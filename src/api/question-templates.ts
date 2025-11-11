/**
 * Question Templates API handlers
 * Handles CRUD operations for pre-registered question templates
 */

import type { Server } from "bun";
import {
  getAllQuestionTemplates,
  getQuestionTemplatesByCategory,
  getQuestionTemplateCategories,
  getQuestionTemplateById,
  createQuestionTemplate,
  updateQuestionTemplate,
  deleteQuestionTemplate,
  getDefaultUser,
} from "../lib/db";

/**
 * GET /api/question-templates
 * Get all question templates (global + user's own)
 */
export async function handleGetQuestionTemplates(req: Request, server: Server) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category");

    const user = await getDefaultUser();
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    let templates;
    if (category) {
      templates = await getQuestionTemplatesByCategory(user.id, category);
    } else {
      templates = await getAllQuestionTemplates(user.id);
    }

    return Response.json(templates);
  } catch (error: any) {
    console.error("Failed to fetch question templates:", error);
    return Response.json(
      { error: "Failed to fetch question templates", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/question-templates/categories
 * Get all available categories
 */
export async function handleGetQuestionTemplateCategories(req: Request, server: Server) {
  try {
    const user = await getDefaultUser();
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const categories = await getQuestionTemplateCategories(user.id);
    return Response.json({ categories });
  } catch (error: any) {
    console.error("Failed to fetch question template categories:", error);
    return Response.json(
      { error: "Failed to fetch categories", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/question-templates/:id
 * Get a specific question template by ID
 */
export async function handleGetQuestionTemplate(req: Request, server: Server) {
  try {
    const url = new URL(req.url);
    const id = parseInt(url.pathname.split("/").pop() || "");

    if (isNaN(id)) {
      return Response.json({ error: "Invalid template ID" }, { status: 400 });
    }

    const template = await getQuestionTemplateById(id);

    if (!template) {
      return Response.json({ error: "Template not found" }, { status: 404 });
    }

    return Response.json(template);
  } catch (error: any) {
    console.error("Failed to fetch question template:", error);
    return Response.json(
      { error: "Failed to fetch template", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/question-templates
 * Create a new question template
 */
export async function handleCreateQuestionTemplate(req: Request, server: Server) {
  try {
    const user = await getDefaultUser();
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { title, question_text, category } = body;

    // Validation
    if (!title || !question_text || !category) {
      return Response.json(
        { error: "title, question_text, and category are required" },
        { status: 400 }
      );
    }

    const template = await createQuestionTemplate(user.id, {
      title,
      question_text,
      category,
      is_global: false, // User templates are never global
    });

    return Response.json(template);
  } catch (error: any) {
    console.error("Failed to create question template:", error);
    return Response.json(
      { error: "Failed to create template", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/question-templates/:id
 * Update a question template
 */
export async function handleUpdateQuestionTemplate(req: Request, server: Server) {
  try {
    const url = new URL(req.url);
    const id = parseInt(url.pathname.split("/").pop() || "");

    if (isNaN(id)) {
      return Response.json({ error: "Invalid template ID" }, { status: 400 });
    }

    const user = await getDefaultUser();
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { title, question_text, category } = body;

    const template = await updateQuestionTemplate(id, user.id, {
      title,
      question_text,
      category,
    });

    if (!template) {
      return Response.json(
        { error: "Template not found or you don't have permission to update it" },
        { status: 404 }
      );
    }

    return Response.json(template);
  } catch (error: any) {
    console.error("Failed to update question template:", error);
    return Response.json(
      { error: "Failed to update template", details: error?.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/question-templates/:id
 * Delete a question template
 */
export async function handleDeleteQuestionTemplate(req: Request, server: Server) {
  try {
    const url = new URL(req.url);
    const id = parseInt(url.pathname.split("/").pop() || "");

    if (isNaN(id)) {
      return Response.json({ error: "Invalid template ID" }, { status: 400 });
    }

    const user = await getDefaultUser();
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const success = await deleteQuestionTemplate(id, user.id);

    if (!success) {
      return Response.json(
        { error: "Template not found or you don't have permission to delete it" },
        { status: 404 }
      );
    }

    return Response.json({ success: true });
  } catch (error: any) {
    console.error("Failed to delete question template:", error);
    return Response.json(
      { error: "Failed to delete template", details: error?.message },
      { status: 500 }
    );
  }
}
