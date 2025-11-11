/**
 * Weaviate collection names
 */
export enum WeaviateCollection {
  PARENT_CLASS = "ParentDocument",
  CHILD_CLASS = "ChildDocument",
}

/**
 * Parent Document - Full page of a document
 */
export interface ParentDocument {
  content: string;
  path: string;
  company_id?: number;
  company_name?: string;
  report_type?: string;
  page: number;
  filename: string;
  file_id: number;
  file_slug: string;
  reporting_year?: number;
}

/**
 * Child Document - Chunk of a document
 */
export interface ChildDocument {
  content: string;
  path: string;
  company_id?: number;
  company_name?: string;
  report_type?: string;
  page: number;
  filename: string;
  file_id: number;
  file_slug: string;
  reporting_year?: number;
  // Reference to parent is handled by Weaviate
}

/**
 * Document chunk with metadata
 */
export interface DocumentChunk {
  content: string;
  page: number;
  chunk_index: number;
  chunk_size: number;
}

/**
 * Weaviate client configuration
 */
export interface WeaviateConfig {
  host: string;
  apiKey?: string;
}
