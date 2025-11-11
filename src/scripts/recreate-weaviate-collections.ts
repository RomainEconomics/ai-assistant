/**
 * Script to recreate Weaviate collections with the updated schema
 * This is useful when the schema has changed and existing collections need to be updated
 *
 * WARNING: This will delete all existing data in the collections!
 *
 * Usage: bun src/scripts/recreate-weaviate-collections.ts
 */

import { getWeaviateClient, createWeaviateCollections } from "../lib/weaviate.ts";
import { WeaviateCollection } from "../types/weaviate.ts";

async function recreateCollections() {
  console.log("🔄 Starting Weaviate collections recreation...\n");

  try {
    // Connect to Weaviate
    const client = await getWeaviateClient();
    console.log("✅ Connected to Weaviate");

    // Get existing collections
    const collections = await client.collections.listAll();
    const existingCollectionNames = Object.keys(collections).map(
      (key) => (collections as any)[key].name
    );

    console.log("📋 Existing collections:", existingCollectionNames);

    // Delete ParentDocument collection if it exists
    if (existingCollectionNames.includes(WeaviateCollection.PARENT_CLASS)) {
      console.log(`🗑️  Deleting collection: ${WeaviateCollection.PARENT_CLASS}`);
      await client.collections.delete(WeaviateCollection.PARENT_CLASS);
      console.log(`✅ Deleted: ${WeaviateCollection.PARENT_CLASS}`);
    }

    // Delete ChildDocument collection if it exists
    if (existingCollectionNames.includes(WeaviateCollection.CHILD_CLASS)) {
      console.log(`🗑️  Deleting collection: ${WeaviateCollection.CHILD_CLASS}`);
      await client.collections.delete(WeaviateCollection.CHILD_CLASS);
      console.log(`✅ Deleted: ${WeaviateCollection.CHILD_CLASS}`);
    }

    console.log("\n📦 Creating collections with updated schema...");

    // Create collections with the updated schema
    await createWeaviateCollections(client);

    // Verify the schema includes references
    console.log("\n🔍 Verifying schema...");
    const childCollection = client.collections.get(WeaviateCollection.CHILD_CLASS);
    const config = await childCollection.config.get();

    console.log("\n📋 ChildDocument schema:");
    console.log("   Properties:", Object.keys(config.properties || {}).join(", "));
    console.log("   References:", Object.keys(config.references || {}).join(", "));

    if (config.references && "parent_page" in config.references) {
      console.log("\n✅ SUCCESS: parent_page reference is present in ChildDocument!");
    } else {
      console.error("\n❌ ERROR: parent_page reference is missing!");
      process.exit(1);
    }

    console.log("\n✅ Collections recreated successfully!");
    console.log("\n⚠️  Note: You will need to re-upload and process your documents.");

    await client.close();
  } catch (error) {
    console.error("\n❌ Error recreating collections:", error);
    process.exit(1);
  }
}

// Run the script
recreateCollections();
