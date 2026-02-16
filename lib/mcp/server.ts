/**
 * Tribora MCP Knowledge Server
 *
 * Exposes Tribora's knowledge capabilities to external AI agents via
 * the Model Context Protocol. Tools delegate to existing service functions
 * with org_id scoping enforced by API key authentication.
 *
 * Tools:
 *   searchRecordings    — Semantic search across content
 *   searchConcepts      — Knowledge graph concept search
 *   getDocument         — Retrieve document by ID
 *   getTranscript       — Retrieve transcript by ID
 *   getRecordingMetadata — Content metadata
 *   exploreKnowledgeGraph — Graph traversal
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import {
  executeSearchRecordings,
  executeGetDocument,
  executeGetTranscript,
  executeGetRecordingMetadata,
  executeSearchConcepts,
  executeExploreKnowledgeGraph,
  type ToolContext,
} from '@/lib/services/chat-tools';

import { authenticateMcpConnection, McpAuthError } from './auth';

/**
 * Create and configure the Tribora MCP server.
 *
 * Authenticates the connection with the given API key, then registers
 * all tool definitions with handlers scoped to the authenticated org.
 */
export async function createMcpServer(apiKey: string): Promise<McpServer> {
  const authContext = await authenticateMcpConnection(apiKey);

  const toolContext: ToolContext = {
    orgId: authContext.orgId,
    userId: 'mcp-agent',
  };

  const server = new McpServer({
    name: 'tribora-knowledge',
    version: '1.0.0',
  });

  registerTools(server, toolContext);

  return server;
}

/**
 * Build an MCP-compatible tool result from a service function response.
 * Catches errors to prevent crashing the server process.
 */
function toToolResult(result: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
  };
}

function toErrorResult(toolName: string, error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`[MCP] ${toolName} handler error:`, error);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: `internal_error: ${message}`,
        }),
      },
    ],
    isError: true,
  };
}

/**
 * Register all 6 knowledge tools on the MCP server.
 */
function registerTools(server: McpServer, ctx: ToolContext): void {
  // 1. searchRecordings — semantic search across content
  server.tool(
    'searchRecordings',
    'Semantic search across recordings, transcripts, and documents. Returns relevant excerpts with source citations.',
    {
      query: z.string().min(1).max(500).describe('The search query'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(5)
        .describe('Max results to return'),
      contentIds: z
        .array(z.string().uuid())
        .optional()
        .describe('Limit search to specific content IDs'),
      includeTranscripts: z
        .boolean()
        .default(true)
        .describe('Include transcript chunks'),
      includeDocuments: z
        .boolean()
        .default(true)
        .describe('Include document chunks'),
      minRelevance: z
        .number()
        .min(0)
        .max(1)
        .default(0.7)
        .describe('Minimum relevance score (0-1)'),
    },
    async (args) => {
      try {
        return toToolResult(await executeSearchRecordings(args, ctx));
      } catch (error) {
        return toErrorResult('searchRecordings', error);
      }
    }
  );

  // 2. searchConcepts — knowledge graph concept search
  server.tool(
    'searchConcepts',
    'Search the knowledge graph for concepts and topics mentioned across recordings. Returns matching concepts with types and mention counts.',
    {
      query: z
        .string()
        .min(1)
        .max(500)
        .describe('Concept name or topic to search for'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(20)
        .default(10)
        .describe('Max concepts to return'),
      types: z
        .array(
          z.enum([
            'tool',
            'process',
            'person',
            'organization',
            'technical_term',
            'general',
          ])
        )
        .optional()
        .describe('Filter by concept types'),
      minMentions: z
        .number()
        .int()
        .min(1)
        .default(1)
        .optional()
        .describe('Minimum mention count'),
    },
    async (args) => {
      try {
        return toToolResult(await executeSearchConcepts(args, ctx));
      } catch (error) {
        return toErrorResult('searchConcepts', error);
      }
    }
  );

  // 3. getDocument — retrieve document by ID
  server.tool(
    'getDocument',
    'Retrieve the full content of a document by its UUID. Returns markdown content and metadata.',
    {
      documentId: z
        .string()
        .uuid()
        .describe('The UUID of the document to retrieve'),
      includeMetadata: z
        .boolean()
        .default(true)
        .describe('Include document metadata'),
    },
    async (args) => {
      try {
        return toToolResult(await executeGetDocument(args, ctx));
      } catch (error) {
        return toErrorResult('getDocument', error);
      }
    }
  );

  // 4. getTranscript — retrieve transcript by content ID
  server.tool(
    'getTranscript',
    'Get the full transcript with timestamps for a recording. Returns formatted text with timing information.',
    {
      contentId: z.string().uuid().describe('The UUID of the content item'),
      includeTimestamps: z
        .boolean()
        .default(true)
        .describe('Include word-level timestamps'),
      formatTimestamps: z
        .boolean()
        .default(true)
        .describe('Format timestamps as MM:SS'),
    },
    async (args) => {
      try {
        return toToolResult(await executeGetTranscript(args, ctx));
      } catch (error) {
        return toErrorResult('getTranscript', error);
      }
    }
  );

  // 5. getRecordingMetadata — content metadata
  server.tool(
    'getRecordingMetadata',
    'Get metadata about a content item: title, duration, status, creation date, and processing stats.',
    {
      contentId: z.string().uuid().describe('The UUID of the content item'),
      includeStats: z
        .boolean()
        .default(true)
        .describe('Include stats (word count, chunks, document status)'),
    },
    async (args) => {
      try {
        return toToolResult(await executeGetRecordingMetadata(args, ctx));
      } catch (error) {
        return toErrorResult('getRecordingMetadata', error);
      }
    }
  );

  // 6. exploreKnowledgeGraph — graph traversal
  server.tool(
    'exploreKnowledgeGraph',
    'Explore the knowledge graph structure. Returns top concepts and their relationships to discover how topics connect.',
    {
      focusConceptId: z
        .string()
        .uuid()
        .optional()
        .describe('Optional concept ID to center exploration around'),
      maxNodes: z
        .number()
        .int()
        .min(5)
        .max(50)
        .default(20)
        .describe('Maximum concepts to return'),
      types: z
        .array(
          z.enum([
            'tool',
            'process',
            'person',
            'organization',
            'technical_term',
            'general',
          ])
        )
        .optional()
        .describe('Filter by concept types'),
    },
    async (args) => {
      try {
        return toToolResult(await executeExploreKnowledgeGraph(args, ctx));
      } catch (error) {
        return toErrorResult('exploreKnowledgeGraph', error);
      }
    }
  );
}

export { McpAuthError };
