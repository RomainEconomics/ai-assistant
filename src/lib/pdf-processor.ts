/**
 * PDF processing utility for text extraction and chunking
 */
import type { DocumentChunk } from "../types/weaviate.ts";

// Import PDFParse class from pdf-parse v2
const { PDFParse } = require("pdf-parse");

/**
 * Text splitter options
 */
interface TextSplitterOptions {
  chunkSize: number;
  chunkOverlap: number;
  separators: string[];
}

/**
 * Default text splitter configuration
 */
const DEFAULT_SPLITTER_OPTIONS: TextSplitterOptions = {
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", " ", ""],
};

/**
 * PDF Processor class for text extraction and chunking
 */
export class PDFProcessor {
  private splitterOptions: TextSplitterOptions;

  constructor(options?: Partial<TextSplitterOptions>) {
    this.splitterOptions = {
      ...DEFAULT_SPLITTER_OPTIONS,
      ...options,
    };
  }

  /**
   * Extract text from PDF buffer
   * @param pdfBuffer - PDF file as Buffer
   * @returns Array of tuples [text, pageNumber]
   */
  async extractTextFromPDF(
    pdfBuffer: Buffer
  ): Promise<Array<[string, number]>> {
    try {
      // Create parser with data buffer
      const parser = new PDFParse({ data: pdfBuffer });

      // Get document info to know how many pages
      const info = await parser.getInfo();
      const totalPages = info.total;

      const pagesText: Array<[string, number]> = [];

      // Extract text from each page
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const result = await parser.getText({ partial: [pageNum] });
        const pageText = result.text.trim();

        if (pageText) {
          pagesText.push([pageText, pageNum]);
        }
      }

      // Clean up
      await parser.destroy();

      console.log(`Extracted text from ${pagesText.length} pages`);
      return pagesText;
    } catch (error) {
      console.error("Failed to extract text from PDF:", error);
      throw error;
    }
  }

  /**
   * Split text into chunks using recursive character splitting
   * @param text - Text to chunk
   * @param pageNumber - Page number where text originated
   * @returns Array of document chunks with metadata
   */
  chunkText(text: string, pageNumber: number): DocumentChunk[] {
    const chunks = this.recursiveTextSplit(
      text,
      this.splitterOptions.chunkSize,
      this.splitterOptions.chunkOverlap,
      this.splitterOptions.separators
    );

    return chunks.map((chunk, index) => ({
      content: chunk,
      page: pageNumber,
      chunk_index: index,
      chunk_size: chunk.length,
    }));
  }

  /**
   * Recursively split text using different separators
   */
  private recursiveTextSplit(
    text: string,
    chunkSize: number,
    chunkOverlap: number,
    separators: string[]
  ): string[] {
    const chunks: string[] = [];

    if (text.length <= chunkSize) {
      return [text];
    }

    // Try each separator
    for (const separator of separators) {
      if (separator === "") {
        // Character-level splitting
        for (let i = 0; i < text.length; i += chunkSize - chunkOverlap) {
          chunks.push(text.slice(i, i + chunkSize));
        }
        return chunks;
      }

      const splits = text.split(separator);

      if (splits.length === 1) {
        // Separator not found, try next one
        continue;
      }

      // Build chunks from splits
      let currentChunk = "";

      for (const split of splits) {
        const testChunk =
          currentChunk === ""
            ? split
            : currentChunk + separator + split;

        if (testChunk.length <= chunkSize) {
          currentChunk = testChunk;
        } else {
          if (currentChunk) {
            chunks.push(currentChunk);
          }

          // If the split itself is too large, recursively split it
          if (split.length > chunkSize) {
            const remainingSeparators = separators.slice(
              separators.indexOf(separator) + 1
            );
            const subChunks = this.recursiveTextSplit(
              split,
              chunkSize,
              chunkOverlap,
              remainingSeparators
            );
            chunks.push(...subChunks);
            currentChunk = "";
          } else {
            currentChunk = split;
          }
        }
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }

      return chunks;
    }

    return chunks;
  }
}

/**
 * Extract text and chunk a PDF file
 * @param pdfBuffer - PDF file as Buffer
 * @param filename - Name of the PDF file
 * @returns Array of page texts and their chunks
 */
export async function processPDF(
  pdfBuffer: Buffer,
  filename: string
): Promise<Array<{ text: string; page: number; chunks: DocumentChunk[] }>> {
  const processor = new PDFProcessor();
  const pagesText = await processor.extractTextFromPDF(pdfBuffer);

  return pagesText.map(([text, page]) => ({
    text,
    page,
    chunks: processor.chunkText(text, page),
  }));
}
