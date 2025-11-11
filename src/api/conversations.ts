import type { ServerRequest } from "bun";
import * as dbQueries from "@/lib/db";
import type { CreateConversationRequest } from "@/types/api";
import {
  exportToJSON,
  exportToMarkdown,
  exportToDOCX,
  exportToPDF,
  generateExportFilename,
  importFromJSON,
} from "@/lib/export-utils";
import { requireAuth } from "@/middleware/auth";
import { verifyProjectOwnership, verifyConversationOwnership } from "@/middleware/ownership";

export async function handleGetConversations(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const url = new URL(req.url);
    const projectId = url.searchParams.get("project_id");

    if (!projectId) {
      return Response.json({ error: "project_id parameter is required" }, { status: 400 });
    }

    const id = parseInt(projectId);
    if (isNaN(id)) {
      return Response.json({ error: "Invalid project_id" }, { status: 400 });
    }

    // Verify project ownership
    const project = await verifyProjectOwnership(id, user.id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const conversations = await dbQueries.getConversationsByProject(id);
    return Response.json({ conversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return Response.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }
}

export async function handleGetConversation(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return Response.json({ error: "Invalid conversation ID" }, { status: 400 });
    }

    const conversation = await verifyConversationOwnership(id, user.id);
    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Get messages with sources
    const messages = await dbQueries.getMessagesWithSources(id);

    // Get attached documents
    const documents = await dbQueries.getConversationDocuments(id);

    return Response.json({ conversation, messages, documents });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    return Response.json({ error: "Failed to fetch conversation" }, { status: 500 });
  }
}

export async function handleCreateConversation(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const body = (await req.json()) as CreateConversationRequest;

    if (!body.project_id || !body.title || !body.model_provider || !body.model_name) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (body.model_provider !== 'openai' && body.model_provider !== 'anthropic') {
      return Response.json({ error: "Invalid model_provider" }, { status: 400 });
    }

    // Verify project exists and user owns it
    const project = await verifyProjectOwnership(body.project_id, user.id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    const conversation = await dbQueries.createConversation(
      body.project_id,
      body.title.trim(),
      body.model_provider,
      body.model_name
    );

    return Response.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("Error creating conversation:", error);
    return Response.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}

export async function handleUpdateConversation(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return Response.json({ error: "Invalid conversation ID" }, { status: 400 });
    }

    // Verify ownership before update
    const existingConversation = await verifyConversationOwnership(id, user.id);
    if (!existingConversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    const body = await req.json();

    if (!body.title) {
      return Response.json({ error: "Title is required" }, { status: 400 });
    }

    const conversation = await dbQueries.updateConversationTitle(id, body.title.trim());

    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    return Response.json({ conversation });
  } catch (error) {
    console.error("Error updating conversation:", error);
    return Response.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}

export async function handleDeleteConversation(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return Response.json({ error: "Invalid conversation ID" }, { status: 400 });
    }

    // Verify ownership before deletion
    const conversation = await verifyConversationOwnership(id, user.id);
    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    await dbQueries.deleteConversation(id);
    return Response.json({ message: "Conversation deleted successfully" });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return Response.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}

// Conversation Documents handlers

export async function handleGetConversationDocuments(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return Response.json({ error: "Invalid conversation ID" }, { status: 400 });
    }

    // Verify ownership
    const conversation = await verifyConversationOwnership(id, user.id);
    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    const documents = await dbQueries.getConversationDocuments(id);
    return Response.json({ documents });
  } catch (error) {
    console.error("Error fetching conversation documents:", error);
    return Response.json({ error: "Failed to fetch conversation documents" }, { status: 500 });
  }
}

export async function handleAddDocumentToConversation(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const conversationId = parseInt(req.params.id);
    if (isNaN(conversationId)) {
      return Response.json({ error: "Invalid conversation ID" }, { status: 400 });
    }

    const body = await req.json();
    const { document_id } = body;

    if (!document_id) {
      return Response.json({ error: "document_id is required" }, { status: 400 });
    }

    // Verify conversation ownership
    const conversation = await verifyConversationOwnership(conversationId, user.id);
    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    // Verify document exists and is completed
    const document = await dbQueries.getDocumentById(document_id);
    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.processing_status !== 'completed') {
      return Response.json({ error: "Document must be fully processed before attaching" }, { status: 400 });
    }

    // Add document to conversation (RAG will find relevant pages automatically)
    await dbQueries.addDocumentToConversation(conversationId, document_id);

    return Response.json({ success: true }, { status: 201 });
  } catch (error: any) {
    console.error("Error adding document to conversation:", error);

    // Handle unique constraint violation
    if (error.message?.includes('UNIQUE constraint')) {
      return Response.json({ error: "Document already attached to this conversation" }, { status: 409 });
    }

    return Response.json({ error: "Failed to add document to conversation" }, { status: 500 });
  }
}

