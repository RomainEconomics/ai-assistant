import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Header,
} from "docx";
import { marked } from "marked";
import { jsPDF } from "jspdf";
import type { ConversationWithMessages } from "../types/database";

/**
 * Create a document header with text-based branding
 */
async function createLogoHeader(): Promise<Header> {
  // Use text-based branding instead of image logo
  return new Header({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: "AI Assistant",
            bold: true,
            size: 24, // 12pt
            color: "1E40AF", // Blue color
          }),
        ],
        alignment: AlignmentType.RIGHT,
        spacing: { after: 50 },
        border: {
          bottom: {
            style: "single",
            size: 6,
            color: "E5E7EB", // Light gray border
          },
          top: { style: "none" },
          left: { style: "none" },
          right: { style: "none" },
        },
      }),
    ],
  });
}

/**
 * Export conversation to JSON format
 */
export function exportToJSON(conversation: ConversationWithMessages): string {
  return JSON.stringify(conversation, null, 2);
}

/**
 * Export conversation to Markdown format
 */
export function exportToMarkdown(
  conversation: ConversationWithMessages,
): string {
  const lines: string[] = [];

  // Title and metadata
  lines.push(`# ${conversation.title}`);
  lines.push("");
  lines.push(
    `**Model:** ${conversation.model_provider} - ${conversation.model_name}`,
  );
  lines.push(
    `**Created:** ${new Date(conversation.created_at).toLocaleString()}`,
  );
  lines.push(
    `**Updated:** ${new Date(conversation.updated_at).toLocaleString()}`,
  );
  lines.push("");
  lines.push("---");
  lines.push("");

  // Messages
  for (const message of conversation.messages) {
    const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
    lines.push(`## ${role}`);
    lines.push("");
    lines.push(message.content);
    lines.push("");
    lines.push(`*${new Date(message.created_at).toLocaleString()}*`);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Export conversation to DOCX format
 * Uses markdown-to-docx transformation as per TODO requirements
 */
export async function exportToDOCX(
  conversation: ConversationWithMessages,
): Promise<Buffer> {
  const sections: Paragraph[] = [];

  // Title
  sections.push(
    new Paragraph({
      text: conversation.title,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
  );

  // Metadata
  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Model: ", bold: true }),
        new TextRun({
          text: `${conversation.model_provider} - ${conversation.model_name}`,
        }),
      ],
      spacing: { after: 100 },
    }),
  );

  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Created: ", bold: true }),
        new TextRun({
          text: new Date(conversation.created_at).toLocaleString(),
        }),
      ],
      spacing: { after: 100 },
    }),
  );

  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Updated: ", bold: true }),
        new TextRun({
          text: new Date(conversation.updated_at).toLocaleString(),
        }),
      ],
      spacing: { after: 300 },
    }),
  );

  // Messages
  for (const message of conversation.messages) {
    const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);

    // Message role heading
    sections.push(
      new Paragraph({
        text: role,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }),
    );

    // Parse markdown content and convert to Word elements
    const contentParagraphs = await markdownToDocxParagraphs(message.content);
    sections.push(...contentParagraphs);

    // Timestamp
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: new Date(message.created_at).toLocaleString(),
            italics: true,
            size: 20, // 10pt
          }),
        ],
        spacing: { before: 100, after: 200 },
      }),
    );
  }

  // Create document header with logo
  const header = await createLogoHeader();

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        headers: {
          default: header,
        },
        children: sections,
      },
    ],
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

/**
 * Convert markdown to DOCX paragraphs
 * Handles: headings, bold, italic, code blocks, lists, links
 */
async function markdownToDocxParagraphs(
  markdown: string,
): Promise<Paragraph[]> {
  const paragraphs: Paragraph[] = [];

  // Parse markdown into tokens
  const tokens = marked.lexer(markdown);

  for (const token of tokens) {
    switch (token.type) {
      case "heading":
        // Headings can also have inline formatting
        paragraphs.push(
          new Paragraph({
            children: parseInlineText(token.text),
            heading: getHeadingLevel(token.depth),
            spacing: { before: 200, after: 100 },
          }),
        );
        break;

      case "paragraph":
        paragraphs.push(
          new Paragraph({
            children: parseInlineText(token.text),
            spacing: { after: 100 },
          }),
        );
        break;

      case "code":
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: token.text,
                font: "Courier New",
              }),
            ],
            shading: {
              fill: "F5F5F5",
            },
            spacing: { before: 100, after: 100 },
          }),
        );
        break;

      case "list":
        // Process list items recursively to handle nesting
        paragraphs.push(...processListItems(token.items, 0));
        break;

      default:
        // Fallback for unsupported types
        if ("text" in token && typeof token.text === "string") {
          paragraphs.push(
            new Paragraph({
              children: parseInlineText(token.text),
              spacing: { after: 100 },
            }),
          );
        }
    }
  }

  return paragraphs;
}

