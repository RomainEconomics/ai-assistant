import type { User } from "@/types/database";
import { updateSessionLastUsed, getSessionByToken, getUserById } from "@/lib/db";

export interface AuthContext {
  user: User;
  refreshToken: string;
}

/**
 * Extract and validate token from request
 * Uses local session stored in database
 */
export async function extractAuthContext(req: Request): Promise<AuthContext | null> {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return null;
    }

    const refreshToken = authHeader.slice(7);

    // Get user from local session
    const session = await getSessionByToken(refreshToken);

    if (!session) {
      console.warn("⚠️ No session found for token");
      return null;
    }

    // Check if session expired
    if (new Date(session.expires_at) < new Date()) {
      console.warn("⚠️ Session expired");
      return null;
    }

    // Get user from database
    const user = await getUserById(session.user_id);

    if (!user || !user.is_active) {
      console.warn("⚠️ User not found or inactive");
      return null;
    }

    // Update session last_used_at
    await updateSessionLastUsed(refreshToken);

    console.log("✅ Auth validated from local session:", user.username);

    return {
      user,
      refreshToken,
    };
  } catch (error) {
    console.error("Error extracting auth context:", error);
    return null;
  }
}

/**
 * Middleware to ensure authentication
 * Returns AuthContext or 401 Response
 */
export async function requireAuth(req: Request): Promise<AuthContext | Response> {
  const authContext = await extractAuthContext(req);

  if (!authContext) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return authContext;
}

/**
 * Middleware to require admin access
 */
export async function requireAdmin(req: Request): Promise<AuthContext | Response> {
  const authResult = await requireAuth(req);
  if (authResult instanceof Response) return authResult;

  const { user } = authResult;

  // Check if user has admin role
  const roles = user.roles ? JSON.parse(user.roles) : [];
  const isAdmin = roles.includes("admin");

  if (!isAdmin) {
    return Response.json(
      { error: "Forbidden: Admin access required" },
      { status: 403 }
    );
  }

  return authResult;
}

/**
 * Middleware for optional authentication
 */
export async function optionalAuth(req: Request): Promise<AuthContext | null> {
  return extractAuthContext(req);
}
