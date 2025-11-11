import { test, expect, describe } from "bun:test";
import { exportToDOCX, exportToMarkdown } from "../export-utils";
import type { ConversationWithMessages } from "../../types/database";

function createTestConversation(content: string): ConversationWithMessages {
  return {
    id: 1,
    project_id: 1,
    title: "Test",
    model_provider: "openai",
    model_name: "gpt-4o",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    messages: [
      {
        id: 1,
        conversation_id: 1,
        role: "assistant",
        content,
        created_at: "2024-01-01T00:00:00.000Z",
      },
    ],
  };
}

describe("List Formatting - Plain Text", () => {
  test("should handle list with 'Scope 3' text", async () => {
    const conversation = createTestConversation(
      "- This is the first time ASSA ABLOY has calculated its Scope 3 emissions, which account for 98% of its total footprint."
    );

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle list with multiple 'Scope' items", async () => {
    const conversation = createTestConversation(`- Scope 1 emissions: Direct emissions
- Scope 2 emissions: Indirect emissions
- Scope 3 emissions: Value chain emissions`);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle list with colons", async () => {
    const conversation = createTestConversation(`- Item 1: Description one
- Item 2: Description two
- Item 3: Description three`);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("List Formatting - Bold Text", () => {
  test("should handle list with bold 'Scope 3:'", async () => {
    const conversation = createTestConversation(
      "- **Scope 3:** This is the first time ASSA ABLOY has calculated its Scope 3 emissions"
    );

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle list with bold terms and colons", async () => {
    const conversation = createTestConversation(`- **Scope 1 Emissions:** Direct GHG emissions from owned sources
- **Scope 2 Emissions:** Indirect emissions from purchased electricity
- **Scope 3 Emissions:** All other indirect emissions in value chain`);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle mixed bold and plain in list items", async () => {
    const conversation = createTestConversation(`- **Key Point:** This is important
- Regular text without bold
- **Another Point:** With more details`);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle list with numbers in bold", async () => {
    const conversation = createTestConversation(`- **98%** of total footprint
- **93%** from purchased goods
- **80-90%** from Scope 3`);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("List Formatting - Complex Cases", () => {
  test("should handle list with code spans", async () => {
    const conversation = createTestConversation(`- Use \`console.log()\` for debugging
- The \`fetch()\` API is async
- Call \`await response.json()\` to parse`);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle list with italic text", async () => {
    const conversation = createTestConversation(`- This is *important*
- Another *key point*
- Final *emphasis*`);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle list with mixed formatting", async () => {
    const conversation = createTestConversation(`- **Bold** and *italic* together
- Some \`code\` inline
- **Bold with *italic* nested**`);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle nested lists", async () => {
    const conversation = createTestConversation(`- Main item 1
  - Sub item 1.1
  - Sub item 1.2
- Main item 2
  - Sub item 2.1`);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle long list items", async () => {
    const longText = "This is a very long list item that contains a lot of text and might wrap across multiple lines in the document. ".repeat(5);
    const conversation = createTestConversation(`- ${longText}`);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("List Formatting - Real World ESG Content", () => {
  test("should handle exact content from ASSA ABLOY report", async () => {
    const conversation = createTestConversation(
      `- This is the first time ASSA ABLOY has calculated its Scope 3 emissions, which account for 98% of its total footprint. The majority (93%) of these emissions come from purchased goods and services, particularly carbon-intensive materials such as steel, electronics, and metals.`
    );

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Also check markdown preserves text
    const markdown = exportToMarkdown(conversation);
    expect(markdown).toContain("Scope 3 emissions");
    expect(markdown).toContain("98%");
    expect(markdown).toContain("ASSA ABLOY");
  });

  test("should handle ESG glossary list", async () => {
    const conversation = createTestConversation(`- **Carbon Footprint:** Total GHG emissions caused directly and indirectly
- **Net Zero:** Achieving a balance between emissions produced and removed
- **Scope 1 Emissions:** Direct emissions from owned or controlled sources
- **Scope 2 Emissions:** Indirect emissions from purchased energy
- **Scope 3 Emissions:** All other indirect emissions in the value chain`);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    // Verify markdown preserves all scopes
    const markdown = exportToMarkdown(conversation);
    expect(markdown).toContain("**Scope 1 Emissions:**");
    expect(markdown).toContain("**Scope 2 Emissions:**");
    expect(markdown).toContain("**Scope 3 Emissions:**");
  });

  test("should handle emissions breakdown list", async () => {
    const conversation = createTestConversation(`- **Purchased goods and services:** 93% of Scope 3 emissions
- **Capital goods:** Steel and electronics manufacturing
- **Transportation and distribution:** Upstream and downstream logistics
- **End-of-life treatment:** Product disposal and recycling`);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("List Formatting - Edge Cases", () => {
  test("should handle empty list items", async () => {
    const conversation = createTestConversation(`-
- Item with content
- `);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle single list item", async () => {
    const conversation = createTestConversation(`- Only one item`);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle ordered lists", async () => {
    const conversation = createTestConversation(`1. First item
2. Second item
3. Third item`);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("should handle list with special characters", async () => {
    const conversation = createTestConversation(`- Item with & ampersand
- Item with < less than
- Item with > greater than
- Item with "quotes"`);

    const buffer = await exportToDOCX(conversation);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
