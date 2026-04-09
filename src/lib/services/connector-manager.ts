/**
 * Connector Manager Service
 *
 * Orchestration layer for managing connectors, sync operations, and credential management.
 * Provides high-level API for connector operations across all connector types.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { ConnectorRegistry } from '@/lib/connectors/registry';
import {
  Connector,
  ConnectorType,
  ConnectorCredentials,
  SyncOptions,
  SyncResult,
  ConnectorFile,
} from '@/lib/connectors/base';
import type { ConnectorConfig } from '@/lib/types/connectors';

export interface CreateConnectorOptions {
  orgId: string;
  connectorType: ConnectorType;
  name?: string;
  credentials: ConnectorCredentials;
  settings?: Record<string, any>;
  syncFrequency?: 'manual' | 'hourly' | 'daily' | 'weekly';
  createdBy?: string;
}

export interface UpdateConnectorOptions {
  name?: string;
  credentials?: ConnectorCredentials;
  settings?: Record<string, any>;
  syncFrequency?: 'manual' | 'hourly' | 'daily' | 'weekly';
  isActive?: boolean;
}

export interface SyncConnectorOptions extends SyncOptions {
  connectorId: string;
  syncType?: 'manual' | 'scheduled' | 'webhook';
}

export interface ConnectorStats {
  totalConnectors: number;
  activeConnectors: number;
  syncingConnectors: number;
  errorConnectors: number;
  lastSyncAt?: Date;
  documentCount: number;
}

/**
 * Connector Manager - Main orchestration service
 */
