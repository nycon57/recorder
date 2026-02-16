/**
 * MCP Server Authentication
 *
 * Validates API keys for MCP connections and resolves the org context.
 * Reuses the existing api-key-validation utility for consistency.
 */

import { validateApiKey } from '@/lib/utils/api-key-validation';

export interface McpAuthContext {
  orgId: string;
  scopes: string[];
  rateLimit: number;
}

/**
 * Authenticate an MCP connection using an API key.
 *
 * Returns the org context on success, or throws with a descriptive message.
 * The API key can come from an environment variable (stdio mode)
 * or from an HTTP header (HTTP/SSE mode).
 */
export async function authenticateMcpConnection(
  apiKey: string
): Promise<McpAuthContext> {
  if (!apiKey) {
    throw new McpAuthError('Invalid or missing API key');
  }

  const result = await validateApiKey(apiKey);

  if (!result.valid || !result.orgId) {
    throw new McpAuthError(result.error || 'Invalid or missing API key');
  }

  return {
    orgId: result.orgId,
    scopes: result.scopes || [],
    rateLimit: result.rateLimit || 1000,
  };
}

export class McpAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpAuthError';
  }
}