/**
 * Parse inline text with markdown formatting (bold, italic, code, links)
 * Uses marked's inline lexer for proper parsing
 */
function parseInlineText(text: string): TextRun[] {
  const runs: TextRun[] = [];

  // Use marked's inline lexer to parse inline tokens
  const tokens = marked.lexer(text, { gfm: true });

  // If there's only one token and it's a paragraph, get its tokens
  if (
    tokens.length === 1 &&
    tokens[0].type === "paragraph" &&
    "tokens" in tokens[0]
  ) {
    const inlineTokens = tokens[0].tokens || [];
    return processInlineTokens(inlineTokens);
  }

  // Fallback: if no proper tokens, return plain text
  if (runs.length === 0) {
    runs.push(new TextRun({ text }));
  }

  return runs;
}

/**
 * Process inline tokens from marked and convert to Word TextRuns
 * Handles nested formatting by tracking formatting state through recursion
 */
function processInlineTokens(
  tokens: any[],
  inheritedFormatting: {
    bold?: boolean;
    italics?: boolean;
    font?: string;
  } = {},
): TextRun[] {
  const runs: TextRun[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case "text":
        runs.push(
          new TextRun({
            text: token.text,
            bold: inheritedFormatting.bold,
            italics: inheritedFormatting.italics,
            font: inheritedFormatting.font,
          }),
        );
        break;

      case "strong":
        // Bold text - process nested tokens with bold formatting
        if (token.tokens && token.tokens.length > 0) {
          runs.push(
            ...processInlineTokens(token.tokens, {
              ...inheritedFormatting,
              bold: true,
            }),
          );
        } else {
          runs.push(
            new TextRun({
              text: token.text,
              bold: true,
              italics: inheritedFormatting.italics,
              font: inheritedFormatting.font,
            }),
          );
        }
        break;

      case "em":
        // Italic text - process nested tokens with italic formatting
        if (token.tokens && token.tokens.length > 0) {
          runs.push(
            ...processInlineTokens(token.tokens, {
              ...inheritedFormatting,
              italics: true,
            }),
          );
        } else {
          runs.push(
            new TextRun({
              text: token.text,
              bold: inheritedFormatting.bold,
              italics: true,
              font: inheritedFormatting.font,
            }),
          );
        }
        break;

      case "codespan":
        runs.push(
          new TextRun({
            text: token.text,
            font: "Courier New",
            bold: inheritedFormatting.bold,
            italics: inheritedFormatting.italics,
          }),
        );
        break;

      case "link":
        // For links, show the link text (not the URL)
        if (token.tokens && token.tokens.length > 0) {
          runs.push(...processInlineTokens(token.tokens, inheritedFormatting));
        } else {
          runs.push(
            new TextRun({
              text: token.text,
              bold: inheritedFormatting.bold,
              italics: inheritedFormatting.italics,
              font: inheritedFormatting.font,
            }),
          );
        }
        break;

      case "space":
        runs.push(
          new TextRun({
            text: " ",
            bold: inheritedFormatting.bold,
            italics: inheritedFormatting.italics,
            font: inheritedFormatting.font,
          }),
        );
        break;

      default:
        // Fallback for unknown token types
        if (token.text) {
          runs.push(
            new TextRun({
              text: token.text,
              bold: inheritedFormatting.bold,
              italics: inheritedFormatting.italics,
              font: inheritedFormatting.font,
            }),
          );
        }
    }
  }

  return runs;
}

/**
 * Process list items recursively to handle nested lists
 */
