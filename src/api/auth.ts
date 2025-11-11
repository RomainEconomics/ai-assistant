import { v4 as uuidv4 } from "uuid";
import { createSession, deleteSession } from "@/lib/db";
import { requireAuth } from "@/middleware/auth";

/**
 * POST /api/auth/login
 * Login with username/password (mock authentication)
 */
export async function handleLogin(req: Request) {
  try {
    const body = await req.json() as { username: string; password: string };

    if (!body.username || !body.password) {
      return Response.json(
        { error: "Username and password required" },
        { status: 400 }
      );
    }

    // Mock authentication - accept any username/password for development
    // In production, you would integrate with a real authentication service
    console.log("🔐 Mock authentication for user:", body.username);

    // Create or get mock user from database
    const { getOrCreateMockUser } = await import("@/lib/db");
    const user = await getOrCreateMockUser(body.username);

    console.log("✅ Mock user created/retrieved:", user.username);

    // Generate mock tokens
    const sessionId = uuidv4();
    const mockAccessToken = `mock_access_${sessionId}`;
    const mockRefreshToken = `mock_refresh_${sessionId}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Create session
    await createSession(
      sessionId,
      user.id,
      mockAccessToken,
      mockRefreshToken,
      expiresAt.toISOString()
    );

    // Return tokens and user info
    return Response.json({
      token: mockRefreshToken, // Frontend expects "token" field
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        roles: user.roles ? JSON.parse(user.roles) : ["user"],
        is_admin: false,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Login failed" },
      { status: 401 }
    );
  }
}

/**
 * POST /api/auth/logout
 * Invalidate session
 */
export async function handleLogout(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ message: "Already logged out" });
    }

    const refreshToken = authHeader.slice(7);

    // Delete session
    await deleteSession(refreshToken);

    return Response.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return Response.json({ error: "Logout failed" }, { status: 500 });
  }
}

/**
 * GET /api/me
 * Get current user
 */
export async function handleGetCurrentUser(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult instanceof Response) return authResult;

  const { user } = authResult;

  return Response.json({
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    roles: user.roles ? JSON.parse(user.roles) : ["user"],
    is_admin: false,
    is_active: user.is_active,
    last_login: user.last_login,
  });
}

/**
 * POST /api/auth/refresh
 * Refresh session (update last_used_at)
 */
export async function handleRefreshSession(req: Request) {
  const authResult = await requireAuth(req);
  if (authResult instanceof Response) return authResult;

  const { user } = authResult;

  // Session is already refreshed in requireAuth middleware
  return Response.json({
    message: "Session refreshed",
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
}
