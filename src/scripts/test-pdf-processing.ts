/**
 * Test script for PDF processing with Worker
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { v4 as uuidv4 } from "uuid";
import type {
  ProcessPDFMessage,
  ProcessPDFResult,
} from "../workers/pdf-worker.ts";

async function testPDFProcessing() {
  console.log("=".repeat(60));
  console.log("Testing PDF Processing with Worker");
  console.log("=".repeat(60));

  try {
    // Read the sample PDF
    const pdfPath = resolve(process.cwd(), "assoy_sr_2022_sample.pdf");
    console.log(`\nReading PDF: ${pdfPath}`);

    const pdfBuffer = readFileSync(pdfPath);
    console.log(`✓ Read ${pdfBuffer.length} bytes`);

    // Create a worker
    console.log("\nCreating PDF processing worker...");
    const worker = new Worker(
      new URL("../workers/pdf-worker.ts", import.meta.url).href
    );
    console.log("✓ Worker created");

    // Set up message handlers
    return new Promise<void>((resolve, reject) => {
      let progressCount = 0;

      worker.onmessage = (event: MessageEvent<ProcessPDFResult>) => {
        const { type, data } = event.data;

        if (type === "progress") {
          progressCount++;
          console.log(
            `\n[Progress ${progressCount}] ${data.message} (${data.progress}%)`
          );
        } else if (type === "result") {
          console.log("\n" + "=".repeat(60));
          console.log("Processing Result:");
          console.log("=".repeat(60));
          console.log(`Success: ${data.success ? "✓" : "❌"}`);
          console.log(`File ID: ${data.fileId}`);
          console.log(`Pages Processed: ${data.pagesProcessed}`);
          console.log(`Chunks Created: ${data.chunksCreated}`);
          console.log(`Chunks Inserted: ${data.chunksInserted}`);
          console.log(`Chunks Failed: ${data.chunksFailed}`);
          console.log(`Message: ${data.message}`);
          console.log("=".repeat(60));

          worker.terminate();

          if (data.success) {
            console.log("\n✓ All tests passed!");
            resolve();
          } else {
            reject(new Error(data.message || "Processing failed"));
          }
        } else if (type === "error") {
          console.error("\n❌ Worker error:");
          console.error(data.error);
          worker.terminate();
          reject(new Error(data.error || "Worker error"));
        }
      };

      worker.onerror = (error) => {
        console.error("\n❌ Worker error event:");
        console.error(error);
        worker.terminate();
        reject(error);
      };

      // Send processing message
      console.log("\nSending PDF to worker for processing...");
      const message: ProcessPDFMessage = {
        type: "process_pdf",
        data: {
          fileId: 1,
          filename: "assoy_sr_2022_sample.pdf",
          pdfBuffer: pdfBuffer.buffer.slice(
            pdfBuffer.byteOffset,
            pdfBuffer.byteOffset + pdfBuffer.byteLength
          ),
          fileSlug: uuidv4(),
          companyId: 1,
          companyName: "Assoy SA",
          reportType: "Sustainability Report",
          reportingYear: 2022,
          path: "/documents/assoy_sr_2022_sample.pdf",
        },
      };

      worker.postMessage(message);
    });
  } catch (error: any) {
    console.error("\n❌ Test failed:");
    console.error(error);

    if (error.message?.includes("ENOENT")) {
      console.error("\nMake sure the sample PDF exists:");
      console.error("  assoy_sr_2022_sample.pdf");
    } else if (error.message?.includes("ECONNREFUSED")) {
      console.error("\nMake sure Weaviate is running:");
      console.error("  docker-compose up -d weaviate");
    } else if (error.message?.includes("OpenAI")) {
      console.error("\nMake sure OPENAI_API_KEY is set in your .env file");
    }

    process.exit(1);
  }
}

// Run the test
testPDFProcessing();