function processListItems(items: any[], level: number): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const item of items) {
    // List items can have inline formatting - need to process their tokens
    let textRuns: TextRun[] = [];

    if ("tokens" in item && Array.isArray(item.tokens)) {
      // Process the nested tokens in the list item
      for (const itemToken of item.tokens) {
        if (
          itemToken.type === "text" &&
          "tokens" in itemToken &&
          Array.isArray(itemToken.tokens)
        ) {
          // The text token has inline formatting tokens
          textRuns.push(...processInlineTokens(itemToken.tokens));
        } else if (itemToken.type === "text") {
          // Plain text token
          textRuns.push(new TextRun({ text: itemToken.text }));
        } else if (itemToken.type === "list") {
          // Skip nested list here - we'll handle it after the main item
          continue;
        } else {
          // Other token types (strong, em, etc.) at the top level
          textRuns.push(...processInlineTokens([itemToken]));
        }
      }
    }

    // Fallback to plain text if no tokens found
    if (textRuns.length === 0 && item.text) {
      textRuns = parseInlineText(item.text);
    }

    // Add the list item paragraph
    paragraphs.push(
      new Paragraph({
        children: textRuns,
        bullet: { level },
        spacing: { after: 50 },
      }),
    );

    // Process nested lists if they exist
    if ("tokens" in item && Array.isArray(item.tokens)) {
      for (const itemToken of item.tokens) {
        if (itemToken.type === "list") {
          // Recursively process nested list with increased indentation
          paragraphs.push(...processListItems(itemToken.items, level + 1));
        }
      }
    }
  }

  return paragraphs;
}

/**
 * Get Word heading level from markdown depth
 */
function getHeadingLevel(depth: number): HeadingLevel {
  switch (depth) {
    case 1:
      return HeadingLevel.HEADING_1;
    case 2:
      return HeadingLevel.HEADING_2;
    case 3:
      return HeadingLevel.HEADING_3;
    case 4:
      return HeadingLevel.HEADING_4;
    case 5:
      return HeadingLevel.HEADING_5;
    default:
      return HeadingLevel.HEADING_6;
  }
}

/**
 * Export conversation to PDF format with markdown support
 */
