/** @jest-environment node */

import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const betterFetchMock = jest.fn<() => Promise<{ data: unknown }>>();
const resolveWhiteLabelByDomainMock = jest.fn<
  (domain: string) => Promise<{ id: string; vendor_org_id: string } | null>
>();

jest.mock("@better-fetch/fetch", () => ({
  betterFetch: betterFetchMock,
}));

jest.mock("@/lib/services/white-label", () => ({
  resolveWhiteLabelByDomain: resolveWhiteLabelByDomainMock,
}));

let middleware: typeof import("@/middleware").middleware;

describe("middleware auth routing", () => {
  beforeAll(async () => {
    ({ middleware } = await import("@/middleware"));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    betterFetchMock.mockResolvedValue({ data: null });
    resolveWhiteLabelByDomainMock.mockResolvedValue(null);
  });

  it("skips auth API routes without fetching session state", async () => {
    const response = await middleware(
      new NextRequest("http://localhost:3000/api/auth/get-session")
    );

    expect(betterFetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("redirects unauthenticated protected pages to /sign-in", async () => {
    const response = await middleware(
      new NextRequest("http://localhost:3000/dashboard")
    );

    expect(betterFetchMock).toHaveBeenCalledWith(
      "/api/auth/get-session",
      expect.objectContaining({
        baseURL: "http://localhost:3000",
      })
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/sign-in"
    );
  });

  it("canonicalizes legacy login and signup URLs for signed-out users", async () => {
    const loginResponse = await middleware(
      new NextRequest("http://localhost:3000/login")
    );
    const signupResponse = await middleware(
      new NextRequest("http://localhost:3000/signup")
    );

    expect(loginResponse.headers.get("location")).toBe(
      "http://localhost:3000/sign-in"
    );
    expect(signupResponse.headers.get("location")).toBe(
      "http://localhost:3000/sign-up"
    );
  });

  it("redirects authenticated users away from legacy and canonical auth pages", async () => {
    betterFetchMock.mockResolvedValue({
      data: {
        user: { id: "user-1" },
      },
    });

    const legacyResponse = await middleware(
      new NextRequest("http://localhost:3000/login")
    );
    const canonicalResponse = await middleware(
      new NextRequest("http://localhost:3000/sign-in")
    );

    expect(legacyResponse.headers.get("location")).toBe(
      "http://localhost:3000/dashboard"
    );
    expect(canonicalResponse.headers.get("location")).toBe(
      "http://localhost:3000/dashboard"
    );
  });

  it("returns a 401 JSON response for protected API routes without a session", async () => {
    const response = await middleware(
      new NextRequest("http://localhost:3000/api/profile")
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it.each([
    "/api/extension/context",
    "/api/extension/debug-events",
    "/api/extension/live-context",
    "/api/extension/query",
    "/api/extension/telemetry/events",
  ])(
    "lets API-key capable extension route %s reach route-level auth",
    async (pathname) => {
      const response = await middleware(
        new NextRequest(`http://localhost:3000${pathname}`, {
          method: "POST",
          headers: { authorization: "Bearer sk_live_test" },
        }),
      );

      expect(betterFetchMock).not.toHaveBeenCalled();
      expect(response.headers.get("x-middleware-next")).toBe("1");
    },
  );

  it("lets the extension auth callback reach its token validation route", async () => {
    const response = await middleware(
      new NextRequest("http://localhost:3000/api/extension/auth/callback", {
        method: "POST",
      }),
    );

    expect(betterFetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("adds custom-domain headers before allowlisted extension route bypass", async () => {
    resolveWhiteLabelByDomainMock.mockResolvedValue({
      id: "config-1",
      vendor_org_id: "vendor-org-1",
    });

    const response = await middleware(
      new NextRequest("https://vendor.example.com/api/extension/query", {
        method: "POST",
        headers: {
          authorization: "Bearer sk_live_test",
          host: "vendor.example.com",
        },
      }),
    );

    expect(resolveWhiteLabelByDomainMock).toHaveBeenCalledWith(
      "vendor.example.com",
    );
    expect(betterFetchMock).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("x-tribora-vendor-org-id")).toBe(
      "vendor-org-1",
    );
    expect(response.headers.get("x-tribora-config-id")).toBe("config-1");
  });

  it.each([
    "/api/extension/agent-session",
    "/api/extension/deepgram-token",
    "/api/extension/user-memory",
  ])("keeps session-only extension route %s protected", async (pathname) => {
    const response = await middleware(
      new NextRequest(`http://localhost:3000${pathname}`, {
        method: "POST",
        headers: { authorization: "Bearer sk_live_test" },
      }),
    );

    expect(betterFetchMock).toHaveBeenCalledWith(
      "/api/auth/get-session",
      expect.objectContaining({
        baseURL: "http://localhost:3000",
      }),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});