export async function handleRemoveDocumentFromConversation(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const conversationId = parseInt(req.params.id);
    const documentId = parseInt(req.params.documentId);

    if (isNaN(conversationId) || isNaN(documentId)) {
      return Response.json({ error: "Invalid conversation or document ID" }, { status: 400 });
    }

    // Verify conversation ownership
    const conversation = await verifyConversationOwnership(conversationId, user.id);
    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    await dbQueries.removeDocumentFromConversation(conversationId, documentId);
    return Response.json({ success: true });
  } catch (error) {
    console.error("Error removing document from conversation:", error);
    return Response.json({ error: "Failed to remove document from conversation" }, { status: 500 });
  }
}

// Export/Import handlers

export async function handleExportConversation(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const id = parseInt(req.params.id);
    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "json";

    if (isNaN(id)) {
      return Response.json({ error: "Invalid conversation ID" }, { status: 400 });
    }

    if (!["json", "md", "docx", "pdf"].includes(format)) {
      return Response.json({ error: "Invalid format. Supported: json, md, docx, pdf" }, { status: 400 });
    }

    // Verify conversation ownership
    const conversation = await verifyConversationOwnership(id, user.id);
    if (!conversation) {
      return Response.json({ error: "Conversation not found" }, { status: 404 });
    }

    const messages = await dbQueries.getMessagesByConversation(id);

    const conversationWithMessages = {
      ...conversation,
      messages,
    };

    // Generate content based on format
    let content: string | Buffer;
    let contentType: string;

    switch (format) {
      case "json":
        content = exportToJSON(conversationWithMessages);
        contentType = "application/json";
        break;
      case "md":
        content = exportToMarkdown(conversationWithMessages);
        contentType = "text/markdown";
        break;
      case "docx":
        content = await exportToDOCX(conversationWithMessages);
        contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        break;
      case "pdf":
        content = exportToPDF(conversationWithMessages);
        contentType = "application/pdf";
        break;
      default:
        return Response.json({ error: "Invalid format" }, { status: 400 });
    }

    const filename = generateExportFilename(conversationWithMessages, format as any);

    return new Response(content, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error exporting conversation:", error);
    return Response.json({ error: "Failed to export conversation" }, { status: 500 });
  }
}

export async function handleImportConversation(req: ServerRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const body = await req.json();

    if (!body.json_data) {
      return Response.json({ error: "json_data field is required" }, { status: 400 });
    }

    if (!body.project_id) {
      return Response.json({ error: "project_id field is required" }, { status: 400 });
    }

    const projectId = parseInt(body.project_id);
    if (isNaN(projectId)) {
      return Response.json({ error: "Invalid project_id" }, { status: 400 });
    }

    // Verify project exists and user owns it
    const project = await verifyProjectOwnership(projectId, user.id);
    if (!project) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }

    // Parse and validate JSON
    let conversationData;
    try {
      conversationData = importFromJSON(body.json_data);
    } catch (error: any) {
      return Response.json({ error: error.message }, { status: 400 });
    }

    // Create new conversation with imported data
    const conversation = await dbQueries.createConversation(
      projectId,
      conversationData.title,
      conversationData.model_provider,
      conversationData.model_name
    );

    // Import messages
    for (const message of conversationData.messages) {
      await dbQueries.createMessage(
        conversation.id,
        message.role,
        message.content
      );
    }

    // Get full conversation with messages for response
    const messages = await dbQueries.getMessagesByConversation(conversation.id);

    return Response.json(
      {
        conversation: {
          ...conversation,
          messages,
        },
        message: "Conversation imported successfully",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error importing conversation:", error);
    return Response.json({ error: "Failed to import conversation" }, { status: 500 });
  }
}
