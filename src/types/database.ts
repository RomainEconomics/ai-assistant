export interface User {
  id: number;
  email: string;
  name: string;
  username?: string;
  roles?: string; // JSON: ["user", "admin"]
  is_active?: boolean;
  last_login?: string;
  updated_at?: string;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  created_at: string;
  last_used_at: string;
}

export interface UserPreferences {
  id: number;
  user_id: number;
  default_model_provider: 'openai' | 'anthropic' | null;
  default_model_name: string | null;
  default_temperature: number;
  default_max_tokens: number;
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'fr';
  disclaimer_accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: number;
  project_id: number;
  title: string;
  model_provider: 'openai' | 'anthropic';
  model_name: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

// Document interface
export interface Document {
  id: number;
  user_id: number;
  filename: string;
  file_slug: string;
  s3_key: string;
  s3_url: string;
  file_size: number;
  mime_type: string;
  company_id: number | null;
  company_name: string | null;
  report_type: string | null;
  reporting_year: number | null;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error: string | null;
  pages_processed: number | null;
  chunks_created: number | null;
  created_at: string;
  updated_at: string;
}

// Conversation-Document association
export interface ConversationDocument {
  id: number;
  conversation_id: number;
  document_id: number;
  selected_pages: string; // JSON array like "[1,2,3]"
  created_at: string;
}

// Message source tracking
export interface MessageSource {
  id: number;
  message_id: number;
  document_id: number;
  page_numbers: string; // JSON array like "[1,2,3]"
  created_at: string;
}

// Extended types with relations
export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

export interface ProjectWithConversations extends Project {
  conversations: Conversation[];
  conversation_count?: number;
}

export interface MessageWithSources extends Message {
  sources?: Array<{
    document_id: number;
    document_filename: string;
    page_numbers: number[];
  }>;
}

export interface ConversationWithDocuments extends Conversation {
  documents: Array<{
    document_id: number;
    document_filename: string;
    selected_pages: number[];
  }>;
}

// Document analysis cache
export interface DocumentAnalysis {
  id: number;
  file_id: number;
  file_slug: string;
  analysis_type: 'summary' | 'key-points' | 'entities' | 'topics';
  result: string; // JSON string
  options: string | null; // JSON string for analysis options
  created_at: string;
}

// Batch query job
export interface BatchQuery {
  id: string; // UUID
  user_id: number;
  questions: string; // JSON array
  document_ids: string; // JSON array
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  total: number; // Total number of queries (questions * documents)
  results: string | null; // JSON string
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

// Multi-document query history
export interface MultiDocQuery {
  id: number;
  user_id: number;
  question: string;
  document_ids: string; // JSON array
  results: string; // JSON string
  created_at: string;
}

// Analysis result types (parsed from JSON)
export interface SummaryResult {
  summary: string;
}

export interface KeyPointsResult {
  keyPoints: string[];
}

export interface EntitiesResult {
  people: string[];
  organizations: string[];
  locations: string[];
  dates: string[];
}

export interface TopicsResult {
  topics: Array<{
    topic: string;
    weight: number; // 0-1
  }>;
}

// Multi-doc query result
export interface MultiDocQueryResult {
  fileId: number;
  filename: string;
  answer: string;
  sources: Array<{
    page: number;
    content: string;
  }>;
  processingTime: number;
}

// Batch query result (N questions × M documents)
export interface BatchQueryResult {
  question: string;
  documentId: number;
  filename: string;
  answer: string;
  sources: Array<{
    page: number;
    content: string;
  }>;
  error?: string;
}

// Batch question result (N questions × 1 document)
export interface BatchQuestionResult {
  question: string;
  answer: string;
  sources: Array<{
    page: number;
    content: string;
  }>;
  processingTime: number;
}

// Batch questioning history
export interface BatchQuestioningHistory {
  id: number;
  user_id: number;
  file_id: number;
  filename: string;
  questions: string; // JSON array
  results: string; // JSON string
  created_at: string;
}

// Question template
export interface QuestionTemplate {
  id: number;
  title: string;
  question_text: string;
  category: string;
  is_global: boolean;
  user_id: number | null;
  created_at: string;
  updated_at: string;
}

// Agent run
export interface AgentRun {
  id: string; // UUID
  user_id: number;
  agent_config_id: string;
  document_id: number;
  query: string;
  status: 'running' | 'completed' | 'failed';
  result: string | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
}

// Agent message (step tracking)
export interface AgentMessage {
  id: number;
  agent_run_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_name: string | null;
  tool_input: string | null; // JSON string
  tool_output: string | null;
  created_at: string;
}

// Agent run with document info
export interface AgentRunWithDocument extends AgentRun {
  filename: string;
  agent_name: string;
}
