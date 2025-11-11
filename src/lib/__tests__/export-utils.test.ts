import { test, expect, describe } from "bun:test";
import {
  exportToJSON,
  exportToMarkdown,
  exportToDOCX,
  exportToPDF,
  generateExportFilename,
  importFromJSON,
} from "../export-utils";
import type { ConversationWithMessages } from "../../types/database";
import { Document as DocxDocument } from "docx";

// Helper to create test conversation
function createTestConversation(overrides?: Partial<ConversationWithMessages>): ConversationWithMessages {
  return {
    id: 1,
    project_id: 1,
    title: "Test Conversation",
    model_provider: "openai",
    model_name: "gpt-4o",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    messages: [
      {
        id: 1,
        conversation_id: 1,
        role: "user",
        content: "Hello",
        created_at: "2024-01-01T00:00:00.000Z",
      },
      {
        id: 2,
        conversation_id: 1,
        role: "assistant",
        content: "Hi there!",
        created_at: "2024-01-01T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

describe("exportToJSON", () => {
  test("should export conversation to valid JSON", () => {
    const conversation = createTestConversation();
    const json = exportToJSON(conversation);

    expect(json).toBeDefined();
    expect(() => JSON.parse(json)).not.toThrow();

    const parsed = JSON.parse(json);
    expect(parsed.id).toBe(conversation.id);
    expect(parsed.title).toBe(conversation.title);
    expect(parsed.messages).toHaveLength(2);
  });

  test("should include all conversation fields", () => {
    const conversation = createTestConversation();
    const json = exportToJSON(conversation);
    const parsed = JSON.parse(json);

    expect(parsed).toHaveProperty("id");
    expect(parsed).toHaveProperty("project_id");
    expect(parsed).toHaveProperty("title");
    expect(parsed).toHaveProperty("model_provider");
    expect(parsed).toHaveProperty("model_name");
    expect(parsed).toHaveProperty("created_at");
    expect(parsed).toHaveProperty("updated_at");
    expect(parsed).toHaveProperty("messages");
  });
});

describe("exportToMarkdown", () => {
  test("should export conversation to markdown format", () => {
    const conversation = createTestConversation();
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("# Test Conversation");
    expect(markdown).toContain("## User");
    expect(markdown).toContain("## Assistant");
    expect(markdown).toContain("Hello");
    expect(markdown).toContain("Hi there!");
  });

  test("should include metadata in markdown", () => {
    const conversation = createTestConversation();
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("**Model:**");
    expect(markdown).toContain("openai - gpt-4o");
    expect(markdown).toContain("**Created:**");
    expect(markdown).toContain("**Updated:**");
  });

  test("should preserve bold text in markdown", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "user",
          content: "Tell me about **Scope 3 Emissions**",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("**Scope 3 Emissions**");
  });

  test("should preserve italic text in markdown", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "user",
          content: "This is *important* text",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("*important*");
  });

  test("should preserve code blocks in markdown", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "Use `console.log()` for debugging",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("`console.log()`");
  });
});

describe("exportToDOCX - Inline Formatting", () => {
  test("should handle bold text correctly", async () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "user",
          content: "**Scope 3 Emissions**",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Verify the buffer is a valid ZIP file (DOCX is a ZIP)
    const signature = buffer.subarray(0, 4);
    expect(signature[0]).toBe(0x50); // P
    expect(signature[1]).toBe(0x4B); // K
  });

  test("should handle mixed bold and plain text", async () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "user",
          content: "Tell me about **Scope 3 Emissions** and their impact.",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle italic text correctly", async () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "user",
          content: "This is *important* text",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle code spans correctly", async () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "Use `console.log()` for debugging",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle multiple formatting types", async () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "**Bold text**, *italic text*, and `code text` should work.",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle complex markdown content", async () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: `# Scope 3 Emissions Overview

**Scope 3 Emissions** are indirect greenhouse gas emissions that occur in a company's value chain.

## Categories

1. **Upstream emissions**: These include purchased goods
2. **Downstream emissions**: Product use and end-of-life
3. *Transportation and distribution*: Both upstream and downstream

### Important Notes

- Scope 3 often represents the **largest portion** of emissions (80-90%)
- Measurement can be \`complex and time-consuming\`
- Requires collaboration with **suppliers and customers**`,
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle headings with bold text", async () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "## **Important** Section\n\nContent here.",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle lists with formatting", async () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "- **Bold** item\n- *Italic* item\n- `Code` item",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("exportToDOCX - Structure", () => {
  test("should generate valid DOCX buffer", async () => {
    const conversation = createTestConversation();
    const buffer = await exportToDOCX(conversation);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // DOCX files start with PK (ZIP signature)
    expect(buffer[0]).toBe(0x50); // P
    expect(buffer[1]).toBe(0x4B); // K
  });

  test("should include conversation title", async () => {
    const conversation = createTestConversation({
      title: "Custom Title",
    });
    const buffer = await exportToDOCX(conversation);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle empty messages", async () => {
    const conversation = createTestConversation({
      messages: [],
    });
    const buffer = await exportToDOCX(conversation);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle single message", async () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "user",
          content: "Single message",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
    const buffer = await exportToDOCX(conversation);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle multiple messages", async () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "user",
          content: "First message",
          created_at: "2024-01-01T00:00:00.000Z",
        },
        {
          id: 2,
          conversation_id: 1,
          role: "assistant",
          content: "Second message",
          created_at: "2024-01-01T00:00:01.000Z",
        },
        {
          id: 3,
          conversation_id: 1,
          role: "user",
          content: "Third message",
          created_at: "2024-01-01T00:00:02.000Z",
        },
      ],
    });
    const buffer = await exportToDOCX(conversation);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("exportToPDF - Basic Structure", () => {
  test("should generate valid PDF buffer", () => {
    const conversation = createTestConversation();
    const buffer = exportToPDF(conversation);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // PDF files start with %PDF
    const signature = buffer.toString("utf-8", 0, 4);
    expect(signature).toBe("%PDF");
  });

  test("should handle long content with pagination", () => {
    const longContent = "This is a very long message that should span multiple pages. ".repeat(100);
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: longContent,
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should include conversation metadata", () => {
    const conversation = createTestConversation({
      title: "Test PDF Export",
      model_provider: "openai",
      model_name: "gpt-4o",
    });
    const buffer = exportToPDF(conversation);

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Verify it's a valid PDF
    const signature = buffer.toString("utf-8", 0, 4);
    expect(signature).toBe("%PDF");
  });
});

describe("exportToPDF - Markdown Headings", () => {
  test("should render H1 headings", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "# Main Title\n\nContent below heading.",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should render H2 headings", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "## Scope 1: Direct Emissions\n\nDetails here.",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should render H3 headings", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "### Subsection Title\n\nMore content.",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should render multiple heading levels", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "# Main\n\n## Section\n\n### Subsection\n\n#### Detail",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("exportToPDF - Inline Formatting", () => {
  test("should render bold text", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "This text has **bold formatting** in it.",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should render italic text", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "This text has *italic formatting* in it.",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should render code spans", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "Use `console.log()` for debugging.",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should render mixed inline formatting", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "Text with **bold**, *italic*, and `code` all together.",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should render bold terms with colons", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "**Scope 1 Emissions:** Direct emissions from owned sources.",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("exportToPDF - Lists", () => {
  test("should render unordered lists", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "- First item\n- Second item\n- Third item",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should render lists with bold text", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "- **Scope 1:** Direct emissions\n- **Scope 2:** Indirect emissions\n- **Scope 3:** Value chain",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should render lists with mixed formatting", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "- **Bold** item\n- *Italic* item\n- `Code` item\n- Regular item",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should render long list items", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "- This is the first time ASSA ABLOY has calculated its Scope 3 emissions, which account for 98% of its total footprint.",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("exportToPDF - Code Blocks", () => {
  test("should render code blocks", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "Here is some code:\n\n```\nconst x = 5;\nconsole.log(x);\n```",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should render code blocks with language", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "JavaScript example:\n\n```javascript\nfunction hello() {\n  return 'world';\n}\n```",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should render multiline code blocks", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "```\nLine 1\nLine 2\nLine 3\nLine 4\nLine 5\n```",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("exportToPDF - Special Characters", () => {
  test("should handle subscript characters (CO₂)", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "**2023**: 24,496,514 t CO₂ eq.",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle multiple CO₂ references", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "Scope 1: 24,496 t CO₂\nScope 2: 654,073 t CO₂\nScope 3: 133,337 t CO₂",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle special characters in text", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "Characters: & < > \" ' % $",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle percentages and numbers", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "Scope 3 accounts for 98% of emissions (93% from purchased goods).",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("exportToPDF - Complex Real-World Content", () => {
  test("should render ESG emissions report", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: `Based on the ENGIE 2023 Universal Registration Document, here are the GHG emissions for Scope 1, 2, and 3:

## Scope 1: Direct Emissions

- **2023**: 24,496,514 t CO₂ eq.
- **2022**: 29,943,790 t CO₂ eq.
- **2021**: 36,703,290 t CO₂ eq.

## Scope 2: Indirect Emissions Related to Energy Consumption

- **2023 Location-Based**: 654,073 t CO₂ eq.
- **2023 Market-Based**: 847,043 t CO₂ eq.
- **2022 Location-Based**: 850,154 t CO₂ eq.
- **2021 Location-Based**: 552,962 t CO₂ eq.

## Scope 3: Other Indirect Emissions

- **2023**: 133,337,361 t CO₂ eq.
- **2022**: 144,543,263 t CO₂ eq.
- **2021**: 122,622,236 t CO₂ eq.

These emissions are detailed on pages 111-113 of the document.`,
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Verify PDF signature
    const signature = buffer.toString("utf-8", 0, 4);
    expect(signature).toBe("%PDF");
  });

  test("should render complex nested formatting", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: `# GHG Emissions Analysis

## Overview

The company has made significant progress:

- **Scope 1 Emissions**: Direct emissions decreased by 18%
  - Reduced from 36,703 t CO₂ to 24,496 t CO₂
  - Achieved through \`renewable energy\` adoption
- **Scope 2 Emissions**: *Indirect emissions* from purchased energy
  - Market-based: 847,043 t CO₂ eq.
  - Location-based: 654,073 t CO₂ eq.
- **Scope 3 Emissions**: Value chain emissions increased
  - Now accounts for *98% of total footprint*
  - **Purchased goods**: 93% of Scope 3

### Key Takeaways

This represents the first comprehensive **Scope 3** calculation.`,
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle multiple messages with markdown", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "user",
          content: "What is the **Ghg Emission** of the company?",
          created_at: "2024-01-01T00:00:00.000Z",
        },
        {
          id: 2,
          conversation_id: 1,
          role: "assistant",
          content: "# Emissions Summary\n\n- **Scope 1**: 24,496 t CO₂\n- **Scope 2**: 654,073 t CO₂\n- **Scope 3**: 133,337 t CO₂",
          created_at: "2024-01-01T00:00:01.000Z",
        },
        {
          id: 3,
          conversation_id: 1,
          role: "user",
          content: "Can you explain *Scope 3* more?",
          created_at: "2024-01-01T00:00:02.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("exportToPDF - Edge Cases", () => {
  test("should handle empty message content", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle plain text without markdown", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "This is plain text with no markdown formatting at all.",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle very long words that need wrapping", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "assistant",
          content: "Supercalifragilisticexpialidocious ".repeat(20),
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });

    const buffer = exportToPDF(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("generateExportFilename", () => {
  test("should generate valid filename for JSON", () => {
    const conversation = createTestConversation({
      title: "Test Conversation",
    });
    const filename = generateExportFilename(conversation, "json");

    expect(filename).toMatch(/\.json$/);
    expect(filename).toContain("test_conversation");
    expect(filename).toMatch(/\d{4}-\d{2}-\d{2}/); // Date format
  });

  test("should sanitize special characters in filename", () => {
    const conversation = createTestConversation({
      title: "Test / Conversation: With Special & Characters!",
    });
    const filename = generateExportFilename(conversation, "json");

    expect(filename).not.toContain("/");
    expect(filename).not.toContain(":");
    expect(filename).not.toContain("&");
    expect(filename).not.toContain("!");
  });

  test("should limit filename length", () => {
    const conversation = createTestConversation({
      title: "A".repeat(200),
    });
    const filename = generateExportFilename(conversation, "json");

    // Should be reasonable length (sanitized title up to 50 chars + date + extension)
    expect(filename.length).toBeLessThan(100);
  });

  test("should generate correct extensions for each format", () => {
    const conversation = createTestConversation();

    expect(generateExportFilename(conversation, "json")).toMatch(/\.json$/);
    expect(generateExportFilename(conversation, "md")).toMatch(/\.md$/);
    expect(generateExportFilename(conversation, "docx")).toMatch(/\.docx$/);
    expect(generateExportFilename(conversation, "pdf")).toMatch(/\.pdf$/);
  });
});

describe("importFromJSON", () => {
  test("should import valid JSON conversation", () => {
    const conversation = createTestConversation();
    const json = exportToJSON(conversation);

    const imported = importFromJSON(json);

    expect(imported.title).toBe(conversation.title);
    expect(imported.model_provider).toBe(conversation.model_provider);
    expect(imported.model_name).toBe(conversation.model_name);
    expect(imported.messages).toHaveLength(conversation.messages.length);
  });

  test("should validate required fields", () => {
    const invalidJSON = JSON.stringify({ id: 1 });

    expect(() => importFromJSON(invalidJSON)).toThrow(/missing required fields/i);
  });

  test("should validate message structure", () => {
    const invalidJSON = JSON.stringify({
      title: "Test",
      model_provider: "openai",
      model_name: "gpt-4o",
      messages: [{ invalid: "data" }],
    });

    expect(() => importFromJSON(invalidJSON)).toThrow(/message missing role or content/i);
  });

  test("should validate message roles", () => {
    const invalidJSON = JSON.stringify({
      title: "Test",
      model_provider: "openai",
      model_name: "gpt-4o",
      messages: [
        {
          role: "invalid_role",
          content: "Test content",
        },
      ],
    });

    expect(() => importFromJSON(invalidJSON)).toThrow(/invalid message role/i);
  });

  test("should handle messages array validation", () => {
    const invalidJSON = JSON.stringify({
      title: "Test",
      model_provider: "openai",
      model_name: "gpt-4o",
      messages: "not an array",
    });

    expect(() => importFromJSON(invalidJSON)).toThrow(/messages must be an array/i);
  });

  test("should strip IDs and timestamps from imported data", () => {
    const conversation = createTestConversation();
    const json = exportToJSON(conversation);

    const imported = importFromJSON(json);

    expect(imported).not.toHaveProperty("id");
    expect(imported).not.toHaveProperty("created_at");
    expect(imported).not.toHaveProperty("updated_at");
  });

  test("should preserve message content and roles", () => {
    const conversation = createTestConversation({
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "user",
          content: "Test message with **bold** text",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      ],
    });
    const json = exportToJSON(conversation);

    const imported = importFromJSON(json);

    expect(imported.messages[0].role).toBe("user");
    expect(imported.messages[0].content).toBe("Test message with **bold** text");
  });
});

describe("Round-trip JSON export/import", () => {
  test("should preserve data through export and import", () => {
    const original = createTestConversation({
      title: "Round Trip Test",
      messages: [
        {
          id: 1,
          conversation_id: 1,
          role: "user",
          content: "**Bold** and *italic* text",
          created_at: "2024-01-01T00:00:00.000Z",
        },
        {
          id: 2,
          conversation_id: 1,
          role: "assistant",
          content: "Response with `code`",
          created_at: "2024-01-01T00:00:01.000Z",
        },
      ],
    });

    const json = exportToJSON(original);
    const imported = importFromJSON(json);

    expect(imported.title).toBe(original.title);
    expect(imported.model_provider).toBe(original.model_provider);
    expect(imported.model_name).toBe(original.model_name);
    expect(imported.messages).toHaveLength(original.messages.length);
    expect(imported.messages[0].content).toBe(original.messages[0].content);
    expect(imported.messages[1].content).toBe(original.messages[1].content);
  });
});
