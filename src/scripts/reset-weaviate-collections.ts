/**
 * Script to delete and recreate Weaviate collections
 * Use this if collections were created without proper vectorizer configuration
 */

import { getWeaviateClient, createWeaviateCollections } from "../lib/weaviate.ts";
import { WeaviateCollection } from "../types/weaviate.ts";

async function resetWeaviateCollections() {
  console.log("=".repeat(60));
  console.log("Resetting Weaviate Collections");
  console.log("=".repeat(60));

  try {
    const client = await getWeaviateClient();

    // Step 1: List existing collections
    console.log("\n[1/3] Checking existing collections...");
    const collections = await client.collections.listAll();
    const existingCollectionNames = Object.keys(collections).map(
      (key) => (collections as any)[key].name
    );
    console.log("Found collections:", existingCollectionNames);

    // Step 2: Delete existing collections
    console.log("\n[2/3] Deleting existing collections...");

    if (existingCollectionNames.includes(WeaviateCollection.CHILD_CLASS)) {
      console.log(`  Deleting ${WeaviateCollection.CHILD_CLASS}...`);
      await client.collections.delete(WeaviateCollection.CHILD_CLASS);
      console.log(`  ✓ Deleted ${WeaviateCollection.CHILD_CLASS}`);
    }

    if (existingCollectionNames.includes(WeaviateCollection.PARENT_CLASS)) {
      console.log(`  Deleting ${WeaviateCollection.PARENT_CLASS}...`);
      await client.collections.delete(WeaviateCollection.PARENT_CLASS);
      console.log(`  ✓ Deleted ${WeaviateCollection.PARENT_CLASS}`);
    }

    // Step 3: Recreate collections
    console.log("\n[3/3] Creating collections with proper configuration...");
    await createWeaviateCollections(client);

    console.log("\n" + "=".repeat(60));
    console.log("✓ Collections reset successfully!");
    console.log("=".repeat(60));
    console.log("\nNote: You will need to re-upload your documents.");

    await client.close();
  } catch (error: any) {
    console.error("\n❌ Failed to reset collections:");
    console.error(error);
    process.exit(1);
  }
}

// Run the script
resetWeaviateCollections();
