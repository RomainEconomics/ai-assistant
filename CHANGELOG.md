# Changelog

## [Generic Version] - 2025-11-10

#### Bug Fixes

- **Weaviate Vectorization**: Fixed "VectorFromInput was called without vectorizer" error
  - Added OpenAI API key to Weaviate container environment
  - Reset collections with proper vectorizer configuration
  - Created test scripts to verify vectorization works

#### New Scripts

- `src/scripts/reset-weaviate-collections.ts` - Reset collections with proper config
- `src/scripts/test-vectorizer.ts` - Verify vectorization functionality

### Current Features

#### Core Features

- Project-based conversation organization
- Multiple AI providers (OpenAI, Anthropic)
- Real-time streaming responses
- Persistent history in SQLite
- Modern UI with React 19 + shadcn/ui
- Internationalization (English & French)
- Dark mode support

#### Advanced Features

- Document chat with RAG (Retrieval-Augmented Generation)
- Weaviate vector database for semantic search
- S3 storage for document management
- Batch questioning across documents
- Multi-document chat
- Conversation export (JSON, Markdown, DOCX, PDF)
- Mock authentication for development

### Tech Stack

- Runtime: Bun 1.3
- Frontend: React 19, shadcn/ui, Tailwind CSS 4
- Backend: Bun.serve() REST API
- Database: SQLite3
- Vector DB: Weaviate 1.33.0 with text2vec-openai
- Storage: S3
- AI: AI SDK (OpenAI, Anthropic)
- PDF: pdf-parse v2 with Worker threads
- i18n: i18next + react-i18next

### Breaking Changes

- **Database**: User table schema changed (removed external auth fields)
- **Weaviate**: Collections need to be reset (old collections incompatible)
- **S3**: New bucket name and folder structure (existing files need migration)

### Migration Guide

#### For Existing Installations

1. **Backup your data**:

   ```bash
   cp data/database/chat.db data/database/chat.db.backup
   ```

2. **Update environment variables**:
   - Update `S3_BUCKET` to `ai-assistant-storage`

3. **Restart Docker services**:

   ```bash
   docker compose down
   docker compose up -d
   ```

4. **Reset Weaviate collections**:

   ```bash
   bun src/scripts/reset-weaviate-collections.ts
   ```

5. **Re-upload documents** (if you had any)

6. **Test the application**:
   - Login with any username/password
   - Upload a test PDF
   - Try batch questioning

### Notes

- **Development Mode**: All authentication is mocked - accept any credentials
- **Production**: Implement proper authentication before deploying
- **Documents**: Must be re-uploaded after Weaviate collection reset