export function exportToPDF(conversation: ConversationWithMessages): Buffer {
  const doc = new jsPDF();
  let yPosition = 20;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const maxWidth = doc.internal.pageSize.width - 2 * margin;

  // Helper to check if we need a new page
  const checkPageBreak = (height: number) => {
    if (yPosition + height > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  };

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(conversation.title, margin, yPosition);
  yPosition += 10;

  // Metadata
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Model: ${conversation.model_provider} - ${conversation.model_name}`,
    margin,
    yPosition,
  );
  yPosition += 6;
  doc.text(
    `Created: ${new Date(conversation.created_at).toLocaleString()}`,
    margin,
    yPosition,
  );
  yPosition += 6;
  doc.text(
    `Updated: ${new Date(conversation.updated_at).toLocaleString()}`,
    margin,
    yPosition,
  );
  yPosition += 10;

  // Messages
  for (const message of conversation.messages) {
    checkPageBreak(30);

    // Role heading
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
    doc.text(role, margin, yPosition);
    yPosition += 8;

    // Render markdown content
    yPosition = renderMarkdownToPDF(
      doc,
      message.content,
      margin,
      yPosition,
      maxWidth,
      pageHeight,
      checkPageBreak,
    );

    // Timestamp
    yPosition += 4;
    checkPageBreak(6);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(new Date(message.created_at).toLocaleString(), margin, yPosition);
    yPosition += 10;
  }

  // Return buffer
  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Render markdown content to PDF with proper formatting
 */
function renderMarkdownToPDF(
  doc: jsPDF,
  markdown: string,
  margin: number,
  startY: number,
  maxWidth: number,
  pageHeight: number,
  checkPageBreak: (height: number) => void,
): number {
  let yPosition = startY;

  // Parse markdown into tokens
  const tokens = marked.lexer(markdown);

  for (const token of tokens) {
    switch (token.type) {
      case "heading":
        checkPageBreak(10);
        const headingSize = 18 - token.depth * 2; // H1=16, H2=14, H3=12, etc.
        doc.setFontSize(headingSize);
        doc.setFont("helvetica", "bold");

        // Render heading with inline formatting
        yPosition = renderInlineTextToPDF(
          doc,
          token.text,
          margin,
          yPosition,
          maxWidth,
          checkPageBreak,
        );
        yPosition += 6;
        break;

      case "paragraph":
        checkPageBreak(10);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        // Render paragraph with inline formatting
        yPosition = renderInlineTextToPDF(
          doc,
          token.text,
          margin,
          yPosition,
          maxWidth,
          checkPageBreak,
        );
        yPosition += 4;
        break;

      case "code":
        checkPageBreak(15);
        doc.setFontSize(9);
        doc.setFont("courier", "normal");

        // Add gray background for code blocks (simulate with border)
        const codeLines = token.text.split("\n");
        for (const line of codeLines) {
          checkPageBreak(5);
          doc.text(line, margin + 2, yPosition);
          yPosition += 5;
        }

        doc.setFont("helvetica", "normal");
        yPosition += 4;
        break;

      case "list":
        for (const item of token.items) {
          checkPageBreak(8);
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");

          // Add bullet point
          doc.text("•", margin, yPosition);

          // Process list item text with inline formatting
          const itemText = item.text;
          yPosition = renderInlineTextToPDF(
            doc,
            itemText,
            margin + 5,
            yPosition,
            maxWidth - 5,
            checkPageBreak,
          );
          yPosition += 2;
        }
        yPosition += 4;
        break;

      case "space":
        yPosition += 4;
        break;

      default:
        // Fallback for unsupported types
        if ("text" in token && typeof token.text === "string") {
          checkPageBreak(10);
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          yPosition = renderInlineTextToPDF(
            doc,
            token.text,
            margin,
            yPosition,
            maxWidth,
            checkPageBreak,
          );
          yPosition += 4;
        }
    }
  }

  return yPosition;
}

/**
 * Render inline text with markdown formatting (bold, italic, code, subscript, superscript)
 */
function renderInlineTextToPDF(
  doc: jsPDF,
  text: string,
  xPosition: number,
  yPosition: number,
  maxWidth: number,
  checkPageBreak: (height: number) => void,
): number {
  // Parse inline markdown
  const inlineTokens = marked.lexer(text, { gfm: true });

  // Extract inline tokens from paragraph wrapper
  let tokens: any[] = [];
  if (
    inlineTokens.length === 1 &&
    inlineTokens[0].type === "paragraph" &&
    "tokens" in inlineTokens[0]
  ) {
    tokens = inlineTokens[0].tokens || [];
  } else {
    // Fallback: treat as plain text
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      checkPageBreak(6);
      doc.text(line, xPosition, yPosition);
      yPosition += 6;
    }
    return yPosition;
  }

  // Process inline tokens
  let currentX = xPosition;
  const lineHeight = 6;
  const currentFont = doc.getFont();
  const currentSize = doc.getFontSize();

  for (const token of tokens) {
    let textContent = "";
    let font = "helvetica";
    let style: "normal" | "bold" | "italic" | "bolditalic" = "normal";
    let size = currentSize;

    switch (token.type) {
      case "text":
        textContent = token.text;
        // Handle special characters for subscripts/superscripts
        textContent = textContent.replace(/CO₂/g, "CO2"); // Convert subscript to regular
        textContent = textContent.replace(/CO2/g, "CO₂"); // Keep subscript symbol
        break;

      case "strong":
        textContent = token.text;
        style = "bold";
        break;

      case "em":
        textContent = token.text;
        style = "italic";
        break;

      case "codespan":
        textContent = token.text;
        font = "courier";
        break;

      case "link":
        textContent = token.text;
        style = "normal";
        break;

      case "space":
        textContent = " ";
        break;

      default:
        if ("text" in token) {
          textContent = token.text;
        }
    }

    if (textContent) {
      doc.setFont(font, style);
      doc.setFontSize(size);

      // Split text if it exceeds line width
      const words = textContent.split(" ");
      for (let i = 0; i < words.length; i++) {
        const word = words[i] + (i < words.length - 1 ? " " : "");
        const wordWidth = doc.getTextWidth(word);

        // Check if word fits on current line
        if (currentX + wordWidth > xPosition + maxWidth) {
          yPosition += lineHeight;
          currentX = xPosition;
          checkPageBreak(lineHeight);
        }

        doc.text(word, currentX, yPosition);
        currentX += wordWidth;
      }
    }
  }

  // Move to next line after rendering all inline content
  return yPosition + lineHeight;
}

/**
 * Generate filename for export
 */
export function generateExportFilename(
  conversation: ConversationWithMessages,
  format: "json" | "md" | "docx" | "pdf",
): string {
  // Sanitize title for filename
  const sanitizedTitle = conversation.title
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()
    .slice(0, 50);

  const timestamp = new Date().toISOString().split("T")[0];

  return `${sanitizedTitle}_${timestamp}.${format}`;
}

/**
 * Import conversation from JSON
 * Returns conversation data without IDs (to be inserted as new)
 */
export function importFromJSON(
  jsonString: string,
): Omit<ConversationWithMessages, "id" | "created_at" | "updated_at"> {
  const data = JSON.parse(jsonString);

  // Validate required fields
  if (
    !data.title ||
    !data.model_provider ||
    !data.model_name ||
    !data.messages
  ) {
    throw new Error("Invalid conversation JSON: missing required fields");
  }

  // Validate messages
  if (!Array.isArray(data.messages)) {
    throw new Error("Invalid conversation JSON: messages must be an array");
  }

  for (const msg of data.messages) {
    if (!msg.role || !msg.content) {
      throw new Error(
        "Invalid conversation JSON: message missing role or content",
      );
    }
    if (!["user", "assistant", "system"].includes(msg.role)) {
      throw new Error(
        `Invalid conversation JSON: invalid message role "${msg.role}"`,
      );
    }
  }

  // Return data without IDs and timestamps (will be generated on insert)
  return {
    project_id: data.project_id,
    title: data.title,
    model_provider: data.model_provider,
    model_name: data.model_name,
    messages: data.messages.map((msg: any) => ({
      conversation_id: 0, // Will be set on insert
      role: msg.role,
      content: msg.content,
    })),
  };
}

// ==========================================
// Multi-Document Query Export Functions
// ==========================================

export interface MultiDocQueryExportData {
  question: string;
  totalTime: number;
  createdAt: string;
  results: Array<{
    fileId: number;
    filename: string;
    answer: string;
    sources: Array<{
      page: number;
      content: string;
    }>;
    processingTime: number;
  }>;
}

/**
 * Export multi-doc query results to JSON format
 */
export function exportMultiDocToJSON(data: MultiDocQueryExportData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Export multi-doc query results to Markdown format
 */
export function exportMultiDocToMarkdown(
  data: MultiDocQueryExportData,
): string {
  const lines: string[] = [];

  // Title and metadata
  lines.push(`# Multi-Document Query Results`);
  lines.push("");
  lines.push(`**Question:** ${data.question}`);
  lines.push(
    `**Total Processing Time:** ${(data.totalTime / 1000).toFixed(2)}s`,
  );
  lines.push(`**Date:** ${new Date(data.createdAt).toLocaleString()}`);
  lines.push(`**Documents Queried:** ${data.results.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Results for each document
  for (const result of data.results) {
    lines.push(`## ${result.filename}`);
    lines.push("");
    lines.push(
      `**Processing Time:** ${(result.processingTime / 1000).toFixed(2)}s`,
    );
    lines.push(`**Sources Found:** ${result.sources.length}`);
    lines.push("");
    lines.push("### Answer");
    lines.push("");
    lines.push(result.answer);
    lines.push("");

    if (result.sources.length > 0) {
      lines.push("### Sources");
      lines.push("");
      for (const source of result.sources) {
        lines.push(`#### Page ${source.page}`);
        lines.push("");
        lines.push("```");
        lines.push(source.content);
        lines.push("```");
        lines.push("");
      }
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Export multi-doc query results to DOCX format
 */
export async function exportMultiDocToDOCX(
  data: MultiDocQueryExportData,
): Promise<Buffer> {
  const sections: Paragraph[] = [];

  // Title
  sections.push(
    new Paragraph({
      text: "Multi-Document Query Results",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
  );

  // Metadata
  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Question: ", bold: true }),
        new TextRun({ text: data.question }),
      ],
      spacing: { after: 100 },
    }),
  );

  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Total Processing Time: ", bold: true }),
        new TextRun({ text: `${(data.totalTime / 1000).toFixed(2)}s` }),
      ],
      spacing: { after: 100 },
    }),
  );

  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Date: ", bold: true }),
        new TextRun({ text: new Date(data.createdAt).toLocaleString() }),
      ],
      spacing: { after: 100 },
    }),
  );

  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Documents Queried: ", bold: true }),
        new TextRun({ text: data.results.length.toString() }),
      ],
      spacing: { after: 300 },
    }),
  );

  // Results for each document
  for (const result of data.results) {
    // Document heading
    sections.push(
      new Paragraph({
        text: result.filename,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 100 },
      }),
    );

    // Document metadata
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Processing Time: ", bold: true }),
          new TextRun({
            text: `${(result.processingTime / 1000).toFixed(2)}s`,
          }),
          new TextRun({ text: " | " }),
          new TextRun({ text: "Sources Found: ", bold: true }),
          new TextRun({ text: result.sources.length.toString() }),
        ],
        spacing: { after: 100 },
      }),
    );

    // Answer heading
    sections.push(
      new Paragraph({
        text: "Answer",
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 100, after: 50 },
      }),
    );

    // Parse markdown answer
    const answerParagraphs = await markdownToDocxParagraphs(result.answer);
    sections.push(...answerParagraphs);

    // Sources
    if (result.sources.length > 0) {
      sections.push(
        new Paragraph({
          text: "Sources",
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        }),
      );

      for (const source of result.sources) {
        sections.push(
          new Paragraph({
            children: [
              new TextRun({ text: `Page ${source.page}`, bold: true }),
            ],
            spacing: { before: 100, after: 50 },
          }),
        );

        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: source.content,
                font: "Courier New",
              }),
            ],
            shading: {
              fill: "F5F5F5",
            },
            spacing: { after: 100 },
          }),
        );
      }
    }
  }

  // Create document header with logo
  const header = await createLogoHeader();

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        headers: {
          default: header,
        },
        children: sections,
      },
    ],
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

