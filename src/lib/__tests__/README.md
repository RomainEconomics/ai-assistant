# Export Utilities Tests

This directory contains comprehensive tests for the conversation export/import functionality.

## Test Files

### `export-utils.test.ts`
Main test suite covering all export and import functionality:

- **JSON Export/Import**:
  - Valid JSON generation
  - Field validation
  - Round-trip preservation
  - Error handling

- **Markdown Export**:
  - Structure validation
  - Metadata inclusion
  - Formatting preservation (bold, italic, code)

- **DOCX Export**:
  - Binary format validation
  - Inline formatting (bold, italic, code spans)
  - Complex markdown content
  - Headings, lists, and nested formatting
  - Empty and edge cases

- **PDF Export**:
  - Binary format validation
  - Pagination handling

- **Filename Generation**:
  - Format extensions
  - Special character sanitization
  - Length limitations

### `markdown-parsing.test.ts`
Focused tests for markdown text preservation and parsing:

- **Text Preservation**:
  - Plain text with colons
  - Bold formatting with colons (e.g., `**Scope 3 Emissions:**`)
  - Numbers and special characters
  - Lists with bold terms
  - Headings with formatting

- **Edge Cases**:
  - Empty content
  - Whitespace handling
  - Very long content
  - Nested formatting
  - Code blocks with colons

- **Real World Examples**:
  - ESG report terminology
  - Technical documentation
  - Glossary-style definitions

### `list-formatting.test.ts`
Comprehensive tests for list item formatting in DOCX export:

- **Plain Text Lists**:
  - Lists with "Scope 3" terminology
  - Multiple scope items
  - Lists with colons

- **Bold Text in Lists**:
  - Bold terms with colons (e.g., `- **Scope 3:** description`)
  - Mixed bold and plain text
  - Numbers in bold within lists

- **Complex Formatting**:
  - Code spans in lists
  - Italic text in lists
  - Mixed formatting (bold + italic + code)
  - Nested lists
  - Long list items

- **Real World ESG Content**:
  - ASSA ABLOY report content
  - ESG glossary lists
  - Emissions breakdown lists

- **Edge Cases**:
  - Empty list items
  - Single item lists
  - Ordered lists
  - Special characters in lists

## Running Tests

Run all export tests:
```bash
bun test src/lib/__tests__/
```

Run specific test file:
```bash
bun test src/lib/__tests__/export-utils.test.ts
bun test src/lib/__tests__/markdown-parsing.test.ts
```

Run tests in watch mode:
```bash
bun test --watch src/lib/__tests__/
```

Run tests with coverage:
```bash
bun test --coverage src/lib/__tests__/
```

## Test Coverage

Current coverage:
- **71 total tests**
- **187 assertions**
- **All tests passing** ✅

### Covered Scenarios

1. ✅ JSON export/import with validation
2. ✅ Markdown export with proper formatting
3. ✅ DOCX export with inline formatting (bold, italic, code)
4. ✅ PDF export with pagination
5. ✅ Text preservation with special characters
6. ✅ Bold text with colons (e.g., `**Scope 3 Emissions:**`)
7. ✅ Complex nested formatting
8. ✅ Lists, headings, and code blocks
9. ✅ **List items with formatting** (FIXED: proper token processing)
10. ✅ Error handling for invalid imports
11. ✅ Filename sanitization

## Known Issues

None currently. All tests pass successfully.

## Adding New Tests

When adding new export/import features:

1. Add tests to `export-utils.test.ts` for core functionality
2. Add tests to `markdown-parsing.test.ts` for text preservation edge cases
3. Run `bun test --update-snapshots` if using snapshot testing
4. Ensure all existing tests still pass

## Test Principles

- **Comprehensive**: Test both happy paths and edge cases
- **Focused**: Each test validates one specific behavior
- **Clear**: Test names describe what is being tested
- **Fast**: All tests run in under 200ms
- **Isolated**: No dependencies between tests
