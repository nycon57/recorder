/** @jest-environment node */

import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const connectMock = jest.fn();
const createMcpServerMock = jest.fn();
const handleRequestMock = jest.fn();
const transportConstructorMock = jest.fn();

interface McpRequestInit {
  body?: string;
  headers?: Record<string, string>;
  method?: string;
  url?: string;
}

jest.mock('@/lib/mcp/server', () => {
  class McpAuthError extends Error {}

  return {
    McpAuthError,
    createMcpServer: createMcpServerMock,
  };
});

jest.mock(
  '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js',
  () => ({
    WebStandardStreamableHTTPServerTransport: transportConstructorMock,
  }),
);

function mcpRequest(init: McpRequestInit = {}): NextRequest {
  return new Request(init.url ?? 'http://localhost:3000/api/mcp', {
    ...init,
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      ...init.headers,
    },
  }) as unknown as NextRequest;
}

async function expectJsonRpcError(
  response: Response,
  status: number,
  code: number,
  message: string,
): Promise<void> {
  expect(response.status).toBe(status);
  await expect(response.json()).resolves.toEqual({
    jsonrpc: '2.0',
    error: { code, message },
    id: null,
  });
}

describe('/api/mcp route', () => {
  let POST: typeof import('../route').POST;
  let GET: typeof import('../route').GET;
  let OPTIONS: typeof import('../route').OPTIONS;
  let PUT: typeof import('../route').PUT;
  let McpAuthError: typeof import('@/lib/mcp/server').McpAuthError;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    const serverModule = await import('@/lib/mcp/server');
    McpAuthError = serverModule.McpAuthError;

    ({ GET, OPTIONS, POST, PUT } = await import('../route'));

    connectMock.mockResolvedValue(undefined as never);
    createMcpServerMock.mockResolvedValue({ connect: connectMock } as never);
    handleRequestMock.mockResolvedValue(
      Response.json({ jsonrpc: '2.0', result: { ok: true }, id: 1 }) as never,
    );
    transportConstructorMock.mockImplementation(() => ({
      handleRequest: handleRequestMock,
    }));
  });

  it('returns a JSON-RPC unauthorized error when auth is missing', async () => {
    const response = await POST(
      mcpRequest({
        method: 'POST',
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
    );

    await expectJsonRpcError(
      response,
      401,
      -32001,
      'Unauthorized: missing Bearer API key',
    );
    expect(createMcpServerMock).not.toHaveBeenCalled();
    expect(transportConstructorMock).not.toHaveBeenCalled();
  });

  it('returns a JSON-RPC unauthorized error when auth is malformed', async () => {
    const response = await POST(
      mcpRequest({
        method: 'POST',
        headers: { authorization: 'Basic not-a-bearer-token' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
    );

    await expectJsonRpcError(
      response,
      401,
      -32001,
      'Unauthorized: missing Bearer API key',
    );
    expect(createMcpServerMock).not.toHaveBeenCalled();
  });

  it('creates a stateless MCP server and web transport for each request', async () => {
    const firstRequest = mcpRequest({
      method: 'POST',
      headers: { authorization: 'bearer trb_mcp_first' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    const secondRequest = mcpRequest({
      method: 'GET',
      headers: {
        accept: 'text/event-stream',
        authorization: 'Bearer trb_mcp_second',
      },
    });

    const firstResponse = await POST(firstRequest);
    const secondResponse = await GET(secondRequest);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(firstResponse.headers.get('access-control-allow-origin')).toBe('*');
    expect(secondResponse.headers.get('access-control-allow-origin')).toBe('*');
    expect(createMcpServerMock).toHaveBeenNthCalledWith(1, 'trb_mcp_first');
    expect(createMcpServerMock).toHaveBeenNthCalledWith(2, 'trb_mcp_second');
    expect(transportConstructorMock).toHaveBeenCalledTimes(2);
    expect(transportConstructorMock).toHaveBeenNthCalledWith(1, {
      sessionIdGenerator: undefined,
    });
    expect(transportConstructorMock).toHaveBeenNthCalledWith(2, {
      sessionIdGenerator: undefined,
    });
    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(handleRequestMock).toHaveBeenNthCalledWith(1, firstRequest);
    expect(handleRequestMock).toHaveBeenNthCalledWith(2, secondRequest);
  });

  it('returns auth failures from createMcpServer as JSON-RPC errors', async () => {
    createMcpServerMock.mockRejectedValue(
      new McpAuthError('Invalid or revoked MCP API key') as never,
    );

    const response = await POST(
      mcpRequest({
        method: 'POST',
        headers: { authorization: 'Bearer trb_mcp_revoked' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
    );

    await expectJsonRpcError(
      response,
      401,
      -32001,
      'Invalid or revoked MCP API key',
    );
  });

  it('returns MCP-compatible JSON-RPC errors for unsupported methods', async () => {
    const response = await PUT();

    expect(response.headers.get('allow')).toBe('GET, POST, DELETE');
    await expectJsonRpcError(response, 405, -32000, 'Method not allowed.');
    expect(createMcpServerMock).not.toHaveBeenCalled();
  });

  it('returns CORS preflight responses for MCP clients', async () => {
    const response = await OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-headers')).toContain(
      'Authorization',
    );
    expect(createMcpServerMock).not.toHaveBeenCalled();
  });
});