/**
 * Export multi-doc query results to PDF format with markdown support
 */
export function exportMultiDocToPDF(data: MultiDocQueryExportData): Buffer {
  const doc = new jsPDF();
  let yPosition = 20;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const maxWidth = doc.internal.pageSize.width - 2 * margin;

  // Helper to check if we need a new page
  const checkPageBreak = (height: number) => {
    if (yPosition + height > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
  };

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Multi-Document Query Results", margin, yPosition);
  yPosition += 10;

  // Metadata
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Question: ${data.question}`, margin, yPosition);
  yPosition += 6;
  doc.text(
    `Total Processing Time: ${(data.totalTime / 1000).toFixed(2)}s`,
    margin,
    yPosition,
  );
  yPosition += 6;
  doc.text(
    `Date: ${new Date(data.createdAt).toLocaleString()}`,
    margin,
    yPosition,
  );
  yPosition += 6;
  doc.text(`Documents Queried: ${data.results.length}`, margin, yPosition);
  yPosition += 10;

  // Results for each document
  for (const result of data.results) {
    checkPageBreak(40);

    // Document heading
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(result.filename, margin, yPosition);
    yPosition += 8;

    // Document metadata
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Processing Time: ${(result.processingTime / 1000).toFixed(2)}s | Sources: ${result.sources.length}`,
      margin,
      yPosition,
    );
    yPosition += 8;

    // Answer heading
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Answer", margin, yPosition);
    yPosition += 6;

    // Render markdown answer
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    yPosition = renderMarkdownToPDF(
      doc,
      result.answer,
      margin,
      yPosition,
      maxWidth,
      pageHeight,
      checkPageBreak,
    );

    // Sources
    if (result.sources.length > 0) {
      yPosition += 4;
      checkPageBreak(10);

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Sources", margin, yPosition);
      yPosition += 6;

      for (const source of result.sources) {
        checkPageBreak(20);

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Page ${source.page}`, margin + 5, yPosition);
        yPosition += 6;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const sourceLines = doc.splitTextToSize(source.content, maxWidth - 10);

        for (const line of sourceLines) {
          checkPageBreak(5);
          doc.text(line, margin + 5, yPosition);
          yPosition += 5;
        }

        yPosition += 4;
      }
    }

    yPosition += 6;
  }

  // Return buffer
  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Generate filename for multi-doc query export
 */
export function generateMultiDocExportFilename(
  question: string,
  format: "json" | "md" | "docx" | "pdf",
): string {
  // Sanitize question for filename (take first 50 chars)
  const sanitizedQuestion = question
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()
    .slice(0, 50);

  const timestamp = new Date().toISOString().split("T")[0];

  return `multi_doc_query_${sanitizedQuestion}_${timestamp}.${format}`;
}

// ==========================================
// Batch Questioning Export Functions
// ==========================================

export interface BatchQuestioningExportData {
  filename: string;
  fileId: number;
  totalTime: number;
  createdAt: string;
  results: Array<{
    question: string;
    answer: string;
    sources: Array<{
      page: number;
      content: string;
    }>;
    processingTime: number;
  }>;
}

/**
 * Export batch questioning results to JSON format
 */
export function exportBatchQuestioningToJSON(
  data: BatchQuestioningExportData,
): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Export batch questioning results to Markdown format
 */
export function exportBatchQuestioningToMarkdown(
  data: BatchQuestioningExportData,
): string {
  const lines: string[] = [];

  // Title and metadata
  lines.push(`# Batch Questioning Results`);
  lines.push("");
  lines.push(`**Document:** ${data.filename}`);
  lines.push(
    `**Total Processing Time:** ${(data.totalTime / 1000).toFixed(2)}s`,
  );
  lines.push(`**Date:** ${new Date(data.createdAt).toLocaleString()}`);
  lines.push(`**Questions Answered:** ${data.results.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Results per question
  data.results.forEach((result, index) => {
    lines.push(`## Question ${index + 1}: ${result.question}`);
    lines.push("");
    lines.push(
      `**Processing Time:** ${(result.processingTime / 1000).toFixed(2)}s`,
    );
    lines.push("");
    lines.push("### Answer");
    lines.push("");
    lines.push(result.answer);
    lines.push("");

    if (result.sources.length > 0) {
      lines.push("### Sources");
      lines.push("");
      result.sources.forEach((source, sourceIdx) => {
        lines.push(`**Source ${sourceIdx + 1} (Page ${source.page}):**`);
        lines.push("```");
        lines.push(source.content);
        lines.push("```");
        lines.push("");
      });
    }

    lines.push("---");
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Export batch questioning results to DOCX format
 */
export async function exportBatchQuestioningToDOCX(
  data: BatchQuestioningExportData,
): Promise<Buffer> {
  const sections: Paragraph[] = [];

  // Title
  sections.push(
    new Paragraph({
      text: "Batch Questioning Results",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 200 },
    }),
  );

  // Metadata
  sections.push(
    new Paragraph({
      children: [
        new TextRun({ text: "Document: ", bold: true }),
        new TextRun(data.filename),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Total Processing Time: ", bold: true }),
        new TextRun(`${(data.totalTime / 1000).toFixed(2)}s`),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Date: ", bold: true }),
        new TextRun(new Date(data.createdAt).toLocaleString()),
      ],
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Questions Answered: ", bold: true }),
        new TextRun(String(data.results.length)),
      ],
      spacing: { after: 300 },
    }),
  );

  // Results per question
  for (let index = 0; index < data.results.length; index++) {
    const result = data.results[index];

    // Question heading
    sections.push(
      new Paragraph({
        text: `Question ${index + 1}: ${result.question}`,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 200 },
      }),
    );

    // Processing time
    sections.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Processing Time: ", bold: true }),
          new TextRun(`${(result.processingTime / 1000).toFixed(2)}s`),
        ],
        spacing: { after: 200 },
      }),
    );

    // Answer heading
    sections.push(
      new Paragraph({
        text: "Answer",
        heading: HeadingLevel.HEADING_3,
        spacing: { after: 100 },
      }),
    );

    // Parse and add answer content
    const answerParagraphs = await markdownToDocxParagraphs(result.answer);
    sections.push(...answerParagraphs);

    // Sources
    if (result.sources.length > 0) {
      sections.push(
        new Paragraph({
          text: "Sources",
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
        }),
      );

      for (let sourceIdx = 0; sourceIdx < result.sources.length; sourceIdx++) {
        const source = result.sources[sourceIdx];
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Source ${sourceIdx + 1} (Page ${source.page}): `,
                bold: true,
              }),
            ],
            spacing: { after: 50 },
          }),
          new Paragraph({
            text: source.content,
            style: "Quote",
            shading: {
              fill: "F0F0F0",
            },
            spacing: { after: 100 },
          }),
        );
      }
    }

    // Separator
    sections.push(
      new Paragraph({
        text: "",
        spacing: { after: 200 },
      }),
    );
  }

  // Create document header with logo
  const header = await createLogoHeader();

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        headers: {
          default: header,
        },
        children: sections,
      },
    ],
    styles: {
      paragraphStyles: [
        {
          id: "Quote",
          name: "Quote",
          basedOn: "Normal",
          paragraph: {
            indent: { left: 720 },
          },
        },
      ],
    },
  });

  // Generate buffer
  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

/**
 * Export batch questioning results to PDF format
 */
export function exportBatchQuestioningToPDF(
  data: BatchQuestioningExportData,
): Buffer {
  const doc = new jsPDF();
  let yPosition = 20;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  const maxWidth = doc.internal.pageSize.width - 2 * margin;

  // Helper to check if we need a new page
  const checkPageBreak = (height: number) => {
    if (yPosition + height > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
      return true;
    }
    return false;
  };

  // Helper to add wrapped text
  const addWrappedText = (
    text: string,
    fontSize: number,
    isBold: boolean = false,
  ) => {
    doc.setFontSize(fontSize);
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line: string) => {
      checkPageBreak(fontSize * 0.5);
      doc.text(line, margin, yPosition);
      yPosition += fontSize * 0.5;
    });
  };

  // Title
  addWrappedText("Batch Questioning Results", 18, true);
  yPosition += 5;

  // Metadata
  addWrappedText(`Document: ${data.filename}`, 12, false);
  yPosition += 2;
  addWrappedText(
    `Total Processing Time: ${(data.totalTime / 1000).toFixed(2)}s`,
    12,
    false,
  );
  yPosition += 2;
  addWrappedText(
    `Date: ${new Date(data.createdAt).toLocaleString()}`,
    12,
    false,
  );
  yPosition += 2;
  addWrappedText(`Questions Answered: ${data.results.length}`, 12, false);
  yPosition += 10;

  // Results per question
  data.results.forEach((result, index) => {
    // Check if we need a new page for the question
    checkPageBreak(40);

    // Question heading
    addWrappedText(`Question ${index + 1}: ${result.question}`, 14, true);
    yPosition += 5;

    // Processing time
    addWrappedText(
      `Processing Time: ${(result.processingTime / 1000).toFixed(2)}s`,
      10,
      false,
    );
    yPosition += 5;

    // Answer heading
    addWrappedText("Answer:", 12, true);
    yPosition += 3;

    // Answer text
    addWrappedText(result.answer, 10, false);
    yPosition += 5;

    // Sources
    if (result.sources.length > 0) {
      checkPageBreak(20);
      addWrappedText("Sources:", 12, true);
      yPosition += 3;

      result.sources.forEach((source, sourceIdx) => {
        checkPageBreak(30);
        addWrappedText(
          `Source ${sourceIdx + 1} (Page ${source.page}):`,
          10,
          true,
        );
        yPosition += 2;

        // Source content in gray box
        doc.setFillColor(240, 240, 240);
        const sourceLines = doc.splitTextToSize(source.content, maxWidth - 10);
        const boxHeight = sourceLines.length * 5 + 4;

        checkPageBreak(boxHeight);
        doc.rect(margin, yPosition - 2, maxWidth, boxHeight, "F");

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        sourceLines.forEach((line: string) => {
          doc.text(line, margin + 5, yPosition);
          yPosition += 5;
        });
        yPosition += 5;
      });
    }

    yPosition += 10;
  });

  // Return buffer
  return Buffer.from(doc.output("arraybuffer"));
}

/**
 * Generate filename for batch questioning export
 */
export function generateBatchQuestioningExportFilename(
  filename: string,
  format: "json" | "md" | "docx" | "pdf",
): string {
  // Sanitize filename
  const sanitizedFilename = filename
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase()
    .slice(0, 50);

  const timestamp = new Date().toISOString().split("T")[0];

  return `batch_questioning_${sanitizedFilename}_${timestamp}.${format}`;
}
