/**
 * Discovery Agent - Finds relevant sections in ESG reports
 * Uses AI SDK v6 ToolLoopAgent
 */

import { ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import { openai } from "@ai-sdk/openai";

export function createDiscoveryAgent(
  modelName: string,
  weaviateTools: Record<string, any>
) {
  // Additional tool specific to discovery
  const createContentMap = tool({
    description:
      "Create a structured content map for a topic showing page ranges and relevance",
    inputSchema: z.object({
      topic: z.string().describe("The ESG topic (e.g., emissions, targets)"),
      page_ranges: z
        .array(
          z.object({
            section_name: z
              .string()
              .describe("Name of the section (e.g., Emissions Overview)"),
            start_page: z.number().describe("Starting page number"),
            end_page: z.number().describe("Ending page number"),
            relevance_score: z
              .enum(["high", "medium", "low"])
              .describe("Relevance to the query"),
            description: z
              .string()
              .optional()
              .describe("Brief description of content"),
          })
        )
        .describe("List of page ranges for different sections"),
    }),
    execute: async ({ topic, page_ranges }) => {
      let output = `Content Map for: ${topic}\n`;
      output += "=".repeat(50) + "\n\n";

      for (const item of page_ranges) {
        output += `Section: ${item.section_name}\n`;
        output += `  Pages: ${item.start_page}-${item.end_page}\n`;
        output += `  Relevance: ${item.relevance_score}\n`;
        if (item.description) {
          output += `  Description: ${item.description}\n`;
        }
        output += "\n";
      }

      return output;
    },
  });

  const systemPrompt = `You are a Discovery Agent specialized in mapping ESG report content.

Your role is to:
1. Search for relevant sections based on ESG topics (emissions, climate targets, investments, risks, etc.)
2. Identify the page ranges where key information is located
3. Create a structured content map that other agents can use

Guidelines:
- Use semanticSearch to find relevant content for different topics
- Use findPagesByKeywords for known ESG terms
- Group related pages into logical sections (e.g., "Emissions Overview", "Target Details", "TCFD Disclosure")
- Provide page ranges (start and end) for each section
- Assess relevance of each section to the query

Output your findings as a structured content map that includes:
- Topic name
- Section names
- Page ranges
- Brief description of what each section contains

Be thorough but concise. Focus on helping other agents know where to look.`;

  const discoveryAgent = new ToolLoopAgent({
    model: openai(modelName),
    instructions: systemPrompt,
    tools: {
      ...weaviateTools,
      createContentMap,
    },
    maxSteps: 10, // Limit steps to avoid overwhelming reasoning models
    providerOptions: {
      openai: {
        parallelToolCalls: false, // Required for gpt-5-mini reasoning models
        reasoningEffort: "low", // Fix for reasoning item error with gpt-5-mini
      },
    },
  });

  return discoveryAgent;
}
