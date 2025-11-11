/**
 * Documents API handlers
 * Handles document upload, listing, and management
 */

import type { Server } from "bun";
import { v4 as uuidv4 } from "uuid";
import {
  getAllDocuments,
  getDocumentById,
  createDocument,
  updateDocumentStatus,
  deleteDocument,
} from "../lib/db";
import type { ProcessPDFMessage, ProcessPDFResult } from "../workers/pdf-worker";
import { requireAuth } from "../middleware/auth";
import { verifyDocumentOwnership } from "../middleware/ownership";

/**
 * GET /api/documents
 * Get all documents for the current user
 */
export async function handleGetDocuments(req: Request, server: Server) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const documents = await getAllDocuments(user.id);
    return Response.json(documents);
  } catch (error: any) {
    console.error("Failed to fetch documents:", error);
    return Response.json(
      { error: "Failed to fetch documents", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/:id
 * Get a specific document by ID
 */
export async function handleGetDocument(req: Request, server: Server) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const url = new URL(req.url);
    const id = parseInt(url.pathname.split("/").pop() || "");

    if (isNaN(id)) {
      return Response.json({ error: "Invalid document ID" }, { status: 400 });
    }

    const document = await verifyDocumentOwnership(id, user.id);

    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    return Response.json(document);
  } catch (error: any) {
    console.error("Failed to fetch document:", error);
    return Response.json(
      { error: "Failed to fetch document", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents/upload
 * Upload a PDF document and start processing
 */
export async function handleUploadDocument(req: Request, server: Server) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const companyId = formData.get("company_id") as string | null;
    const companyName = formData.get("company_name") as string | null;
    const reportType = formData.get("report_type") as string | null;
    const reportingYear = formData.get("reporting_year") as string | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return Response.json({ error: "Only PDF files are supported" }, { status: 400 });
    }

    // Generate unique file slug
    const fileSlug = uuidv4();

    // Create initial document record
    const document = await createDocument(user.id, {
      filename: file.name,
      file_slug: fileSlug,
      s3_key: "", // Will be updated by worker
      s3_url: "", // Will be updated by worker
      file_size: file.size,
      mime_type: file.type,
      company_id: companyId ? parseInt(companyId) : undefined,
      company_name: companyName || undefined,
      report_type: reportType || undefined,
      reporting_year: reportingYear ? parseInt(reportingYear) : undefined,
    });

    // Update status to processing
    await updateDocumentStatus(document.id, "processing");

    // Convert file to ArrayBuffer for worker
    const arrayBuffer = await file.arrayBuffer();

    // Spawn worker to process PDF
    const worker = new Worker(new URL("../workers/pdf-worker.ts", import.meta.url).href);

    // Handle worker messages
    worker.onmessage = async (event: MessageEvent<ProcessPDFResult>) => {
      const { type, data } = event.data;

      if (type === "progress") {
        console.log(`[Document ${document.id}] Progress: ${data.message}`);
      } else if (type === "result") {
        console.log(`[Document ${document.id}] Processing complete:`, data);

        // Update document with results
        if (data.success) {
          await updateDocumentStatus(document.id, "completed", {
            pages_processed: data.pagesProcessed,
            chunks_created: data.chunksCreated,
            s3_key: data.s3Key,
            s3_url: data.s3Url,
          });
        } else {
          await updateDocumentStatus(document.id, "failed", {
            processing_error: data.error || data.message,
          });
        }

        worker.terminate();
      } else if (type === "error") {
        console.error(`[Document ${document.id}] Processing error:`, data.error);

        await updateDocumentStatus(document.id, "failed", {
          processing_error: data.error || "Unknown error",
        });

        worker.terminate();
      }
    };

    worker.onerror = async (error) => {
      console.error(`[Document ${document.id}] Worker error:`, error);

      await updateDocumentStatus(document.id, "failed", {
        processing_error: error.message || "Worker error",
      });

      worker.terminate();
    };

    // Send processing message to worker
    worker.postMessage({
      type: "process_pdf",
      data: {
        fileId: document.id,
        filename: file.name,
        pdfBuffer: arrayBuffer,
        fileSlug,
        companyId: document.company_id || undefined,
        companyName: document.company_name || undefined,
        reportType: document.report_type || undefined,
        reportingYear: document.reporting_year || undefined,
      },
    } satisfies ProcessPDFMessage);

    // Return document immediately (processing happens in background)
    return Response.json({
      success: true,
      document,
      message: "Document uploaded and processing started",
    });
  } catch (error: any) {
    console.error("Failed to upload document:", error);
    return Response.json(
      { error: "Failed to upload document", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/:id
 * Delete a document
 */
export async function handleDeleteDocument(req: Request, server: Server) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const url = new URL(req.url);
    const id = parseInt(url.pathname.split("/").pop() || "");

    if (isNaN(id)) {
      return Response.json({ error: "Invalid document ID" }, { status: 400 });
    }

    // Verify document ownership
    const document = await verifyDocumentOwnership(id, user.id);
    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    // TODO: Delete from S3 and Weaviate

    // Delete from database
    await deleteDocument(id);

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete document:", error);
    return Response.json(
      { error: "Failed to delete document", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/:id/pdf
 * Download/proxy PDF from S3
 */
export async function handleDownloadDocument(req: Request, server: Server) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const id = parseInt(pathParts[pathParts.length - 2] || "");

    if (isNaN(id)) {
      return Response.json({ error: "Invalid document ID" }, { status: 400 });
    }

    // Verify document ownership
    const document = await verifyDocumentOwnership(id, user.id);
    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    // Check if S3 key is available
    if (!document.s3_key) {
      return Response.json({ error: "Document not yet uploaded to storage" }, { status: 404 });
    }

    // Stream PDF directly from S3 using Bun's S3Client file interface
    // This avoids buffering the entire file in memory and starts sending immediately
    const { getS3Credentials } = await import("../lib/s3-storage");
    const { S3Client } = await import("bun");
    const credentials = getS3Credentials();

    // Get S3 file handle (streaming)
    const s3file = S3Client.file(document.s3_key, credentials);

    // Check if file exists
    const exists = await s3file.exists();
    if (!exists) {
      return Response.json({ error: "PDF not found in storage" }, { status: 404 });
    }

    // Get the file as a stream
    const stream = s3file.stream();

    // Return streaming response with appropriate headers
    // Using ReadableStream allows efficient streaming without buffering
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${document.filename}"`,
        "Content-Length": document.file_size.toString(),
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "Accept-Ranges": "bytes", // Enable range requests for seeking
      },
    });
  } catch (error: any) {
    console.error("Failed to download document:", error);
    return Response.json(
      { error: "Failed to download document", details: error?.message },
      { status: 500 }
    );
  }
}
