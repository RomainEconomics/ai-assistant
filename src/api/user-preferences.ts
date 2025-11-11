import type { Server } from "bun";
import {
  getUserPreferences,
  updateUserPreferences,
  getOrCreateUserPreferences,
  getDefaultUser,
} from "@/lib/db";

/**
 * GET /api/user-preferences
 * Get current user's preferences
 */
export async function handleGetUserPreferences(req: Request, server: Server) {
  try {
    // Get default user (single user support for now)
    const user = await getDefaultUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get or create user preferences
    const preferences = await getOrCreateUserPreferences(user.id);

    return new Response(
      JSON.stringify(preferences),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error fetching user preferences:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch user preferences" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

/**
 * PATCH /api/user-preferences
 * Update current user's preferences
 */
export async function handleUpdateUserPreferences(req: Request, server: Server) {
  try {
    // Get default user (single user support for now)
    const user = await getDefaultUser();
    if (!user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();

    // Validate language if provided
    if (body.language && !["en", "fr"].includes(body.language)) {
      return new Response(
        JSON.stringify({ error: "Invalid language. Must be 'en' or 'fr'" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate theme if provided
    if (body.theme && !["light", "dark", "system"].includes(body.theme)) {
      return new Response(
        JSON.stringify({ error: "Invalid theme. Must be 'light', 'dark', or 'system'" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update user preferences
    const preferences = await updateUserPreferences(user.id, {
      default_model_provider: body.default_model_provider,
      default_model_name: body.default_model_name,
      default_temperature: body.default_temperature,
      default_max_tokens: body.default_max_tokens,
      theme: body.theme,
      language: body.language,
    });

    return new Response(
      JSON.stringify(preferences),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error updating user preferences:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update user preferences" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
