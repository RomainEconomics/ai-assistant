import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/api-client';
import type {
  Project,
  Conversation,
  Message,
  ProjectWithConversations,
  Document,
  MultiDocQueryResult,
  UserPreferences,
  QuestionTemplate,
} from '@/types/database';
import type {
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateConversationRequest,
  ChatStreamRequest,
} from '@/types/api';

// Projects
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await authenticatedFetch('/api/projects');
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      return data.projects as Project[];
    },
  });
}

export function useProject(id: number) {
  return useQuery({
    queryKey: ['projects', id],
    queryFn: async () => {
      const res = await authenticatedFetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error('Failed to fetch project');
      const data = await res.json();
      return data as { project: Project; conversations: Conversation[] };
    },
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (project: CreateProjectRequest) => {
      const res = await authenticatedFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(project),
      });
      if (!res.ok) throw new Error('Failed to create project');
      const data = await res.json();
      return data.project as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: UpdateProjectRequest }) => {
      const res = await authenticatedFetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update project');
      const data = await res.json();
      return data.project as Project;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects', variables.id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await authenticatedFetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete project');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

// Conversations
export function useConversations(projectId: number) {
  return useQuery({
    queryKey: ['conversations', projectId],
    queryFn: async () => {
      const res = await authenticatedFetch(`/api/conversations?project_id=${projectId}`);
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const data = await res.json();
      return data.conversations as Conversation[];
    },
    enabled: !!projectId,
  });
}

export function useConversation(id: number) {
  return useQuery({
    queryKey: ['conversations', id],
    queryFn: async () => {
      const res = await authenticatedFetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error('Failed to fetch conversation');
      const data = await res.json();
      return data as { conversation: Conversation; messages: Message[] };
    },
    enabled: !!id,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (conversation: CreateConversationRequest) => {
      const res = await authenticatedFetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversation),
      });
      if (!res.ok) throw new Error('Failed to create conversation');
      const data = await res.json();
      return data.conversation as Conversation;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['projects', data.project_id] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await authenticatedFetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete conversation');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

// Models
export function useModels() {
  return useQuery({
    queryKey: ['models'],
    queryFn: async () => {
      const res = await authenticatedFetch('/api/models');
      if (!res.ok) throw new Error('Failed to fetch models');
      return res.json();
    },
  });
}

// Save assistant message
export function useSaveAssistantMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: number; content: string }) => {
      const res = await authenticatedFetch('/api/chat/save-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, content }),
      });
      if (!res.ok) throw new Error('Failed to save message');
      const data = await res.json();
      return data.message as Message;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', variables.conversationId] });
    },
  });
}

// Message operations
export function useUpdateMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content, conversationId }: { id: number; content: string; conversationId: number }) => {
      const res = await authenticatedFetch(`/api/messages/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to update message');
      const data = await res.json();
      return data.message as Message;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', variables.conversationId] });
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, conversationId }: { id: number; conversationId: number }) => {
      const res = await authenticatedFetch(`/api/messages/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete message');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', variables.conversationId] });
    },
  });
}

// Documents
export function useDocuments() {
  return useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const res = await authenticatedFetch('/api/documents');
      if (!res.ok) throw new Error('Failed to fetch documents');
      return res.json() as Promise<Document[]>;
    },
    // Poll every 3 seconds if there are documents being processed
    refetchInterval: (query) => {
      const documents = query.state.data as Document[] | undefined;
      const hasProcessingDocs = documents?.some(
        (doc) => doc.processing_status === 'processing' || doc.processing_status === 'pending'
      );
      return hasProcessingDocs ? 3000 : false; // Poll every 3s if processing, otherwise don't poll
    },
  });
}

export function useDocument(id: number) {
  return useQuery({
    queryKey: ['documents', id],
    queryFn: async () => {
      const res = await authenticatedFetch(`/api/documents/${id}`);
      if (!res.ok) throw new Error('Failed to fetch document');
      return res.json() as Promise<Document>;
    },
    enabled: !!id,
  });
}

export function useUploadDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await authenticatedFetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to upload document');
      }
      return res.json() as Promise<{ success: boolean; document: Document; message: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await authenticatedFetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete document');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}

// Conversation Documents
export function useConversationDocuments(conversationId: number) {
  return useQuery({
    queryKey: ['conversations', conversationId, 'documents'],
    queryFn: async () => {
      const res = await authenticatedFetch(`/api/conversations/${conversationId}/documents`);
      if (!res.ok) throw new Error('Failed to fetch conversation documents');
      const data = await res.json();
      return data.documents as Array<{
        document_id: number;
        document_filename: string;
      }>;
    },
    enabled: !!conversationId,
  });
}

export function useAddDocumentToConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      documentId,
    }: {
      conversationId: number;
      documentId: number;
    }) => {
      const res = await authenticatedFetch(`/api/conversations/${conversationId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document_id: documentId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add document to conversation');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', variables.conversationId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['conversations', variables.conversationId] });
    },
  });
}

export function useRemoveDocumentFromConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      documentId,
    }: {
      conversationId: number;
      documentId: number;
    }) => {
      const res = await authenticatedFetch(`/api/conversations/${conversationId}/documents/${documentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove document from conversation');
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', variables.conversationId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['conversations', variables.conversationId] });
    },
  });
}

// Multi-Doc RAG Queries
export function useMultiDocQuery() {
  return useMutation({
    mutationFn: async (params: {
      question: string;
      fileIds: number[];
      model?: string;
      saveHistory?: boolean;
      userId?: number;
    }) => {
      const res = await authenticatedFetch('/api/rag/multi-doc-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to query documents');
      }
      const data = await res.json();
      return data as {
        question: string;
        results: MultiDocQueryResult[];
        totalTime: number;
      };
    },
  });
}

