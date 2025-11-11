/**
 * Advanced RAG functions for multi-document and batch operations
 */
import { getWeaviateClient } from "./weaviate.ts";
import { WeaviateCollection } from "../types/weaviate.ts";
import { Filters } from "weaviate-client";
import type { MultiDocQueryResult, BatchQueryResult } from "../types/database.ts";
import { getDocumentById } from "./db.ts";

export interface RagSearchResult {
  page: number;
  content: string;
  filename: string;
  file_id: number;
  company_name: string;
  score: number;
}

/**
 * Perform RAG search filtered by specific document IDs
 * @param query - User's search query
 * @param fileIds - Array of document IDs to search within
 * @param limit - Maximum number of parent pages to retrieve (default: 5)
 * @returns Array of unique parent pages with relevance scores
 */
export async function ragSearchFiltered(
  query: string,
  fileIds: number[],
  limit: number = 5
): Promise<RagSearchResult[]> {
  const client = await getWeaviateClient();

  try {
    const childCollection = client.collections.get(WeaviateCollection.CHILD_CLASS);

    // Perform hybrid search (combines vector similarity + BM25)
    const results = await childCollection.query.hybrid(query, {
      limit: 20, // Get more chunks to ensure we have diverse pages
      filters: childCollection.filter.byProperty("file_id").containsAny(fileIds),
      returnMetadata: ['score'],
      includeVector: false,
    });

    console.log(`[RAG-Advanced] Found ${results.objects.length} matching chunks for query: "${query.substring(0, 100)}..."`);

    // Extract unique parent page references
    const pageMap = new Map<string, RagSearchResult>();

    // Get parent documents for matching chunks
    const parentCollection = client.collections.get(WeaviateCollection.PARENT_CLASS);

    for (const result of results.objects) {
      const props = result.properties as any;
      const score = (result.metadata as any)?.score || 0;

      // Create unique key for this page
      const pageKey = `${props.file_id}-${props.page}`;

      // Keep highest scoring occurrence of each page
      if (!pageMap.has(pageKey) || (pageMap.get(pageKey)?.score || 0) < score) {
        // Fetch the full parent page content
        try {
          const parentResults = await parentCollection.query.fetchObjects({
            filters: Filters.and(
              parentCollection.filter.byProperty("file_id").equal(props.file_id),
              parentCollection.filter.byProperty("page").equal(props.page)
            ),
            limit: 1,
          });

          if (parentResults.objects.length > 0) {
            const parentProps = parentResults.objects[0].properties as any;
            pageMap.set(pageKey, {
              page: parentProps.page,
              content: parentProps.content,
              filename: parentProps.filename,
              file_id: parentProps.file_id,
              company_name: parentProps.company_name || '',
              score,
            });
          }
        } catch (error) {
          console.error(`[RAG-Advanced] Failed to fetch parent page for ${pageKey}:`, error);
        }
      }
    }

    // Convert to array and sort by score (highest first)
    const pages = Array.from(pageMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`[RAG-Advanced] Retrieved ${pages.length} unique pages (limit: ${limit})`);
    console.log(`[RAG-Advanced] Page distribution:`, pages.map(p => `${p.filename} p${p.page}`).join(', '));

    return pages;
  } catch (error) {
    console.error(`[RAG-Advanced] Search failed:`, error);
    throw error;
  } finally {
    await client.close();
  }
}

/**
 * Query multiple documents separately and return structured results
 * Each document gets its own RAG search and result
 *
 * @param query - User's question
 * @param fileIds - Array of document IDs to query
 * @param limit - Maximum pages per document (default: 3)
 * @returns Array of results, one per document
 */
export async function ragSearchMultiDoc(
  query: string,
  fileIds: number[],
  limit: number = 3
): Promise<Array<{
  fileId: number;
  filename: string;
  pages: RagSearchResult[];
  error?: string;
}>> {
  const results = await Promise.all(
    fileIds.map(async (fileId) => {
      try {
        // Get document info
        const doc = await getDocumentById(fileId);
        if (!doc) {
          return {
            fileId,
            filename: `Document ${fileId}`,
            pages: [],
            error: 'Document not found',
          };
        }

        // Search within this specific document
        const pages = await ragSearchFiltered(query, [fileId], limit);

        return {
          fileId,
          filename: doc.filename,
          pages,
        };
      } catch (error: any) {
        console.error(`[RAG-Advanced] Failed to query document ${fileId}:`, error);
        return {
          fileId,
          filename: `Document ${fileId}`,
          pages: [],
          error: error.message || 'Unknown error',
        };
      }
    })
  );

  return results;
}

