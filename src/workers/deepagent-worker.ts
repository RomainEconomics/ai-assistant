/**
 * DeepAgent Worker
 * Runs deep agent analysis in a background worker thread
 */
import { createDeepAgent } from "deepagents";
import { ChatOpenAI } from "@langchain/openai";
import { createWeaviateTools } from "../lib/deepagent-tools.ts";
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
 * Run deep agent analysis
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

    // Create Weaviate tools for this document
    const tools = createWeaviateTools({
      fileSlug: document.file_slug,
      filename: document.filename,
    });

    sendProgress(runId, "Creating AI model...");

    // Create LLM model
    const model = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.7,
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    sendProgress(runId, "Starting deep agent analysis...");

    // Create deep agent
    const agent = createDeepAgent({
      model,
      tools,
      systemPrompt: agentConfig.systemPrompt,
    });

    console.log(
      `[DeepAgent Worker] Starting run ${runId} with agent ${agentConfig.id} on document ${document.filename}`
    );

    // Run agent
    const result = await agent.invoke({
      messages: [{ role: "user", content: agentRun.query }],
    });

    const endTime = Date.now();
    const durationSeconds = Math.round((endTime - startTime) / 1000);

    // Extract the final answer from the messages
    const finalMessage = result.messages[result.messages.length - 1];
    const finalAnswer = finalMessage.content;

    console.log(`[DeepAgent Worker] Run ${runId} completed in ${durationSeconds}s`);

    // Update agent run with result
    await updateAgentRun(runId, {
      status: "completed",
      result: finalAnswer,
    });

    // Send completion message
    sendCompleted(runId, finalAnswer, durationSeconds);
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
