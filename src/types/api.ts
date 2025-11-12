import type { Conversation, Message, Project } from "./database";

// Request types
export interface CreateProjectRequest {
  name: string;
  description?: string;
  is_private?: boolean;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  is_private?: boolean;
}

export interface CreateConversationRequest {
  project_id: number;
  title: string;
  model_provider: "openai" | "anthropic";
  model_name: string;
}

export interface SendMessageRequest {
  conversation_id: number;
  content: string;
}

export interface ChatStreamRequest {
  conversation_id: number;
  message: string;
  model_provider: "openai" | "anthropic";
  model_name: string;
}

// Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface ProjectsResponse {
  projects: Project[];
}

export interface ConversationResponse {
  conversation: Conversation;
  messages: Message[];
}

export interface MessagesResponse {
  messages: Message[];
}

export interface ModelsResponse {
  models: {
    provider: string;
    models: {
      id: string;
      name: string;
    }[];
  }[];
}

// Available AI models
export const AI_MODELS = {
  openai: [
    { id: "gpt-5-mini", name: "GPT-5 Mini" },
    { id: "gpt-5", name: "GPT-5" },
    { id: "gpt-4o", name: "GPT-4 Omni" },
    { id: "gpt-4o-mini", name: "GPT-4 Omni Mini" },
  ],
  anthropic: [
    { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
    { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
    { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet" },
    { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" },
  ],
} as const;
