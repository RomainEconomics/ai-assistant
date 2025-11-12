/**
 * DeepAgent Worker
 * Runs deep agent analysis in a background worker thread
 * Uses AI SDK v6 with hierarchical multi-agent system
 */
import { openai } from "@ai-sdk/openai";
import { WeaviateTools } from "../lib/agents/tools.ts";
import { CoordinatorAgent } from "../lib/agents/coordinator.ts";
import { createDiscoveryAgent } from "../lib/agents/discovery-agent.ts";
import {
  createEmissionsExtractor,
  createTargetsExtractor,
  createInvestmentExtractor,
  createRiskExtractor,
} from "../lib/agents/extraction-agents.ts";
import { createSynthesisAgent } from "../lib/agents/synthesis-agent.ts";
import { getAgentConfig } from "../lib/deepagent-configs.ts";
import {
  updateAgentRun,
  getAgentRunById,
  getDocumentById,
} from "../lib/db.ts";

export interface DeepAgentWorkerMessage {
  type: "run";
  runId: string;
}

export interface DeepAgentWorkerResponse {
  type: "progress" | "completed" | "error";
  runId: string;
  message?: string;
  result?: string;
  durationSeconds?: number;
  error?: string;
}

/**
 * Main worker message handler
 */
self.onmessage = async (event: MessageEvent<DeepAgentWorkerMessage>) => {
  const { type, runId } = event.data;

  if (type === "run") {
    await runDeepAgent(runId);
  }
};

/**
 * Run deep agent analysis using AI SDK v6
 */
async function runDeepAgent(runId: string): Promise<void> {
  const startTime = Date.now();

  try {
    // Send progress update
    sendProgress(runId, "Initializing agent...");

    // Get agent run from database
    const agentRun = await getAgentRunById(runId);
    if (!agentRun) {
      throw new Error(`Agent run ${runId} not found`);
    }

    // Get agent configuration
    const agentConfig = getAgentConfig(agentRun.agent_config_id);
    if (!agentConfig) {
      throw new Error(`Agent configuration ${agentRun.agent_config_id} not found`);
    }

    // Get document
    const document = await getDocumentById(agentRun.document_id);
    if (!document) {
      throw new Error(`Document ${agentRun.document_id} not found`);
    }

    sendProgress(runId, `Loading document: ${document.filename}`);

    // Configuration
    const MODEL = "gpt-5-mini"; // DO NOT MODIFY this line
    const WEAVIATE_URL = process.env.WEAVIATE_HOST || "http://localhost:8080";
    const FILE_SLUG = document.file_slug;

    sendProgress(runId, "Connecting to Weaviate...");

    // Initialize Weaviate tools
    const weaviateTools = new WeaviateTools(WEAVIATE_URL);
    const tools = weaviateTools.createTools(FILE_SLUG);

    sendProgress(runId, "Creating agent system...");

    // Create all agents
    const discoveryAgent = createDiscoveryAgent(MODEL, tools);
    const emissionsAgent = createEmissionsExtractor(MODEL, tools);
    const targetsAgent = createTargetsExtractor(MODEL, tools);
    const investmentAgent = createInvestmentExtractor(MODEL, tools);
    const riskAgent = createRiskExtractor(MODEL, tools);
    const synthesisAgent = createSynthesisAgent(MODEL);

    // Create coordinator with progress callback
    const coordinator = new CoordinatorAgent({
      discoveryAgent,
      emissionsAgent,
      targetsAgent,
      investmentAgent,
      riskAgent,
      synthesisAgent,
      onProgress: (message: string) => {
        sendProgress(runId, message);
      },
    });

    console.log(
      `[DeepAgent Worker] Starting run ${runId} with agent ${agentConfig.id} on document ${document.filename}`
    );

    sendProgress(runId, "Starting deep agent analysis...");

    // Run the hierarchical analysis
    const results = await coordinator.runAnalysis(
      agentRun.query || "environmental strategy and climate action"
    );

    const endTime = Date.now();
    const durationSeconds = Math.round((endTime - startTime) / 1000);

    // Get the formatted result (synthesis output)
    const finalResult = coordinator.getFormattedResult();

    // Get intermediate results for storage
    const intermediateResults = coordinator.getIntermediateResults();

    console.log(`[DeepAgent Worker] Run ${runId} completed in ${durationSeconds}s`);

    // Update agent run with result and intermediate results
    await updateAgentRun(runId, {
      status: "completed",
      result: finalResult,
      intermediate_results: intermediateResults,
    });

    // Send completion message
    sendCompleted(runId, finalResult, durationSeconds);
  } catch (error) {
    console.error(`[DeepAgent Worker] Run ${runId} failed:`, error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update agent run with error
    await updateAgentRun(runId, {
      status: "failed",
      error: errorMessage,
    });

    // Send error message
    sendError(runId, errorMessage);
  }
}

/**
 * Send progress update
 */
function sendProgress(runId: string, message: string): void {
  const response: DeepAgentWorkerResponse = {
    type: "progress",
    runId,
    message,
  };
  self.postMessage(response);
}

/**
 * Send completion message
 */
function sendCompleted(runId: string, result: string, durationSeconds: number): void {
  const response: DeepAgentWorkerResponse = {
    type: "completed",
    runId,
    result,
    durationSeconds,
  };
  self.postMessage(response);
}

/**
 * Send error message
 */
function sendError(runId: string, error: string): void {
  const response: DeepAgentWorkerResponse = {
    type: "error",
    runId,
    error,
  };
  self.postMessage(response);
}