/**
 * Batch process multiple queries across multiple documents
 * This is the core function for batch questioning feature
 *
 * @param questions - Array of user questions
 * @param fileIds - Array of document IDs
 * @param onProgress - Optional callback for progress updates (current, total)
 * @returns Array of results for each question-document pair
 */
export async function ragBatchQuery(
  questions: string[],
  fileIds: number[],
  onProgress?: (current: number, total: number) => void
): Promise<Array<{
  question: string;
  fileId: number;
  filename: string;
  pages: RagSearchResult[];
  error?: string;
}>> {
  const total = questions.length * fileIds.length;
  let current = 0;
  const results: Array<{
    question: string;
    fileId: number;
    filename: string;
    pages: RagSearchResult[];
    error?: string;
  }> = [];

  console.log(`[RAG-Advanced] Starting batch query: ${questions.length} questions × ${fileIds.length} documents = ${total} queries`);

  // Process sequentially to avoid overwhelming the API
  for (const question of questions) {
    for (const fileId of fileIds) {
      try {
        // Get document info
        const doc = await getDocumentById(fileId);
        const filename = doc?.filename || `Document ${fileId}`;

        if (!doc) {
          results.push({
            question,
            fileId,
            filename,
            pages: [],
            error: 'Document not found',
          });
        } else {
          // Search within this specific document
          const pages = await ragSearchFiltered(question, [fileId], 3);

          results.push({
            question,
            fileId,
            filename,
            pages,
          });
        }
      } catch (error: any) {
        console.error(`[RAG-Advanced] Failed batch query for Q:"${question}" Doc:${fileId}:`, error);
        results.push({
          question,
          fileId,
          filename: `Document ${fileId}`,
          pages: [],
          error: error.message || 'Unknown error',
        });
      }

      current++;
      if (onProgress) {
        onProgress(current, total);
      }

      // Small delay to avoid rate limiting (100ms between queries)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`[RAG-Advanced] Batch query completed: ${results.length} results`);

  return results;
}

/**
 * Get all unique document pages for a set of documents
 * Useful for document analysis that needs full text
 *
 * @param fileId - Document ID
 * @returns Array of all pages with content
 */
export async function getAllDocumentPages(fileId: number): Promise<RagSearchResult[]> {
  const client = await getWeaviateClient();

  try {
    const parentCollection = client.collections.get(WeaviateCollection.PARENT_CLASS);

    const results = await parentCollection.query.fetchObjects({
      filters: parentCollection.filter.byProperty("file_id").equal(fileId),
      limit: 1000, // Max pages per document
    });

    const pages = results.objects.map((obj: any) => ({
      page: obj.properties.page,
      content: obj.properties.content,
      filename: obj.properties.filename,
      file_id: obj.properties.file_id,
      company_name: obj.properties.company_name || '',
      score: 1.0, // No relevance score for full retrieval
    }));

    // Sort by page number
    pages.sort((a, b) => a.page - b.page);

    console.log(`[RAG-Advanced] Retrieved ${pages.length} pages for document ${fileId}`);

    return pages;
  } catch (error) {
    console.error(`[RAG-Advanced] Failed to retrieve all pages for document ${fileId}:`, error);
    throw error;
  } finally {
    await client.close();
  }
}

/**
 * Count total chunks/pages for a document
 * Useful for displaying progress or stats
 *
 * @param fileId - Document ID
 * @returns Object with chunk and page counts
 */
export async function getDocumentStats(fileId: number): Promise<{
  totalChunks: number;
  totalPages: number;
}> {
  const client = await getWeaviateClient();

  try {
    const childCollection = client.collections.get(WeaviateCollection.CHILD_CLASS);
    const parentCollection = client.collections.get(WeaviateCollection.PARENT_CLASS);

    const [childResults, parentResults] = await Promise.all([
      childCollection.query.fetchObjects({
        filters: childCollection.filter.byProperty("file_id").equal(fileId),
        limit: 10000, // High limit to count all
      }),
      parentCollection.query.fetchObjects({
        filters: parentCollection.filter.byProperty("file_id").equal(fileId),
        limit: 1000,
      }),
    ]);

    return {
      totalChunks: childResults.objects.length,
      totalPages: parentResults.objects.length,
    };
  } catch (error) {
    console.error(`[RAG-Advanced] Failed to get stats for document ${fileId}:`, error);
    throw error;
  } finally {
    await client.close();
  }
}
