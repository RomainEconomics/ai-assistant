/**
 * Batch Questioning API endpoints
 * Allows asking multiple questions to a single document
 */
import { ragSearchFiltered } from "../lib/rag-advanced.ts";
import { getDocumentById, saveBatchQuery } from "../lib/db.ts";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import type { BatchQuestionResult } from "../types/database.ts";
import { requireAuth } from "../middleware/auth.ts";

/**
 * Handle batch questioning for a single document
 * POST /api/batch-questioning
 *
 * Request body:
 * {
 *   questions: string[] (array of questions)
 *   fileId: number (single document ID)
 *   model?: string (optional, defaults to gpt-4o-mini)
 *   saveHistory?: boolean (optional, defaults to true)
 *   userId?: number (optional, for history)
 * }
 *
 * Response:
 * {
 *   fileId: number
 *   filename: string
 *   results: BatchQuestionResult[]
 *   totalTime: number
 * }
 */
export async function handleBatchQuestioning(req: Request): Promise<Response> {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const body = await req.json();
    const {
      questions,
      fileId,
      model = "gpt-4o-mini",
      saveHistory = true,
    } = body;

    // Validation
    if (!Array.isArray(questions) || questions.length === 0) {
      return Response.json(
        { error: "questions must be a non-empty array" },
        { status: 400 },
      );
    }

    if (!fileId || typeof fileId !== "number") {
      return Response.json(
        { error: "fileId is required and must be a number" },
        { status: 400 },
      );
    }

    if (questions.length > 50) {
      return Response.json(
        { error: "Maximum 50 questions can be asked at once" },
        { status: 400 },
      );
    }

    // Validate all questions are strings and not empty
    for (const q of questions) {
      if (typeof q !== "string" || q.trim().length === 0) {
        return Response.json(
          { error: "All questions must be non-empty strings" },
          { status: 400 },
        );
      }
    }

    console.log(
      `[Batch Questioning] Processing ${questions.length} questions for document ${fileId}`,
    );

    // Get document and verify ownership
    const document = await getDocumentById(fileId);
    if (!document) {
      return Response.json(
        { error: "Document not found" },
        { status: 404 },
      );
    }

    if (document.user_id !== user.id) {
      return Response.json(
        { error: "Access denied" },
        { status: 403 },
      );
    }

    const startTime = Date.now();

    // Process each question
    const results: BatchQuestionResult[] = await Promise.all(
      questions.map(async (question, index) => {
        const questionStartTime = Date.now();

        try {
          // Step 1: Get relevant pages for this question
          const pages = await ragSearchFiltered(question, [fileId], 5);

          if (pages.length === 0) {
            return {
              question,
              answer: "No relevant content found in this document for this question.",
              sources: [],
              processingTime: Date.now() - questionStartTime,
            };
          }

          // Step 2: Build context from retrieved pages
          const context = pages
            .map(
              (page, idx) =>
                `[Source ${idx + 1} - Page ${page.page}]\n${page.content}`,
            )
            .join("\n\n---\n\n");

          // Step 3: Generate AI answer
          const aiModel = model.startsWith("claude")
            ? anthropic(model)
            : openai(model);

          const prompt = `You are a helpful assistant analyzing a document. Answer the following question based ONLY on the provided context. If the context doesn't contain enough information to answer the question, say so clearly.

Question: ${question}

Context from document "${document.filename}":
${context}

Please provide a clear, concise answer. Cite specific page numbers when relevant.`;

          const result = await generateText({
            model: aiModel,
            prompt,
            temperature: 0.3,
            maxTokens: 2000,
          });

          const answer = result.text;

          console.log(
            `[Batch Questioning] Question ${index + 1}/${questions.length} completed`,
          );

          return {
            question,
            answer,
            sources: pages.map((page) => ({
              page: page.page,
              content: page.content.substring(0, 500) + "...", // Truncate for response size
            })),
            processingTime: Date.now() - questionStartTime,
          };
        } catch (error: any) {
          console.error(
            `[Batch Questioning] Failed to process question ${index + 1}:`,
            error,
          );
          return {
            question,
            answer: `Error processing question: ${error.message}`,
            sources: [],
            processingTime: Date.now() - questionStartTime,
          };
        }
      }),
    );

    const totalTime = Date.now() - startTime;
    console.log(`[Batch Questioning] Completed in ${totalTime}ms`);

    // Step 4: Save to history (optional)
    if (saveHistory) {
      try {
        await saveBatchQuery(user.id, fileId, questions, results);
        console.log(`[Batch Questioning] Saved to history for user ${user.id}`);
      } catch (error) {
        console.error("[Batch Questioning] Failed to save history:", error);
        // Don't fail the request if history save fails
      }
    }

    return Response.json({
      fileId,
      filename: document.filename,
      results,
      totalTime,
    });
  } catch (error: any) {
    console.error("[Batch Questioning] Request failed:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Get batch questioning history for the authenticated user
 * GET /api/batch-questioning/history?limit=:limit
 */
export async function handleGetBatchQuestioningHistory(
  req: Request,
): Promise<Response> {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const { getUserBatchQuestioningHistory } = await import("../lib/db.ts");
    const history = await getUserBatchQuestioningHistory(user.id, limit);

    // Parse JSON fields
    const parsedHistory = history.map((item: any) => ({
      id: item.id,
      fileId: item.file_id,
      filename: item.filename,
      questions: JSON.parse(item.questions),
      results: JSON.parse(item.results),
      createdAt: item.created_at,
    }));

    return Response.json({ history: parsedHistory });
  } catch (error: any) {
    console.error("[Batch Questioning] Failed to get history:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Delete a batch query from history
 * DELETE /api/batch-questioning/history/:id
 */
export async function handleDeleteBatchQuestioningHistory(
  req: Request,
): Promise<Response> {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const id = parseInt(pathParts[pathParts.length - 1]);

    if (!id || isNaN(id)) {
      return Response.json({ error: "Valid id is required" }, { status: 400 });
    }

    // Verify ownership before deleting
    const { getBatchQuestioningById, deleteBatchQuestioning } = await import("../lib/db.ts");
    const query = await getBatchQuestioningById(id);

    if (!query) {
      return Response.json({ error: "Query not found" }, { status: 404 });
    }

    if (query.user_id !== user.id) {
      return Response.json({ error: "Access denied" }, { status: 403 });
    }

    await deleteBatchQuestioning(id);

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("[Batch Questioning] Failed to delete history:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Export batch questioning results to various formats
 * POST /api/batch-questioning/export?format=json|md|docx|pdf
 *
 * Request body (JSON):
 * {
 *   filename: string
 *   fileId: number
 *   results: BatchQuestionResult[]
 *   totalTime: number
 * }
 */
export async function handleExportBatchQuestioning(
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

    // Get export data from request body
    const body = await req.json();
    const { filename, fileId, results, totalTime } = body;

    if (!filename || !fileId || !results || !Array.isArray(results)) {
      return Response.json(
        { error: "filename, fileId, and results array are required" },
        { status: 400 },
      );
    }

    const exportData = {
      filename,
      fileId,
      results,
      totalTime: totalTime || 0,
      createdAt: new Date().toISOString(),
    };

    // Import export utilities
    const {
      exportBatchQuestioningToJSON,
      exportBatchQuestioningToMarkdown,
      exportBatchQuestioningToDOCX,
      exportBatchQuestioningToPDF,
      generateBatchQuestioningExportFilename,
    } = await import("../lib/export-utils.ts");

    const exportFilename = generateBatchQuestioningExportFilename(filename, format);

    let buffer: Buffer;
    let contentType: string;

    // Generate export based on format
    switch (format) {
      case "json":
        buffer = Buffer.from(exportBatchQuestioningToJSON(exportData));
        contentType = "application/json";
        break;

      case "md":
        buffer = Buffer.from(exportBatchQuestioningToMarkdown(exportData));
        contentType = "text/markdown";
        break;

      case "docx":
        buffer = await exportBatchQuestioningToDOCX(exportData);
        contentType =
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        break;

      case "pdf":
        buffer = exportBatchQuestioningToPDF(exportData);
        contentType = "application/pdf";
        break;

      default:
        return Response.json({ error: "Invalid format" }, { status: 400 });
    }

    // Return file download
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${exportFilename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("[Batch Questioning] Export failed:", error);
    return Response.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
