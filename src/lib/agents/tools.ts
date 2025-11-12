/**
 * Weaviate-based tools for ESG agent system
 * Adapted from playground to use existing Weaviate setup
 */

import { tool } from "ai";
import { z } from "zod";
import weaviate, { type WeaviateClient, Filters } from "weaviate-client";

export class WeaviateTools {
  private client: Promise<WeaviateClient>;
  private collectionName: string;

  constructor(weaviateUrl: string, collectionName = "ChildDocument") {
    const config = {
      scheme: weaviateUrl.startsWith("https") ? "https" : "http",
      host: weaviateUrl.replace(/^https?:\/\//, ""),
      headers: process.env.OPENAI_API_KEY
        ? { "X-OpenAI-Api-Key": process.env.OPENAI_API_KEY }
        : undefined,
    };

    this.client = weaviate.connectToCustom(config);
    this.collectionName = collectionName;
  }

  /**
   * Create all tools for the agent system
   */
  createTools(fileSlug?: string) {
    const semanticSearch = tool({
      description:
        "Search the document using semantic similarity to find relevant content",
      inputSchema: z.object({
        query: z.string().describe("The search query to find relevant content"),
        k: z
          .number()
          .optional()
          .default(5)
          .describe("Number of results to return (max 10)"),
      }),
      execute: async ({ query, k = 5 }) => {
        // Limit to max 10 to avoid overwhelming the context
        k = Math.min(k, 10);
        try {
          const client = await this.client;
          const collection = client.collections.get(this.collectionName);

          // Build query with optional file filter using v3 API
          const queryOptions: any = {
            limit: k,
            returnMetadata: ["distance"],
            includeVector: false,
          };

          if (fileSlug) {
            queryOptions.filters = collection.filter
              .byProperty("file_slug")
              .equal(fileSlug);
          }

          const result = await collection.query.nearText(query, queryOptions);

          if (!result.objects || result.objects.length === 0) {
            return "No results found for the query.";
          }

          let output = `Found ${result.objects.length} relevant passages:\n\n`;
          result.objects.forEach((obj, i) => {
            const props = obj.properties as any;
            const page = props.page || "unknown";
            const content = String(props.content || "");
            output += `${i + 1}. [Page ${page}]\n${content}\n\n`;
          });

          return output;
        } catch (error) {
          return `Error performing semantic search: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    });

    const getDocumentPages = tool({
      description: "Get full content from specific document pages",
      inputSchema: z.object({
        pages: z
          .array(z.number())
          .max(10)
          .describe("List of page numbers to retrieve (max 10)"),
      }),
      execute: async ({ pages }) => {
        if (!pages || pages.length === 0) {
          return "No pages specified.";
        }

        // Limit to max 10 pages to avoid overwhelming context
        if (pages.length > 10) {
          pages = pages.slice(0, 10);
        }

        try {
          // Get ParentDocument collection for full page content
          const client = await this.client;
          const parentCollection = client.collections.get("ParentDocument");

          let filters;
          if (pages.length === 1) {
            filters = parentCollection.filter
              .byProperty("page")
              .equal(pages[0]);
          } else {
            filters = Filters.or(
              ...pages.map((p) =>
                parentCollection.filter.byProperty("page").equal(p),
              ),
            );
          }

          // Add file slug filter if provided
          if (fileSlug) {
            filters = Filters.and(
              filters,
              parentCollection.filter.byProperty("file_slug").equal(fileSlug),
            );
          }

          const result = await parentCollection.query.fetchObjects({
            filters,
            limit: 100,
          });

          if (!result.objects || result.objects.length === 0) {
            return `No content found for pages: ${pages}`;
          }

          let text = "";
          result.objects.forEach((obj) => {
            const props = obj.properties as any;
            const page = props.page;
            const content = props.content;
            text += `=== Page ${page} ===\n${content}\n\n`;
          });

          return text;
        } catch (error) {
          return `Error retrieving document pages: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    });

    const searchWithPageFilter = tool({
      description: "Search within a specific page range using semantic search",
      inputSchema: z.object({
        query: z.string().describe("The search query"),
        start_page: z.number().describe("Starting page number (inclusive)"),
        end_page: z.number().describe("Ending page number (inclusive)"),
        k: z
          .number()
          .optional()
          .default(5)
          .describe("Number of results to return (max 10)"),
      }),
      execute: async ({ query, start_page, end_page, k = 5 }) => {
        // Limit to max 10 results
        k = Math.min(k, 10);
        try {
          const client = await this.client;
          const collection = client.collections.get(this.collectionName);

          // Search with page range filter using v3 API
          let filters = Filters.and(
            collection.filter.byProperty("page").greaterOrEqual(start_page),
            collection.filter.byProperty("page").lessOrEqual(end_page),
          );

          // Add file slug filter if provided
          if (fileSlug) {
            filters = Filters.and(
              filters,
              collection.filter.byProperty("file_slug").equal(fileSlug),
            );
          }

          const result = await collection.query.nearText(query, {
            limit: k * 3,
            filters,
            returnMetadata: ["distance"],
            includeVector: false,
          });

          if (!result.objects || result.objects.length === 0) {
            return `No results found in pages ${start_page}-${end_page}.`;
          }

          // Take only k results
          const filtered = result.objects.slice(0, k);

          let output = `Found ${filtered.length} results in pages ${start_page}-${end_page}:\n\n`;
          filtered.forEach((obj, i) => {
            const props = obj.properties as any;
            const page = props.page || "unknown";
            const content = String(props.content || "");
            output += `${i + 1}. [Page ${page}]\n${content}\n\n`;
          });

          return output;
        } catch (error) {
          return `Error searching with page filter: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    });

    const findPagesByKeywords = tool({
      description:
        "Find page numbers that contain specific keywords using semantic search",
      inputSchema: z.object({
        keywords: z
          .array(z.string())
          .describe("List of keywords to search for"),
      }),
      execute: async ({ keywords }) => {
        if (!keywords || keywords.length === 0) {
          return "No keywords provided.";
        }

        try {
          const client = await this.client;
          const collection = client.collections.get(this.collectionName);
          const allPages = new Set<number>();

          // Search for each keyword using v3 API
          for (const keyword of keywords) {
            const queryOptions: any = {
              limit: 10,
              returnMetadata: ["distance"],
              includeVector: false,
            };

            if (fileSlug) {
              queryOptions.filters = collection.filter
                .byProperty("file_slug")
                .equal(fileSlug);
            }

            const result = await collection.query.nearText(
              keyword,
              queryOptions,
            );

            if (result.objects) {
              result.objects.forEach((obj) => {
                const props = obj.properties as any;
                const page = props.page;
                if (typeof page === "number") {
                  allPages.add(page);
                }
              });
            }
          }

          if (allPages.size === 0) {
            return `No pages found containing keywords: ${keywords.join(", ")}`;
          }

          const sortedPages = Array.from(allPages).sort((a, b) => a - b);
          return `Found ${sortedPages.length} pages containing keywords [${keywords.join(", ")}]:\nPages: ${sortedPages.join(", ")}`;
        } catch (error) {
          return `Error finding pages by keywords: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    });

    return {
      semanticSearch,
      getDocumentPages,
      searchWithPageFilter,
      findPagesByKeywords,
    };
  }
}
