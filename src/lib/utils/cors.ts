/**
 * Shared CORS headers for SDK and extension API routes (TRIB-58).
 *
 * All /api/sdk/* and /api/extension/* routes should use these headers
 * to allow cross-origin requests from:
 * - Vendor custom domains (resolved dynamically)
 * - The main Tribora domain
 * - localhost:* in development
 *
 * For MVP we use `Access-Control-Allow-Origin: *` since the SDK is
 * embedded on arbitrary vendor customer sites and we authenticate via
 * API key (not cookies). This is the same pattern used by Stripe.js,
 * Intercom, and other embeddable SDKs.
 */

import { NextResponse } from 'next/server';

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

/** Return a 204 preflight response with CORS headers. */
export function corsPreflightResponse(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** Merge CORS headers into an existing headers object or record. */
export function withCors(
  existingHeaders?: Record<string, string>
): Record<string, string> {
  return { ...CORS_HEADERS, ...(existingHeaders ?? {}) };
}
