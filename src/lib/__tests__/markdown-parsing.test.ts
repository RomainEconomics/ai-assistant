import { test, expect, describe } from "bun:test";
import { exportToMarkdown } from "../export-utils";
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
        role: "user",
        content,
        created_at: "2024-01-01T00:00:00.000Z",
      },
    ],
  };
}

describe("Markdown Export - Text Preservation", () => {
  test("should preserve 'Scope 3 Emissions:' text completely", () => {
    const conversation = createTestConversation("Scope 3 Emissions: are important");
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("Scope 3 Emissions:");
    expect(markdown).toContain("are important");
    expect(markdown).not.toMatch(/^\s*:\s*are important/m); // Should not start with just ":"
  });

  test("should preserve 'Scope 3 Emissions:' with bold formatting", () => {
    const conversation = createTestConversation("**Scope 3 Emissions:** are important");
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("**Scope 3 Emissions:**");
    expect(markdown).toContain("are important");
  });

  test("should preserve text before colon in bold", () => {
    const conversation = createTestConversation("**Key Point:** This is the detail");
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("**Key Point:**");
    expect(markdown).toContain("This is the detail");
    expect(markdown).not.toMatch(/^\s*:\s*This is/m); // Should not start with just ":"
  });

  test("should preserve numbered emissions with bold", () => {
    const conversation = createTestConversation("**Scope 1 Emissions:** Direct emissions");
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("**Scope 1 Emissions:**");
    expect(markdown).toContain("Direct emissions");
    expect(markdown).not.toContain(": Direct emissions"); // Should have text before colon
  });

  test("should preserve numbered emissions without bold", () => {
    const conversation = createTestConversation("Scope 2 Emissions: Indirect emissions");
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("Scope 2 Emissions:");
    expect(markdown).toContain("Indirect emissions");
  });

  test("should handle multiple bold terms with colons", () => {
    const conversation = createTestConversation(
      "**Term 1:** Definition 1\n**Term 2:** Definition 2"
    );
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("**Term 1:**");
    expect(markdown).toContain("Definition 1");
    expect(markdown).toContain("**Term 2:**");
    expect(markdown).toContain("Definition 2");
  });

  test("should preserve text with numbers and special characters", () => {
    const conversation = createTestConversation("**CO2 Emissions (80-90%):** Main contributor");
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("**CO2 Emissions (80-90%):**");
    expect(markdown).toContain("Main contributor");
  });

  test("should preserve markdown lists with bold terms", () => {
    const conversation = createTestConversation(
      "- **Scope 1:** Direct\n- **Scope 2:** Indirect\n- **Scope 3:** Value chain"
    );
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("**Scope 1:**");
    expect(markdown).toContain("**Scope 2:**");
    expect(markdown).toContain("**Scope 3:**");
    expect(markdown).toContain("Direct");
    expect(markdown).toContain("Indirect");
    expect(markdown).toContain("Value chain");
  });

  test("should preserve headings with bold text and colons", () => {
    const conversation = createTestConversation("## **Important Note:** Details below");
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("## **Important Note:**");
    expect(markdown).toContain("Details below");
  });

  test("should not remove text when colon is at the end", () => {
    const conversation = createTestConversation("The following items:");
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("The following items:");
  });
});

describe("Markdown Export - Edge Cases", () => {
  test("should handle empty content", () => {
    const conversation = createTestConversation("");
    const markdown = exportToMarkdown(conversation);

    // Should still have structure even with empty content
    expect(markdown).toContain("## User");
  });

  test("should handle content with only whitespace", () => {
    const conversation = createTestConversation("   ");
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("## User");
  });

  test("should handle very long content", () => {
    const longText = "**Scope 3 Emissions:** ".repeat(100) + "and more";
    const conversation = createTestConversation(longText);
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("**Scope 3 Emissions:**");
    expect(markdown).toContain("and more");
  });

  test("should handle nested markdown formatting", () => {
    const conversation = createTestConversation("**Bold with *italic* inside:** Text");
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("**Bold with *italic* inside:**");
    expect(markdown).toContain("Text");
  });

  test("should handle code blocks with colons", () => {
    const conversation = createTestConversation("Use this code: `const x: number = 5`");
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("Use this code:");
    expect(markdown).toContain("`const x: number = 5`");
  });
});

describe("Markdown Export - Real World Examples", () => {
  test("should handle ESG report terminology", () => {
    const content = `**Scope 1 Emissions:** Direct GHG emissions from owned/controlled sources
**Scope 2 Emissions:** Indirect GHG emissions from purchased electricity
**Scope 3 Emissions:** All other indirect emissions in the value chain`;

    const conversation = createTestConversation(content);
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("**Scope 1 Emissions:**");
    expect(markdown).toContain("Direct GHG emissions");
    expect(markdown).toContain("**Scope 2 Emissions:**");
    expect(markdown).toContain("purchased electricity");
    expect(markdown).toContain("**Scope 3 Emissions:**");
    expect(markdown).toContain("value chain");
  });

  test("should handle technical documentation style", () => {
    const content = `## API Endpoints

**GET /api/users:** Retrieve all users
**POST /api/users:** Create a new user
**DELETE /api/users/:id:** Delete a user`;

    const conversation = createTestConversation(content);
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("**GET /api/users:**");
    expect(markdown).toContain("Retrieve all users");
    expect(markdown).toContain("**POST /api/users:**");
    expect(markdown).toContain("Create a new user");
  });

  test("should handle glossary-style definitions", () => {
    const content = `**Carbon Footprint:** Total GHG emissions caused by an entity
**Net Zero:** Balance between emissions produced and removed
**Carbon Offset:** Reduction in emissions to compensate`;

    const conversation = createTestConversation(content);
    const markdown = exportToMarkdown(conversation);

    expect(markdown).toContain("**Carbon Footprint:**");
    expect(markdown).toContain("Total GHG emissions");
    expect(markdown).toContain("**Net Zero:**");
    expect(markdown).toContain("Balance between");
    expect(markdown).toContain("**Carbon Offset:**");
    expect(markdown).toContain("Reduction in emissions");
  });
});
