import { serve } from "bun";
import index from "./index.html";
import { initializeDatabase } from "./lib/db";

// Import API handlers
import {
  handleGetProjects,
  handleGetProject,
  handleCreateProject,
  handleUpdateProject,
  handleDeleteProject,
} from "./api/projects";

import {
  handleGetConversations,
  handleGetConversation,
  handleCreateConversation,
  handleUpdateConversation,
  handleDeleteConversation,
  handleGetConversationDocuments,
  handleAddDocumentToConversation,
  handleRemoveDocumentFromConversation,
  handleExportConversation,
  handleImportConversation,
} from "./api/conversations";

import {
  handleChatStream,
  handleSaveAssistantMessage,
  handleGetModels,
  handleDeleteMessage,
  handleUpdateMessage,
} from "./api/chat";

import {
  handleGetDocuments,
  handleGetDocument,
  handleUploadDocument,
  handleDeleteDocument,
  handleDownloadDocument,
} from "./api/documents";

import {
  handleMultiDocQuery,
  handleGetMultiDocHistory,
  handleDeleteMultiDocHistory,
  handleExportMultiDocQuery,
} from "./api/rag-multi";

import {
  handleBatchQuestioning,
  handleGetBatchQuestioningHistory,
  handleDeleteBatchQuestioningHistory,
  handleExportBatchQuestioning,
} from "./api/batch-questioning";

import {
  handleGetSettings,
  handleUpdateSettings,
} from "./api/settings";

import {
  handleListAgents,
  handleRunAgent,
  handleGetHistory,
  handleGetRun,
  handleGetDocumentRuns,
} from "./api/deepagent";

import {
  handleLogin,
  handleLogout,
  handleGetCurrentUser,
  handleRefreshSession,
} from "./api/auth";

import {
  handleGetUserPreferences,
  handleUpdateUserPreferences,
} from "./api/user-preferences";

import {
  handleGetQuestionTemplates,
  handleGetQuestionTemplateCategories,
  handleGetQuestionTemplate,
  handleCreateQuestionTemplate,
  handleUpdateQuestionTemplate,
  handleDeleteQuestionTemplate,
} from "./api/question-templates";

// Initialize database
await initializeDatabase();

const server = serve({
  routes: {
    // Authentication API
    "/api/auth/login": {
      POST: handleLogin,
    },
    "/api/auth/logout": {
      POST: handleLogout,
    },
    "/api/me": {
      GET: handleGetCurrentUser,
    },
    "/api/auth/refresh": {
      POST: handleRefreshSession,
    },

    // Projects API
    "/api/projects": {
      GET: handleGetProjects,
      POST: handleCreateProject,
    },
    "/api/projects/:id": {
      GET: handleGetProject,
      PUT: handleUpdateProject,
      DELETE: handleDeleteProject,
    },

    // Conversations API
    "/api/conversations": {
      GET: handleGetConversations,
      POST: handleCreateConversation,
    },
    "/api/conversations/:id": {
      GET: handleGetConversation,
      PUT: handleUpdateConversation,
      DELETE: handleDeleteConversation,
    },
    "/api/conversations/:id/documents": {
      GET: handleGetConversationDocuments,
      POST: handleAddDocumentToConversation,
    },
    "/api/conversations/:id/documents/:documentId": {
      DELETE: handleRemoveDocumentFromConversation,
    },
    "/api/conversations/:id/export": {
      GET: handleExportConversation,
    },
    "/api/conversations/import": {
      POST: handleImportConversation,
    },

    // Chat API
    "/api/chat/stream": {
      POST: handleChatStream,
    },
    "/api/chat/save-message": {
      POST: handleSaveAssistantMessage,
    },
    "/api/models": {
      GET: handleGetModels,
    },
    "/api/messages/:id": {
      PUT: handleUpdateMessage,
      DELETE: handleDeleteMessage,
    },

    // Documents API
    "/api/documents": {
      GET: handleGetDocuments,
    },
    "/api/documents/upload": {
      POST: handleUploadDocument,
    },
    "/api/documents/:id/pdf": {
      GET: handleDownloadDocument,
    },
    "/api/documents/:id": {
      GET: handleGetDocument,
      DELETE: handleDeleteDocument,
    },

    // RAG Multi-Doc API
    "/api/rag/multi-doc-query": {
      POST: handleMultiDocQuery,
    },
    "/api/rag/multi-doc-history": {
      GET: handleGetMultiDocHistory,
    },
    "/api/rag/multi-doc-history/:id": {
      DELETE: handleDeleteMultiDocHistory,
    },
    "/api/rag/multi-doc-export": {
      POST: handleExportMultiDocQuery,
    },

    // Batch Questioning API
    "/api/batch-questioning": {
      POST: handleBatchQuestioning,
    },
    "/api/batch-questioning/history": {
      GET: handleGetBatchQuestioningHistory,
    },
    "/api/batch-questioning/history/:id": {
      DELETE: handleDeleteBatchQuestioningHistory,
    },
    "/api/batch-questioning/export": {
      POST: handleExportBatchQuestioning,
    },

    // Settings API
    "/api/settings": {
      GET: handleGetSettings,
      PUT: handleUpdateSettings,
    },

    // DeepAgent API
    "/api/deepagent/agents": {
      GET: handleListAgents,
    },
    "/api/deepagent/run": {
      POST: handleRunAgent,
    },
    "/api/deepagent/history": {
      GET: handleGetHistory,
    },
    "/api/deepagent/runs/:id": {
      GET: (req, server) => {
        const url = new URL(req.url);
        const id = url.pathname.split("/").pop() || "";
        return handleGetRun(req, server, id);
      },
    },
    "/api/deepagent/document/:documentId/runs": {
      GET: (req, server) => {
        const url = new URL(req.url);
        const parts = url.pathname.split("/");
        const documentId = parts[parts.length - 2] || "";
        return handleGetDocumentRuns(req, server, documentId);
      },
    },

    // User Preferences API
    "/api/user-preferences": {
      GET: handleGetUserPreferences,
      PATCH: handleUpdateUserPreferences,
    },

    // Question Templates API
    "/api/question-templates": {
      GET: handleGetQuestionTemplates,
      POST: handleCreateQuestionTemplate,
    },
    "/api/question-templates/categories": {
      GET: handleGetQuestionTemplateCategories,
    },
    "/api/question-templates/:id": {
      GET: handleGetQuestionTemplate,
      PUT: handleUpdateQuestionTemplate,
      DELETE: handleDeleteQuestionTemplate,
    },

    // Serve static files from public directory
    "/public/*": {
      GET: async (req: Request) => {
        const url = new URL(req.url);
        const filePath = url.pathname.replace("/public", "./public");
        const file = Bun.file(filePath);

        if (await file.exists()) {
          return new Response(file);
        }
        return new Response("Not Found", { status: 404 });
      },
    },

    // Serve index.html for all unmatched routes (SPA)
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
