/**
 * PDF processing worker
 * Handles PDF text extraction, chunking, and Weaviate indexing in a separate thread
 */

// Declare self for TypeScript
declare var self: Worker;

import { v5 as uuidv5, v4 as uuidv4 } from "uuid";
import { PDFProcessor } from "../lib/pdf-processor.ts";
import { getWeaviateClient } from "../lib/weaviate.ts";
import { WeaviateCollection } from "../types/weaviate.ts";
import type { ParentDocument, ChildDocument } from "../types/weaviate.ts";
import { uploadPDFToS3 } from "../lib/s3-storage.ts";
import {
  PARENT_BATCH_SIZE,
  CHILD_BATCH_SIZE,
  BATCH_DELAY_MS,
} from "../config/weaviate-batch.ts";

// Namespace UUID for generating deterministic UUIDs
const NAMESPACE_UUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // DNS namespace

/**
 * Message types for worker communication
 */
export interface ProcessPDFMessage {
  type: "process_pdf";
  data: {
    fileId: number;
    filename: string;
    pdfBuffer: ArrayBuffer;
    fileSlug: string;
    companyId?: number;
    companyName?: string;
    reportType?: string;
    reportingYear?: number;
    path?: string;
  };
}

export interface ProcessPDFResult {
  type: "result" | "error" | "progress";
  data: {
    success: boolean;
    fileId: number;
    pagesProcessed?: number;
    chunksCreated?: number;
    chunksInserted?: number;
    chunksFailed?: number;
    message?: string;
    error?: string;
    progress?: number;
    s3Key?: string;
    s3Url?: string;
  };
}

/**
 * Generate deterministic UUID v5 from object
 */
function generateUUID(data: Record<string, any>): string {
  const dataString = JSON.stringify(data, Object.keys(data).sort());
  return uuidv5(dataString, NAMESPACE_UUID);
}

/**
 * Process PDF file and store in Weaviate
 */
