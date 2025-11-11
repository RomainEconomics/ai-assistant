/**
 * AI-powered document analysis functions
 * Provides summarization, key points extraction, entity extraction, and topic modeling
 */
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { getAllDocumentPages } from "./rag-advanced.ts";
import { getDocumentAnalysis, saveDocumentAnalysis, getDocumentById } from "./db.ts";
import type {
  SummaryResult,
  KeyPointsResult,
  EntitiesResult,
  TopicsResult,
} from "../types/database.ts";

/**
 * Default AI model for analysis tasks
 * Using GPT-4o-mini for cost efficiency
 */
const DEFAULT_MODEL = openai("gpt-4o-mini");

/**
 * Summarize a document
 * Uses hierarchical summarization for long documents
 *
 * @param fileId - Document ID
 * @param options - Summary options
 * @param forceRefresh - Bypass cache
 * @returns Summary text
 */
export async function summarizeDocument(
  fileId: number,
  options?: { maxLength?: number; model?: string },
  forceRefresh: boolean = false
): Promise<{ summary: string; cached: boolean }> {
  const maxLength = options?.maxLength || 500;
  const optionsKey = JSON.stringify({ maxLength });

  // Check cache first
  if (!forceRefresh) {
    const cached = await getDocumentAnalysis(fileId, 'summary', optionsKey);
    if (cached) {
      console.log(`[AI-Analysis] Using cached summary for document ${fileId}`);
      const result = JSON.parse(cached.result) as SummaryResult;
      return { summary: result.summary, cached: true };
    }
  }

  console.log(`[AI-Analysis] Generating new summary for document ${fileId}`);

  // Get all pages
  const pages = await getAllDocumentPages(fileId);
  const doc = await getDocumentById(fileId);

  if (pages.length === 0) {
    throw new Error('Document has no content');
  }

  // Combine all pages into full text
  const fullText = pages.map(p => p.content).join('\n\n');

  // If text is very long (>10k words), do hierarchical summarization
  const wordCount = fullText.split(/\s+/).length;
  let summary: string;

  if (wordCount > 10000) {
    console.log(`[AI-Analysis] Document is long (${wordCount} words), using hierarchical summarization`);

    // Summarize each page first
    const pageSummaries = await Promise.all(
      pages.map(async (page, idx) => {
        const pagePrompt = `Summarize this section concisely in 2-3 sentences:\n\n${page.content}`;
        const result = await generateText({
          model: DEFAULT_MODEL,
          prompt: pagePrompt,
          temperature: 0.3,
          maxTokens: 200,
        });
        console.log(`[AI-Analysis] Summarized page ${idx + 1}/${pages.length}`);
        return result.text;
      })
    );

    // Combine page summaries into final summary
    const combinedSummaries = pageSummaries.join('\n\n');
    const finalPrompt = `Provide a comprehensive summary of this document in approximately ${maxLength} words. Focus on the main themes, key findings, and conclusions:\n\n${combinedSummaries}`;

    const finalResult = await generateText({
      model: DEFAULT_MODEL,
      prompt: finalPrompt,
      temperature: 0.3,
      maxTokens: Math.ceil(maxLength * 1.5), // Account for token-to-word ratio
    });

    summary = finalResult.text;
  } else {
    // Direct summarization for shorter documents
    const prompt = `Summarize the following document in approximately ${maxLength} words. Focus on the main themes, key findings, and conclusions:\n\n${fullText}`;

    const result = await generateText({
      model: DEFAULT_MODEL,
      prompt,
      temperature: 0.3,
      maxTokens: Math.ceil(maxLength * 1.5),
    });

    summary = result.text;
  }

  // Cache the result
  if (doc) {
    await saveDocumentAnalysis(
      fileId,
      doc.file_slug,
      'summary',
      { summary },
      optionsKey
    );
  }

  console.log(`[AI-Analysis] Summary generated and cached for document ${fileId}`);

  return { summary, cached: false };
}

