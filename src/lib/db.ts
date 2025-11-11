import { sql, SQL } from "bun";
import type { User, Project, Conversation, Message, Document, ConversationDocument, MessageSource, AgentRun, AgentMessage, AgentRunWithDocument } from "@/types/database";

// Database connection
const dbPath = process.env.DATABASE_PATH || "./data/database/chat.db";
export const db = new SQL(`sqlite://${dbPath}`);

// Initialize database with tables
export async function initializeDatabase() {
  // Users table
  await db`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      username TEXT UNIQUE,
      roles TEXT DEFAULT '["user"]',
      is_active BOOLEAN DEFAULT 1,
      last_login DATETIME,
      updated_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;

  // Sessions table for JWT token management
  await db`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  // User preferences table
  await db`
    CREATE TABLE IF NOT EXISTS user_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      default_model_provider TEXT CHECK(default_model_provider IN ('openai', 'anthropic')),
      default_model_name TEXT,
      default_temperature REAL DEFAULT 0.7,
      default_max_tokens INTEGER DEFAULT 2000,
      theme TEXT DEFAULT 'light' CHECK(theme IN ('light', 'dark', 'system')),
      language TEXT DEFAULT 'en' CHECK(language IN ('en', 'fr')),
      disclaimer_accepted_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  // Projects table
  await db`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      is_private BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  // Conversations table
  await db`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      model_provider TEXT NOT NULL CHECK(model_provider IN ('openai', 'anthropic')),
      model_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `;

  // Messages table
  await db`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )
  `;

  // Documents table
  await db`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      file_slug TEXT NOT NULL UNIQUE,
      s3_key TEXT NOT NULL,
      s3_url TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      company_id INTEGER,
      company_name TEXT,
      report_type TEXT,
      reporting_year INTEGER,
      processing_status TEXT NOT NULL DEFAULT 'pending' CHECK(processing_status IN ('pending', 'processing', 'completed', 'failed')),
      processing_error TEXT,
      pages_processed INTEGER,
      chunks_created INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  // Conversation-Document association table (for RAG - no specific pages)
  await db`
    CREATE TABLE IF NOT EXISTS conversation_documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      document_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
      UNIQUE(conversation_id, document_id)
    )
  `;

  // Message source tracking table
  await db`
    CREATE TABLE IF NOT EXISTS message_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id INTEGER NOT NULL,
      document_id INTEGER NOT NULL,
      page_numbers TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `;

  // Document analyses cache table (for AI analysis results)
  await db`
    CREATE TABLE IF NOT EXISTS document_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER NOT NULL,
      file_slug TEXT NOT NULL,
      analysis_type TEXT NOT NULL CHECK(analysis_type IN ('summary', 'key-points', 'entities', 'topics')),
      result TEXT NOT NULL,
      options TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (file_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `;

  // Batch queries table (for async job tracking)
  await db`
    CREATE TABLE IF NOT EXISTS batch_queries (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      questions TEXT NOT NULL,
      document_ids TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
      progress INTEGER DEFAULT 0,
      total INTEGER NOT NULL,
      results TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  // Multi-doc queries table (for query history)
  await db`
    CREATE TABLE IF NOT EXISTS multi_doc_queries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      document_ids TEXT NOT NULL,
      results TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  // Batch questioning history table (for multiple questions to one document)
  await db`
    CREATE TABLE IF NOT EXISTS batch_questioning_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      file_id INTEGER NOT NULL,
      questions TEXT NOT NULL,
      results TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `;

  // Question templates table (for pre-registered questions)
  await db`
    CREATE TABLE IF NOT EXISTS question_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      question_text TEXT NOT NULL,
      category TEXT NOT NULL,
      is_global BOOLEAN DEFAULT 0,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `;

  // Agent runs table (for DeepAgent execution history)
  await db`
    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      agent_config_id TEXT NOT NULL,
      document_id INTEGER NOT NULL,
      query TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running', 'completed', 'failed')),
      result TEXT,
      error TEXT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      duration_seconds INTEGER,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    )
  `;

  // Agent messages table (for step-by-step tracking of agent execution)
  await db`
    CREATE TABLE IF NOT EXISTS agent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_run_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
      content TEXT NOT NULL,
      tool_name TEXT,
      tool_input TEXT,
      tool_output TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_run_id) REFERENCES agent_runs(id) ON DELETE CASCADE
    )
  `;

  // Create indexes for better query performance
  // User and session indexes
  await db`CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`;
  await db`CREATE INDEX IF NOT EXISTS idx_users_auth_client_id ON users(auth_client_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_sessions_refresh_token ON sessions(refresh_token)`;
  await db`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`;
  // Other indexes
  await db`CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_conversations_project_id ON conversations(project_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_documents_file_slug ON documents(file_slug)`;
  await db`CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_conversation_documents_conversation_id ON conversation_documents(conversation_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_conversation_documents_document_id ON conversation_documents(document_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_message_sources_message_id ON message_sources(message_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_message_sources_document_id ON message_sources(document_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_document_analyses_file_id ON document_analyses(file_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_document_analyses_file_slug ON document_analyses(file_slug)`;
  await db`CREATE INDEX IF NOT EXISTS idx_document_analyses_type ON document_analyses(file_id, analysis_type)`;
  await db`CREATE INDEX IF NOT EXISTS idx_batch_queries_user_id ON batch_queries(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_batch_queries_status ON batch_queries(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_multi_doc_queries_user_id ON multi_doc_queries(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_batch_questioning_history_user_id ON batch_questioning_history(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_batch_questioning_history_file_id ON batch_questioning_history(file_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_question_templates_user_id ON question_templates(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_question_templates_category ON question_templates(category)`;
  await db`CREATE INDEX IF NOT EXISTS idx_question_templates_is_global ON question_templates(is_global)`;
  await db`CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON agent_runs(user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_agent_runs_document_id ON agent_runs(document_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_agent_runs_status ON agent_runs(status)`;
  await db`CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_config_id ON agent_runs(agent_config_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_agent_messages_agent_run_id ON agent_messages(agent_run_id)`;

  // Create default user if none exists
  const users = await db`SELECT COUNT(*) as count FROM users`;
  if (users[0]?.count === 0) {
    await db`
      INSERT INTO users (email, name)
      VALUES ('admin@localhost', 'Default User')
    `;
    console.log('✅ Created default user');
  }

  // Create default global question templates for ESG
  const globalTemplates = await db`SELECT COUNT(*) as count FROM question_templates WHERE is_global = 1`;
  if (globalTemplates[0]?.count === 0) {
    const defaultTemplates = [
      // ESG - Environmental
      { title: 'GHG Emissions (Scope 1)', text: 'What are the Scope 1 greenhouse gas emissions reported in this document?', category: 'ESG - Environmental' },
      { title: 'GHG Emissions (Scope 2)', text: 'What are the Scope 2 greenhouse gas emissions reported in this document?', category: 'ESG - Environmental' },
      { title: 'GHG Emissions (Scope 3)', text: 'What are the Scope 3 greenhouse gas emissions reported in this document?', category: 'ESG - Environmental' },
      { title: 'Water Consumption', text: 'What is the total water consumption reported in this document?', category: 'ESG - Environmental' },
      { title: 'Waste Management', text: 'What are the waste management practices and metrics reported?', category: 'ESG - Environmental' },
      { title: 'Renewable Energy', text: 'What percentage of energy comes from renewable sources?', category: 'ESG - Environmental' },
      { title: 'Biodiversity Impact', text: 'What are the impacts on biodiversity and conservation efforts mentioned?', category: 'ESG - Environmental' },

      // ESG - Social
      { title: 'Employee Diversity', text: 'What are the workforce diversity metrics reported?', category: 'ESG - Social' },
      { title: 'Gender Pay Gap', text: 'What is the gender pay gap reported in this document?', category: 'ESG - Social' },
      { title: 'Health & Safety', text: 'What are the occupational health and safety metrics?', category: 'ESG - Social' },
      { title: 'Employee Training', text: 'What training and development programs are provided to employees?', category: 'ESG - Social' },
      { title: 'Human Rights', text: 'What human rights policies and practices are described?', category: 'ESG - Social' },

      // ESG - Governance
      { title: 'Board Composition', text: 'What is the composition of the board of directors?', category: 'ESG - Governance' },
      { title: 'Executive Compensation', text: 'What are the executive compensation details?', category: 'ESG - Governance' },
      { title: 'Anti-Corruption', text: 'What anti-corruption and anti-bribery policies are in place?', category: 'ESG - Governance' },
      { title: 'Data Privacy', text: 'What data privacy and security measures are implemented?', category: 'ESG - Governance' },

      // Financial
      { title: 'Revenue Growth', text: 'What is the revenue growth reported for this period?', category: 'Financial' },
      { title: 'Profit Margins', text: 'What are the profit margins reported?', category: 'Financial' },
      { title: 'Capital Expenditure', text: 'What are the capital expenditures (CapEx) for this period?', category: 'Financial' },
      { title: 'Debt Levels', text: 'What are the current debt levels and debt-to-equity ratio?', category: 'Financial' },
    ];

    for (const template of defaultTemplates) {
      await db`
        INSERT INTO question_templates (title, question_text, category, is_global, user_id)
        VALUES (${template.title}, ${template.text}, ${template.category}, 1, NULL)
      `;
    }
    console.log('✅ Created default global question templates');
  }

  console.log('✅ Database initialized');
}

// User queries
export async function getDefaultUser(): Promise<User | null> {
  const users = await db`SELECT * FROM users LIMIT 1`;
  return users[0] as User | null;
}

/**
 * Get or create a mock user for development
 */
export async function getOrCreateMockUser(username: string): Promise<User> {
  // Try to find existing user by username
  const existing = await db`SELECT * FROM users WHERE username = ${username} LIMIT 1`;
  if (existing.length > 0) {
    return existing[0];
  }

  // Create new mock user
  const result = await db`
    INSERT INTO users (
      email,
      name,
      username,
      roles,
      is_active,
      last_login,
      created_at,
      updated_at
    ) VALUES (
      ${username + "@localhost"},
      ${"User " + username},
      ${username},
      ${JSON.stringify(["user"])},
      ${1},
      ${new Date().toISOString()},
      ${new Date().toISOString()},
      ${new Date().toISOString()}
    )
    RETURNING *
  `;

  const user = result[0] as User;

  // Create user preferences
  await db`
    INSERT INTO user_preferences (user_id)
    VALUES (${user.id})
  `;

  console.log("✅ Created mock user:", username);
  return user;
}

// Project queries
export async function getAllProjects(userId: number): Promise<Project[]> {
  const projects = await db`
    SELECT p.*, COUNT(c.id) as conversation_count
    FROM projects p
    LEFT JOIN conversations c ON p.id = c.project_id
    WHERE p.user_id = ${userId}
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `;
  return projects as Project[];
}

export async function getProjectById(id: number): Promise<Project | null> {
  const projects = await db`SELECT * FROM projects WHERE id = ${id}`;
  return projects[0] as Project | null;
}

export async function createProject(
  userId: number,
  name: string,
  description: string | null,
  isPrivate: boolean = true
): Promise<Project> {
  const result = await db`
    INSERT INTO projects (user_id, name, description, is_private)
    VALUES (${userId}, ${name}, ${description}, ${isPrivate})
    RETURNING *
  `;
  return result[0] as Project;
}

export async function updateProject(
  id: number,
  updates: { name?: string; description?: string; is_private?: boolean }
): Promise<Project | null> {
  if (Object.keys(updates).length === 0) {
    return getProjectById(id);
  }

  // Get current project
  const current = await getProjectById(id);
  if (!current) {
    return null;
  }

  // Apply updates
  const newData = {
    name: updates.name !== undefined ? updates.name : current.name,
    description: updates.description !== undefined ? updates.description : current.description,
    is_private: updates.is_private !== undefined ? updates.is_private : current.is_private,
  };

  const result = await db`
    UPDATE projects
    SET
      name = ${newData.name},
      description = ${newData.description},
      is_private = ${newData.is_private},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;

  return result[0] as Project | null;
}

export async function deleteProject(id: number): Promise<boolean> {
  await db`DELETE FROM projects WHERE id = ${id}`;
  return true;
}

// Conversation queries
export async function getConversationsByProject(projectId: number): Promise<Conversation[]> {
  const conversations = await db`
    SELECT * FROM conversations
    WHERE project_id = ${projectId}
    ORDER BY updated_at DESC
  `;
  return conversations as Conversation[];
}

export async function getConversationById(id: number): Promise<Conversation | null> {
  const conversations = await db`SELECT * FROM conversations WHERE id = ${id}`;
  return conversations[0] as Conversation | null;
}

export async function createConversation(
  projectId: number,
  title: string,
  modelProvider: 'openai' | 'anthropic',
  modelName: string
): Promise<Conversation> {
  const result = await db`
    INSERT INTO conversations (project_id, title, model_provider, model_name)
    VALUES (${projectId}, ${title}, ${modelProvider}, ${modelName})
    RETURNING *
  `;

  // Update project's updated_at
  await db`UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ${projectId}`;

  return result[0] as Conversation;
}

export async function updateConversationTitle(id: number, title: string): Promise<Conversation | null> {
  const result = await db`
    UPDATE conversations
    SET title = ${title}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0] as Conversation | null;
}

export async function deleteConversation(id: number): Promise<boolean> {
  await db`DELETE FROM conversations WHERE id = ${id}`;
  return true;
}

// Message queries
export async function getMessagesByConversation(conversationId: number): Promise<Message[]> {
  const messages = await db`
    SELECT * FROM messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
  `;
  return messages as Message[];
}

export async function createMessage(
  conversationId: number,
  role: 'user' | 'assistant' | 'system',
  content: string
): Promise<Message> {
  const result = await db`
    INSERT INTO messages (conversation_id, role, content)
    VALUES (${conversationId}, ${role}, ${content})
    RETURNING *
  `;

  // Update conversation's updated_at
  await db`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ${conversationId}`;

  return result[0] as Message;
}

export async function updateMessage(id: number, content: string): Promise<Message | null> {
  const result = await db`
    UPDATE messages
    SET content = ${content}
    WHERE id = ${id}
    RETURNING *
  `;

  if (result[0]) {
    // Update conversation's updated_at
    const message = result[0] as Message;
    await db`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ${message.conversation_id}`;
  }

  return result[0] as Message | null;
}

export async function deleteMessage(id: number): Promise<boolean> {
  // Get the message first to update the conversation
  const messages = await db`SELECT conversation_id FROM messages WHERE id = ${id}`;
  const conversationId = messages[0]?.conversation_id;

  await db`DELETE FROM messages WHERE id = ${id}`;

  if (conversationId) {
    await db`UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ${conversationId}`;
  }

  return true;
}

// Document queries
export async function getAllDocuments(userId: number): Promise<Document[]> {
  const documents = await db`
    SELECT * FROM documents
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return documents as Document[];
}

export async function getDocumentById(id: number): Promise<Document | null> {
  const documents = await db`SELECT * FROM documents WHERE id = ${id}`;
  return documents[0] as Document | null;
}

export async function getDocumentBySlug(fileSlug: string): Promise<Document | null> {
  const documents = await db`SELECT * FROM documents WHERE file_slug = ${fileSlug}`;
  return documents[0] as Document | null;
}

export async function createDocument(
  userId: number,
  data: {
    filename: string;
    file_slug: string;
    s3_key: string;
    s3_url: string;
    file_size: number;
    mime_type: string;
    company_id?: number;
    company_name?: string;
    report_type?: string;
    reporting_year?: number;
  }
): Promise<Document> {
  const result = await db`
    INSERT INTO documents (
      user_id, filename, file_slug, s3_key, s3_url, file_size, mime_type,
      company_id, company_name, report_type, reporting_year
    )
    VALUES (
      ${userId}, ${data.filename}, ${data.file_slug}, ${data.s3_key}, ${data.s3_url},
      ${data.file_size}, ${data.mime_type}, ${data.company_id || null},
      ${data.company_name || null}, ${data.report_type || null}, ${data.reporting_year || null}
    )
    RETURNING *
  `;
  return result[0] as Document;
}

export async function updateDocumentStatus(
  id: number,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  data?: {
    processing_error?: string | null;
    pages_processed?: number | null;
    chunks_created?: number | null;
    s3_key?: string;
    s3_url?: string;
  }
): Promise<Document | null> {
  const result = await db`
    UPDATE documents
    SET
      processing_status = ${status},
      processing_error = ${data?.processing_error || null},
      pages_processed = ${data?.pages_processed || null},
      chunks_created = ${data?.chunks_created || null},
      s3_key = COALESCE(${data?.s3_key || null}, s3_key),
      s3_url = COALESCE(${data?.s3_url || null}, s3_url),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;
  return result[0] as Document | null;
}

export async function deleteDocument(id: number): Promise<boolean> {
  await db`DELETE FROM documents WHERE id = ${id}`;
  return true;
}

// Conversation-Document queries
export async function getConversationDocuments(conversationId: number): Promise<Array<{
  document_id: number;
  document_filename: string;
}>> {
  const results = await db`
    SELECT
      cd.document_id,
      d.filename as document_filename
    FROM conversation_documents cd
    JOIN documents d ON cd.document_id = d.id
    WHERE cd.conversation_id = ${conversationId}
  `;

  return results.map((row: any) => ({
    document_id: row.document_id,
    document_filename: row.document_filename,
  }));
}

export async function addDocumentToConversation(
  conversationId: number,
  documentId: number
): Promise<ConversationDocument> {
  const result = await db`
    INSERT INTO conversation_documents (conversation_id, document_id)
    VALUES (${conversationId}, ${documentId})
    RETURNING *
  `;
  return result[0] as ConversationDocument;
}

export async function removeDocumentFromConversation(
  conversationId: number,
  documentId: number
): Promise<boolean> {
  await db`
    DELETE FROM conversation_documents
    WHERE conversation_id = ${conversationId} AND document_id = ${documentId}
  `;
  return true;
}

// Message source queries
export async function getMessageSources(messageId: number): Promise<Array<{
  document_id: number;
  document_filename: string;
  page_numbers: number[];
}>> {
  const results = await db`
    SELECT
      ms.document_id,
      d.filename as document_filename,
      ms.page_numbers
    FROM message_sources ms
    JOIN documents d ON ms.document_id = d.id
    WHERE ms.message_id = ${messageId}
  `;

  return results.map((row: any) => ({
    document_id: row.document_id,
    document_filename: row.document_filename,
    page_numbers: JSON.parse(row.page_numbers),
  }));
}

export async function addMessageSource(
  messageId: number,
  documentId: number,
  pageNumbers: number[]
): Promise<MessageSource> {
  const result = await db`
    INSERT INTO message_sources (message_id, document_id, page_numbers)
    VALUES (${messageId}, ${documentId}, ${JSON.stringify(pageNumbers)})
    RETURNING *
  `;
  return result[0] as MessageSource;
}

export async function getMessagesWithSources(conversationId: number): Promise<Array<any>> {
  const messages = await getMessagesByConversation(conversationId);

  // Fetch sources for each message
  const messagesWithSources = await Promise.all(
    messages.map(async (message) => {
      const sources = await getMessageSources(message.id);
      return {
        ...message,
        sources: sources.length > 0 ? sources : undefined,
      };
    })
  );

  return messagesWithSources;
}

// Document analysis queries
export async function getDocumentAnalysis(
  fileId: number,
  analysisType: 'summary' | 'key-points' | 'entities' | 'topics',
  options?: string
): Promise<any | null> {
  let query;

  if (options) {
    query = await db`
      SELECT * FROM document_analyses
      WHERE file_id = ${fileId}
        AND analysis_type = ${analysisType}
        AND options = ${options}
      ORDER BY created_at DESC
      LIMIT 1
    `;
  } else {
    query = await db`
      SELECT * FROM document_analyses
      WHERE file_id = ${fileId}
        AND analysis_type = ${analysisType}
        AND options IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;
  }

  return query[0] || null;
}

export async function saveDocumentAnalysis(
  fileId: number,
  fileSlug: string,
  analysisType: 'summary' | 'key-points' | 'entities' | 'topics',
  result: any,
  options?: string
): Promise<any> {
  const resultJson = typeof result === 'string' ? result : JSON.stringify(result);

  const query = await db`
    INSERT INTO document_analyses (file_id, file_slug, analysis_type, result, options)
    VALUES (${fileId}, ${fileSlug}, ${analysisType}, ${resultJson}, ${options || null})
    RETURNING *
  `;

  return query[0];
}

export async function deleteDocumentAnalyses(fileId: number): Promise<boolean> {
  await db`DELETE FROM document_analyses WHERE file_id = ${fileId}`;
  return true;
}

// Batch query job functions
export async function createBatchQuery(
  id: string,
  userId: number,
  questions: string[],
  documentIds: number[]
): Promise<any> {
  const total = questions.length * documentIds.length;
  const result = await db`
    INSERT INTO batch_queries (id, user_id, questions, document_ids, total)
    VALUES (
      ${id},
      ${userId},
      ${JSON.stringify(questions)},
      ${JSON.stringify(documentIds)},
      ${total}
    )
    RETURNING *
  `;
  return result[0];
}

export async function getBatchQuery(id: string): Promise<any | null> {
  const results = await db`SELECT * FROM batch_queries WHERE id = ${id}`;
  return results[0] || null;
}

export async function updateBatchQueryStatus(
  id: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  data?: {
    progress?: number;
    results?: any;
    error?: string;
  }
): Promise<any | null> {
  const completedAt = status === 'completed' || status === 'failed' ? new Date().toISOString() : null;

  const result = await db`
    UPDATE batch_queries
    SET
      status = ${status},
      progress = ${data?.progress !== undefined ? data.progress : null},
      results = ${data?.results ? JSON.stringify(data.results) : null},
      error = ${data?.error || null},
      completed_at = ${completedAt}
    WHERE id = ${id}
    RETURNING *
  `;

  return result[0] || null;
}

export async function getUserBatchJobs(userId: number): Promise<any[]> {
  const results = await db`
    SELECT * FROM batch_queries
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return results;
}

export async function deleteBatchJob(id: string): Promise<boolean> {
  await db`DELETE FROM batch_queries WHERE id = ${id}`;
  return true;
}

// Multi-doc query functions
export async function saveMultiDocQuery(
  userId: number,
  question: string,
  documentIds: number[],
  results: any
): Promise<any> {
  const result = await db`
    INSERT INTO multi_doc_queries (user_id, question, document_ids, results)
    VALUES (
      ${userId},
      ${question},
      ${JSON.stringify(documentIds)},
      ${JSON.stringify(results)}
    )
    RETURNING *
  `;
  return result[0];
}

export async function getUserMultiDocQueries(userId: number, limit: number = 50): Promise<any[]> {
  const results = await db`
    SELECT * FROM multi_doc_queries
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return results;
}

export async function getMultiDocQueryById(id: number): Promise<any> {
  const results = await db`
    SELECT * FROM multi_doc_queries
    WHERE id = ${id}
    LIMIT 1
  `;
  return results[0];
}

export async function deleteMultiDocQuery(id: number): Promise<boolean> {
  await db`DELETE FROM multi_doc_queries WHERE id = ${id}`;
  return true;
}

// User preferences queries
export async function getUserPreferences(userId: number): Promise<any | null> {
  const results = await db`SELECT * FROM user_preferences WHERE user_id = ${userId}`;
  return results[0] || null;
}

export async function createUserPreferences(userId: number): Promise<any> {
  const result = await db`
    INSERT INTO user_preferences (user_id)
    VALUES (${userId})
    RETURNING *
  `;
  return result[0];
}

export async function updateUserPreferences(
  userId: number,
  updates: {
    default_model_provider?: 'openai' | 'anthropic';
    default_model_name?: string;
    default_temperature?: number;
    default_max_tokens?: number;
    theme?: 'light' | 'dark' | 'system';
    language?: 'en' | 'fr';
    disclaimer_accepted_at?: string | null;
  }
): Promise<any | null> {
  if (Object.keys(updates).length === 0) {
    return getUserPreferences(userId);
  }

  // Get current preferences
  const current = await getUserPreferences(userId);
  if (!current) {
    return null;
  }

  // Apply updates
  const newData = {
    default_model_provider: updates.default_model_provider !== undefined ? updates.default_model_provider : current.default_model_provider,
    default_model_name: updates.default_model_name !== undefined ? updates.default_model_name : current.default_model_name,
    default_temperature: updates.default_temperature !== undefined ? updates.default_temperature : current.default_temperature,
    default_max_tokens: updates.default_max_tokens !== undefined ? updates.default_max_tokens : current.default_max_tokens,
    theme: updates.theme !== undefined ? updates.theme : current.theme,
    language: updates.language !== undefined ? updates.language : current.language,
    disclaimer_accepted_at: updates.disclaimer_accepted_at !== undefined ? updates.disclaimer_accepted_at : current.disclaimer_accepted_at,
  };

  const result = await db`
    UPDATE user_preferences
    SET
      default_model_provider = ${newData.default_model_provider},
      default_model_name = ${newData.default_model_name},
      default_temperature = ${newData.default_temperature},
      default_max_tokens = ${newData.default_max_tokens},
      theme = ${newData.theme},
      language = ${newData.language},
      disclaimer_accepted_at = ${newData.disclaimer_accepted_at},
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
    RETURNING *
  `;

  return result[0] || null;
}

export async function getOrCreateUserPreferences(userId: number): Promise<any> {
  let prefs = await getUserPreferences(userId);
  if (!prefs) {
    prefs = await createUserPreferences(userId);
  }
  return prefs;
}

// Batch questioning functions
export async function saveBatchQuery(
  userId: number,
  fileId: number,
  questions: string[],
  results: any
): Promise<any> {
  const result = await db`
    INSERT INTO batch_questioning_history (user_id, file_id, questions, results)
    VALUES (
      ${userId},
      ${fileId},
      ${JSON.stringify(questions)},
      ${JSON.stringify(results)}
    )
    RETURNING *
  `;
  return result[0];
}

export async function getUserBatchQuestioningHistory(userId: number, limit: number = 50): Promise<any[]> {
  const results = await db`
    SELECT bqh.*, d.filename
    FROM batch_questioning_history bqh
    JOIN documents d ON bqh.file_id = d.id
    WHERE bqh.user_id = ${userId}
    ORDER BY bqh.created_at DESC
    LIMIT ${limit}
  `;
  return results;
}

export async function getBatchQuestioningById(id: number): Promise<any> {
  const results = await db`
    SELECT bqh.*, d.filename
    FROM batch_questioning_history bqh
    JOIN documents d ON bqh.file_id = d.id
    WHERE bqh.id = ${id}
    LIMIT 1
  `;
  return results[0];
}

export async function deleteBatchQuestioning(id: number): Promise<boolean> {
  await db`DELETE FROM batch_questioning_history WHERE id = ${id}`;
  return true;
}

// Question template functions
export async function getAllQuestionTemplates(userId: number): Promise<any[]> {
  // Get both global templates and user's own templates
  const templates = await db`
    SELECT * FROM question_templates
    WHERE is_global = 1 OR user_id = ${userId}
    ORDER BY category, title
  `;
  return templates;
}

export async function getQuestionTemplatesByCategory(userId: number, category: string): Promise<any[]> {
  const templates = await db`
    SELECT * FROM question_templates
    WHERE (is_global = 1 OR user_id = ${userId})
    AND category = ${category}
    ORDER BY title
  `;
  return templates;
}

export async function getQuestionTemplateCategories(userId: number): Promise<string[]> {
  const categories = await db`
    SELECT DISTINCT category FROM question_templates
    WHERE is_global = 1 OR user_id = ${userId}
    ORDER BY category
  `;
  return categories.map((row: any) => row.category);
}

export async function getQuestionTemplateById(id: number): Promise<any | null> {
  const templates = await db`
    SELECT * FROM question_templates
    WHERE id = ${id}
    LIMIT 1
  `;
  return templates[0] || null;
}

export async function createQuestionTemplate(
  userId: number,
  data: {
    title: string;
    question_text: string;
    category: string;
    is_global?: boolean;
  }
): Promise<any> {
  const result = await db`
    INSERT INTO question_templates (title, question_text, category, is_global, user_id)
    VALUES (
      ${data.title},
      ${data.question_text},
      ${data.category},
      ${data.is_global || false},
      ${userId}
    )
    RETURNING *
  `;
  return result[0];
}

export async function updateQuestionTemplate(
  id: number,
  userId: number,
  updates: {
    title?: string;
    question_text?: string;
    category?: string;
  }
): Promise<any | null> {
  // First check if user owns this template (can't update global templates)
  const template = await getQuestionTemplateById(id);
  if (!template || template.is_global || template.user_id !== userId) {
    return null;
  }

  if (Object.keys(updates).length === 0) {
    return template;
  }

  // Apply updates
  const newData = {
    title: updates.title !== undefined ? updates.title : template.title,
    question_text: updates.question_text !== undefined ? updates.question_text : template.question_text,
    category: updates.category !== undefined ? updates.category : template.category,
  };

  const result = await db`
    UPDATE question_templates
    SET
      title = ${newData.title},
      question_text = ${newData.question_text},
      category = ${newData.category},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
    RETURNING *
  `;

  return result[0] || null;
}

export async function deleteQuestionTemplate(id: number, userId: number): Promise<boolean> {
  // First check if user owns this template (can't delete global templates)
  const template = await getQuestionTemplateById(id);
  if (!template || template.is_global || template.user_id !== userId) {
    return false;
  }

  await db`DELETE FROM question_templates WHERE id = ${id}`;
  return true;
}

// Session management functions
export interface Session {
  id: string;
  user_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
  last_used_at: string;
}

export async function createSession(
  sessionId: string,
  userId: number,
  accessToken: string,
  refreshToken: string,
  expiresAt: string
): Promise<Session> {
  const result = await db`
    INSERT INTO sessions (id, user_id, access_token, refresh_token, expires_at)
    VALUES (${sessionId}, ${userId}, ${accessToken}, ${refreshToken}, ${expiresAt})
    RETURNING *
  `;
  return result[0] as Session;
}

export async function getSessionByRefreshToken(refreshToken: string): Promise<Session | null> {
  const result = await db`
    SELECT * FROM sessions
    WHERE refresh_token = ${refreshToken}
    LIMIT 1
  `;
  return result[0] as Session | null;
}

// Alias for consistency
export async function getSessionByToken(token: string): Promise<Session | null> {
  return getSessionByRefreshToken(token);
}

export async function getUserById(userId: number): Promise<User | null> {
  const result = await db`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
  return result[0] as User | null;
}

export async function getSessionsByUserId(userId: number): Promise<Session[]> {
  const sessions = await db`
    SELECT * FROM sessions
    WHERE user_id = ${userId}
    ORDER BY last_used_at DESC
  `;
  return sessions as Session[];
}

export async function updateSessionLastUsed(refreshToken: string): Promise<void> {
  await db`
    UPDATE sessions
    SET last_used_at = CURRENT_TIMESTAMP
    WHERE refresh_token = ${refreshToken}
  `;
}

export async function deleteSession(refreshToken: string): Promise<boolean> {
  await db`DELETE FROM sessions WHERE refresh_token = ${refreshToken}`;
  return true;
}

export async function deleteUserSessions(userId: number): Promise<boolean> {
  await db`DELETE FROM sessions WHERE user_id = ${userId}`;
  return true;
}

export async function deleteExpiredSessions(): Promise<number> {
  const result = await db`
    DELETE FROM sessions
    WHERE expires_at < CURRENT_TIMESTAMP
    RETURNING id
  `;
  return result.length;
}

export async function getUserByAuthUserId(authUserId: number): Promise<User | null> {
  const result = await db`
    SELECT * FROM users
    WHERE auth_user_id = ${authUserId}
    LIMIT 1
  `;
  return result[0] as User | null;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const result = await db`
    SELECT * FROM users
    WHERE username = ${username}
    LIMIT 1
  `;
  return result[0] as User | null;
}

// ============================================================================
// Agent Runs
// ============================================================================

/**
 * Create a new agent run
 */
export async function createAgentRun(data: {
  id: string;
  userId: number;
  agentConfigId: string;
  documentId: number;
  query: string;
}): Promise<AgentRun> {
  const { id, userId, agentConfigId, documentId, query } = data;

  await db`
    INSERT INTO agent_runs (
      id,
      user_id,
      agent_config_id,
      document_id,
      query,
      status
    ) VALUES (
      ${id},
      ${userId},
      ${agentConfigId},
      ${documentId},
      ${query},
      'running'
    )
  `;

  const result = await db`
    SELECT * FROM agent_runs WHERE id = ${id}
  `;

  return result[0] as AgentRun;
}

/**
 * Update agent run status and result
 */
export async function updateAgentRun(
  id: string,
  data: {
    status?: 'running' | 'completed' | 'failed';
    result?: string;
    error?: string;
  }
): Promise<void> {
  const { status, result, error } = data;

  // For simplicity, handle each update case separately
  if (status === 'completed') {
    // Update with completed status and duration
    await db`
      UPDATE agent_runs
      SET status = ${status},
          result = ${result || null},
          completed_at = CURRENT_TIMESTAMP,
          duration_seconds = CAST((julianday(CURRENT_TIMESTAMP) - julianday(started_at)) * 86400 AS INTEGER)
      WHERE id = ${id}
    `;
  } else if (status === 'failed') {
    // Update with failed status and error
    await db`
      UPDATE agent_runs
      SET status = ${status},
          error = ${error || null},
          completed_at = CURRENT_TIMESTAMP,
          duration_seconds = CAST((julianday(CURRENT_TIMESTAMP) - julianday(started_at)) * 86400 AS INTEGER)
      WHERE id = ${id}
    `;
  } else if (status !== undefined) {
    // Update just status (running)
    await db`
      UPDATE agent_runs
      SET status = ${status}
      WHERE id = ${id}
    `;
  }
}

/**
 * Get agent run by ID
 */
export async function getAgentRunById(id: string): Promise<AgentRun | null> {
  const result = await db`
    SELECT * FROM agent_runs WHERE id = ${id}
  `;
  return result[0] as AgentRun | null;
}

/**
 * Get agent runs for a user
 */
export async function getAgentRunsByUser(
  userId: number,
  limit: number = 50
): Promise<AgentRunWithDocument[]> {
  const result = await db`
    SELECT
      ar.*,
      d.filename,
      '' as agent_name
    FROM agent_runs ar
    JOIN documents d ON ar.document_id = d.id
    WHERE ar.user_id = ${userId}
    ORDER BY ar.started_at DESC
    LIMIT ${limit}
  `;

  return result as AgentRunWithDocument[];
}

/**
 * Get agent runs for a document
 */
export async function getAgentRunsByDocument(
  documentId: number,
  limit: number = 20
): Promise<AgentRunWithDocument[]> {
  const result = await db`
    SELECT
      ar.*,
      d.filename,
      '' as agent_name
    FROM agent_runs ar
    JOIN documents d ON ar.document_id = d.id
    WHERE ar.document_id = ${documentId}
    ORDER BY ar.started_at DESC
    LIMIT ${limit}
  `;

  return result as AgentRunWithDocument[];
}

/**
 * Create an agent message
 */
export async function createAgentMessage(data: {
  agentRunId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName?: string;
  toolInput?: string;
  toolOutput?: string;
}): Promise<void> {
  const { agentRunId, role, content, toolName, toolInput, toolOutput } = data;

  await db`
    INSERT INTO agent_messages (
      agent_run_id,
      role,
      content,
      tool_name,
      tool_input,
      tool_output
    ) VALUES (
      ${agentRunId},
      ${role},
      ${content},
      ${toolName || null},
      ${toolInput || null},
      ${toolOutput || null}
    )
  `;
}

/**
 * Get messages for an agent run
 */
export async function getAgentMessages(
  agentRunId: string
): Promise<AgentMessage[]> {
  const result = await db`
    SELECT * FROM agent_messages
    WHERE agent_run_id = ${agentRunId}
    ORDER BY created_at ASC
  `;

  return result as AgentMessage[];
}
