import { NextRequest, NextResponse } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';

import { McpAuthError, createMcpServer } from '@/lib/mcp/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function jsonRpcErrorResponse(
  status: number,
  code: number,
  message: string,
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
    { status },
  );
}

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
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

    return await transport.handleRequest(request);
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
