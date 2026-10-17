import { createAdminClient } from "@insforge/sdk";

/**
 * Full-access client for background jobs that act for many users (cron).
 * It bypasses RLS, so every query must filter or set user_id explicitly.
 */
export function getAdminClient() {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) throw new Error("NEXT_PUBLIC_INSFORGE_URL and INSFORGE_API_KEY must be set");
  return createAdminClient({ baseUrl, apiKey });
}
