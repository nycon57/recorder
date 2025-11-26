/**
 * Token Manager Service
 *
 * Centralized OAuth token refresh handling for all connectors.
 * Handles token expiration detection, refresh, and database updates.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';

// =====================================================
// TYPES
// =====================================================

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes?: string[];
}

export interface StoredCredentials {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string | Date;
  scopes?: string[];
  [key: string]: unknown;
}

export type RefreshFunction = (refreshToken: string) => Promise<TokenSet>;

export interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  newTokens?: TokenSet;
  error?: string;
}

// =====================================================
// TOKEN MANAGER CLASS
// =====================================================

export class TokenManager {
  /** Buffer time before expiration to trigger refresh (5 minutes) */
  private static readonly EXPIRATION_BUFFER_MS = 5 * 60 * 1000;

  /**
   * Ensure we have a valid access token, refreshing if necessary.
   *
   * @param connectorId - The connector config ID in the database
   * @param tokens - Current token set
   * @param refreshFn - Function to call external OAuth provider for refresh
   * @returns Valid access token
   * @throws Error if token refresh fails
   */
  static async ensureValidToken(
    connectorId: string,
    tokens: TokenSet | StoredCredentials,
    refreshFn: RefreshFunction
  ): Promise<string> {
    const normalizedTokens = this.normalizeTokens(tokens);

    if (!normalizedTokens.accessToken) {
      throw new Error('No access token available');
    }

    // Check if token is expired or expiring soon
    if (this.isTokenExpiringSoon(normalizedTokens.expiresAt)) {
      if (!normalizedTokens.refreshToken) {
        throw new Error('Token expired and no refresh token available');
      }

      console.log(`[TokenManager] Token expiring soon for connector ${connectorId}, refreshing...`);

      try {
        const newTokens = await refreshFn(normalizedTokens.refreshToken);
        await this.updateStoredTokens(connectorId, newTokens);
        console.log(`[TokenManager] Token refreshed successfully for connector ${connectorId}`);
        return newTokens.accessToken;
      } catch (error) {
        console.error(`[TokenManager] Token refresh failed for connector ${connectorId}:`, error);
        throw new Error(`Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return normalizedTokens.accessToken;
  }

  /**
   * Force refresh tokens even if not expired.
   * Useful when getting 401 errors.
   */
  static async forceRefresh(
    connectorId: string,
    tokens: TokenSet | StoredCredentials,
    refreshFn: RefreshFunction
  ): Promise<TokenRefreshResult> {
    const normalizedTokens = this.normalizeTokens(tokens);

    if (!normalizedTokens.refreshToken) {
      return {
        success: false,
        error: 'No refresh token available',
      };
    }

    try {
      const newTokens = await refreshFn(normalizedTokens.refreshToken);
      await this.updateStoredTokens(connectorId, newTokens);

      return {
        success: true,
        accessToken: newTokens.accessToken,
        newTokens,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
      };
    }
  }

  /**
   * Check if token is expired or will expire within buffer period
   */
  static isTokenExpiringSoon(expiresAt: Date): boolean {
    const bufferTime = Date.now() + this.EXPIRATION_BUFFER_MS;
    return expiresAt.getTime() < bufferTime;
  }

  /**
   * Check if token is already expired
   */
  static isTokenExpired(expiresAt: Date): boolean {
    return expiresAt.getTime() < Date.now();
  }

  /**
   * Update stored tokens in database
   */
  private static async updateStoredTokens(
    connectorId: string,
    tokens: TokenSet
  ): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('connector_configs')
      .update({
        credentials: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: tokens.expiresAt.toISOString(),
          scopes: tokens.scopes,
        },
        credentials_updated_at: new Date().toISOString(),
      })
      .eq('id', connectorId);

    if (error) {
      console.error(`[TokenManager] Failed to update tokens in database:`, error);
      throw new Error(`Failed to persist refreshed tokens: ${error.message}`);
    }
  }

  /**
   * Normalize various token formats to a consistent TokenSet
   */
  private static normalizeTokens(tokens: TokenSet | StoredCredentials): TokenSet {
    let expiresAt: Date;

    if (tokens.expiresAt instanceof Date) {
      expiresAt = tokens.expiresAt;
    } else if (typeof tokens.expiresAt === 'string') {
      expiresAt = new Date(tokens.expiresAt);
    } else {
      // Default to expired if no expiration info
      expiresAt = new Date(0);
    }

    return {
      accessToken: tokens.accessToken || '',
      refreshToken: tokens.refreshToken || '',
      expiresAt,
      scopes: tokens.scopes,
    };
  }

  /**
   * Get tokens from connector config
   */
  static async getTokensFromConnector(connectorId: string): Promise<StoredCredentials | null> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('connector_configs')
      .select('credentials')
      .eq('id', connectorId)
      .single();

    if (error || !data) {
      console.error(`[TokenManager] Failed to get connector credentials:`, error);
      return null;
    }

    return data.credentials as StoredCredentials;
  }

  /**
   * Calculate time until token expires in milliseconds
   */
  static getTimeUntilExpiration(expiresAt: Date): number {
    return Math.max(0, expiresAt.getTime() - Date.now());
  }

  /**
   * Format expiration time for logging
   */
  static formatExpirationTime(expiresAt: Date): string {
    const msUntilExpiry = this.getTimeUntilExpiration(expiresAt);

    if (msUntilExpiry <= 0) {
      return 'expired';
    }

    const minutes = Math.floor(msUntilExpiry / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  }
}

// =====================================================
// PROVIDER-SPECIFIC REFRESH FUNCTIONS
// =====================================================

/**
 * Create a refresh function for Google OAuth
 */
export function createGoogleRefreshFunction(
  clientId: string,
  clientSecret: string
): RefreshFunction {
  return async (refreshToken: string): Promise<TokenSet> => {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google token refresh failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope?.split(' '),
    };
  };
}

/**
 * Create a refresh function for Microsoft OAuth (SharePoint/OneDrive)
 */
export function createMicrosoftRefreshFunction(
  clientId: string,
  clientSecret: string,
  tenantId: string = 'common'
): RefreshFunction {
  return async (refreshToken: string): Promise<TokenSet> => {
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
        scope: 'https://graph.microsoft.com/.default offline_access',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Microsoft token refresh failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: data.scope?.split(' '),
    };
  };
}

/**
 * Create a refresh function for Notion OAuth
 */
export function createNotionRefreshFunction(
  clientId: string,
  clientSecret: string
): RefreshFunction {
  return async (refreshToken: string): Promise<TokenSet> => {
    // Notion doesn't support refresh tokens in the standard way
    // Their tokens are long-lived. This is a placeholder for consistency.
    throw new Error('Notion tokens do not support refresh. User must re-authorize.');
  };
}

// =====================================================
// HELPER EXPORTS
// =====================================================

export default TokenManager;