export class ConnectorManager {
  /**
   * Create new connector configuration
   */
  static async createConnector(
    options: CreateConnectorOptions
  ): Promise<{ success: boolean; connectorId?: string; error?: string }> {
    try {
      const {
        orgId,
        connectorType,
        name,
        credentials,
        settings = {},
        syncFrequency = 'manual',
        createdBy,
      } = options;

      // Create connector instance to validate credentials
      const connector = ConnectorRegistry.create(connectorType, credentials);

      // Test authentication
      const authResult = await connector.authenticate(credentials);
      if (!authResult.success) {
        return {
          success: false,
          error: authResult.error || 'Authentication failed',
        };
      }

      // Test connection
      const testResult = await connector.testConnection();
      if (!testResult.success) {
        return {
          success: false,
          error: testResult.message || 'Connection test failed',
        };
      }

      // Save connector configuration to database
      const { data, error } = await supabaseAdmin
        .from('connector_configs')
        .insert({
          org_id: orgId,
          connector_type: connectorType,
          name: name || connector.name,
          credentials,
          settings,
          sync_status: 'idle',
          is_active: true,
          created_by: createdBy,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to save connector: ${error.message}`);
      }

      return {
        success: true,
        connectorId: data.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update existing connector configuration
   */
  static async updateConnector(
    connectorId: string,
    options: UpdateConnectorOptions
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {};

      if (options.name) updateData.name = options.name;
      if (options.settings) updateData.settings = options.settings;
      if (options.isActive !== undefined) updateData.is_active = options.isActive;

      // If credentials are being updated, validate them first
      if (options.credentials) {
        const { data: config } = await supabaseAdmin
          .from('connector_configs')
          .select('connector_type')
          .eq('id', connectorId)
          .single();

        if (!config) {
          return { success: false, error: 'Connector not found' };
        }

        const connector = ConnectorRegistry.create(
          config.connector_type as ConnectorType,
          options.credentials
        );

        const authResult = await connector.authenticate(options.credentials);
        if (!authResult.success) {
          return {
            success: false,
            error: authResult.error || 'Credential validation failed',
          };
        }

        updateData.credentials = options.credentials;
        updateData.credentials_updated_at = new Date().toISOString();
      }

      updateData.updated_at = new Date().toISOString();

      const { error } = await supabaseAdmin
        .from('connector_configs')
        .update(updateData)
        .eq('id', connectorId);

      if (error) {
        throw new Error(`Failed to update connector: ${error.message}`);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete connector configuration
   */
  static async deleteConnector(
    connectorId: string,
    deleteDocuments = false
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // If deleteDocuments is true, delete all imported documents
      if (deleteDocuments) {
        await supabaseAdmin
          .from('imported_documents')
          .delete()
          .eq('connector_id', connectorId);
      }

      // Delete connector configuration
      const { error } = await supabaseAdmin
        .from('connector_configs')
        .delete()
        .eq('id', connectorId);

      if (error) {
        throw new Error(`Failed to delete connector: ${error.message}`);
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get connector by ID
   */
  static async getConnector(
    connectorId: string
  ): Promise<{ success: boolean; connector?: any; error?: string }> {
    try {
      const { data, error } = await supabaseAdmin
        .from('connector_configs')
        .select('*')
        .eq('id', connectorId)
        .single();

      if (error) {
        throw new Error(`Failed to get connector: ${error.message}`);
      }

      return { success: true, connector: data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List connectors for an organization
   */
  static async listConnectors(
    orgId: string,
    options?: {
      connectorType?: ConnectorType;
      isActive?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ success: boolean; connectors?: any[]; error?: string }> {
    try {
      let query = supabaseAdmin
        .from('connector_configs')
        .select('*')
        .eq('org_id', orgId);

      if (options?.connectorType) {
        query = query.eq('connector_type', options.connectorType);
      }

      if (options?.isActive !== undefined) {
        query = query.eq('is_active', options.isActive);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      if (options?.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to list connectors: ${error.message}`);
      }

      return { success: true, connectors: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Sync connector - fetch and process files
   */
  static async syncConnector(
    options: SyncConnectorOptions
  ): Promise<{ success: boolean; result?: SyncResult; error?: string }> {
    const { connectorId, syncType = 'manual', ...syncOptions } = options;
    const startTime = Date.now();

    try {
      // Get connector configuration
      const { data: config, error: configError } = await supabaseAdmin
        .from('connector_configs')
        .select('*')
        .eq('id', connectorId)
        .single();

      if (configError || !config) {
        throw new Error('Connector not found');
      }

      if (!config.is_active) {
        throw new Error('Connector is not active');
      }

      // Update sync status to 'syncing'
      await supabaseAdmin
        .from('connector_configs')
        .update({ sync_status: 'syncing' })
        .eq('id', connectorId);

      // Create connector instance
      const connector = ConnectorRegistry.create(
        config.connector_type as ConnectorType,
        config.credentials,
        config.settings
      );

      // Perform sync
      const syncResult = await connector.sync(syncOptions);

      // Update connector status
      await supabaseAdmin
        .from('connector_configs')
        .update({
          sync_status: syncResult.success ? 'idle' : 'error',
          sync_error: syncResult.success ? null : syncResult.errors[0]?.error,
          last_sync_at: new Date().toISOString(),
        })
        .eq('id', connectorId);

      // Log sync operation
      const durationMs = Date.now() - startTime;
      await this.logSync({
        connectorId,
        orgId: config.org_id,
        syncType,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        durationMs,
        status: syncResult.success ? 'success' : syncResult.filesFailed > 0 ? 'partial' : 'failed',
        documentsSynced: syncResult.filesProcessed,
        documentsUpdated: syncResult.filesUpdated,
        documentsFailed: syncResult.filesFailed,
        documentsDeleted: syncResult.filesDeleted,
        errorMessage: syncResult.errors[0]?.error,
      });

      return { success: true, result: syncResult };
    } catch (error) {
      // Update connector status to error
      await supabaseAdmin
        .from('connector_configs')
        .update({
          sync_status: 'error',
          sync_error: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', connectorId);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Test connector connection
   */
  static async testConnector(
    connectorId: string
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const { data: config } = await supabaseAdmin
        .from('connector_configs')
        .select('*')
        .eq('id', connectorId)
        .single();

      if (!config) {
        return { success: false, error: 'Connector not found' };
      }

      const connector = ConnectorRegistry.create(
        config.connector_type as ConnectorType,
        config.credentials,
        config.settings
      );

      const testResult = await connector.testConnection();

      return {
        success: testResult.success,
        message: testResult.message,
        error: testResult.success ? undefined : testResult.message,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * List files from connector
   */
  static async listFiles(
    connectorId: string,
    options?: {
      limit?: number;
      offset?: number;
      filters?: Record<string, any>;
    }
  ): Promise<{ success: boolean; files?: ConnectorFile[]; error?: string }> {
    try {
      const { data: config } = await supabaseAdmin
        .from('connector_configs')
        .select('*')
        .eq('id', connectorId)
        .single();

      if (!config) {
        return { success: false, error: 'Connector not found' };
      }

      const connector = ConnectorRegistry.create(
        config.connector_type as ConnectorType,
        config.credentials,
        config.settings
      );

      const files = await connector.listFiles(options);

      return { success: true, files };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get connector statistics
   */
  static async getStats(orgId: string): Promise<ConnectorStats> {
    try {
      const { data: connectors } = await supabaseAdmin
        .from('connector_configs')
        .select('sync_status, last_sync_at')
        .eq('org_id', orgId);

      const { data: documents } = await supabaseAdmin
        .from('imported_documents')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId);

      const totalConnectors = connectors?.length || 0;
      const activeConnectors =
        connectors?.filter((c) => c.sync_status !== 'error').length || 0;
      const syncingConnectors =
        connectors?.filter((c) => c.sync_status === 'syncing').length || 0;
      const errorConnectors =
        connectors?.filter((c) => c.sync_status === 'error').length || 0;

      const lastSyncDates = connectors
        ?.map((c) => c.last_sync_at)
        .filter((d): d is string => d !== null)
        .map((d) => new Date(d))
        .sort((a, b) => b.getTime() - a.getTime());

      const lastSyncAt = lastSyncDates?.[0];

      return {
        totalConnectors,
        activeConnectors,
        syncingConnectors,
        errorConnectors,
        lastSyncAt,
        documentCount: documents?.length || 0,
      };
    } catch (error) {
      console.error('[ConnectorManager] Error getting stats:', error);
      return {
        totalConnectors: 0,
        activeConnectors: 0,
        syncingConnectors: 0,
        errorConnectors: 0,
        documentCount: 0,
      };
    }
  }

  /**
   * Refresh connector credentials (for OAuth tokens)
   */
  static async refreshCredentials(
    connectorId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: config } = await supabaseAdmin
        .from('connector_configs')
        .select('*')
        .eq('id', connectorId)
        .single();

      if (!config) {
        return { success: false, error: 'Connector not found' };
      }

      const connector = ConnectorRegistry.create(
        config.connector_type as ConnectorType,
        config.credentials,
        config.settings
      );

      if (!connector.refreshCredentials) {
        return { success: false, error: 'Connector does not support credential refresh' };
      }

      const newCredentials = await connector.refreshCredentials(config.credentials);

      await supabaseAdmin
        .from('connector_configs')
        .update({
          credentials: newCredentials,
          credentials_updated_at: new Date().toISOString(),
        })
        .eq('id', connectorId);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Log sync operation
   */
  private static async logSync(log: {
    connectorId: string;
    orgId: string;
    syncType: 'manual' | 'scheduled' | 'webhook';
    startedAt: Date;
    completedAt: Date;
    durationMs: number;
    status: 'running' | 'success' | 'partial' | 'failed';
    documentsSynced: number;
    documentsUpdated: number;
    documentsFailed: number;
    documentsDeleted: number;
    errorMessage?: string;
  }): Promise<void> {
    try {
      await supabaseAdmin.from('connector_sync_logs').insert({
        connector_id: log.connectorId,
        org_id: log.orgId,
        sync_type: log.syncType,
        started_at: log.startedAt.toISOString(),
        completed_at: log.completedAt.toISOString(),
        duration_ms: log.durationMs,
        status: log.status,
        documents_synced: log.documentsSynced,
        documents_updated: log.documentsUpdated,
        documents_failed: log.documentsFailed,
        documents_deleted: log.documentsDeleted,
        error_message: log.errorMessage,
        metadata: {},
        api_calls_made: 0,
        bytes_transferred: 0,
      });
    } catch (error) {
      console.error('[ConnectorManager] Failed to log sync:', error);
    }
  }
}
