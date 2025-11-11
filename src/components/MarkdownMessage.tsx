import { useState, useEffect, useRef, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { Button } from "./ui/button";
import { Check, Copy } from "lucide-react";
import "highlight.js/styles/github-dark.css";

// Helper function to extract text from React nodes
function extractText(children: ReactNode): string {
  if (typeof children === "string") {
    return children;
  }
  if (typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(extractText).join("");
  }
  if (children && typeof children === "object" && "props" in children) {
    return extractText((children as any).props.children);
  }
  return "";
}

interface MarkdownMessageProps {
  content: string;
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            // Convert children to string properly using the helper function
            const codeString = extractText(children).replace(/\n$/, "");

            if (!inline && match) {
              return (
                <CodeBlock language={match[1]} code={codeString} {...props} />
              );
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            return <>{children}</>;
          },
          a({ href, children, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
                {...props}
              >
                {children}
              </a>
            );
          },
          table({ children, ...props }) {
            return (
              <div className="overflow-x-auto my-4">
                <table
                  className="min-w-full border-collapse border border-border"
                  {...props}
                >
                  {children}
                </table>
              </div>
            );
          },
          th({ children, ...props }) {
            return (
              <th
                className="border border-border bg-muted px-4 py-2 text-left font-semibold"
                {...props}
              >
                {children}
              </th>
            );
          },
          td({ children, ...props }) {
            return (
              <td className="border border-border px-4 py-2" {...props}>
                {children}
              </td>
            );
          },
          ul({ children, ...props }) {
            return (
              <ul className="list-disc pl-6 my-2 space-y-1" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol className="list-decimal pl-6 my-2 space-y-1" {...props}>
                {children}
              </ol>
            );
          },
          blockquote({ children, ...props }) {
            return (
              <blockquote
                className="border-l-4 border-primary pl-4 py-2 my-4 italic text-muted-foreground"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          h1({ children, ...props }) {
            return (
              <h1 className="text-2xl font-bold mt-6 mb-4" {...props}>
                {children}
              </h1>
            );
          },
          h2({ children, ...props }) {
            return (
              <h2 className="text-xl font-bold mt-5 mb-3" {...props}>
                {children}
              </h2>
            );
          },
          h3({ children, ...props }) {
            return (
              <h3 className="text-lg font-bold mt-4 mb-2" {...props}>
                {children}
              </h3>
            );
          },
          p({ children, ...props }) {
            return (
              <p className="mb-4 leading-relaxed" {...props}>
                {children}
              </p>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code, ...props }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (codeRef.current) {
      // Only highlight this specific code block, not all blocks
      import("highlight.js").then((hljs) => {
        const element = codeRef.current;
        if (element && !element.dataset.highlighted) {
          hljs.default.highlightElement(element);
        }
      });
    }
  }, [code, language]);

  return (
    <div className="relative group my-4">
      <div className="absolute right-2 top-2 z-10">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={copyToClipboard}
          className="opacity-0 group-hover:opacity-100 transition-opacity bg-muted/80 hover:bg-muted"
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <pre
        className="overflow-x-auto rounded-md bg-muted p-4 text-sm"
        {...props}
      >
        <code ref={codeRef} className={`language-${language}`}>
          {code}
        </code>
      </pre>
    </div>
  );
}
