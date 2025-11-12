/**
 * Test startup behavior when Weaviate is not available
 */
import { initializeWeaviate } from "../lib/weaviate";

// Temporarily override WEAVIATE_HOST to point to non-existent server
const originalHost = process.env.WEAVIATE_HOST;
process.env.WEAVIATE_HOST = "http://localhost:9999"; // Non-existent port

console.log("🧪 Testing startup without Weaviate...\n");

await initializeWeaviate();

// Restore original host
process.env.WEAVIATE_HOST = originalHost;

console.log("\n✅ Application can start even when Weaviate is unavailable");
console.log("📝 Vector search features would be gracefully disabled");
