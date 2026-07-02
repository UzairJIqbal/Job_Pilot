import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAuthActions } from "@insforge/sdk/ssr";
import { getPostHogClient } from "@/lib/posthog-server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("insforge_code");
  const codeVerifier = request.cookies.get(
    "insforge_oauth_code_verifier",
  )?.value;

  if (code && codeVerifier) {
    const response = NextResponse.redirect(new URL("/dashboard", origin));

    const auth = createAuthActions({
      requestCookies: request.cookies,
      responseCookies: response.cookies,
    });

    const { error } = await auth.exchangeOAuthCode(code, codeVerifier);

    if (error) {
      console.error("[api/auth/callback] exchangeOAuthCode error:", error);
      getPostHogClient().capture({
        distinctId: "anonymous",
        event: "oauth_failed",
        properties: { error: String(error) },
      });
      return NextResponse.redirect(
        new URL("/login?error=oauth_failed", origin),
      );
    }

    getPostHogClient().capture({
      distinctId: crypto.randomUUID(),
      event: "oauth_completed",
    });

    response.cookies.delete("insforge_oauth_code_verifier");
    return response;
  }

  return NextResponse.redirect(new URL("/login", origin));
}
