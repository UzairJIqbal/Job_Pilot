import { cookies } from "next/headers";
import { createServerClient } from "@insforge/sdk/ssr";

type InsForgeClient = ReturnType<typeof createServerClient>;

/**
 * Create an authenticated InsForge server client.
 * Handles access token + refresh token from cookies, with automatic
 * session refresh when the access token is expired.
 */
export async function getAuthenticatedClient(): Promise<{
  client: InsForgeClient;
  userId: string;
} | { error: string; status: number }> {
  const cookieStore = await cookies();
  const client = createServerClient({ cookies: cookieStore });

  // Try getCurrentUser with existing access token
  const { data: authData } = await client.auth.getCurrentUser();
  if (authData?.user?.id) {
    return { client, userId: authData.user.id };
  }

  // Access token missing or expired — try refresh
  const refreshToken = cookieStore.get("insforge_refresh_token")?.value;
  if (!refreshToken) {
    return { error: "Not authenticated. Please log in again.", status: 401 };
  }

  const { data: refreshed, error: refreshError } = await client.auth.refreshSession({
    refreshToken,
  });

  if (refreshError || !refreshed?.accessToken) {
    return { error: "Session expired. Please log in again.", status: 401 };
  }

  // Retry with refreshed session
  const { data: retryAuth } = await client.auth.getCurrentUser();
  if (retryAuth?.user?.id) {
    return { client, userId: retryAuth.user.id };
  }

  return { error: "Not authenticated. Please log in again.", status: 401 };
}
