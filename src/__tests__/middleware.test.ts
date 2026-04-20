/** @jest-environment node */

import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest } from "next/server";

const betterFetchMock = jest.fn();

jest.mock("@better-fetch/fetch", () => ({
  betterFetch: betterFetchMock,
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
});