/**
 * Extract key points from a document
 *
 * @param fileId - Document ID
 * @param options - Extraction options
 * @param forceRefresh - Bypass cache
 * @returns Array of key points
 */
export async function extractKeyPoints(
  fileId: number,
  options?: { topK?: number },
  forceRefresh: boolean = false
): Promise<{ keyPoints: string[]; cached: boolean }> {
  const topK = options?.topK || 10;
  const optionsKey = JSON.stringify({ topK });

  // Check cache
  if (!forceRefresh) {
    const cached = await getDocumentAnalysis(fileId, 'key-points', optionsKey);
    if (cached) {
      console.log(`[AI-Analysis] Using cached key points for document ${fileId}`);
      const result = JSON.parse(cached.result) as KeyPointsResult;
      return { keyPoints: result.keyPoints, cached: true };
    }
  }

  console.log(`[AI-Analysis] Extracting key points for document ${fileId}`);

  // Get all pages
  const pages = await getAllDocumentPages(fileId);
  const doc = await getDocumentById(fileId);

  if (pages.length === 0) {
    throw new Error('Document has no content');
  }

  const fullText = pages.map(p => p.content).join('\n\n');

  const prompt = `Extract the ${topK} most important key points from this document. Return ONLY a JSON array of strings, with no additional text or formatting. Example format: ["Point 1", "Point 2", "Point 3"]

Document:
${fullText}`;

  const result = await generateText({
    model: DEFAULT_MODEL,
    prompt,
    temperature: 0.3,
    maxTokens: 1000,
  });

  // Parse JSON response
  let keyPoints: string[];
  try {
    // Try to extract JSON from response (in case model adds extra text)
    const jsonMatch = result.text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      keyPoints = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON array found in response');
    }
  } catch (error) {
    console.error('[AI-Analysis] Failed to parse key points JSON, falling back to text splitting');
    // Fallback: split by newlines
    keyPoints = result.text
      .split('\n')
      .filter(line => line.trim().length > 0)
      .slice(0, topK);
  }

  // Cache the result
  if (doc) {
    await saveDocumentAnalysis(
      fileId,
      doc.file_slug,
      'key-points',
      { keyPoints },
      optionsKey
    );
  }

  console.log(`[AI-Analysis] Extracted ${keyPoints.length} key points for document ${fileId}`);

  return { keyPoints, cached: false };
}

/**
 * Extract entities from a document (people, organizations, locations, dates)
 *
 * @param fileId - Document ID
 * @param forceRefresh - Bypass cache
 * @returns Categorized entities
 */
export async function extractEntities(
  fileId: number,
  forceRefresh: boolean = false
): Promise<{ entities: EntitiesResult; cached: boolean }> {
  // Check cache
  if (!forceRefresh) {
    const cached = await getDocumentAnalysis(fileId, 'entities');
    if (cached) {
      console.log(`[AI-Analysis] Using cached entities for document ${fileId}`);
      const result = JSON.parse(cached.result) as EntitiesResult;
      return { entities: result, cached: true };
    }
  }

  console.log(`[AI-Analysis] Extracting entities for document ${fileId}`);

  // Get all pages
  const pages = await getAllDocumentPages(fileId);
  const doc = await getDocumentById(fileId);

  if (pages.length === 0) {
    throw new Error('Document has no content');
  }

  const fullText = pages.map(p => p.content).join('\n\n');

  const prompt = `Extract all named entities from this document. Return ONLY a JSON object with the following structure, with no additional text:
{
  "people": ["person names"],
  "organizations": ["organization names"],
  "locations": ["location names"],
  "dates": ["dates mentioned"]
}

Document:
${fullText}`;

  const result = await generateText({
    model: DEFAULT_MODEL,
    prompt,
    temperature: 0.2,
    maxTokens: 2000,
  });

  // Parse JSON response
  let entities: EntitiesResult;
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      entities = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON object found in response');
    }
  } catch (error) {
    console.error('[AI-Analysis] Failed to parse entities JSON, using empty result');
    entities = {
      people: [],
      organizations: [],
      locations: [],
      dates: [],
    };
  }

  // Cache the result
  if (doc) {
    await saveDocumentAnalysis(
      fileId,
      doc.file_slug,
      'entities',
      entities
    );
  }

  console.log(`[AI-Analysis] Extracted entities for document ${fileId}: ${entities.people.length} people, ${entities.organizations.length} orgs`);

  return { entities, cached: false };
}

