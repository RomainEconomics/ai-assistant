/**
 * Test script for Weaviate connection and collection creation
 */

import {
  getWeaviateClient,
  checkWeaviateHealth,
  createWeaviateCollections,
} from "../lib/weaviate.ts";
import { WeaviateCollection } from "../types/weaviate.ts";

async function testWeaviate() {
  console.log("=".repeat(60));
  console.log("Testing Weaviate Connection and Collection Creation");
  console.log("=".repeat(60));

  try {
    // Step 1: Health check
    console.log("\n[1/4] Checking Weaviate health...");
    const isHealthy = await checkWeaviateHealth();

    if (!isHealthy) {
      console.error("❌ Weaviate is not available");
      console.error("\nMake sure Weaviate is running:");
      console.error("  docker-compose up -d weaviate");
      process.exit(1);
    }

    console.log("✓ Weaviate is healthy");

    // Step 2: Connect to Weaviate
    console.log("\n[2/4] Connecting to Weaviate...");
    const client = await getWeaviateClient();
    console.log("✓ Connected to Weaviate");

    try {
      // Step 3: List existing collections
      console.log("\n[3/4] Listing existing collections...");
      const collections = await client.collections.listAll();
      const collectionNames = Object.keys(collections);

      console.log(`Found ${collectionNames.length} collections:`);
      collectionNames.forEach((name) => {
        console.log(`  - ${name}`);
      });

      // Step 4: Create collections
      console.log("\n[4/4] Creating/verifying collections...");
      await createWeaviateCollections(client);

      // Verify collections were created
      console.log("\nVerifying collections...");

      // Try to get the collections directly
      let hasParent = false;
      let hasChild = false;

      try {
        const parentCollection = client.collections.get(
          WeaviateCollection.PARENT_CLASS
        );
        hasParent = true;
      } catch (e) {
        hasParent = false;
      }

      try {
        const childCollection = client.collections.get(
          WeaviateCollection.CHILD_CLASS
        );
        hasChild = true;
      } catch (e) {
        hasChild = false;
      }

      if (hasParent && hasChild) {
        console.log("✓ All collections created successfully");

        console.log("\nCollection details:");
        console.log(`  ${WeaviateCollection.PARENT_CLASS}:`);
        console.log(`    - Description: Full page documents (no vectorizer)`);

        console.log(`  ${WeaviateCollection.CHILD_CLASS}:`);
        console.log(`    - Description: Document chunks (with text2vec-openai)`);
        console.log(
          `    - Reference: parent_page -> ${WeaviateCollection.PARENT_CLASS}`
        );
      } else {
        console.error("❌ Failed to create all collections");
        if (!hasParent) {
          console.error(`  Missing: ${WeaviateCollection.PARENT_CLASS}`);
        }
        if (!hasChild) {
          console.error(`  Missing: ${WeaviateCollection.CHILD_CLASS}`);
        }
        process.exit(1);
      }
    } finally {
      await client.close();
    }

    console.log("\n" + "=".repeat(60));
    console.log("✓ All tests passed!");
    console.log("=".repeat(60));
  } catch (error: any) {
    console.error("\n❌ Test failed:");
    console.error(error);

    if (error.message?.includes("ECONNREFUSED")) {
      console.error("\nMake sure Weaviate is running:");
      console.error("  docker-compose up -d weaviate");
    } else if (error.message?.includes("OpenAI")) {
      console.error("\nMake sure OPENAI_API_KEY is set in your .env file");
    }

    process.exit(1);
  }
}

// Run the test
testWeaviate();
