import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession, type UpdateSessionOptions } from "@insforge/sdk/ssr/middleware";

const protectedRoutes = ["/dashboard", "/queue", "/applications", "/profile", "/find-jobs"];

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );

  if (!isProtected) {
    return response;
  }

  // updateSession refreshes the access token when needed and
  // writes updated cookies to the response. Next.js cookie objects
  // are runtime-compatible with InsForge's CookieStore interface
  // but have stricter TypeScript overload signatures — hence the cast.
  // Only runs for protected routes to avoid blocking public pages.
  // Wrapped in try/catch: if the InsForge backend is slow or down,
  // we degrade gracefully — the existing cookie token is still valid
  // for this request and the refresh will be retried on next navigation.
  try {
    await updateSession({
      requestCookies: request.cookies as unknown as UpdateSessionOptions["requestCookies"],
      responseCookies: response.cookies as unknown as UpdateSessionOptions["responseCookies"],
    });
  } catch (error) {
    console.error("[proxy] updateSession failed:", error);
  }

  const accessToken =
    response.cookies.get("insforge_access_token")?.value ??
    request.cookies.get("insforge_access_token")?.value;

  if (!accessToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
