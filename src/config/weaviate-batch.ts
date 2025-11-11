/**
 * Weaviate batch processing configuration
 *
 * These settings control how many documents are inserted in each batch
 * when uploading to Weaviate. Smaller batch sizes prevent exceeding
 * OpenAI's embedding API token limits (300k tokens per request).
 */

/**
 * Batch size for parent documents (full pages)
 *
 * Parent documents contain full page text which can be quite large.
 * Conservative batch size to avoid memory issues.
 *
 * Recommended: 25-100 documents per batch
 */
export const PARENT_BATCH_SIZE = 50;

/**
 * Batch size for child documents (text chunks)
 *
 * Child documents are smaller chunks (~1000 chars each) that need
 * to be embedded via OpenAI's API. OpenAI has a 300k token limit
 * per request, which is approximately:
 * - ~225k words
 * - ~200-250 chunks (assuming 1000 chars/chunk)
 *
 * We use a conservative batch size to leave margin for error and
 * to handle documents with dense technical content.
 *
 * Recommended: 50-150 chunks per batch
 */
export const CHILD_BATCH_SIZE = 100;

/**
 * Maximum retries for failed batches
 *
 * If a batch fails to insert, we can retry it this many times
 * before marking the documents as failed.
 */
export const MAX_BATCH_RETRIES = 2;

/**
 * Delay between batches in milliseconds
 *
 * Adding a small delay between batches can help avoid rate limiting
 * and reduce load on the embedding API.
 *
 * Set to 0 to disable delays.
 */
export const BATCH_DELAY_MS = 100;
