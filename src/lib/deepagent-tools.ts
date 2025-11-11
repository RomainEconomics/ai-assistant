/**
 * Weaviate-based tools for DeepAgents
 * Similar to Python ChromaDBTools but using Weaviate vector database
 */
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getWeaviateClient } from "./weaviate.ts";
import { WeaviateCollection } from "../types/weaviate.ts";
import { Filters } from "weaviate-client";

export interface WeaviateToolsConfig {
  fileSlug: string; // The file slug to search within
  filename?: string; // Optional filename for display
}

/**
 * Create Weaviate-based tools for a specific document
 */
export function createWeaviateTools(config: WeaviateToolsConfig) {
  const { fileSlug, filename = "document" } = config;

  /**
   * Semantic search in document chunks
   */
  const semanticSearch = tool(
    async ({ query, k = 5 }) => {
      const client = await getWeaviateClient();

      try {
        const childCollection = client.collections.get(WeaviateCollection.CHILD_CLASS);

        // Perform hybrid search (combines vector similarity + BM25)
        const results = await childCollection.query.hybrid(query, {
          limit: k,
          filters: childCollection.filter.byProperty("file_slug").equal(fileSlug),
          returnMetadata: ["score"],
          includeVector: false,
        });

        if (results.objects.length === 0) {
          return "No results found for the query.";
        }

        let output = `Found ${results.objects.length} relevant passages:\n\n`;
        results.objects.forEach((result: any, i: number) => {
          const props = result.properties;
          const score = result.metadata?.score || 0;
          const content =
            props.content.length > 300
              ? props.content.substring(0, 300) + "..."
              : props.content;

          output += `${i + 1}. [Page ${props.page}] (Score: ${score.toFixed(3)})\n${content}\n\n`;
        });

        return output;
      } catch (error) {
        console.error("Semantic search failed:", error);
        throw error;
      } finally {
        await client.close();
      }
    },
    {
      name: "semantic_search",
      description: `Search the document "${filename}" using semantic similarity. Returns relevant text passages with page numbers.`,
      schema: z.object({
        query: z.string().describe("The search query to find relevant content"),
        k: z
          .number()
          .optional()
          .default(5)
          .describe("Number of results to return (default: 5)"),
      }),
    }
  );

  /**
   * Get full content from specific document pages
   */
  const getDocumentPages = tool(
    async ({ pages }) => {
      if (!pages || pages.length === 0) {
        return "No pages specified.";
      }

      const client = await getWeaviateClient();

      try {
        const parentCollection = client.collections.get(WeaviateCollection.PARENT_CLASS);

        // Query for pages matching the file_slug and page numbers
        const results = await parentCollection.query.fetchObjects({
          filters: Filters.and(
            parentCollection.filter.byProperty("file_slug").equal(fileSlug),
            parentCollection.filter.byProperty("page").containsAny(pages)
          ),
          limit: pages.length,
        });

        if (results.objects.length === 0) {
          return `No content found for pages: ${pages.join(", ")}`;
        }

        // Sort by page number
        const sortedPages = results.objects
          .map((obj: any) => ({
            page: obj.properties.page,
            content: obj.properties.content,
          }))
          .sort((a, b) => a.page - b.page);

        let output = "";
        sortedPages.forEach(({ page, content }) => {
          output += `=== Page ${page} ===\n${content}\n\n`;
        });

        return output;
      } catch (error) {
        console.error("Failed to get document pages:", error);
        throw error;
      } finally {
        await client.close();
      }
    },
    {
      name: "get_document_pages",
      description: `Get full content from specific pages of the document "${filename}". Use this when you need complete page content for detailed analysis.`,
      schema: z.object({
        pages: z
          .array(z.number())
          .describe("List of page numbers to retrieve (e.g., [1, 5, 10])"),
      }),
    }
  );

  /**
   * Search within a specific page range
   */
  const searchWithPageFilter = tool(
    async ({ query, startPage, endPage, k = 3 }) => {
      const client = await getWeaviateClient();

      try {
        const childCollection = client.collections.get(WeaviateCollection.CHILD_CLASS);

        // Perform hybrid search with page range filter
        const results = await childCollection.query.hybrid(query, {
          limit: k * 3, // Get more results to filter
          filters: Filters.and(
            childCollection.filter.byProperty("file_slug").equal(fileSlug),
            childCollection.filter.byProperty("page").greaterOrEqual(startPage),
            childCollection.filter.byProperty("page").lessOrEqual(endPage)
          ),
          returnMetadata: ["score"],
          includeVector: false,
        });

        if (results.objects.length === 0) {
          return `No results found in pages ${startPage}-${endPage}.`;
        }

        // Take top k results
        const topResults = results.objects.slice(0, k);

        let output = `Found ${topResults.length} results in pages ${startPage}-${endPage}:\n\n`;
        topResults.forEach((result: any, i: number) => {
          const props = result.properties;
          const score = result.metadata?.score || 0;
          const content =
            props.content.length > 250
              ? props.content.substring(0, 250) + "..."
              : props.content;

          output += `${i + 1}. [Page ${props.page}] (Score: ${score.toFixed(3)})\n${content}\n\n`;
        });

        return output;
      } catch (error) {
        console.error("Search with page filter failed:", error);
        throw error;
      } finally {
        await client.close();
      }
    },
    {
      name: "search_with_page_filter",
      description: `Search within a specific page range of the document "${filename}". Useful when you know the approximate location of information.`,
      schema: z.object({
        query: z.string().describe("The search query"),
        startPage: z.number().describe("Starting page number (inclusive)"),
        endPage: z.number().describe("Ending page number (inclusive)"),
        k: z
          .number()
          .optional()
          .default(3)
          .describe("Number of results to return (default: 3)"),
      }),
    }
  );

  /**
   * Find pages containing specific keywords
   */
  const findPagesByKeywords = tool(
    async ({ keywords }) => {
      if (!keywords || keywords.length === 0) {
        return "No keywords provided.";
      }

      const client = await getWeaviateClient();

      try {
        const childCollection = client.collections.get(WeaviateCollection.CHILD_CLASS);

        // Search for each keyword and collect unique page numbers
        const allPages = new Set<number>();

        for (const keyword of keywords) {
          const results = await childCollection.query.hybrid(keyword, {
            limit: 10,
            filters: childCollection.filter.byProperty("file_slug").equal(fileSlug),
            includeVector: false,
          });

          results.objects.forEach((obj: any) => {
            if (obj.properties.page) {
              allPages.add(obj.properties.page);
            }
          });
        }

        if (allPages.size === 0) {
          return `No pages found containing keywords: ${keywords.join(", ")}`;
        }

        const sortedPages = Array.from(allPages).sort((a, b) => a - b);
        return `Found ${sortedPages.length} pages containing keywords [${keywords.join(", ")}]:\nPages: ${sortedPages.join(", ")}`;
      } catch (error) {
        console.error("Find pages by keywords failed:", error);
        throw error;
      } finally {
        await client.close();
      }
    },
    {
      name: "find_pages_by_keywords",
      description: `Find page numbers in the document "${filename}" that contain specific keywords. Useful for locating sections on specific topics.`,
      schema: z.object({
        keywords: z
          .array(z.string())
          .describe('List of keywords to search for (e.g., ["TCFD", "net-zero", "emissions"])'),
      }),
    }
  );

  return [semanticSearch, getDocumentPages, searchWithPageFilter, findPagesByKeywords];
}
