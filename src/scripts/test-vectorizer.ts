/**
 * Test script to verify vectorizer is working
 */

import { getWeaviateClient } from "../lib/weaviate.ts";
import { WeaviateCollection } from "../types/weaviate.ts";

async function testVectorizer() {
  console.log("=".repeat(60));
  console.log("Testing Weaviate Vectorizer");
  console.log("=".repeat(60));

  try {
    const client = await getWeaviateClient();

    // Step 1: Insert a test document chunk
    console.log("\n[1/3] Inserting test document chunk...");
    const childCollection = client.collections.get(WeaviateCollection.CHILD_CLASS);

    const insertResult = await childCollection.data.insert({
      properties: {
        content: "This is a test document about climate change and greenhouse gas emissions.",
        path: "test/document.pdf",
        company_id: 1,
        company_name: "Test Company",
        report_type: "Sustainability Report",
        page: 1,
        filename: "test-document.pdf",
        file_id: 1,
        file_slug: "test-slug-123",
        reporting_year: 2024,
      },
    });

    console.log("✓ Inserted test document with UUID:", insertResult);

    // Step 2: Perform a semantic search using nearText
    console.log("\n[2/3] Performing semantic search...");
    const searchResults = await childCollection.query.nearText("greenhouse gas emissions", {
      limit: 1,
      returnMetadata: ["distance"],
    });

    console.log(`✓ Found ${searchResults.objects.length} results`);
    if (searchResults.objects.length > 0) {
      const result = searchResults.objects[0];
      console.log("  Top result:");
      console.log(`    Content: ${(result.properties as any).content.substring(0, 100)}...`);
      console.log(`    Distance: ${(result.metadata as any)?.distance}`);
    }

    // Step 3: Clean up test data
    console.log("\n[3/3] Cleaning up test data...");
    await childCollection.data.deleteById(insertResult);
    console.log("✓ Deleted test document");

    console.log("\n" + "=".repeat(60));
    console.log("✓ Vectorizer is working correctly!");
    console.log("=".repeat(60));

    await client.close();
  } catch (error: any) {
    console.error("\n❌ Test failed:");
    console.error(error);

    if (error.message?.includes("VectorFromInput was called without vectorizer")) {
      console.error("\n💡 The OpenAI API key might not be configured in Weaviate.");
      console.error("   Check that docker-compose.yml has: OPENAI_APIKEY: ${OPENAI_API_KEY}");
      console.error("   Then restart with: docker compose restart weaviate");
    }

    process.exit(1);
  }
}

// Run the test
testVectorizer();
