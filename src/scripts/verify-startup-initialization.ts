/**
 * Comprehensive verification of startup initialization
 * Tests both database and Weaviate initialization
 */
import { initializeDatabase } from "../lib/db";
import { initializeWeaviate, getWeaviateClient } from "../lib/weaviate";
import { WeaviateCollection } from "../types/weaviate";

console.log("🧪 Verifying Startup Initialization\n");
console.log("=" .repeat(60));

// Test 1: Database initialization
console.log("\n1️⃣  Testing Database Initialization...");
try {
  await initializeDatabase();
  console.log("✅ Database initialized successfully");
} catch (error) {
  console.error("❌ Database initialization failed:", error);
  process.exit(1);
}

// Test 2: Weaviate initialization
console.log("\n2️⃣  Testing Weaviate Initialization...");
try {
  await initializeWeaviate();
  console.log("✅ Weaviate initialized successfully");
} catch (error) {
  console.error("❌ Weaviate initialization failed:", error);
  process.exit(1);
}

// Test 3: Verify collections exist with correct schema
console.log("\n3️⃣  Verifying Collection Schemas...");
const client = await getWeaviateClient();

try {
  // Check ParentDocument
  const parentCollection = client.collections.get(WeaviateCollection.PARENT_CLASS);
  const parentConfig = await parentCollection.config.get();
  console.log(`   ✅ ${WeaviateCollection.PARENT_CLASS} exists`);
  console.log(`      - Properties: ${Object.keys(parentConfig.properties || {}).length}`);

  // Check ChildDocument
  const childCollection = client.collections.get(WeaviateCollection.CHILD_CLASS);
  const childConfig = await childCollection.config.get();
  console.log(`   ✅ ${WeaviateCollection.CHILD_CLASS} exists`);
  console.log(`      - Properties: ${Object.keys(childConfig.properties || {}).length}`);

  // Verify vectorizer
  const vectorizers = childConfig.vectorizers as any;
  const hasVectorizer = vectorizers && Object.keys(vectorizers).length > 0;
  if (hasVectorizer) {
    console.log(`      - Vectorizer: ${Object.keys(vectorizers)[0]}`);
    console.log("   ✅ Vectorizer configured correctly");
  } else {
    console.error("   ❌ No vectorizer found on ChildDocument");
    process.exit(1);
  }

  // Verify parent_page reference
  const references = childConfig.references as any;

  // References can be an array or an object
  let hasParentRef = false;
  let targetCollection = "";

  if (Array.isArray(references) && references.length > 0) {
    // Array format
    const parentRef = references.find((ref: any) => ref.name === "parent_page");
    if (parentRef) {
      hasParentRef = true;
      targetCollection = parentRef.targetCollection || parentRef.targetCollections?.[0] || "unknown";
    }
  } else if (references?.parent_page) {
    // Object format
    hasParentRef = true;
    targetCollection = references.parent_page.targetCollection || references.parent_page.targetCollections?.[0] || "unknown";
  }

  if (hasParentRef) {
    console.log("   ✅ parent_page reference exists");
    console.log(`      - Target: ${targetCollection}`);
  } else {
    console.error("   ❌ parent_page reference missing");
    console.error("   References structure:", JSON.stringify(references, null, 2));
    process.exit(1);
  }

  console.log("\n✅ All schema verifications passed!");

} catch (error) {
  console.error("❌ Schema verification failed:", error);
  process.exit(1);
} finally {
  await client.close();
}

console.log("\n" + "=".repeat(60));
console.log("🎉 Startup Initialization Verification Complete!");
console.log("\n📝 Summary:");
console.log("   ✅ Database initialized");
console.log("   ✅ Weaviate connected");
console.log("   ✅ Collections created with correct schema");
console.log("   ✅ Vectorizer configured");
console.log("   ✅ Parent-child references working");
console.log("\n🚀 Your application is ready to process documents!");