/**
 * Extract topics from a document with weights
 *
 * @param fileId - Document ID
 * @param options - Topic extraction options
 * @param forceRefresh - Bypass cache
 * @returns Array of topics with weights
 */
export async function extractTopics(
  fileId: number,
  options?: { topK?: number },
  forceRefresh: boolean = false
): Promise<{ topics: TopicsResult; cached: boolean }> {
  const topK = options?.topK || 5;
  const optionsKey = JSON.stringify({ topK });

  // Check cache
  if (!forceRefresh) {
    const cached = await getDocumentAnalysis(fileId, 'topics', optionsKey);
    if (cached) {
      console.log(`[AI-Analysis] Using cached topics for document ${fileId}`);
      const result = JSON.parse(cached.result) as TopicsResult;
      return { topics: result, cached: true };
    }
  }

  console.log(`[AI-Analysis] Extracting topics for document ${fileId}`);

  // Get all pages
  const pages = await getAllDocumentPages(fileId);
  const doc = await getDocumentById(fileId);

  if (pages.length === 0) {
    throw new Error('Document has no content');
  }

  const fullText = pages.map(p => p.content).join('\n\n');

  const prompt = `Identify the ${topK} main topics discussed in this document. Return ONLY a JSON object with a "topics" array, where each item has "topic" (string) and "weight" (number 0-1). Example:
{
  "topics": [
    {"topic": "Climate Change", "weight": 0.9},
    {"topic": "Renewable Energy", "weight": 0.7}
  ]
}

Document:
${fullText}`;

  const result = await generateText({
    model: DEFAULT_MODEL,
    prompt,
    temperature: 0.3,
    maxTokens: 1000,
  });

  // Parse JSON response
  let topicsResult: TopicsResult;
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      topicsResult = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('No JSON object found in response');
    }
  } catch (error) {
    console.error('[AI-Analysis] Failed to parse topics JSON, using empty result');
    topicsResult = { topics: [] };
  }

  // Cache the result
  if (doc) {
    await saveDocumentAnalysis(
      fileId,
      doc.file_slug,
      'topics',
      topicsResult,
      optionsKey
    );
  }

  console.log(`[AI-Analysis] Extracted ${topicsResult.topics.length} topics for document ${fileId}`);

  return { topics: topicsResult, cached: false };
}

/**
 * Run all analysis types at once
 * Useful for comprehensive document analysis
 *
 * @param fileId - Document ID
 * @param forceRefresh - Bypass cache for all analyses
 * @returns Combined analysis results
 */
export async function analyzeDocumentFull(
  fileId: number,
  forceRefresh: boolean = false
): Promise<{
  summary: string;
  keyPoints: string[];
  entities: EntitiesResult;
  topics: TopicsResult;
}> {
  console.log(`[AI-Analysis] Running full analysis for document ${fileId}`);

  const [summaryResult, keyPointsResult, entitiesResult, topicsResult] = await Promise.all([
    summarizeDocument(fileId, undefined, forceRefresh),
    extractKeyPoints(fileId, undefined, forceRefresh),
    extractEntities(fileId, forceRefresh),
    extractTopics(fileId, undefined, forceRefresh),
  ]);

  return {
    summary: summaryResult.summary,
    keyPoints: keyPointsResult.keyPoints,
    entities: entitiesResult.entities,
    topics: topicsResult.topics,
  };
}
