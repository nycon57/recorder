#!/usr/bin/env tsx
/**
 * Tribora MCP Knowledge Server — Entry Point
 *
 * Starts the MCP server in one of two modes:
 *   stdio  — for local development / Claude Desktop integration (default)
 *   http   — for remote access via Streamable HTTP transport
 *
 * Usage:
 *   TRIBORA_API_KEY=sk_live_... npm run mcp:dev          # stdio mode
 *   TRIBORA_API_KEY=sk_live_... npm run mcp:dev -- http   # HTTP mode on port 3100
 */

import { createServer } from 'node:http';
import { resolve } from 'path';

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { config } from 'dotenv';

import { createMcpServer, McpAuthError } from '@/lib/mcp/server';

// Load .env.local for Supabase credentials, etc.
config({ path: resolve(process.cwd(), '.env.local') });

const MCP_HTTP_PORT = Number(process.env.MCP_PORT) || 3100;

async function main() {
  const apiKey = process.env.TRIBORA_API_KEY;
  if (!apiKey) {
    console.error('Error: TRIBORA_API_KEY environment variable is required.');
    console.error('Set it to a valid API key from your Tribora organization.');
    process.exit(1);
  }

  // Validate required Supabase env vars
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    console.error(
      'Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.'
    );
    process.exit(1);
  }

  let server;
  try {
    server = await createMcpServer(apiKey);
  } catch (error) {
    if (error instanceof McpAuthError) {
      console.error(`Authentication failed: ${error.message}`);
    } else {
      console.error('Failed to create MCP server:', error);
    }
    process.exit(1);
  }

  const mode = process.argv[2] || 'stdio';

  if (mode === 'http') {
    await startHttpMode(server);
  } else {
    await startStdioMode(server);
  }
}

async function startStdioMode(
  server: Awaited<ReturnType<typeof createMcpServer>>
) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] Tribora Knowledge Server running (stdio mode)');
}

async function startHttpMode(
  server: Awaited<ReturnType<typeof createMcpServer>>
) {
  const httpServer = createServer(async (req, res) => {
    // Only accept POST to /mcp
    if (req.method !== 'POST' || req.url !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  httpServer.listen(MCP_HTTP_PORT, () => {
    console.error(
      `[MCP] Tribora Knowledge Server running (HTTP mode) on port ${MCP_HTTP_PORT}`
    );
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
