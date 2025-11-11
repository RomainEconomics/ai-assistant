/**
 * S3 storage types and interfaces
 */

/**
 * S3 credentials configuration
 */
export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  region: string;
}

/**
 * S3 upload options
 */
export interface S3UploadOptions {
  key: string;
  body: Buffer | Uint8Array;
  contentType?: string;
  metadata?: Record<string, string>;
}

/**
 * S3 upload result
 */
export interface S3UploadResult {
  success: boolean;
  key: string;
  url: string;
  size: number;
  error?: string;
}

/**
 * S3 file metadata
 */
export interface S3FileMetadata {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
  metadata?: Record<string, string>;
}

/**
 * File key generation options
 */
export interface FileKeyOptions {
  filename: string;
  companyId?: number;
  year?: number;
  fileHash?: string;
  prefix?: string;
}
