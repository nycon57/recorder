import { NextRequest, NextResponse } from "next/server";
import { betterFetch } from "@better-fetch/fetch";
import type { Session } from "@/lib/auth/auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for auth API routes (avoid circular fetch)
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // CORS preflight requests carry no credentials — let them reach the route's
  // OPTIONS handler so it can return proper Access-Control-* headers.
  // Extension/SDK routes are embedded cross-origin and must respond to preflight.
  if (
    request.method === "OPTIONS" &&
    (pathname.startsWith("/api/extension/") || pathname.startsWith("/api/sdk/"))
  ) {
    return NextResponse.next();
  }

  // Extension health check is public — skip auth
  if (pathname === "/api/extension/health") {
    return NextResponse.next();
  }

  // SDK bundle route is public — skip auth (served with cache headers)
  if (pathname === "/api/sdk/bundle") {
    return NextResponse.next();
  }

  // ─── TRIB-58: Custom domain resolution ──────────────────────────────
  // If the Host header matches a vendor's custom_domain, resolve their
  // white-label config and inject headers for downstream routes.
  const host = request.headers.get("host");
  const mainDomain = process.env.NEXT_PUBLIC_APP_URL
    ? new URL(process.env.NEXT_PUBLIC_APP_URL).host
    : "localhost:3000";

  if (host && host !== mainDomain && !host.startsWith("localhost")) {
    // Lazy-import to avoid pulling Supabase into every middleware call
    // for requests on the main domain
    try {
      const { resolveWhiteLabelByDomain } = await import(
        "@/lib/services/white-label"
      );
      const config = await resolveWhiteLabelByDomain(host);
      if (config) {
        const response = NextResponse.next();
        response.headers.set("x-tribora-vendor-org-id", config.vendor_org_id);
        response.headers.set("x-tribora-config-id", config.id);

        // For SDK routes on custom domains, skip session auth and return
        // early — SDK auth is handled via API key in the route itself
        if (pathname.startsWith("/api/sdk/") || pathname.startsWith("/api/extension/")) {
          return response;
        }
      }
    } catch (err) {
      // Domain resolution failure should not block the request
      console.warn("[middleware] Custom domain resolution error:", err);
    }
  }

  // ─── SDK routes use API key auth, not session ───────────────────────
  // Skip session check for SDK init (API key auth handled in route)
  if (pathname.startsWith("/api/sdk/")) {
    return NextResponse.next();
  }

  const { data: session } = await betterFetch<Session>(
    "/api/auth/get-session",
    {
      baseURL: request.nextUrl.origin,
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    }
  );

  // Protected routes — require authentication
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/assistant") ||
    pathname.startsWith("/library") ||
    pathname.startsWith("/recordings") ||
    pathname.startsWith("/record") ||
    pathname.startsWith("/search") ||
    pathname.startsWith("/knowledge") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/api/activity") ||
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/analytics") ||
    pathname.startsWith("/api/billing") ||
    pathname.startsWith("/api/chat") ||
    pathname.startsWith("/api/collections") ||
    pathname.startsWith("/api/comments") ||
    pathname.startsWith("/api/content") ||
    pathname.startsWith("/api/conversations") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/dashboard") ||
    pathname.startsWith("/api/favorites") ||
    pathname.startsWith("/api/integrations") ||
    pathname.startsWith("/api/knowledge") ||
    pathname.startsWith("/api/library") ||
    pathname.startsWith("/api/monitoring") ||
    pathname.startsWith("/api/organizations") ||
    pathname.startsWith("/api/profile") ||
    pathname.startsWith("/api/recordings") ||
    pathname.startsWith("/api/search") ||
    pathname.startsWith("/api/extension") ||
    pathname.startsWith("/api/storage") ||
    pathname.startsWith("/api/tags")
  ) {
    if (!session) {
      // API routes get a 401; page routes redirect to login
      if (pathname.startsWith("/api/")) {
        // Extension/SDK routes are called cross-origin — error responses
        // must carry CORS headers so the browser surfaces the real status
        // (otherwise a 401 shows up as an opaque CORS failure).
        const isCrossOriginApi =
          pathname.startsWith("/api/extension/") ||
          pathname.startsWith("/api/sdk/");
        return NextResponse.json(
          { error: "Unauthorized" },
          {
            status: 401,
            headers: isCrossOriginApi
              ? {
                  "Access-Control-Allow-Origin": "*",
                  "Access-Control-Allow-Methods":
                    "GET, POST, PUT, DELETE, OPTIONS",
                  "Access-Control-Allow-Headers": "Authorization, Content-Type",
                }
              : undefined,
          }
        );
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // Redirect authenticated users away from auth pages
  if (
    (pathname === "/login" ||
      pathname === "/signup" ||
      pathname.startsWith("/sign-in") ||
      pathname.startsWith("/sign-up")) &&
    session
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
