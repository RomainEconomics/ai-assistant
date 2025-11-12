/**
 * Utility to parse and format page references in DeepAgent results
 * Extracts page numbers from formats like [Page X], [Pages X-Y], [Pages X, Y, Z]
 */

export interface PageReference {
  text: string; // Original text (e.g., "[Page 118]")
  pages: number[]; // Extracted page numbers
  startIndex: number; // Start position in original text
  endIndex: number; // End position in original text
}

/**
 * Parse page references from text
 * Matches patterns like:
 * - [Page 118]
 * - [Pages 109, 112]
 * - [Pages 109-112]
 * - (page 118)
 * - (pages 109, 112)
 */
export function parsePageReferences(text: string): PageReference[] {
  const references: PageReference[] = [];

  // Regex patterns for different page reference formats
  // Note: Matches both hyphen (-) and en-dash (–) for ranges
  const patterns = [
    /\[Pages?\s+(\d+(?:\s*[-–]\s*\d+|\s*,\s*\d+)*)\]/gi, // [Page X] or [Pages X-Y] or [Pages X, Y]
    /\(pages?\s+(\d+(?:\s*[-–]\s*\d+|\s*,\s*\d+)*)\)/gi, // (page X) or (pages X-Y)
  ];

  for (const pattern of patterns) {
    let match;
    // Reset lastIndex for each pattern
    pattern.lastIndex = 0;

    while ((match = pattern.exec(text)) !== null) {
      const fullMatch = match[0];
      const pageString = match[1];
      const pages = extractPageNumbers(pageString);

      if (pages.length > 0) {
        references.push({
          text: fullMatch,
          pages,
          startIndex: match.index,
          endIndex: match.index + fullMatch.length,
        });
      }
    }
  }

  // Sort by startIndex
  return references.sort((a, b) => a.startIndex - b.startIndex);
}

/**
 * Extract individual page numbers from a string like "109, 112" or "109-112"
 */
function extractPageNumbers(pageString: string): number[] {
  const pages: number[] = [];

  // Handle ranges (e.g., "109-112" or "109–112" with en-dash)
  const rangeSeparator = pageString.includes('–') ? '–' : '-';
  if (pageString.includes(rangeSeparator)) {
    const parts = pageString.split(rangeSeparator).map(s => s.trim());
    if (parts.length === 2) {
      const start = parseInt(parts[0], 10);
      const end = parseInt(parts[1], 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          pages.push(i);
        }
        return pages;
      }
    }
  }

  // Handle comma-separated (e.g., "109, 112, 115")
  const parts = pageString.split(',');
  for (const part of parts) {
    const pageNum = parseInt(part.trim(), 10);
    if (!isNaN(pageNum)) {
      pages.push(pageNum);
    }
  }

  return pages;
}

/**
 * Convert text with page references into React-renderable segments
 * Each segment is either plain text or a page reference
 */
export interface TextSegment {
  type: 'text' | 'page-reference';
  content: string;
  pages?: number[]; // Only for page-reference type
}

export function segmentTextWithPageReferences(text: string): TextSegment[] {
  const references = parsePageReferences(text);
  const segments: TextSegment[] = [];

  if (references.length === 0) {
    return [{ type: 'text', content: text }];
  }

  let lastIndex = 0;

  for (const ref of references) {
    // Add text before the reference
    if (ref.startIndex > lastIndex) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex, ref.startIndex),
      });
    }

    // Add the page reference
    segments.push({
      type: 'page-reference',
      content: ref.text,
      pages: ref.pages,
    });

    lastIndex = ref.endIndex;
  }

  // Add remaining text after last reference
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.substring(lastIndex),
    });
  }

  return segments;
}

/**
 * Format page numbers for display
 * Examples:
 * - [118] -> "Page 118"
 * - [109, 112] -> "Pages 109, 112"
 * - [109, 110, 111, 112] -> "Pages 109-112"
 */
export function formatPageNumbers(pages: number[]): string {
  if (pages.length === 0) return '';
  if (pages.length === 1) return `Page ${pages[0]}`;

  // Check if it's a continuous range
  const sorted = [...pages].sort((a, b) => a - b);
  let isContinuous = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) {
      isContinuous = false;
      break;
    }
  }

  if (isContinuous) {
    return `Pages ${sorted[0]}-${sorted[sorted.length - 1]}`;
  }

  return `Pages ${sorted.join(', ')}`;
}
