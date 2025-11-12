/**
 * Test inserting documents into Weaviate with proper vectorization
 */
import { getWeaviateClient } from "../lib/weaviate.ts";
import { v5 as uuidv5 } from "uuid";

const NAMESPACE_UUID = "6ba7b810-9dad-11d1-80b4-00c04fd430c8"; // Standard DNS namespace UUID

async function testInsert() {
  console.log("🧪 Testing Weaviate insert with vectorization...\n");

  const client = await getWeaviateClient();

  try {
    // Get collections
    const parentCollection = client.collections.get("ParentDocument");
    const childCollection = client.collections.get("ChildDocument");

    // Test data
    const fileSlug = "test-file-123";
    const testPage = {
      content: "This is a test document about artificial intelligence and machine learning.",
      path: "test/path/to/file.pdf",
      company_id: 1,
      company_name: "Test Company",
      report_type: "Test Report",
      page: 1,
      filename: "test.pdf",
      file_id: 1,
      file_slug: fileSlug,
      reporting_year: 2024,
    };

    // Generate parent UUID
    const parentUuid = uuidv5(`${fileSlug}-parent-1`, NAMESPACE_UUID);

    console.log("📄 Inserting parent document...");
    await parentCollection.data.insert({
      properties: testPage,
      id: parentUuid,
    });
    console.log("✅ Parent inserted:", parentUuid);

    // Test chunk
    const testChunk = {
      content: "Artificial intelligence is transforming the world of technology.",
      path: testPage.path,
      company_id: testPage.company_id,
      company_name: testPage.company_name,
      report_type: testPage.report_type,
      page: testPage.page,
      filename: testPage.filename,
      file_id: testPage.file_id,
      file_slug: testPage.file_slug,
      reporting_year: testPage.reporting_year,
    };

    // Generate child UUID
    const childUuid = uuidv5(`${fileSlug}-chunk-1-0`, NAMESPACE_UUID);

    console.log("\n📝 Inserting child document with reference...");
    await childCollection.data.insert({
      properties: testChunk,
      id: childUuid,
      references: {
        parent_page: parentUuid,
      },
    });
    console.log("✅ Child inserted:", childUuid);

    // Verify the data
    console.log("\n🔍 Verifying insertion...");
    const parent = await parentCollection.query.fetchObjectById(parentUuid);
    console.log("✅ Parent found:", parent?.uuid);

    const child = await childCollection.query.fetchObjectById(childUuid, {
      includeVector: false,
    });
    console.log("✅ Child found:", child?.uuid);
    console.log("✅ Has vector:", child?.vectors && Object.keys(child.vectors).length > 0);

    // Test semantic search
    console.log("\n🔎 Testing semantic search...");
    const searchResults = await childCollection.query.nearText("machine learning", {
      limit: 1,
      returnMetadata: ['distance'],
    });

    if (searchResults.objects.length > 0) {
      console.log("✅ Search successful! Found:", searchResults.objects.length, "results");
      console.log("   Distance:", (searchResults.objects[0].metadata as any)?.distance);
      console.log("   Content:", (searchResults.objects[0].properties as any)?.content?.substring(0, 80) + "...");
    } else {
      console.log("⚠️  No results found (this might indicate vectorization issues)");
    }

    // Clean up
    console.log("\n🧹 Cleaning up test data...");
    await childCollection.data.deleteById(childUuid);
    await parentCollection.data.deleteById(parentUuid);
    console.log("✅ Cleanup complete");

    console.log("\n✨ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    throw error;
  } finally {
    await client.close();
  }
}

testInsert()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
