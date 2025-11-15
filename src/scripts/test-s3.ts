/**
 * Test script for S3 connection and operations
 */

import {
  getS3Credentials,
  generateFileKey,
  calculateFileHash,
  uploadToS3,
  existsInS3,
  getS3FileMetadata,
  listS3Files,
  deleteFromS3,
} from "../lib/s3-storage.ts";

async function testS3Connection() {
  console.log("=".repeat(60));
  console.log("Testing S3 Connection and Operations");
  console.log("=".repeat(60));

  try {
    // Step 1: Get credentials
    console.log("\n[1/6] Getting S3 credentials...");
    const credentials = getS3Credentials();
    console.log("✓ Credentials loaded");
    console.log(`  Bucket: ${credentials.bucket}`);
    console.log(`  Endpoint: ${credentials.endpoint}`);
    console.log(`  Region: ${credentials.region}`);

    // Step 2: List files in project folder
    console.log("\n[2/6] Listing files in app-storage folder...");
    const files = await listS3Files("app-storage/", 10);
    console.log(`✓ Found ${files.length} files in app-storage/`);
    if (files.length > 0) {
      files.forEach((file) => {
        console.log(`  - ${file.key} (${file.size} bytes)`);
      });
    }

    // Step 3: Generate test file key
    console.log("\n[3/6] Generating test file key...");
    const testContent = "Hello from AI Assistant! This is a test file.";
    const testBuffer = Buffer.from(testContent);
    const testHash = calculateFileHash(testBuffer);
    const testKey = generateFileKey({
      filename: "test-file.txt",
      companyId: 1,
      year: 2024,
      fileHash: testHash,
      prefix: "test",
    });
    console.log(`✓ Generated key: ${testKey}`);

    // Step 4: Upload test file
    console.log("\n[4/6] Uploading test file...");
    const uploadResult = await uploadToS3({
      key: testKey,
      body: testBuffer,
      contentType: "text/plain",
      metadata: {
        test: "true",
        timestamp: new Date().toISOString(),
      },
    });

    if (!uploadResult.success) {
      console.error("❌ Upload failed:", uploadResult.error);
      process.exit(1);
    }

    console.log("✓ File uploaded successfully");
    console.log(`  Key: ${uploadResult.key}`);
    console.log(`  Size: ${uploadResult.size} bytes`);
    console.log(`  URL: ${uploadResult.url}`);

    // Step 5: Verify file exists and get metadata
    console.log("\n[5/6] Verifying file exists...");
    const exists = await existsInS3(testKey);

    if (!exists) {
      console.error("❌ File not found in S3");
      process.exit(1);
    }

    console.log("✓ File exists");

    const metadata = await getS3FileMetadata(testKey);
    if (metadata) {
      console.log("  Metadata:");
      console.log(`    Size: ${metadata.size} bytes`);
      console.log(`    Last Modified: ${metadata.lastModified}`);
      console.log(`    Content Type: ${metadata.contentType}`);
      if (metadata.metadata) {
        console.log(`    Custom Metadata:`, metadata.metadata);
      }
    }

    // Step 6: Clean up - delete test file
    console.log("\n[6/6] Cleaning up test file...");
    const deleted = await deleteFromS3(testKey);

    if (!deleted) {
      console.warn("⚠️  Failed to delete test file");
    } else {
      console.log("✓ Test file deleted");
    }

    console.log("\n" + "=".repeat(60));
    console.log("✓ All S3 tests passed!");
    console.log("=".repeat(60));
  } catch (error: any) {
    console.error("\n❌ Test failed:");
    console.error(error);

    if (error.message?.includes("credentials not found")) {
      console.error("\nMake sure S3 credentials are set in your .env file:");
      console.error("  S3_ACCESS_KEY_ID=your_access_key");
      console.error("  S3_SECRET_ACCESS_KEY=your_secret_key");
    } else if (error.message?.includes("ECONNREFUSED")) {
      console.error("\nMake sure the S3 endpoint is accessible:");
      console.error("  S3_ENDPOINT=https://your-s3-endpoint.com/ (optional, defaults to AWS S3)");
    }

    process.exit(1);
  }
}

// Run the test
testS3Connection();
