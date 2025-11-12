/**
 * Markdown renderer with clickable page references
 * Parses [Page X] and [Pages X-Y] format and makes them clickable
 */

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import { parsePageReferences, formatPageNumbers } from "@/lib/parse-page-references";
import { Button } from "./ui/button";
import { FileText } from "lucide-react";

interface MarkdownWithPageLinksProps {
  content: string;
  onPageClick?: (pageNumber: number) => void;
  className?: string;
}

export function MarkdownWithPageLinks({
  content,
  onPageClick,
  className = "",
}: MarkdownWithPageLinksProps) {
  /**
   * Pre-process content to replace page references with placeholder markers
   * This prevents ReactMarkdown from treating [Page X] as markdown links
   */
  const pageReferencesMap = React.useRef<Map<string, { pages: number[]; displayText: string }>>(new Map());

  const preprocessContent = (text: string): string => {
    pageReferencesMap.current.clear();
    const references = parsePageReferences(text);

    if (references.length === 0) {
      return text;
    }

    let processed = text;
    let offset = 0;

    references.forEach((ref, idx) => {
      const marker = `{{PAGE_REF_${idx}}}`;
      const displayText = ref.pages.length === 1
        ? `Page ${ref.pages[0]}`
        : formatPageNumbers(ref.pages);

      pageReferencesMap.current.set(marker, {
        pages: ref.pages,
        displayText,
      });

      const before = processed.substring(0, ref.startIndex + offset);
      const after = processed.substring(ref.endIndex + offset);
      processed = before + marker + after;
      offset += marker.length - (ref.endIndex - ref.startIndex);
    });

    return processed;
  };

  /**
   * Process text nodes to replace markers with clickable buttons
   */
  const processTextWithPageReferences = (text: string): React.ReactNode => {
    // Check if text contains any markers
    if (!text.includes('{{PAGE_REF_')) {
      return text;
    }

    const markerRegex = /\{\{PAGE_REF_(\d+)\}\}/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = markerRegex.exec(text)) !== null) {
      // Add text before marker
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${match.index}`}>
            {text.substring(lastIndex, match.index)}
          </span>
        );
      }

      // Get the full marker
      const marker = match[0]; // This is {{PAGE_REF_0}}
      const refData = pageReferencesMap.current.get(marker);

      if (refData) {
        // If single page, create one clickable span
        if (refData.pages.length === 1) {
          parts.push(
            <span
              key={`page-${match.index}`}
              className="inline-flex items-center gap-1 mx-1 text-primary hover:text-primary/80 font-medium underline underline-offset-4 cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onPageClick?.(refData.pages[0]);
              }}
              title={`Click to open PDF at ${refData.displayText}`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onPageClick?.(refData.pages[0]);
                }
              }}
            >
              <FileText className="h-3 w-3" />
              {refData.displayText}
            </span>
          );
        } else {
          // Multiple pages: create separate clickable spans for each page
          parts.push(
            <span key={`pages-${match.index}`} className="inline-flex items-center gap-1 mx-1">
              <FileText className="h-3 w-3 text-primary" />
              <span className="text-foreground">Pages </span>
              {refData.pages.map((page, pageIdx) => (
                <React.Fragment key={`page-${match.index}-${pageIdx}`}>
                  {pageIdx > 0 && <span className="text-muted-foreground">, </span>}
                  <span
                    className="text-primary hover:text-primary/80 font-medium underline underline-offset-4 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onPageClick?.(page);
                    }}
                    title={`Click to open PDF at page ${page}`}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onPageClick?.(page);
                      }
                    }}
                  >
                    {page}
                  </span>
                </React.Fragment>
              ))}
            </span>
          );
        }
      } else {
        // Fallback: show the marker if data not found
        parts.push(
          <span key={`marker-${match.index}`}>{match[0]}</span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key="text-end">{text.substring(lastIndex)}</span>
      );
    }

    return parts.length > 0 ? <>{parts}</> : text;
  };

  /**
   * Process children recursively to handle text nodes with page references
   */
  const processChildren = (children: any): any => {
    if (typeof children === 'string') {
      return processTextWithPageReferences(children);
    }

    if (Array.isArray(children)) {
      return children.map((child, idx) => {
        if (typeof child === 'string') {
          return <React.Fragment key={idx}>{processTextWithPageReferences(child)}</React.Fragment>;
        }
        return child;
      });
    }

    return children;
  };

  /**
   * Custom text renderer that processes page references
   */
  const customRenderers = {
    // Handle text nodes directly
    text: ({ value }: { value: string }) => {
      return <>{processTextWithPageReferences(value)}</>;
    },

    // Handle paragraphs - process children to catch text nodes
    p: ({ node, children, ...props }: any) => {
      return <p className="my-3 leading-relaxed" {...props}>{processChildren(children)}</p>;
    },

    // Style markdown elements explicitly
    h1: ({ node, children, ...props }: any) => (
      <h1 className="text-3xl font-bold mt-8 mb-4 first:mt-0" {...props}>{processChildren(children)}</h1>
    ),
    h2: ({ node, children, ...props }: any) => (
      <h2 className="text-2xl font-semibold mt-6 mb-3" {...props}>{processChildren(children)}</h2>
    ),
    h3: ({ node, children, ...props }: any) => (
      <h3 className="text-xl font-semibold mt-4 mb-2" {...props}>{processChildren(children)}</h3>
    ),
    ul: ({ node, children, ...props }: any) => (
      <ul className="list-disc list-outside ml-6 my-4 space-y-2" {...props}>{processChildren(children)}</ul>
    ),
    ol: ({ node, children, ...props }: any) => (
      <ol className="list-decimal list-outside ml-6 my-4 space-y-2" {...props}>{processChildren(children)}</ol>
    ),
    li: ({ node, children, ...props }: any) => (
      <li className="leading-relaxed" {...props}>{processChildren(children)}</li>
    ),
    strong: ({ node, children, ...props }: any) => (
      <strong className="font-semibold" {...props}>{processChildren(children)}</strong>
    ),
    em: ({ node, children, ...props }: any) => (
      <em className="italic" {...props}>{processChildren(children)}</em>
    ),

    // Handle inline code differently (don't parse page refs in code)
    code: ({ node, inline, className, children, ...props }: any) => {
      if (inline) {
        return <code className="bg-muted px-1 py-0.5 rounded text-sm font-mono">{children}</code>;
      }
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },

    // Handle blockquotes
    blockquote: ({ node, children, ...props }: any) => {
      return (
        <blockquote className="border-l-4 border-primary pl-4 italic my-4" {...props}>
          {processChildren(children)}
        </blockquote>
      );
    },

    // Handle tables
    table: ({ node, children, ...props }: any) => {
      return (
        <div className="overflow-x-auto my-4">
          <table className="min-w-full divide-y divide-border" {...props}>
            {processChildren(children)}
          </table>
        </div>
      );
    },
    thead: ({ node, children, ...props }: any) => (
      <thead {...props}>{processChildren(children)}</thead>
    ),
    tbody: ({ node, children, ...props }: any) => (
      <tbody {...props}>{processChildren(children)}</tbody>
    ),
    tr: ({ node, children, ...props }: any) => (
      <tr {...props}>{processChildren(children)}</tr>
    ),
    td: ({ node, children, ...props }: any) => (
      <td {...props}>{processChildren(children)}</td>
    ),
    th: ({ node, children, ...props }: any) => (
      <th {...props}>{processChildren(children)}</th>
    ),
  };

  const processedContent = preprocessContent(content);

  return (
    <div className={`text-foreground ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={customRenderers as any}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
