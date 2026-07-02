import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";
import { getPostHogClient } from "@/lib/posthog-server";

const ALLOWED_PROVIDERS = ["google", "github"] as const;
type Provider = (typeof ALLOWED_PROVIDERS)[number];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const { origin } = new URL(request.url);

  if (!ALLOWED_PROVIDERS.includes(provider as Provider)) {
    return NextResponse.redirect(new URL("/login?error=invalid_provider", origin));
  }

  // Create a response we can attach cookies to and pass to createAuthActions
  const response = NextResponse.next();

  const auth = createAuthActions({
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  });

  const { data, error } = await auth.signInWithOAuth(provider as Provider, {
    redirectTo: `${origin}/api/auth/callback`,
    skipBrowserRedirect: true,
    additionalParams: provider === "google" ? { prompt: "select_account" } : undefined,
  });

  if (error || !data?.url || !data?.codeVerifier) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", origin));
  }

  getPostHogClient().capture({
    distinctId: crypto.randomUUID(),
    event: "oauth_initiated",
    properties: { provider },
  });

  // 302 redirect to the provider's OAuth page
  const redirectResponse = NextResponse.redirect(data.url, { status: 302 });

  // Persist PKCE verifier for the callback to exchange
  redirectResponse.cookies.set("insforge_oauth_code_verifier", data.codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return redirectResponse;
}
