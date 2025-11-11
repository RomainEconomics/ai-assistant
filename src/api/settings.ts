import type { Server } from "bun";
import { getOrCreateUserPreferences, updateUserPreferences } from "@/lib/db";
import type { UserPreferences } from "@/types/database";
import { requireAuth } from "@/middleware/auth";

/**
 * GET /api/settings
 * Get user preferences
 */
export async function handleGetSettings(req: Request, server: Server) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const preferences = await getOrCreateUserPreferences(user.id);

    return new Response(
      JSON.stringify(preferences),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error getting settings:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get settings" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * PUT /api/settings
 * Update user preferences
 */
export async function handleUpdateSettings(req: Request, server: Server) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    const body = await req.json();

    // Validate input
    const updates: {
      default_model_provider?: 'openai' | 'anthropic';
      default_model_name?: string;
      default_temperature?: number;
      default_max_tokens?: number;
      theme?: 'light' | 'dark' | 'system';
      language?: 'en' | 'fr';
      disclaimer_accepted_at?: string | null;
    } = {};

    if (body.default_model_provider !== undefined) {
      if (!['openai', 'anthropic'].includes(body.default_model_provider)) {
        return new Response(
          JSON.stringify({ error: "Invalid model provider" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      updates.default_model_provider = body.default_model_provider;
    }

    if (body.default_model_name !== undefined) {
      updates.default_model_name = body.default_model_name;
    }

    if (body.default_temperature !== undefined) {
      const temp = parseFloat(body.default_temperature);
      if (isNaN(temp) || temp < 0 || temp > 2) {
        return new Response(
          JSON.stringify({ error: "Temperature must be between 0 and 2" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      updates.default_temperature = temp;
    }

    if (body.default_max_tokens !== undefined) {
      const tokens = parseInt(body.default_max_tokens);
      if (isNaN(tokens) || tokens < 1 || tokens > 100000) {
        return new Response(
          JSON.stringify({ error: "Max tokens must be between 1 and 100000" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      updates.default_max_tokens = tokens;
    }

    if (body.theme !== undefined) {
      if (!['light', 'dark', 'system'].includes(body.theme)) {
        return new Response(
          JSON.stringify({ error: "Invalid theme" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      updates.theme = body.theme;
    }

    if (body.language !== undefined) {
      if (!['en', 'fr'].includes(body.language)) {
        return new Response(
          JSON.stringify({ error: "Invalid language" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      updates.language = body.language;
    }

    if (body.disclaimer_accepted_at !== undefined) {
      // Accept either null or a valid ISO datetime string
      if (body.disclaimer_accepted_at === null) {
        updates.disclaimer_accepted_at = null;
      } else if (typeof body.disclaimer_accepted_at === 'string') {
        updates.disclaimer_accepted_at = body.disclaimer_accepted_at;
      } else {
        return new Response(
          JSON.stringify({ error: "Invalid disclaimer_accepted_at format" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Ensure user preferences exist first
    await getOrCreateUserPreferences(user.id);

    const updatedPreferences = await updateUserPreferences(user.id, updates);

    return new Response(
      JSON.stringify(updatedPreferences),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating settings:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update settings" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
