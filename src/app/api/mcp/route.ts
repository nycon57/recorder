import { NextRequest, NextResponse } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { McpAuthError, createMcpServer } from '@/lib/mcp/server';
import { CORS_HEADERS, corsPreflightResponse, withCors } from '@/lib/utils/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonRpcErrorResponse(
  status: number,
  code: number,
  message: string,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    {
      jsonrpc: '2.0',
      error: {
        code,
        message,
      },
      id: null,
    },
    { status, headers: withCors(headers) },
  );
}

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  const [scheme, ...tokenParts] = authHeader?.trim().split(/\s+/) ?? [];
  if (scheme?.toLowerCase() !== 'bearer' || tokenParts.length !== 1) {
    return null;
  }

  const token = tokenParts[0]?.trim() ?? '';
  return token.length > 0 ? token : null;
}

function unsupportedMethodResponse(): NextResponse {
  return jsonRpcErrorResponse(405, -32000, 'Method not allowed.', {
    Allow: 'GET, POST, DELETE',
  });
}

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  const apiKey = extractBearerToken(request);
  if (!apiKey) {
    return jsonRpcErrorResponse(
      401,
      -32001,
      'Unauthorized: missing Bearer API key',
    );
  }

  try {
    const server = await createMcpServer(apiKey);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);

    const response = await transport.handleRequest(request);
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  } catch (error) {
    if (error instanceof McpAuthError) {
      return jsonRpcErrorResponse(401, -32001, error.message);
    }

    console.error('[api/mcp] failed to handle MCP request:', error);
    return jsonRpcErrorResponse(500, -32603, 'Internal server error');
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request);
}

export async function DELETE(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request);
}

export async function OPTIONS(): Promise<Response> {
  return corsPreflightResponse();
}

export async function PUT(): Promise<Response> {
  return unsupportedMethodResponse();
}

export async function PATCH(): Promise<Response> {
  return unsupportedMethodResponse();
}