export function useMultiDocHistory(limit: number = 50) {
  return useQuery({
    queryKey: ['multi-doc-history', limit],
    queryFn: async () => {
      const res = await authenticatedFetch(`/api/rag/multi-doc-history?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch multi-doc history');
      const data = await res.json();
      return data.history as Array<{
        id: number;
        question: string;
        documentIds: number[];
        results: MultiDocQueryResult[];
        createdAt: string;
      }>;
    },
  });
}

// Batch Questioning
export function useBatchQuestioning() {
  return useMutation({
    mutationFn: async (params: {
      questions: string[];
      fileId: number;
      model?: string;
      saveHistory?: boolean;
      userId?: number;
    }) => {
      const res = await authenticatedFetch('/api/batch-questioning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to process batch questions');
      }
      const data = await res.json();
      return data as {
        fileId: number;
        filename: string;
        results: Array<{
          question: string;
          answer: string;
          sources: Array<{ page: number; content: string }>;
          processingTime: number;
        }>;
        totalTime: number;
      };
    },
  });
}

export function useBatchQuestioningHistory(limit: number = 50) {
  return useQuery({
    queryKey: ['batch-questioning-history', limit],
    queryFn: async () => {
      const res = await authenticatedFetch(`/api/batch-questioning/history?limit=${limit}`);
      if (!res.ok) throw new Error('Failed to fetch batch questioning history');
      const data = await res.json();
      return data.history as Array<{
        id: number;
        fileId: number;
        filename: string;
        questions: string[];
        results: Array<{
          question: string;
          answer: string;
          sources: Array<{ page: number; content: string }>;
          processingTime: number;
        }>;
        createdAt: string;
      }>;
    },
  });
}

// Batch questioning export
export function useExportBatchQuestioning() {
  return useMutation({
    mutationFn: async ({
      filename,
      fileId,
      results,
      totalTime,
      format
    }: {
      filename: string;
      fileId: number;
      results: any[];
      totalTime: number;
      format: 'json' | 'md' | 'docx' | 'pdf'
    }) => {
      const res = await authenticatedFetch(`/api/batch-questioning/export?format=${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, fileId, results, totalTime }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to export batch questioning');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = res.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const exportFilename = filenameMatch ? filenameMatch[1] : `batch_questioning.${format}`;

      // Get blob and trigger download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = exportFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      return { filename: exportFilename };
    },
  });
}

// Settings
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await authenticatedFetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json() as Promise<UserPreferences>;
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Partial<Omit<UserPreferences, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
      const res = await authenticatedFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update settings');
      }
      return res.json() as Promise<UserPreferences>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

// Export/Import
export function useExportConversation() {
  return useMutation({
    mutationFn: async ({ conversationId, format }: { conversationId: number; format: 'json' | 'md' | 'docx' | 'pdf' }) => {
      const res = await authenticatedFetch(`/api/conversations/${conversationId}/export?format=${format}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to export conversation');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = res.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `conversation.${format}`;

      // Get blob and trigger download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      return { filename };
    },
  });
}

export function useImportConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ projectId, jsonData }: { projectId: number; jsonData: string }) => {
      const res = await authenticatedFetch('/api/conversations/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, json_data: jsonData }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to import conversation');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', variables.projectId] });
    },
  });
}

// Multi-doc query export
export function useExportMultiDocQuery() {
  return useMutation({
    mutationFn: async ({
      question,
      results,
      totalTime,
      format
    }: {
      question: string;
      results: any[];
      totalTime: number;
      format: 'json' | 'md' | 'docx' | 'pdf'
    }) => {
      const res = await authenticatedFetch(`/api/rag/multi-doc-export?format=${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, results, totalTime }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to export multi-doc query');
      }

      // Get filename from Content-Disposition header
      const contentDisposition = res.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch ? filenameMatch[1] : `multi_doc_query.${format}`;

      // Get blob and trigger download
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      return { filename };
    },
  });
}

// Question Templates
export function useQuestionTemplates(category?: string) {
  return useQuery({
    queryKey: ['question-templates', category],
    queryFn: async () => {
      const url = category
        ? `/api/question-templates?category=${encodeURIComponent(category)}`
        : '/api/question-templates';
      const res = await authenticatedFetch(url);
      if (!res.ok) throw new Error('Failed to fetch question templates');
      return res.json() as Promise<QuestionTemplate[]>;
    },
  });
}

export function useQuestionTemplateCategories() {
  return useQuery({
    queryKey: ['question-template-categories'],
    queryFn: async () => {
      const res = await authenticatedFetch('/api/question-templates/categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      const data = await res.json();
      return data.categories as string[];
    },
  });
}

export function useCreateQuestionTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title: string; question_text: string; category: string }) => {
      const res = await authenticatedFetch('/api/question-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create template');
      }
      return res.json() as Promise<QuestionTemplate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-templates'] });
      queryClient.invalidateQueries({ queryKey: ['question-template-categories'] });
    },
  });
}

export function useUpdateQuestionTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: { title?: string; question_text?: string; category?: string };
    }) => {
      const res = await authenticatedFetch(`/api/question-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update template');
      }
      return res.json() as Promise<QuestionTemplate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-templates'] });
      queryClient.invalidateQueries({ queryKey: ['question-template-categories'] });
    },
  });
}

export function useDeleteQuestionTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await authenticatedFetch(`/api/question-templates/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['question-templates'] });
      queryClient.invalidateQueries({ queryKey: ['question-template-categories'] });
    },
  });
}
