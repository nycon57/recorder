/**
 * Tribora MCP Knowledge Server
 *
 * Exposes Tribora's knowledge base to external AI agents via the
 * Model Context Protocol. Each tool validates the API key, scopes
 * queries to the owning org, and returns structured JSON.
 *
 * Tools:
 *   searchRecordings      — Semantic search across content
 *   searchConcepts        — Knowledge graph concept search
 *   exploreKnowledgeGraph — Depth-based graph traversal
 *   getDocument           — Retrieve document by content ID
 *   getTranscript         — Retrieve transcript by content ID
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { authenticateMcpConnection, McpAuthError } from './auth';
import {
  handleSearchRecordings,
  handleSearchConcepts,
  handleExploreKnowledgeGraph,
  handleGetDocument,
  handleGetTranscript,
  McpToolError,
  type McpToolContext,
} from './handlers';

/**
 * Create and configure the Tribora MCP server.
 *
 * Authenticates the connection with the given API key, then registers
 * all tool definitions with handlers scoped to the authenticated org.
 */
export async function createMcpServer(apiKey: string): Promise<McpServer> {
  const authContext = await authenticateMcpConnection(apiKey);

  const ctx: McpToolContext = { orgId: authContext.orgId };

  const server = new McpServer({
    name: 'tribora-knowledge',
    version: '1.0.0',
  });

  registerTools(server, ctx);

  return server;
}

/** Serialize a handler result as MCP tool output. */
function toToolResult(result: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
  };
}

/** Serialize an error as an MCP tool error following MCP conventions. */
function toErrorResult(toolName: string, error: unknown): CallToolResult {
  if (error instanceof McpToolError) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ code: error.code, message: error.message }),
        },
      ],
      isError: true,
    };
  }

  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`[MCP] ${toolName} error:`, error);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ code: 'internal_error', message }),
      },
    ],
    isError: true,
  };
}

/**
 * Register all knowledge tools on the MCP server.
 */
function registerTools(server: McpServer, ctx: McpToolContext): void {
  // searchRecordings — semantic search across content
  server.tool(
    'searchRecordings',
    'Semantic search across recordings, transcripts, and documents. Returns matching items with snippets and similarity scores.',
    {
      query: z.string().min(1).max(500).describe('Search query'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .describe('Max results to return'),
      contentTypes: z
        .array(z.string())
        .optional()
        .describe(
          'Filter by content types (recording, video, audio, document, text)'
        ),
    },
    async (args) => {
      try {
        return toToolResult(await handleSearchRecordings(args, ctx));
      } catch (error) {
        return toErrorResult('searchRecordings', error);
      }
    }
  );

  // searchConcepts — knowledge graph concept search
  server.tool(
    'searchConcepts',
    'Search the knowledge graph for concepts and topics. Returns matching concepts with types, descriptions, and mention counts.',
    {
      query: z
        .string()
        .min(1)
        .max(500)
        .describe('Concept name or topic to search for'),
      conceptType: z
        .string()
        .optional()
        .describe(
          'Filter by concept type (tool, process, person, organization, technical_term, general)'
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe('Max concepts to return'),
    },
    async (args) => {
      try {
        return toToolResult(await handleSearchConcepts(args, ctx));
      } catch (error) {
        return toErrorResult('searchConcepts', error);
      }
    }
  );

  // exploreKnowledgeGraph — depth-based graph traversal
  server.tool(
    'exploreKnowledgeGraph',
    'Explore the knowledge graph from a concept. Traverses relationships up to the given depth and returns connected concepts.',
    {
      conceptId: z
        .string()
        .uuid()
        .describe('The concept ID to start exploration from'),
      depth: z
        .number()
        .int()
        .min(1)
        .max(3)
        .default(1)
        .describe('How many relationship hops to traverse (1-3)'),
    },
    async (args) => {
      try {
        return toToolResult(await handleExploreKnowledgeGraph(args, ctx));
      } catch (error) {
        return toErrorResult('exploreKnowledgeGraph', error);
      }
    }
  );

  // getDocument — retrieve document by content ID
  server.tool(
    'getDocument',
    'Retrieve the full document content for a content item. Returns the document body, format, and metadata.',
    {
      contentId: z
        .string()
        .uuid()
        .describe('The UUID of the content item whose document to retrieve'),
    },
    async (args) => {
      try {
        return toToolResult(await handleGetDocument(args, ctx));
      } catch (error) {
        return toErrorResult('getDocument', error);
      }
    }
  );

  // getTranscript — retrieve transcript by content ID
  server.tool(
    'getTranscript',
    'Retrieve the full transcript text for a content item. Returns the text, language, and duration.',
    {
      contentId: z
        .string()
        .uuid()
        .describe('The UUID of the content item whose transcript to retrieve'),
    },
    async (args) => {
      try {
        return toToolResult(await handleGetTranscript(args, ctx));
      } catch (error) {
        return toErrorResult('getTranscript', error);
      }
    }
  );
}

export { McpAuthError };
