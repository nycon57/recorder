import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const { pathname } = request.nextUrl;

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
    pathname.startsWith("/api/storage") ||
    pathname.startsWith("/api/tags")
  ) {
    if (!session) {
      // API routes get a 401; page routes redirect to login
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
