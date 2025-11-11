# Bun Development Guidelines

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

---

# AI Assistant Application

A full-stack AI chat application built with Bun 1.3, React 19, and the AI SDK. Supports multiple AI providers (OpenAI, Anthropic) with project-based conversation organization and document chat with RAG.

## Project Overview

This application provides an in-house chat interface for:

- **Simple Chat**: Direct conversations with AI models (OpenAI GPT-4/GPT-4o, Anthropic Claude)
- **Project Organization**: Group related conversations into projects
- **Conversation Management**: Persistent chat history with full CRUD operations
- **Streaming Responses**: Real-time AI responses using AI SDK streaming
- **Multi-Provider Support**: Choose between OpenAI and Anthropic models per conversation
- **Document Chat with RAG**: Upload PDFs, extract text, chunk, embed, and query using Weaviate vector database
- **S3 Storage**: Store PDF documents in OVH S3 bucket with automatic key generation

## Tech Stack

- **Runtime**: Bun 1.3 (server + bundler)
- **Frontend**: React 19 with shadcn/ui + Tailwind CSS 4
- **UI Components**: shadcn/ui (sidebar, button, card, input, etc.) + Radix UI primitives
- **Routing & State**: TanStack Query for data fetching (no TanStack Router used)
- **Backend**: Bun.serve() with REST API endpoints
- **Database**: SQLite3 with PostgreSQL-compatible schema (via Bun's SQL API)
- **AI Integration**: AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`)
- **Vector Database**: Weaviate 1.33.0 with text2vec-openai module
- **Storage**: OVH S3 (via Bun's built-in S3Client)
- **PDF Processing**: pdf-parse v2 with Worker threads
- **Styling**: Tailwind CSS 4 with custom design tokens
- **Theming**: next-themes for light/dark mode support
- **Internationalization**: i18next + react-i18next (English & French)

## Architecture

### Project Structure

```
src/
├── api/                    # Backend API route handlers
│   ├── chat.ts            # AI streaming, model list, message saving
│   ├── conversations.ts   # Conversation CRUD operations
│   ├── projects.ts        # Project CRUD operations
│   └── settings.ts        # User preferences API (theme, language, model defaults)
├── components/
│   ├── app-sidebar.tsx    # Main application sidebar (shadcn)
│   ├── language-switcher.tsx # Language selection dropdown
│   ├── theme-switcher.tsx # Theme selection dropdown (light/dark/system)
│   └── ui/                # shadcn/ui components
│       ├── sidebar.tsx    # Shadcn sidebar primitives
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── textarea.tsx
│       ├── badge.tsx
│       ├── avatar.tsx
│       ├── scroll-area.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── skeleton.tsx
│       └── tooltip.tsx
├── hooks/
│   ├── useApi.ts          # TanStack Query hooks for API calls
│   ├── useLanguage.ts     # Language management hook
│   ├── useTheme.ts        # Theme management hook
│   └── use-mobile.tsx     # Mobile detection hook for sidebar
├── lib/
│   ├── db.ts              # Database connection and queries
│   ├── utils.ts           # Utility functions (cn() for classnames)
│   ├── i18n.ts            # i18next configuration and helpers
│   ├── weaviate.ts        # Weaviate client and collection management
│   ├── pdf-processor.ts   # PDF text extraction and chunking
│   └── s3-storage.ts      # S3 storage operations (OVH)
├── locales/               # Translation files
│   ├── en/
│   │   └── translation.json # English translations
│   └── fr/
│       └── translation.json # French translations
├── pages/
│   ├── ProjectsPage.tsx   # Projects list and conversation management
│   ├── ConversationPage.tsx # Chat interface with streaming
│   └── SettingsPage.tsx   # User preferences (model defaults, theme, language)
├── types/
│   ├── database.ts        # Database schema TypeScript types
│   ├── api.ts             # API request/response types and model definitions
│   ├── weaviate.ts        # Weaviate collection and document types
│   └── s3.ts              # S3 storage types and interfaces
├── workers/
│   └── pdf-worker.ts      # Worker thread for PDF processing
├── scripts/
│   ├── test-weaviate.ts   # Weaviate connection test
│   ├── test-s3.ts         # S3 connection test
│   └── test-pdf-processing.ts # PDF processing pipeline test
├── App.tsx                # Main app with SidebarProvider and routing logic
├── frontend.tsx           # React app bootstrap
├── index.tsx              # Server entry point with API routes
└── index.html             # HTML entry point

data/
└── database/
    └── chat.db            # SQLite database file
```

### Database Schema

#### SQLite Database (src/lib/db.ts)

PostgreSQL-compatible SQLite schema with proper relationships:

**users** - User accounts (single user for now)

- id (INTEGER PRIMARY KEY)
- email (TEXT UNIQUE)
- name (TEXT)
- created_at (DATETIME)

**user_preferences** - User settings and preferences

- id (INTEGER PRIMARY KEY)
- user_id (INTEGER → users.id)
- default_model_provider ('openai' | 'anthropic' | NULL)
- default_model_name (TEXT | NULL)
- default_temperature (REAL, default: 0.7)
- default_max_tokens (INTEGER, default: 2000)
- theme ('light' | 'dark' | 'system', default: 'light')
- language ('en' | 'fr', default: 'en')
- created_at, updated_at (DATETIME)

**projects** - Project organization

- id (INTEGER PRIMARY KEY)
- user_id (INTEGER → users.id)
- name (TEXT)
- description (TEXT)
- is_private (BOOLEAN, default: true)
- created_at, updated_at (DATETIME)

**conversations** - Chat sessions

- id (INTEGER PRIMARY KEY)
- project_id (INTEGER → projects.id)
- title (TEXT)
- model_provider ('openai' | 'anthropic')
- model_name (TEXT)
- created_at, updated_at (DATETIME)

**messages** - Chat messages

- id (INTEGER PRIMARY KEY)
- conversation_id (INTEGER → conversations.id)
- role ('user' | 'assistant' | 'system')
- content (TEXT)
- created_at (DATETIME)

**agent_runs** - DeepAgent execution history

- id (TEXT PRIMARY KEY) - UUID
- user_id (INTEGER → users.id)
- agent_config_id (TEXT) - Agent configuration identifier
- document_id (INTEGER → documents.id)
- query (TEXT) - User query or agent default
- status ('running' | 'completed' | 'failed')
- result (TEXT) - Agent analysis result
- error (TEXT) - Error message if failed
- started_at (DATETIME)
- completed_at (DATETIME)
- duration_seconds (INTEGER) - Calculated on completion

**agent_messages** - DeepAgent step-by-step logs

- id (INTEGER PRIMARY KEY)
- agent_run_id (TEXT → agent_runs.id)
- role ('user' | 'assistant' | 'system' | 'tool')
- content (TEXT)
- tool_name (TEXT) - Tool used (if role='tool')
- tool_input (TEXT) - JSON tool parameters
- tool_output (TEXT) - Tool result
- created_at (DATETIME)

#### Weaviate Vector Database (src/lib/weaviate.ts)

Parent/Child collection schema for document RAG:

**ParentDocument** - Full page content (no vectorizer)

- content (TEXT) - Full page text
- path (TEXT) - S3 storage key
- company_id (INT)
- company_name (TEXT)
- report_type (TEXT)
- page (INT) - Page number
- filename (TEXT)
- file_id (INT) - Reference to file tracking
- file_slug (TEXT) - Unique file identifier (UUID)
- reporting_year (INT)

**ChildDocument** - Text chunks with embeddings (text2vec-openai)

- content (TEXT) - Chunk text (vectorized)
- path (TEXT) - S3 storage key
- company_id (INT)
- company_name (TEXT)
- report_type (TEXT)
- page (INT) - Original page number
- filename (TEXT)
- file_id (INT)
- file_slug (TEXT)
- reporting_year (INT)
- **References**: parent_page → ParentDocument

**RAG Strategy**: Search on ChildDocument chunks (semantic search via embeddings), then retrieve full ParentDocument pages for context.

### Backend API (src/index.tsx)

Uses Bun.serve() with route-based REST API:

**Projects API**

- `GET /api/projects` - List all projects
- `POST /api/projects` - Create project
- `GET /api/projects/:id` - Get project with conversations
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

**Conversations API**

- `GET /api/conversations?project_id=:id` - List conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id` - Get conversation with messages
- `PUT /api/conversations/:id` - Update conversation title
- `DELETE /api/conversations/:id` - Delete conversation

**Chat API**

- `POST /api/chat/stream` - Stream AI response (saves assistant message automatically)
- `POST /api/chat/save-message` - Manually save assistant message (legacy)
- `GET /api/models` - List available AI models

**Settings API**

- `GET /api/settings` - Get user preferences (auto-creates if not exists)
- `PUT /api/settings` - Update user preferences (theme, language, model defaults)

### Frontend Architecture

**State Management**:

- TanStack Query for server state (data fetching, caching)
- React useState for local UI state (view navigation, form state)
- Shadcn Sidebar context for sidebar state

**Routing**:

- Simple view-based routing with useState ('projects' | 'conversation')
- No client-side router library used

**Key Features**:

- Shadcn sidebar with collapse/expand, mobile responsive
- Real-time streaming chat responses
- Optimistic UI updates for better UX
- Automatic message persistence during streaming

## Available AI Models

### OpenAI

- GPT-4 Omni (`gpt-4o`)
- GPT-4 Omni Mini (`gpt-4o-mini`)

### Anthropic

- Claude 3.5 Sonnet (`claude-3-5-sonnet-20241022`)
- Claude 3 Opus (`claude-3-opus-20240229`)
- Claude 3 Sonnet (`claude-3-sonnet-20240229`)
- Claude 3 Haiku (`claude-3-haiku-20240307`)

## Getting Started

### Prerequisites

- Bun 1.3 or later
- OpenAI API key (optional)
- Anthropic API key (optional)

### Installation

```bash
bun install
```

### Configuration

.env file contains the environment variables:

```env
# Database
DATABASE_PATH=./data/database/chat.db

# OpenAI API Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Anthropic API Configuration
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Server Configuration
PORT=3001
NODE_ENV=development

# Weaviate Configuration
WEAVIATE_HOST=http://localhost:8080
WEAVIATE_API_KEY=

# S3 Storage Configuration (OVH)
S3_ACCESS_KEY_ID=your_access_key_here
S3_SECRET_ACCESS_KEY=your_secret_key_here
S3_BUCKET=ai-assistant-storage
S3_ENDPOINT=https://s3.gra.io.cloud.ovh.net/
S3_REGION=gra
```

### Development

Start the services:

```bash
# Start Weaviate with Docker Compose
docker compose up -d weaviate

# Start the development server
bun dev
# or
bun --hot src/index.tsx
```

Server runs at `http://localhost:3001`

### Production

```bash
bun start
```

### Testing

Test individual components:

```bash
# Test Weaviate connection and collection creation
bun src/scripts/test-weaviate.ts

# Test S3 connection and file operations
bun src/scripts/test-s3.ts

# Test full PDF processing pipeline (S3 + Weaviate)
bun src/scripts/test-pdf-processing.ts
```

## Development Workflow

### Adding a New shadcn/ui Component

```bash
bunx shadcn@latest add <component-name>
```

### Database Queries

Use Bun's tagged template syntax:

```typescript
import { sql, SQL } from "bun";
const db = new SQL("sqlite://./data/database/chat.db");

// Safe parameterized queries
const projects = await db`
  SELECT * FROM projects
  WHERE user_id = ${userId}
  ORDER BY updated_at DESC
`;

// Conditional clauses
const searchFilter = search ? sql`AND name LIKE ${"%" + search + "%"}` : sql``;

const results = await db`
  SELECT * FROM projects
  WHERE user_id = ${userId} ${searchFilter}
`;
```

### Streaming AI Responses

The `/api/chat/stream` endpoint uses AI SDK's `streamText` function:

```typescript
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

// In handler
const result = streamText({
  model: provider === "openai" ? openai(modelName) : anthropic(modelName),
  messages: conversationHistory,
  temperature: 0.7,
  maxTokens: 2000,
});

// Stream to client
for await (const part of result.textStream) {
  // Stream chunk to client
  // Accumulate full response
}

// Save complete response to database
await createMessage(conversationId, "assistant", fullResponse);
```

### PDF Processing with Workers

PDF processing runs in a separate Worker thread to avoid blocking the main application:

```typescript
import { PDFProcessor } from "../lib/pdf-processor.ts";
import { uploadPDFToS3 } from "../lib/s3-storage.ts";
import { getWeaviateClient } from "../lib/weaviate.ts";

// In worker thread (src/workers/pdf-worker.ts)
const processor = new PDFProcessor();

// 1. Extract text from PDF (per-page)
const pagesText = await processor.extractTextFromPDF(buffer);

// 2. Upload to S3
const s3Result = await uploadPDFToS3(filename, buffer, {
  fileId,
  companyId,
  companyName,
  reportingYear,
});

// 3. Chunk text (1000 chars with 200 overlap)
for (const [pageText, pageNumber] of pagesText) {
  const chunks = processor.chunkText(pageText, pageNumber);

  // Create parent document (full page)
  const parentData = {
    content: pageText,
    path: s3Result.key, // S3 key
    page: pageNumber,
    // ... other metadata
  };

  // Create child documents (chunks with embeddings)
  for (const chunk of chunks) {
    const childData = {
      content: chunk.content,
      path: s3Result.key,
      page: pageNumber,
      // ... other metadata
      // References parent_page
    };
  }
}

// 4. Insert into Weaviate
await parentCollection.data.insert({ properties: parentData, id: parentUuid });
await childCollection.data.insert({
  properties: childData,
  id: childUuid,
  references: { parent_page: parentUuid },
});
```

**Processing Pipeline:**

1. Extract text per page using pdf-parse v2
2. Upload PDF to S3 (`app-storage/documents/{year}/entity_{id}/{hash}/{filename}`)
3. Chunk text recursively (configurable size/overlap)
4. Create ParentDocument entries (full pages)
5. Create ChildDocument entries (chunks) with embeddings via text2vec-openai
6. Link children to parents via references

### S3 Storage Operations

Using Bun's built-in S3Client for OVH Cloud Storage:

```typescript
import { S3Client } from "bun";
import {
  uploadToS3,
  generateFileKey,
  calculateFileHash,
} from "../lib/s3-storage.ts";

// Generate hierarchical key
const fileHash = calculateFileHash(buffer);
const key = generateFileKey({
  filename: "report.pdf",
  companyId: 1,
  year: 2024,
  fileHash,
  prefix: "documents",
});
// Result: app-storage/documents/2024/entity_1/a1b2c3d4/report.pdf

// Upload with metadata
const result = await uploadToS3({
  key,
  body: buffer,
  contentType: "application/pdf",
  metadata: {
    company_id: "1",
    reporting_year: "2024",
    file_hash: fileHash,
  },
});

// Check existence
const exists = await existsInS3(key);

// Get metadata
const metadata = await getS3FileMetadata(key);

// List files
const files = await listS3Files("app-storage/documents/2024/", 100);

// Download
const buffer = await downloadFromS3(key);

// Delete
await deleteFromS3(key);
```

**S3 File Structure:**

```
app-storage/              # Project root folder
  └── documents/          # Document type
      └── {year}/         # Reporting year
          └── entity_{id}/ # Entity identifier
              └── {hash}/  # First 8 chars of SHA256
                  └── {filename} # Sanitized filename
```

### PDF Viewing and Access

**IMPORTANT: Always use the API proxy endpoint to access PDFs, never use direct S3 URLs.**

Documents are stored in OVH S3 with the full URL saved in the database (`s3_url` field). However, direct S3 URLs may have CORS restrictions or require authentication, causing 400/403 errors.

**Correct approach - Use the API proxy:**

```typescript
// ✅ CORRECT: Use API endpoint with document ID
const pdfUrl = `/api/documents/${document.id}/pdf`;

// In React components
<PdfViewer
  fileUrl={`/api/documents/${document.id}/pdf`}
  fileName={document.filename}
  initialPage={1}
/>
```

**Incorrect approach - Do NOT use:**

```typescript
// ❌ WRONG: Don't use direct S3 URL
const pdfUrl = document.s3_url; // https://s3.gra.io.cloud.ovh.net/...

// This will cause:
// - 400 Bad Request errors
// - CORS issues
// - Authentication failures
// - PDF cache to spam requests
```

**Why use the API proxy:**

- Server-side S3 authentication (credentials never exposed to client)
- Proper CORS headers
- Centralized access control
- Better caching with `Cache-Control` headers
- Works with PDF cache hook (`usePdfCache`)
- Prevents duplicate requests

**API Endpoint Implementation:**

The `/api/documents/:id/pdf` endpoint (in `src/api/documents.ts`) handles:
1. Document lookup by ID
2. S3 download using server credentials
3. Streaming to client with proper headers
4. Cache control (1 hour)

```typescript
// Backend (src/api/documents.ts)
export async function handleDownloadDocument(req: Request, server: Server) {
  const document = await getDocumentById(id);
  const pdfBuffer = await downloadFromS3(document.s3_key);

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${document.filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
```

## Key Features Implemented

### Phase 1 - Core MVP ✅

- ✅ Full-stack app with Bun 1.3
- ✅ Project organization system
- ✅ Conversation management (CRUD)
- ✅ Streaming chat with OpenAI and Anthropic
- ✅ Persistent message history
- ✅ Modern UI with shadcn sidebar
- ✅ Mobile responsive design
- ✅ Model selection per conversation
- ✅ Database with PostgreSQL-compatible schema

- ✅ **Conversation Export/Import**
  - Export conversations to JSON, Markdown, DOCX, and PDF formats
  - Import conversations from JSON files
  - Markdown-aware export with proper formatting (bold, italic, code blocks, lists, headings)
  - DOCX export with `docx` library and markdown parsing via `marked`
  - PDF export with `jspdf` including text wrapping and page breaks
  - API endpoints: `GET /api/conversations/:id/export?format=json|md|docx|pdf`, `POST /api/conversations/import`
  - React hooks: `useExportConversation()`, `useImportConversation()`
  - Automatic file download with sanitized filenames
  - Export includes all metadata (title, model info, timestamps) and message history

### Phase 2 - Document Chat with RAG ✅

- ✅ **Weaviate Vector Database Integration**
  - Parent/Child collection schema for optimal RAG
  - ParentDocument: Full pages without vectorization
  - ChildDocument: Text chunks with OpenAI embeddings (text-embedding-3-small)
  - Automatic collection creation on startup
  - Docker Compose integration

- ✅ **S3 Storage (OVH Cloud)**
  - Bun's built-in S3Client integration
  - Hierarchical file organization with project-specific folders
  - SHA256 hashing for deduplication
  - Metadata storage support
  - Complete CRUD operations

- ✅ **PDF Processing Pipeline**
  - Worker thread processing (non-blocking)
  - Per-page text extraction with pdf-parse v2
  - Recursive text chunking (configurable size/overlap)
  - Automatic S3 upload
  - Weaviate indexing with embeddings
  - Progress reporting
  - UUID v5 for deterministic document IDs

- ✅ **Test Scripts**
  - Weaviate connection and collection verification
  - S3 operations testing
  - Full PDF processing pipeline testing

- ✅ **Multi-Document Query Export**
  - Export multi-doc query results to JSON, Markdown, DOCX, and PDF formats
  - Reuses conversation export utilities with markdown-to-DOCX parsing
  - Includes metadata (question, processing time, document count, date)
  - Structured results per document with answers and sources
  - API endpoint: `POST /api/rag/multi-doc-export?format=json|md|docx|pdf`
  - React hook: `useExportMultiDocQuery()`
  - UI integration: Export dropdown in MultiDocChatPage results header
  - Fully internationalized (English & French)
  - Automatic file download with sanitized filenames

**Export Formats:**
- **JSON**: Complete data structure with all metadata and results
- **Markdown**: Formatted document with headings, metadata, and code blocks for sources
- **DOCX**: Word document with proper formatting, parsed markdown content, and metadata
- **PDF**: Professional PDF with text wrapping, page breaks, and structured layout

**Implementation Files:**
- Export utilities: `src/lib/export-utils.ts` (functions: `exportMultiDocToJSON`, `exportMultiDocToMarkdown`, `exportMultiDocToDOCX`, `exportMultiDocToPDF`)
- API handler: `src/api/rag-multi.ts` (`handleExportMultiDocQuery`)
- React hook: `src/hooks/useApi.ts` (`useExportMultiDocQuery`)
- UI component: `src/pages/MultiDocChatPage.tsx`
- Database query: `src/lib/db.ts` (`getMultiDocQueryById`)

### UI Features

- ✅ Collapsible sidebar with smooth animations
- ✅ `Cmd+B` / `Ctrl+B` keyboard shortcut
- ✅ Mobile sheet/drawer on small screens
- ✅ Persistent state via cookies
- ✅ Icon-only collapsed mode
- ✅ Project list with active states

### Phase 1.5 - Internationalization (i18n) ✅

- ✅ **Multi-language Support**
  - English (en) and French (fr) translations
  - 500+ UI strings translated
  - Centralized translation files in JSON format
  - i18next + react-i18next integration

- ✅ **Language Switcher**
  - Dropdown menu in app header
  - Visual indicator for current language
  - Loading states during updates
  - Toast notifications

- ✅ **Backend Persistence**
  - User language preference in database
  - API endpoints for preferences (GET/PATCH)
  - Automatic sync between frontend and backend

- ✅ **Locale Formatting**
  - Date formatting per locale
  - Relative time formatting
  - Number and currency formatting
  - Helper functions in `src/lib/i18n.ts`

- ✅ **Developer Experience**
  - `useLanguage()` hook for language management
  - `useTranslation()` hook for translations
  - Comprehensive documentation in `I18N_GUIDE.md`
  - Easy to add new languages

**Usage Example:**
```tsx
import { useTranslation } from "react-i18next";

function MyComponent() {
  const { t } = useTranslation();
  return <h1>{t('projects.title')}</h1>;
}
```

See `I18N_GUIDE.md` for complete documentation.

### Phase 1.5 - Theme Support (Light/Dark Mode) ✅

- ✅ **Theme Provider**
  - next-themes integration for seamless theme switching
  - ThemeProvider wraps the entire application
  - Support for light, dark, and system modes
  - Automatic system theme detection
  - Smooth transitions without flash on page load

- ✅ **Theme Switcher Component**
  - Dropdown menu in app header (next to language switcher)
  - Visual icons: Sun (light), Moon (dark), Monitor (system)
  - Active theme indicator with checkmark
  - Loading states during theme updates
  - Toast notifications for user feedback

- ✅ **Backend Persistence**
  - Theme preference stored in `user_preferences` table
  - API endpoints via `/api/settings` (GET/PUT)
  - Automatic sync between frontend and backend
  - Theme persists across sessions and devices

- ✅ **Styling**
  - Complete Tailwind CSS 4 dark mode support
  - Custom dark variant: `@custom-variant dark (&:is(.dark *))`
  - Full color scheme for both light and dark modes
  - All shadcn/ui components support dark mode out of the box
  - CSS variables for consistent theming

- ✅ **Developer Experience**
  - `useTheme()` hook for theme management
  - Simple API: `const { theme, setTheme, resolvedTheme } = useTheme()`
  - Type-safe theme modes: 'light' | 'dark' | 'system'
  - Automatic revert on backend update failure

**Usage Example:**
```tsx
import { useTheme } from "@/hooks/useTheme";

function MyComponent() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Get current theme setting
  console.log(theme); // 'light' | 'dark' | 'system'

  // Get resolved theme (always 'light' or 'dark')
  console.log(resolvedTheme); // 'light' | 'dark'

  // Change theme
  await setTheme('dark');
}
```

**Implementation Details:**
- **Component**: `src/components/theme-switcher.tsx`
- **Hook**: `src/hooks/useTheme.ts`
- **Translations**: `settings.theme.*` keys in `src/locales/{en,fr}/translation.json`
- **Database**: `user_preferences.theme` column ('light' | 'dark' | 'system')
- **CSS**: `styles/globals.css` with complete dark mode color scheme

### Phase 1.5 - Settings Page ✅

- ✅ **Comprehensive Settings UI**
  - Tabbed interface with three sections: Model Defaults, Appearance, Language
  - shadcn/ui components (Tabs, Cards, Select, Input)
  - Real-time form state management with optimistic updates
  - Save button with loading and success states

- ✅ **Model Defaults Configuration**
  - Default AI provider selection (OpenAI/Anthropic)
  - Default model selection per provider
  - Temperature slider (0-2)
  - Max tokens input (1-100,000)
  - All settings validate and persist to database

- ✅ **Backend Integration**
  - `user_preferences` table stores all settings
  - `/api/settings` endpoints (GET/PUT)
  - Auto-create preferences on first access
  - Validates all input server-side

- ✅ **User Experience**
  - Accessible via Settings link in sidebar footer
  - Toast notifications for save success/failure
  - Responsive layout with max-width container
  - Fully translated (i18n support)

**Route**: `/settings` | **Component**: `src/pages/SettingsPage.tsx` | **API**: `src/api/settings.ts`

### Phase 2.5 - DeepAgent Analysis ✅

- ✅ **DeepAgent Integration**
  - Port of langchain-ai/deepagentsjs for TypeScript
  - Specialized AI agents for comprehensive document analysis
  - Background worker processing (non-blocking, prevents HTTP timeouts)
  - Real-time status polling (every 3 seconds)
  - Full execution history tracking

- ✅ **Weaviate-based Tools**
  - Custom tool implementations using existing Weaviate setup
  - `semantic_search` - Hybrid search on document chunks
  - `get_document_pages` - Retrieve full page content by page numbers
  - `search_with_page_filter` - Search within specific page ranges
  - `find_pages_by_keywords` - Locate pages containing specific keywords
  - All tools scoped to specific documents via `file_slug`

- ✅ **Pre-configured Agents**
  - **Simple Document Q&A** - Fast, lightweight agent for quick queries (1-2 minutes)
    - Basic document understanding and information extraction
    - Efficient for testing and simple questions
  - **ESG Environmental Strategy Analyst** - Comprehensive ESG analysis (10-15 minutes)
    - Expert in GHG emissions, climate targets, energy transition finance
    - Analyzes TCFD compliance, greenwashing indicators, data gaps
    - Produces structured reports with page citations and critical assessment

- ✅ **Database Schema**
  - `agent_runs` table - Execution history with status tracking
  - `agent_messages` table - Step-by-step execution logs (for future debugging)
  - Full support for completed, failed, and running states
  - Automatic duration calculation on completion

- ✅ **Background Processing Architecture**
  - Worker thread spawned via `src/workers/deepagent-worker.ts`
  - API returns immediately with run ID
  - Frontend polls `/api/deepagent/runs/:id` for status updates
  - Progress messages logged server-side
  - Automatic worker cleanup on completion/failure

- ✅ **API Endpoints**
  - `GET /api/deepagent/agents` - List available agent configurations
  - `POST /api/deepagent/run` - Start agent run (returns immediately)
  - `GET /api/deepagent/history?limit=50` - Get user's run history
  - `GET /api/deepagent/runs/:id` - Poll for run status and results
  - `GET /api/deepagent/document/:documentId/runs` - Get runs for specific document

- ✅ **User Interface**
  - Tabbed interface (Run Agent / Result)
  - Agent selector with descriptions and estimated durations
  - Document selector (only completed/processed documents)
  - Optional custom query input (uses agent default if empty)
  - Real-time status updates with loading indicators
  - History dialog with filterable past runs
  - Markdown-rendered results with proper formatting
  - Mobile-responsive design

- ✅ **Developer Experience**
  - Easy to add new agents via `src/lib/deepagent-configs.ts`
  - Agent configs include system prompts, default queries, metadata
  - Tools automatically adapt to selected document
  - Comprehensive error handling and recovery
  - Full i18n support (English & French)

**Route**: `/deepagent` | **Component**: `src/pages/DeepAgentPage.tsx` | **API**: `src/api/deepagent.ts` | **Worker**: `src/workers/deepagent-worker.ts`

**Dependencies**:
- `deepagents` - TypeScript deep agent framework
- `@langchain/core` - LangChain core functionality
- `@langchain/openai` - OpenAI model integration
- `zod` - Schema validation for tool parameters

**Usage Example:**
```typescript
// Add a new agent configuration
export const MY_CUSTOM_AGENT: DeepAgentConfig = {
  id: "my-agent",
  name: "My Custom Agent",
  description: "Description of what this agent does",
  estimatedDuration: "5-10 minutes",
  systemPrompt: `Your system prompt here...`,
  defaultQuery: "Default query to run if user doesn't provide one",
};
```

**How It Works:**
1. User selects agent and document, optionally enters custom query
2. API creates run record in database with status='running'
3. Background worker spawned to execute agent
4. Frontend polls for status every 3 seconds
5. Worker uses Weaviate tools to search/retrieve document content
6. LLM processes information using agent's system prompt
7. On completion, result saved to database with status='completed'
8. Frontend displays markdown-formatted results

## Future Enhancements

See `TODO.md` for detailed roadmap including:

- Phase 2.5: RAG query implementation (hybrid search on ChildDocument → retrieve ParentDocument)
- Phase 2.5: Document upload API endpoints
- Phase 2.5: Document-aware chat interface
- Phase 3: Multi-user support, sharing, analytics

## Troubleshooting

### General

- **Port in use**: Set `PORT` env var to different port
- **Database not found**: Ensure `data/database/` directory exists
- **API keys not working**: Check `.env` file has correct keys
- **HMR not working**: Restart with `bun --hot src/index.tsx`
- **Sidebar not showing**: Check that `SidebarProvider` wraps the app in `App.tsx`

### Weaviate

- **Connection refused**: Ensure Weaviate is running: `docker compose up -d weaviate`
- **Collection creation fails**: Check OpenAI API key for text2vec-openai module
- **Port 8080 in use**: Update `WEAVIATE_HOST` in `.env` or change Docker port mapping

### S3 Storage

- **Credentials not found**: Ensure all S3\_\* variables are set in `.env`
- **Upload fails**: Verify S3 endpoint and bucket access permissions
- **403 Forbidden**: Check S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY are correct

### PDF Processing

- **Worker fails to start**: Ensure all dependencies installed: `bun install`
- **Text extraction fails**: Verify PDF is not encrypted or password-protected
- **Embeddings fail**: Check OpenAI API key and Weaviate text2vec-openai module