async function processPDFFile(
  message: ProcessPDFMessage["data"],
): Promise<ProcessPDFResult["data"]> {
  const {
    fileId,
    filename,
    pdfBuffer,
    fileSlug,
    companyId,
    companyName,
    reportType,
    reportingYear,
    path,
  } = message;

  try {
    console.log(
      `[Worker] Starting PDF processing for file_id=${fileId}, filename=${filename}`,
    );

    // Send progress update
    self.postMessage({
      type: "progress",
      data: {
        success: true,
        fileId,
        message: "Extracting text from PDF",
        progress: 10,
      },
    } satisfies ProcessPDFResult);

    // Initialize PDF processor
    const processor = new PDFProcessor();

    // Convert ArrayBuffer to Buffer for pdf-parse
    const buffer = Buffer.from(pdfBuffer);

    // Extract text from PDF
    const pagesText = await processor.extractTextFromPDF(buffer);

    if (pagesText.length === 0) {
      console.warn(`[Worker] No text extracted from PDF ${filename}`);
      return {
        success: false,
        fileId,
        message: "No text found in PDF",
      };
    }

    // Upload PDF to S3 before processing
    self.postMessage({
      type: "progress",
      data: {
        success: true,
        fileId,
        message: "Uploading PDF to S3",
        progress: 20,
      },
    } satisfies ProcessPDFResult);

    const s3Result = await uploadPDFToS3(filename, buffer, {
      fileId,
      companyId,
      companyName,
      reportingYear,
    });

    if (!s3Result.success) {
      console.error(`[Worker] Failed to upload PDF to S3: ${s3Result.error}`);
      return {
        success: false,
        fileId,
        message: `S3 upload failed: ${s3Result.error}`,
        error: s3Result.error,
      };
    }

    console.log(`[Worker] Uploaded to S3: ${s3Result.key}`);

    // Send progress update
    self.postMessage({
      type: "progress",
      data: {
        success: true,
        fileId,
        message: `Extracted ${pagesText.length} pages, creating chunks`,
        progress: 30,
      },
    } satisfies ProcessPDFResult);

    // Connect to Weaviate
    const weaviateClient = await getWeaviateClient();

    try {
      // Get collections
      const parentCollection = weaviateClient.collections.get(
        WeaviateCollection.PARENT_CLASS,
      );
      const childCollection = weaviateClient.collections.get(
        WeaviateCollection.CHILD_CLASS,
      );

      // Prepare batch data
      const parentObjects: Array<{ uuid: string; properties: ParentDocument }> =
        [];
      const childObjects: Array<{
        uuid: string;
        properties: ChildDocument;
        references: { parent_page: string };
      }> = [];

      let totalChunks = 0;

      console.log(
        `[Worker] Processing ${pagesText.length} pages for file_id=${fileId}`,
      );

      // Process each page
      for (const [pageText, pageNumber] of pagesText) {
        const parentData: ParentDocument = {
          content: pageText,
          path: s3Result.key, // Use S3 key as path
          company_id: companyId || -1,
          company_name: companyName || "",
          report_type: reportType || "",
          page: pageNumber,
          filename,
          file_id: fileId,
          file_slug: fileSlug,
          reporting_year: reportingYear || -1,
        };

        const parentUuid = generateUUID(parentData);
        parentObjects.push({ uuid: parentUuid, properties: parentData });

        // Create child documents (chunks)
        const chunks = processor.chunkText(pageText, pageNumber);

        for (const chunk of chunks) {
          const childData: ChildDocument = {
            content: chunk.content,
            path: s3Result.key, // Use S3 key as path
            company_id: companyId || -1,
            company_name: companyName || "",
            report_type: reportType || "",
            page: pageNumber,
            filename,
            file_id: fileId,
            file_slug: fileSlug,
            reporting_year: reportingYear || -1,
          };

          const childUuid = generateUUID(childData);

          childObjects.push({
            uuid: childUuid,
            properties: childData,
            references: { parent_page: parentUuid },
          });

          totalChunks++;
        }
      }

      // Send progress update
      self.postMessage({
        type: "progress",
        data: {
          success: true,
          fileId,
          message: `Created ${totalChunks} chunks, inserting into Weaviate`,
          progress: 50,
        },
      } satisfies ProcessPDFResult);

      // Batch insert parent documents with reasonable batch size
      let parentFailed = 0;

      if (parentObjects.length > 0) {
        console.log(
          `[Worker] Batch inserting ${parentObjects.length} parent documents in batches of ${PARENT_BATCH_SIZE}`,
        );

        // Split into smaller batches
        for (let i = 0; i < parentObjects.length; i += PARENT_BATCH_SIZE) {
          const batch = parentObjects.slice(i, i + PARENT_BATCH_SIZE);
          const batchNumber = Math.floor(i / PARENT_BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(
            parentObjects.length / PARENT_BATCH_SIZE,
          );

          console.log(
            `[Worker] Inserting parent batch ${batchNumber}/${totalBatches} (${batch.length} pages)`,
          );

          try {
            const response = await parentCollection.data.insertMany(
              batch.map((obj) => ({
                properties: obj.properties,
                id: obj.uuid,
              })),
            );

            // Check if there were any errors
            if (response.errors) {
              const batchFailed = Object.keys(response.errors).length;
              parentFailed += batchFailed;
              console.error(
                `[Worker] Failed to insert ${batchFailed} parent documents in batch ${batchNumber}:`,
                response.errors,
              );
            }

            console.log(
              `[Worker] Parent batch ${batchNumber}/${totalBatches}: Inserted ${batch.length - (response.errors ? Object.keys(response.errors).length : 0)}/${batch.length} pages`,
            );

            // Update progress
            const progressPercent =
              50 + Math.floor(((i + batch.length) / parentObjects.length) * 25);
            self.postMessage({
              type: "progress",
              data: {
                success: true,
                fileId,
                message: `Inserting pages: batch ${batchNumber}/${totalBatches}`,
                progress: progressPercent,
              },
            } satisfies ProcessPDFResult);

            // Add delay between batches if configured
            if (BATCH_DELAY_MS > 0 && batchNumber < totalBatches) {
              await new Promise((resolve) =>
                setTimeout(resolve, BATCH_DELAY_MS),
              );
            }
          } catch (error) {
            console.error(
              `[Worker] Failed to insert parent batch ${batchNumber}/${totalBatches}:`,
              error,
            );
            parentFailed += batch.length;
          }
        }

        console.log(
          `[Worker] Inserted ${parentObjects.length - parentFailed}/${parentObjects.length} parent documents (${parentFailed} failures)`,
        );
      }

      // Send progress update
      self.postMessage({
        type: "progress",
        data: {
          success: true,
          fileId,
          message: `Inserted parent pages, inserting child chunks`,
          progress: 75,
        },
      } satisfies ProcessPDFResult);

      // Batch insert child documents with smaller batch size to avoid OpenAI token limits
      // OpenAI has a 300k token limit per request (~225k words or ~200-250 chunks)
      let childFailed = 0;

      if (childObjects.length > 0) {
        console.log(
          `[Worker] Batch inserting ${childObjects.length} child documents in batches of ${CHILD_BATCH_SIZE}`,
        );

        // Split into smaller batches
        for (let i = 0; i < childObjects.length; i += CHILD_BATCH_SIZE) {
          const batch = childObjects.slice(i, i + CHILD_BATCH_SIZE);
          const batchNumber = Math.floor(i / CHILD_BATCH_SIZE) + 1;
          const totalBatches = Math.ceil(
            childObjects.length / CHILD_BATCH_SIZE,
          );

          console.log(
            `[Worker] Inserting child batch ${batchNumber}/${totalBatches} (${batch.length} chunks)`,
          );

          try {
            const response = await childCollection.data.insertMany(
              batch.map((obj) => ({
                properties: obj.properties,
                id: obj.uuid,
                references: obj.references,
              })),
            );

            // Check if there were any errors
            if (response.errors) {
              const batchFailed = Object.keys(response.errors).length;
              childFailed += batchFailed;
              console.error(
                `[Worker] Failed to insert ${batchFailed} child documents in batch ${batchNumber}:`,
                response.errors,
              );
            }

            console.log(
              `[Worker] Child batch ${batchNumber}/${totalBatches}: Inserted ${batch.length - (response.errors ? Object.keys(response.errors).length : 0)}/${batch.length} chunks`,
            );

            // Update progress
            const progressPercent =
              75 + Math.floor(((i + batch.length) / childObjects.length) * 20);
            self.postMessage({
              type: "progress",
              data: {
                success: true,
                fileId,
                message: `Inserting chunks: batch ${batchNumber}/${totalBatches}`,
                progress: progressPercent,
              },
            } satisfies ProcessPDFResult);

            // Add delay between batches if configured
            if (BATCH_DELAY_MS > 0 && batchNumber < totalBatches) {
              await new Promise((resolve) =>
                setTimeout(resolve, BATCH_DELAY_MS),
              );
            }
          } catch (error) {
            console.error(
              `[Worker] Failed to insert child batch ${batchNumber}/${totalBatches}:`,
              error,
            );
            childFailed += batch.length;
          }
        }

        console.log(
          `[Worker] Inserted ${childObjects.length - childFailed}/${childObjects.length} child documents (${childFailed} failures)`,
        );
      }

      const totalFailed = parentFailed + childFailed;
      const totalExpected = parentObjects.length + childObjects.length;

      // Send final result
      const result: ProcessPDFResult["data"] = {
        success: totalFailed === 0,
        fileId,
        pagesProcessed: pagesText.length,
        chunksCreated: totalChunks,
        s3Key: s3Result.key,
        s3Url: s3Result.url,
        chunksInserted: totalExpected - totalFailed,
        chunksFailed: totalFailed,
        message:
          totalFailed === 0
            ? "PDF processed successfully"
            : `PDF processed with ${totalFailed} insertion failures`,
      };

      console.log(
        `[Worker] Completed processing: ${pagesText.length} pages, ${totalChunks} chunks`,
      );

      return result;
    } finally {
      await weaviateClient.close();
    }
  } catch (error: any) {
    console.error(`[Worker] Failed to process PDF ${filename}:`, error);
    return {
      success: false,
      fileId,
      error: error?.message || String(error),
      message: "PDF processing failed",
    };
  }
}

/**
 * Worker message handler
 */
self.onmessage = async (event: MessageEvent<ProcessPDFMessage>) => {
  const { type, data } = event.data;

  if (type === "process_pdf") {
    try {
      const result = await processPDFFile(data);

      self.postMessage({
        type: "result",
        data: result,
      } satisfies ProcessPDFResult);
    } catch (error: any) {
      self.postMessage({
        type: "error",
        data: {
          success: false,
          fileId: data.fileId,
          error: error?.message || String(error),
          message: "Worker error",
        },
      } satisfies ProcessPDFResult);
    }
  }
};

console.log("[Worker] PDF processing worker initialized");
