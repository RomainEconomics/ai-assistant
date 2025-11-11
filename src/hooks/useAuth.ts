/**
 * Authentication hook
 * Manages user authentication state and operations
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAuthToken,
  setAuthToken,
  removeAuthToken,
  authenticatedFetch,
} from "@/lib/api-client";
import type { User } from "@/types/database";

interface LoginCredentials {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: User;
}

/**
 * Login mutation
 */
async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Login failed");
  }

  const data = await response.json();

  // Store token
  setAuthToken(data.token);

  return data;
}

/**
 * Logout mutation
 */
async function logout(): Promise<void> {
  try {
    await authenticatedFetch("/api/auth/logout", {
      method: "POST",
    });
  } catch (error) {
    console.error("Logout request failed:", error);
    // Continue with local logout even if API call fails
  }

  // Clear token regardless of API response
  removeAuthToken();
}

/**
 * Get current user
 */
async function getCurrentUser(): Promise<User> {
  const response = await authenticatedFetch("/api/me");

  if (!response.ok) {
    throw new Error("Failed to get current user");
  }

  return response.json();
}

/**
 * Refresh session
 */
async function refreshSession(): Promise<LoginResponse> {
  const response = await authenticatedFetch("/api/auth/refresh", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to refresh session");
  }

  const data = await response.json();

  // Update token
  if (data.token) {
    setAuthToken(data.token);
  }

  return data;
}

/**
 * Main authentication hook
 */
export function useAuth() {
  const queryClient = useQueryClient();
  const token = getAuthToken();
  const isAuthenticated = !!token;

  // Query current user (only if authenticated)
  const {
    data: user,
    isLoading: isLoadingUser,
    error: userError,
  } = useQuery({
    queryKey: ["currentUser"],
    queryFn: getCurrentUser,
    enabled: isAuthenticated,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      // Set user data in cache
      queryClient.setQueryData(["currentUser"], data.user);
    },
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Clear all queries
      queryClient.clear();
    },
  });

  // Refresh mutation
  const refreshMutation = useMutation({
    mutationFn: refreshSession,
    onSuccess: (data) => {
      // Update user data in cache
      queryClient.setQueryData(["currentUser"], data.user);
    },
  });

  return {
    // State
    user,
    isAuthenticated,
    isLoading: isLoadingUser,
    error: userError,

    // Actions
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    refresh: refreshMutation.mutateAsync,

    // Mutation states
    isLoggingIn: loginMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
    loginError: loginMutation.error,
  };
}
