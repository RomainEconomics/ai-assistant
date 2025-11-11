/**
 * DeepAgent API endpoints
 */
import type { Server } from "bun";
import { v4 as uuidv4 } from "uuid";
import { AGENT_CONFIGS, getAgentConfig } from "../lib/deepagent-configs.ts";
import {
  createAgentRun,
  getAgentRunById,
  getAgentRunsByUser,
  getAgentRunsByDocument,
  getDocumentById,
  getDefaultUser,
} from "../lib/db.ts";

/**
 * GET /api/deepagent/agents
 * List all available agent configurations
 */
export async function handleListAgents(req: Request, server: Server) {
  try {
    // Return agent configurations (id, name, description, estimatedDuration)
    const agents = AGENT_CONFIGS.map((config) => ({
      id: config.id,
      name: config.name,
      description: config.description,
      estimatedDuration: config.estimatedDuration,
    }));

    return Response.json(agents);
  } catch (error) {
    console.error("Failed to list agents:", error);
    return Response.json({ error: "Failed to list agents" }, { status: 500 });
  }
}

/**
 * POST /api/deepagent/run
 * Start a deep agent run on a document (returns immediately, runs in background)
 *
 * Body: {
 *   agentConfigId: string,
 *   documentId: number,
 *   query?: string (optional, uses default if not provided)
 * }
 */
export async function handleRunAgent(req: Request, server: Server) {
  try {
    const body = await req.json();
    const { agentConfigId, documentId, query: customQuery } = body;

    if (!agentConfigId || !documentId) {
      return Response.json(
        { error: "agentConfigId and documentId are required" },
        { status: 400 },
      );
    }

    // Get agent configuration
    const agentConfig = getAgentConfig(agentConfigId);
    if (!agentConfig) {
      return Response.json(
        { error: "Agent configuration not found" },
        { status: 404 },
      );
    }

    // Get document
    const document = await getDocumentById(documentId);
    if (!document) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.processing_status !== "completed") {
      return Response.json(
        { error: "Document is not fully processed yet" },
        { status: 400 },
      );
    }

    // Get current user
    const user = await getDefaultUser();
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 401 });
    }

    // Use custom query or default query from config
    const query = customQuery || agentConfig.defaultQuery || "";

    if (!query) {
      return Response.json({ error: "Query is required" }, { status: 400 });
    }

    // Create agent run in database
    const runId = uuidv4();
    await createAgentRun({
      id: runId,
      userId: user.id,
      agentConfigId: agentConfig.id,
      documentId: document.id,
      query,
    });

    console.log(
      `[DeepAgent] Created run ${runId}, starting background worker...`,
    );

    // Start background worker (don't await - let it run in background)
    const workerPath = new URL(
      "../workers/deepagent-worker.ts",
      import.meta.url,
    ).pathname;
    const worker = new Worker(workerPath);

    worker.postMessage({
      type: "run",
      runId,
    });

    // Worker will update the database when done
    worker.onmessage = (event) => {
      const { type, message } = event.data;
      if (type === "progress") {
        console.log(`[DeepAgent Worker ${runId}] ${message}`);
      } else if (type === "completed") {
        console.log(`[DeepAgent Worker ${runId}] Completed`);
        worker.terminate();
      } else if (type === "error") {
        console.error(`[DeepAgent Worker ${runId}] Error:`, event.data.error);
        worker.terminate();
      }
    };

    worker.onerror = (error) => {
      console.error(`[DeepAgent Worker ${runId}] Worker error:`, error);
      worker.terminate();
    };

    // Return run ID immediately for status polling
    return Response.json({
      id: runId,
      status: "running",
      message: "Agent run started in background",
    });
  } catch (error) {
    console.error("Failed to start agent run:", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to start agent run",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/deepagent/history?limit=50
 * Get agent run history for current user
 */
export async function handleGetHistory(req: Request, server: Server) {
  try {
    const user = await getDefaultUser();
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);

    const runs = await getAgentRunsByUser(user.id, limit);

    // Add agent names from configs
    const runsWithNames = runs.map((run) => {
      const config = getAgentConfig(run.agent_config_id);
      return {
        ...run,
        agent_name: config?.name || run.agent_config_id,
      };
    });

    return Response.json(runsWithNames);
  } catch (error) {
    console.error("Failed to get history:", error);
    return Response.json({ error: "Failed to get history" }, { status: 500 });
  }
}

/**
 * GET /api/deepagent/runs/:id
 * Get a specific agent run by ID
 */
export async function handleGetRun(
  req: Request,
  server: Server,
  runId: string,
) {
  try {
    const run = await getAgentRunById(runId);

    if (!run) {
      return Response.json({ error: "Agent run not found" }, { status: 404 });
    }

    // Get document and agent config info
    const document = await getDocumentById(run.document_id);
    const agentConfig = getAgentConfig(run.agent_config_id);

    return Response.json({
      ...run,
      filename: document?.filename,
      agent_name: agentConfig?.name || run.agent_config_id,
    });
  } catch (error) {
    console.error("Failed to get run:", error);
    return Response.json({ error: "Failed to get run" }, { status: 500 });
  }
}

/**
 * GET /api/deepagent/document/:documentId/runs?limit=20
 * Get agent runs for a specific document
 */
export async function handleGetDocumentRuns(
  req: Request,
  server: Server,
  documentId: string,
) {
  try {
    const docId = parseInt(documentId, 10);
    if (isNaN(docId)) {
      return Response.json({ error: "Invalid document ID" }, { status: 400 });
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "20", 10);

    const runs = await getAgentRunsByDocument(docId, limit);

    // Add agent names from configs
    const runsWithNames = runs.map((run) => {
      const config = getAgentConfig(run.agent_config_id);
      return {
        ...run,
        agent_name: config?.name || run.agent_config_id,
      };
    });

    return Response.json(runsWithNames);
  } catch (error) {
    console.error("Failed to get document runs:", error);
    return Response.json(
      { error: "Failed to get document runs" },
      { status: 500 },
    );
  }
}
