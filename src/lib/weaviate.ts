/**
 * Weaviate client connection and collection management
 */
import weaviate, { WeaviateClient, vectorizer, dataType, Filters } from "weaviate-client";
import type { WeaviateConfig } from "../types/weaviate.ts";
import { WeaviateCollection } from "../types/weaviate.ts";

/**
 * Get Weaviate client configuration from environment
 */
export function getWeaviateConfig(): WeaviateConfig {
  const host = process.env.WEAVIATE_HOST || "http://localhost:8080";
  const apiKey = process.env.WEAVIATE_API_KEY;

  return {
    host,
    apiKey: apiKey || undefined,
  };
}

/**
 * Create a Weaviate client instance
 */
export async function getWeaviateClient(): Promise<WeaviateClient> {
  const config = getWeaviateConfig();

  const clientConfig: any = {
    scheme: config.host.startsWith("https") ? "https" : "http",
    host: config.host.replace(/^https?:\/\//, ""),
  };

  // Add API key if provided
  if (config.apiKey) {
    clientConfig.apiKey = config.apiKey;
  }

  // Add OpenAI API key for vectorization
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    clientConfig.headers = {
      "X-OpenAI-Api-Key": openaiKey,
    };
  }

  const client = await weaviate.connectToCustom(clientConfig);
  return client;
}

/**
 * Check if Weaviate is available
 */
export async function checkWeaviateHealth(): Promise<boolean> {
  try {
    const client = await getWeaviateClient();
    const isReady = await client.isReady();
    await client.close();
    return isReady;
  } catch (error) {
    console.error("Weaviate health check failed:", error);
    return false;
  }
}

/**
 * Initialize Weaviate - check health and create collections if needed
 * Called at application startup
 */
export async function initializeWeaviate(): Promise<void> {
  try {
    console.log("🔍 Checking Weaviate connection...");

    const isHealthy = await checkWeaviateHealth();
    if (!isHealthy) {
      console.warn("⚠️  Weaviate is not available - vector search features will be disabled");
      return;
    }

    console.log("✅ Weaviate is healthy");

    const client = await getWeaviateClient();
    try {
      await createWeaviateCollections(client);
      console.log("✅ Weaviate initialization complete");
    } finally {
      await client.close();
    }
  } catch (error) {
    console.error("❌ Failed to initialize Weaviate:", error);
    console.warn("⚠️  Vector search features may not work correctly");
  }
}

/**
 * Create Weaviate collections if they don't exist
 */
export async function createWeaviateCollections(
  client: WeaviateClient
): Promise<void> {
  try {
    // Get existing collections
    const collections = await client.collections.listAll();
    const existingCollectionNames = Object.keys(collections).map(
      (key) => (collections as any)[key].name
    );

    console.log("Existing collections:", existingCollectionNames);

    // Create ParentDocument collection if it doesn't exist
    if (!existingCollectionNames.includes(WeaviateCollection.PARENT_CLASS)) {
      console.log(`Creating collection: ${WeaviateCollection.PARENT_CLASS}`);

      await client.collections.create({
        name: WeaviateCollection.PARENT_CLASS,
        description:
          "Full page of a document (Parent Document). This is the parent of the ChildDocument class. No vectorizer is needed for this class since the similarity will be performed on the ChildDocument class.",
        vectorizers: vectorizer.none(),
        properties: [
          {
            name: "content",
            description: "The textual content of the document page",
            dataType: dataType.TEXT,
          },
          {
            name: "path",
            description: "The S3 path to the document",
            dataType: dataType.TEXT,
            tokenization: "field" as any,
          },
          {
            name: "company_id",
            description: "The company ID from PostgreSQL",
            dataType: dataType.INT,
          },
          {
            name: "company_name",
            description: "The company name",
            dataType: dataType.TEXT,
          },
          {
            name: "report_type",
            description: "The Report Type",
            dataType: dataType.TEXT,
          },
          {
            name: "page",
            description: "The Page Number of the file",
            dataType: dataType.INT,
          },
          {
            name: "filename",
            description: "Filename of the document",
            dataType: dataType.TEXT,
            tokenization: "field" as any,
          },
          {
            name: "file_id",
            description: "File ID from database",
            dataType: dataType.INT,
          },
          {
            name: "file_slug",
            description: "File slug UUID which uniquely identifies files",
            dataType: dataType.TEXT,
          },
          {
            name: "reporting_year",
            description: "The reporting year",
            dataType: dataType.INT,
          },
        ],
      });

      console.log(`✓ Created collection: ${WeaviateCollection.PARENT_CLASS}`);
    }

    // Create ChildDocument collection if it doesn't exist
    if (!existingCollectionNames.includes(WeaviateCollection.CHILD_CLASS)) {
      console.log(`Creating collection: ${WeaviateCollection.CHILD_CLASS}`);

      await client.collections.create({
        name: WeaviateCollection.CHILD_CLASS,
        description:
          "A chunk of a document (Child Document). This is the child of the ParentDocument class. The vectorizer is needed for this class since the similarity will be performed on the ChildDocument class.",
        vectorizers: vectorizer.text2VecOpenAI({
          model: "text-embedding-3-small",
        }),
        properties: [
          {
            name: "content",
            description: "The textual content of the document chunk",
            dataType: dataType.TEXT,
          },
          {
            name: "path",
            description: "The S3 path to the document",
            dataType: dataType.TEXT,
            tokenization: "field" as any,
            skipVectorization: true,
          },
          {
            name: "company_id",
            description: "The company ID from PostgreSQL",
            dataType: dataType.INT,
          },
          {
            name: "company_name",
            description: "The company name",
            dataType: dataType.TEXT,
            skipVectorization: true,
          },
          {
            name: "report_type",
            description: "The Report Type",
            dataType: dataType.TEXT,
            skipVectorization: true,
          },
          {
            name: "page",
            description: "The Page Number of the file",
            dataType: dataType.INT,
          },
          {
            name: "filename",
            description: "Filename of the document",
            dataType: dataType.TEXT,
            tokenization: "field" as any,
          },
          {
            name: "file_id",
            description: "File ID from database",
            dataType: dataType.INT,
          },
          {
            name: "file_slug",
            description: "File slug UUID which uniquely identifies files",
            dataType: dataType.TEXT,
            skipVectorization: true,
          },
          {
            name: "reporting_year",
            description: "The reporting year",
            dataType: dataType.INT,
          },
        ],
        references: [
          {
            name: "parent_page",
            targetCollection: WeaviateCollection.PARENT_CLASS,
            description: "The parent document this child document belongs to",
          },
        ],
      });

      console.log(`✓ Created collection: ${WeaviateCollection.CHILD_CLASS}`);
    }

    console.log("✓ All Weaviate collections are ready");
  } catch (error) {
    console.error("Failed to create Weaviate collections:", error);
    throw error;
  }
}

