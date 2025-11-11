import type { ServerRequest } from "bun";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import * as dbQueries from "@/lib/db";
import type { ChatStreamRequest } from "@/types/api";
import { ragSearch } from "@/lib/weaviate";
import { requireAuth } from "@/middleware/auth";
import { verifyConversationOwnership } from "@/middleware/ownership";

export async function handleChatStream(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const body = (await req.json()) as ChatStreamRequest;

    if (!body.conversation_id || !body.message || !body.model_provider || !body.model_name) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify conversation ownership
    const conversation = await verifyConversationOwnership(body.conversation_id, user.id);
    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Save user message
    await dbQueries.createMessage(body.conversation_id, "user", body.message);

    // Get conversation history
    const messages = await dbQueries.getMessagesByConversation(body.conversation_id);

    // Auto-generate title from first message if this is the first user message
    if (messages.length === 1 && messages[0].role === "user") {
      const title = body.message.length > 50
        ? body.message.substring(0, 50) + "..."
        : body.message;
      await dbQueries.updateConversationTitle(body.conversation_id, title);
    }

    // Fetch conversation documents and perform RAG search
    const conversationDocs = await dbQueries.getConversationDocuments(body.conversation_id);
    let documentContext = "";
    const usedDocuments: Array<{ document_id: number; page_numbers: number[] }> = [];

    if (conversationDocs.length > 0) {
      console.log(`[Chat] Performing RAG search across ${conversationDocs.length} attached documents`);

      try {
        // Extract document IDs for RAG search
        const documentIds = conversationDocs.map(doc => doc.document_id);

        // Perform RAG search using user's message as query
        const relevantPages = await ragSearch(body.message, documentIds, 5);

        if (relevantPages.length > 0) {
          documentContext = "\n\n--- DOCUMENT CONTEXT ---\n\n";
          documentContext += "The following document pages were found to be most relevant to your question:\n\n";

          relevantPages.forEach((page) => {
            documentContext += `## Document: ${page.filename} (Page ${page.page})\n\n`;
            documentContext += `${page.content}\n\n`;
            documentContext += "---\n\n";
          });

          documentContext += "Please use the above document content to answer questions accurately. Cite specific pages when referencing information from the documents.\n\n";
          documentContext += "--- END DOCUMENT CONTEXT ---\n\n";

          // Group pages by document for tracking
          const pagesByDocument = new Map<number, number[]>();
          relevantPages.forEach((page) => {
            const existing = pagesByDocument.get(page.file_id) || [];
            existing.push(page.page);
            pagesByDocument.set(page.file_id, existing);
          });

          // Convert to array for message sources
          pagesByDocument.forEach((pages, docId) => {
            usedDocuments.push({
              document_id: docId,
              page_numbers: pages.sort((a, b) => a - b),
            });
          });

          console.log(`[Chat] RAG retrieved ${relevantPages.length} pages from ${usedDocuments.length} documents`);
        } else {
          console.log(`[Chat] No relevant pages found for query: "${body.message.substring(0, 100)}..."`);
        }
      } catch (error) {
        console.error(`[Chat] RAG search failed:`, error);
        // Continue without context if RAG fails
      }
    }

    // Prepare messages for AI
    const conversationMessages = messages.map((msg) => ({
      role: msg.role === "system" ? "system" : msg.role,
      content: msg.content,
    })) as any;

    // If we have document context, prepend it as a system message
    if (documentContext) {
      conversationMessages.unshift({
        role: "system",
        content: documentContext,
      });
    }

    // Select the appropriate model
    let model;
    if (body.model_provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return Response.json({ error: "OpenAI API key not configured" }, { status: 500 });
      }
      model = openai(body.model_name);
    } else if (body.model_provider === "anthropic") {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return Response.json({ error: "Anthropic API key not configured" }, { status: 500 });
      }
      model = anthropic(body.model_name);
    } else {
      return Response.json({ error: "Invalid model provider" }, { status: 400 });
    }

    // Stream the response using streamText
    const result = streamText({
      model,
      messages: conversationMessages,
      temperature: 0.7,
      maxOutputTokens: 2000,
    });

    // Create a custom streaming response
    const encoder = new TextEncoder();
    let fullText = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const part of result.textStream) {
            fullText += part;
            // Send text chunks in AI SDK data stream format
            const data = `0:${JSON.stringify(part)}\n`;
            controller.enqueue(encoder.encode(data));
          }

          // Save the complete assistant message to the database
          if (fullText) {
            const assistantMessage = await dbQueries.createMessage(body.conversation_id, "assistant", fullText);

            // Save message sources if documents were used
            if (usedDocuments.length > 0) {
              console.log(`[Chat] Saving ${usedDocuments.length} document sources for message ${assistantMessage.id}`);
              await Promise.all(
                usedDocuments.map((doc) =>
                  dbQueries.addMessageSource(
                    assistantMessage.id,
                    doc.document_id,
                    doc.page_numbers
                  )
                )
              );
            }
          }

          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Error in chat stream:", error);
    return Response.json(
      { error: `Failed to process chat request: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

export async function handleSaveAssistantMessage(req: ServerRequest) {
  try {
    const body = await req.json();

    if (!body.conversation_id || !body.content) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const message = await dbQueries.createMessage(
      body.conversation_id,
      "assistant",
      body.content
    );

    return Response.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Error saving assistant message:", error);
    return Response.json({ error: "Failed to save message" }, { status: 500 });
  }
}

export async function handleGetModels() {
  const { AI_MODELS } = await import("@/types/api");

  return Response.json({
    models: [
      {
        provider: "openai",
        models: AI_MODELS.openai,
      },
      {
        provider: "anthropic",
        models: AI_MODELS.anthropic,
      },
    ],
  });
}

export async function handleDeleteMessage(req: ServerRequest) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return Response.json({ error: "Invalid message ID" }, { status: 400 });
    }

    await dbQueries.deleteMessage(id);
    return Response.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error deleting message:", error);
    return Response.json({ error: "Failed to delete message" }, { status: 500 });
  }
}

export async function handleUpdateMessage(req: ServerRequest) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return Response.json({ error: "Invalid message ID" }, { status: 400 });
    }

    const body = await req.json();

    if (!body.content) {
      return Response.json({ error: "Content is required" }, { status: 400 });
    }

    const message = await dbQueries.updateMessage(id, body.content);
    return Response.json({ message }, { status: 200 });
  } catch (error) {
    console.error("Error updating message:", error);
    return Response.json({ error: "Failed to update message" }, { status: 500 });
  }
}
