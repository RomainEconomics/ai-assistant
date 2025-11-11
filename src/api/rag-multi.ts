/**
 * Multi-document RAG API endpoints
 * Allows querying multiple documents simultaneously and comparing results
 */
import { ragSearchMultiDoc } from "../lib/rag-advanced.ts";
import { saveMultiDocQuery, getDocumentById } from "../lib/db.ts";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import type { MultiDocQueryResult } from "../types/database.ts";
import { requireAuth } from "../middleware/auth.ts";

/**
 * Handle multi-document query
 * POST /api/rag/multi-doc-query
 *
 * Request body:
 * {
 *   question: string
 *   fileIds: number[]
 *   model?: string (optional, defaults to gpt-4o-mini)
 *   saveHistory?: boolean (optional, defaults to true)
 *   userId?: number (optional, for history)
 * }
 *
 * Response:
 * {
 *   question: string
 *   results: MultiDocQueryResult[]
 * }
 */
export async function handleMultiDocQuery(req: Request): Promise<Response> {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const body = await req.json();
    const {
      question,
      fileIds,
      model = "gpt-4o-mini",
      saveHistory = true,
    } = body;

    // Validation
    if (!question || typeof question !== "string") {
      return Response.json(
        { error: "Question is required and must be a string" },
        { status: 400 },
      );
    }

    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return Response.json(
        { error: "fileIds must be a non-empty array" },
        { status: 400 },
      );
    }

    if (fileIds.length > 10) {
      return Response.json(
        { error: "Maximum 10 documents can be queried at once" },
        { status: 400 },
      );
    }

    // Verify user owns all documents
    for (const fileId of fileIds) {
      const doc = await getDocumentById(fileId);
      if (!doc || doc.user_id !== user.id) {
        return Response.json(
          { error: `Document ${fileId} not found or access denied` },
          { status: 403 },
        );
      }
    }

    console.log(
      `[Multi-Doc API] Processing query for ${fileIds.length} documents`,
    );
    console.log(`[Multi-Doc API] Question: "${question.substring(0, 100)}..."`);

    const startTime = Date.now();

    // Step 1: Get relevant pages for each document
    const ragResults = await ragSearchMultiDoc(question, fileIds, 5);

    // Step 2: Generate AI answers for each document
    const results: MultiDocQueryResult[] = await Promise.all(
      ragResults.map(async (docResult) => {
        const docStartTime = Date.now();

        if (docResult.error || docResult.pages.length === 0) {
          return {
            fileId: docResult.fileId,
            filename: docResult.filename,
            answer:
              docResult.error || "No relevant content found in this document.",
            sources: [],
            processingTime: Date.now() - docStartTime,
          };
        }

        try {
          // Build context from retrieved pages
          const context = docResult.pages
            .map(
              (page, idx) =>
                `[Source ${idx + 1} - Page ${page.page}]\n${page.content}`,
            )
            .join("\n\n---\n\n");

          // Generate AI answer
          const aiModel = model.startsWith("claude")
            ? anthropic(model)
            : openai(model);

          const prompt = `You are a helpful assistant analyzing a document. Answer the following question based ONLY on the provided context. If the context doesn't contain enough information to answer the question, say so clearly.

Question: ${question}

Context from document "${docResult.filename}":
${context}

Please provide a clear, concise answer. Cite specific page numbers when relevant.`;

          const result = await generateText({
            model: aiModel,
            prompt,
            temperature: 0.3,
            maxOutputTokens: 2000,
          });

          const answer = result.text;

          return {
            fileId: docResult.fileId,
            filename: docResult.filename,
            answer,
            sources: docResult.pages.map((page) => ({
              page: page.page,
              content: page.content.substring(0, 500) + "...", // Truncate for response size
            })),
            processingTime: Date.now() - docStartTime,
          };
        } catch (error: any) {
          console.error(
            `[Multi-Doc API] Failed to generate answer for document ${docResult.fileId}:`,
            error,
          );
          return {
            fileId: docResult.fileId,
            filename: docResult.filename,
            answer: `Error generating answer: ${error.message}`,
            sources: [],
            processingTime: Date.now() - docStartTime,
          };
        }
      }),
    );

    const totalTime = Date.now() - startTime;
    console.log(`[Multi-Doc API] Completed in ${totalTime}ms`);

    // Step 3: Save to history (optional)
    if (saveHistory) {
      try {
        await saveMultiDocQuery(user.id, question, fileIds, results);
        console.log(`[Multi-Doc API] Saved to history for user ${user.id}`);
      } catch (error) {
        console.error("[Multi-Doc API] Failed to save history:", error);
        // Don't fail the request if history save fails
      }
    }

    return Response.json({
      question,
      results,
      totalTime,
    });
  } catch (error: any) {
    console.error("[Multi-Doc API] Request failed:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Get multi-doc query history for the authenticated user
 * GET /api/rag/multi-doc-history?limit=:limit
 */
export async function handleGetMultiDocHistory(
  req: Request,
): Promise<Response> {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const { getUserMultiDocQueries } = await import("../lib/db.ts");
    const history = await getUserMultiDocQueries(user.id, limit);

    // Parse JSON fields
    const parsedHistory = history.map((item: any) => ({
      id: item.id,
      question: item.question,
      documentIds: JSON.parse(item.document_ids),
      results: JSON.parse(item.results),
      createdAt: item.created_at,
    }));

    return Response.json({ history: parsedHistory });
  } catch (error: any) {
    console.error("[Multi-Doc API] Failed to get history:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Delete a multi-doc query from history
 * DELETE /api/rag/multi-doc-history/:id
 */
export async function handleDeleteMultiDocHistory(
  req: Request,
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const id = parseInt(pathParts[pathParts.length - 1]);

    if (!id || isNaN(id)) {
      return Response.json({ error: "Valid id is required" }, { status: 400 });
    }

    const { deleteMultiDocQuery } = await import("../lib/db.ts");
    await deleteMultiDocQuery(id);

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("[Multi-Doc API] Failed to delete history:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Export multi-doc query results to various formats
 * GET /api/rag/multi-doc-export?format=json|md|docx|pdf
 *
 * Request body (JSON):
 * {
 *   question: string
 *   results: MultiDocQueryResult[]
 *   totalTime: number
 * }
 *
 * Or can export from history:
 * GET /api/rag/multi-doc-export/:id?format=json|md|docx|pdf
 */
export async function handleExportMultiDocQuery(
  req: Request,
): Promise<Response> {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const url = new URL(req.url);
    const format = url.searchParams.get("format") as
      | "json"
      | "md"
      | "docx"
      | "pdf"
      | null;

    if (!format || !["json", "md", "docx", "pdf"].includes(format)) {
      return Response.json(
        { error: "Valid format parameter required (json, md, docx, pdf)" },
        { status: 400 },
      );
    }

    // Check if exporting from history (path includes ID)
    const pathParts = url.pathname.split("/");
    const historyId = pathParts[pathParts.length - 1];
    let exportData;

    if (historyId && historyId !== "multi-doc-export" && !isNaN(parseInt(historyId))) {
      // Export from history
      const { getMultiDocQueryById } = await import("../lib/db.ts");
      const historyItem = await getMultiDocQueryById(parseInt(historyId));

      if (!historyItem) {
        return Response.json(
          { error: "History item not found" },
          { status: 404 },
        );
      }

      exportData = {
        question: historyItem.question,
        results: JSON.parse(historyItem.results),
        totalTime: JSON.parse(historyItem.results).reduce(
          (sum: number, r: MultiDocQueryResult) => sum + r.processingTime,
          0,
        ),
        createdAt: historyItem.created_at,
      };
    } else {
      // Export from request body
      const body = await req.json();
      const { question, results, totalTime } = body;

      if (!question || !results || !Array.isArray(results)) {
        return Response.json(
          { error: "question and results array are required" },
          { status: 400 },
        );
      }

      exportData = {
        question,
        results,
        totalTime: totalTime || 0,
        createdAt: new Date().toISOString(),
      };
    }

    // Import export utilities
    const {
      exportMultiDocToJSON,
      exportMultiDocToMarkdown,
      exportMultiDocToDOCX,
      exportMultiDocToPDF,
      generateMultiDocExportFilename,
    } = await import("../lib/export-utils.ts");

    const filename = generateMultiDocExportFilename(exportData.question, format);

    let buffer: Buffer;
    let contentType: string;

    // Generate export based on format
    switch (format) {
      case "json":
        buffer = Buffer.from(exportMultiDocToJSON(exportData));
        contentType = "application/json";
        break;

      case "md":
        buffer = Buffer.from(exportMultiDocToMarkdown(exportData));
        contentType = "text/markdown";
        break;

      case "docx":
        buffer = await exportMultiDocToDOCX(exportData);
        contentType =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        break;

      case "pdf":
        buffer = exportMultiDocToPDF(exportData);
        contentType = "application/pdf";
        break;

      default:
        return Response.json({ error: "Invalid format" }, { status: 400 });
    }

    // Return file download
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("[Multi-Doc API] Export failed:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