/**
 * Retrieve page content from Weaviate ParentDocument collection
 * @param fileSlug - The file slug (UUID) of the document
 * @param pageNumbers - Array of page numbers to retrieve
 * @returns Array of page content objects
 */
export async function getDocumentPages(
  fileSlug: string,
  pageNumbers: number[]
): Promise<Array<{ page: number; content: string; filename: string }>> {
  const client = await getWeaviateClient();

  try {
    const collection = client.collections.get(WeaviateCollection.PARENT_CLASS);

    // Query for pages matching the file_slug and page numbers
    const results = await collection.query.fetchObjects({
      filters: Filters.and(
        collection.filter.byProperty("file_slug").equal(fileSlug),
        collection.filter.byProperty("page").containsAny(pageNumbers)
      ),
      limit: pageNumbers.length,
    });

    // Map results to a simpler format
    const pages = results.objects.map((obj: any) => ({
      page: obj.properties.page,
      content: obj.properties.content,
      filename: obj.properties.filename,
    }));

    // Sort by page number
    pages.sort((a, b) => a.page - b.page);

    return pages;
  } catch (error) {
    console.error(`Failed to retrieve pages for file_slug ${fileSlug}:`, error);
    throw error;
  } finally {
    await client.close();
  }
}

/**
 * Retrieve page content for multiple documents
 * Useful for conversation context where multiple docs are attached
 */
export async function getMultipleDocumentPages(
  documents: Array<{ file_slug: string; page_numbers: number[] }>
): Promise<Array<{ document_slug: string; pages: Array<{ page: number; content: string; filename: string }> }>> {
  const results = await Promise.all(
    documents.map(async (doc) => {
      const pages = await getDocumentPages(doc.file_slug, doc.page_numbers);
      return {
        document_slug: doc.file_slug,
        pages,
      };
    })
  );

  return results;
}

/**
 * RAG Search: Perform semantic search on ChildDocument chunks and retrieve parent pages
 * @param query - User's search query
 * @param documentIds - Array of document IDs to search within
 * @param limit - Maximum number of parent pages to retrieve (default: 5)
 * @returns Array of unique parent pages with relevance scores
 */
export async function ragSearch(
  query: string,
  documentIds: number[],
  limit: number = 5
): Promise<Array<{
  page: number;
  content: string;
  filename: string;
  file_id: number;
  company_name: string;
  score: number;
}>> {
  const client = await getWeaviateClient();

  try {
    const childCollection = client.collections.get(WeaviateCollection.CHILD_CLASS);

    // Perform hybrid search (combines vector similarity + BM25)
    const results = await childCollection.query.hybrid(query, {
      limit: 20, // Get more chunks to ensure we have diverse pages
      filters: childCollection.filter.byProperty("file_id").containsAny(documentIds),
      returnMetadata: ['score'],
      includeVector: false,
    });

    console.log(`[RAG] Found ${results.objects.length} matching chunks for query: "${query.substring(0, 100)}..."`);

    // Extract unique parent page references
    const pageMap = new Map<string, {
      page: number;
      content: string;
      filename: string;
      file_id: number;
      company_name: string;
      score: number;
    }>();

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
          console.error(`[RAG] Failed to fetch parent page for ${pageKey}:`, error);
        }
      }
    }

    // Convert to array and sort by score (highest first)
    const pages = Array.from(pageMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    console.log(`[RAG] Retrieved ${pages.length} unique pages (limit: ${limit})`);
    console.log(`[RAG] Page distribution:`, pages.map(p => `${p.filename} p${p.page}`).join(', '));

    return pages;
  } catch (error) {
    console.error(`[RAG] Search failed:`, error);
    throw error;
  } finally {
    await client.close();
  }
}
