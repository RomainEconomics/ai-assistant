/**
 * Fix Weaviate Schema - Delete and recreate collections with proper configuration
 */
import { getWeaviateClient, createWeaviateCollections } from "../lib/weaviate.ts";

async function fixWeaviateSchema() {
  console.log("🔧 Fixing Weaviate schema...\n");

  const client = await getWeaviateClient();

  try {
    // Check if collections exist
    const collections = await client.collections.listAll();
    const existingCollectionNames = Object.keys(collections).map(
      (key) => (collections as any)[key].name
    );

    console.log("📋 Existing collections:", existingCollectionNames);

    // Delete existing collections
    for (const collectionName of ["ChildDocument", "ParentDocument"]) {
      if (existingCollectionNames.includes(collectionName)) {
        console.log(`\n🗑️  Deleting collection: ${collectionName}`);
        await client.collections.delete(collectionName);
        console.log(`✅ Deleted: ${collectionName}`);
      }
    }

    console.log("\n📦 Creating collections with proper schema...\n");

    // Create collections with proper configuration
    await createWeaviateCollections(client);

    console.log("\n✅ Weaviate schema fixed successfully!");
    console.log("\n📝 Verifying schema...\n");

    // Verify the schema
    const newCollections = await client.collections.listAll();
    console.log("Collections:", Object.keys(newCollections).map((key) => (newCollections as any)[key].name));

  } catch (error) {
    console.error("❌ Failed to fix Weaviate schema:", error);
    throw error;
  } finally {
    await client.close();
  }
}

// Run the fix
fixWeaviateSchema()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
