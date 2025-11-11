import type { User, Project, Conversation, Document } from "@/types/database";
import * as dbQueries from "@/lib/db";

/**
 * Verify user owns project
 */
export async function verifyProjectOwnership(projectId: number, userId: number): Promise<Project | null> {
  const project = await dbQueries.getProjectById(projectId);
  if (!project || project.user_id !== userId) {
    return null;
  }
  return project;
}

/**
 * Verify user owns conversation (through project)
 */
export async function verifyConversationOwnership(conversationId: number, userId: number): Promise<Conversation | null> {
  const conversation = await dbQueries.getConversationById(conversationId);
  if (!conversation) {
    return null;
  }

  const project = await verifyProjectOwnership(conversation.project_id, userId);
  if (!project) {
    return null;
  }

  return conversation;
}

/**
 * Verify user owns document
 */
export async function verifyDocumentOwnership(documentId: number, userId: number): Promise<Document | null> {
  const document = await dbQueries.getDocumentById(documentId);
  if (!document || document.user_id !== userId) {
    return null;
  }
  return document;
}
