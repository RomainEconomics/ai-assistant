/**
 * S3 storage utility using Bun's built-in S3Client
 */
import { S3Client } from "bun";
import { createHash } from "crypto";
import type {
  S3Credentials,
  S3UploadOptions,
  S3UploadResult,
  S3FileMetadata,
  FileKeyOptions,
} from "../types/s3.ts";

/**
 * Get S3 credentials from environment
 */
export function getS3Credentials(): S3Credentials {
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET || "ai-assistant-storage";
  const endpoint = process.env.S3_ENDPOINT || "https://s3.gra.io.cloud.ovh.net/";
  const region = process.env.S3_REGION || "gra";

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("S3 credentials not found in environment variables");
  }

  return {
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    region,
  };
}

/**
 * Generate a file key for S3 storage
 * Format: app-storage/{prefix}/{year}/{entity_id}/{hash}/{filename}
 */
export function generateFileKey(options: FileKeyOptions): string {
  const { filename, companyId, year, fileHash, prefix = "documents" } = options;

  // Project-specific root folder
  const projectRoot = "app-storage";

  // Sanitize filename
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

  // Build path components
  const parts = [projectRoot, prefix];

  if (year) {
    parts.push(year.toString());
  }

  if (companyId) {
    parts.push(`entity_${companyId}`);
  }

  if (fileHash) {
    // Use first 8 chars of hash as subdirectory
    parts.push(fileHash.substring(0, 8));
  }

  parts.push(sanitizedFilename);

  return parts.join("/");
}

/**
 * Calculate SHA256 hash of a buffer
 */
export function calculateFileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(
  options: S3UploadOptions
): Promise<S3UploadResult> {
  try {
    const credentials = getS3Credentials();

    const { key, body, contentType = "application/octet-stream", metadata } = options;

    // Convert Buffer to Uint8Array if needed
    const data = body instanceof Buffer ? new Uint8Array(body) : body;

    // Upload using Bun's S3Client
    await S3Client.write(
      key,
      data,
      {
        type: contentType,
        metadata: metadata || {},
      },
      credentials
    );

    // Get file size
    const size = data.length;

    // Construct URL
    const url = `${credentials.endpoint}${credentials.bucket}/${key}`;

    console.log(`✓ Uploaded to S3: ${key} (${size} bytes)`);

    return {
      success: true,
      key,
      url,
      size,
    };
  } catch (error: any) {
    console.error("Failed to upload to S3:", error);
    return {
      success: false,
      key: options.key,
      url: "",
      size: 0,
      error: error?.message || String(error),
    };
  }
}

/**
 * Check if a file exists in S3
 */
export async function existsInS3(key: string): Promise<boolean> {
  try {
    const credentials = getS3Credentials();
    return await S3Client.exists(key, credentials);
  } catch (error) {
    console.error(`Failed to check S3 existence for ${key}:`, error);
    return false;
  }
}

/**
 * Get file metadata from S3
 */
export async function getS3FileMetadata(
  key: string
): Promise<S3FileMetadata | null> {
  try {
    const credentials = getS3Credentials();
    const stat = await S3Client.stat(key, credentials);

    if (!stat) {
      return null;
    }

    return {
      key,
      size: stat.size,
      lastModified: stat.lastModified,
      contentType: stat.type,
      metadata: stat.metadata,
    };
  } catch (error) {
    console.error(`Failed to get S3 metadata for ${key}:`, error);
    return null;
  }
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(key: string): Promise<boolean> {
  try {
    const credentials = getS3Credentials();
    await S3Client.delete(key, credentials);
    console.log(`✓ Deleted from S3: ${key}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete from S3 ${key}:`, error);
    return false;
  }
}

/**
 * List files in S3 with a given prefix
 */
export async function listS3Files(
  prefix: string,
  maxKeys: number = 1000
): Promise<Array<{ key: string; size: number; lastModified: Date }>> {
  try {
    const credentials = getS3Credentials();

    const result = await S3Client.list(
      {
        prefix,
        maxKeys,
      },
      credentials
    );

    if (!result.contents) {
      return [];
    }

    return result.contents.map((item) => ({
      key: item.key,
      size: item.size,
      lastModified: item.lastModified,
    }));
  } catch (error) {
    console.error(`Failed to list S3 files with prefix ${prefix}:`, error);
    return [];
  }
}

/**
 * Download a file from S3
 */
export async function downloadFromS3(key: string): Promise<Buffer | null> {
  try {
    const credentials = getS3Credentials();

    // Get S3File object
    const s3file = S3Client.file(key, credentials);

    // Read as ArrayBuffer
    const arrayBuffer = await s3file.arrayBuffer();

    if (!arrayBuffer) {
      return null;
    }

    // Convert ArrayBuffer to Buffer
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error(`Failed to download from S3 ${key}:`, error);
    return null;
  }
}

/**
 * Upload a PDF file to S3 with automatic key generation
 */
export async function uploadPDFToS3(
  filename: string,
  buffer: Buffer,
  options: {
    companyId?: number;
    companyName?: string;
    reportingYear?: number;
    fileId?: number;
  }
): Promise<S3UploadResult> {
  // Calculate file hash
  const fileHash = calculateFileHash(buffer);

  // Generate key
  const key = generateFileKey({
    filename,
    companyId: options.companyId,
    year: options.reportingYear,
    fileHash,
  });

  // Prepare metadata
  const metadata: Record<string, string> = {
    filename,
    file_hash: fileHash,
    upload_date: new Date().toISOString(),
  };

  if (options.fileId) {
    metadata.file_id = options.fileId.toString();
  }

  if (options.companyId) {
    metadata.company_id = options.companyId.toString();
  }

  if (options.companyName) {
    metadata.company_name = options.companyName;
  }

  if (options.reportingYear) {
    metadata.reporting_year = options.reportingYear.toString();
  }

  // Upload to S3
  return uploadToS3({
    key,
    body: buffer,
    contentType: "application/pdf",
    metadata,
  });
}
