/**
 * Connector Sync Handler
 *
 * Handles connector sync jobs by calling the appropriate connector's sync method
 * and updating the database with sync results.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database, Json } from '@/lib/types/database';
import { ConnectorRegistry } from '@/lib/connectors/registry';
import {
  ConnectorType,
  type ConnectorCredentials,
  type SyncOptions,
} from '@/lib/connectors/base';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'sync-connector' });

type Job = Database['public']['Tables']['jobs']['Row'];

interface SyncConnectorPayload {
  connectorId: string;
  orgId: string;
  syncType?: 'manual' | 'scheduled' | 'webhook';
  fullSync?: boolean;
  since?: string; // ISO date string
  limit?: number;
}

function jsonObject(value: Json | null | unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : undefined;
}

/**
 * Handle connector sync job
 */
export async function syncConnector(job: Job): Promise<void> {
  const payload = job.payload as unknown as SyncConnectorPayload;
  const {
    connectorId,
    orgId,
    syncType = 'scheduled',
    fullSync,
    since,
    limit,
  } = payload;

  logger.info('Starting connector sync', {
    context: { connectorId, orgId, syncType },
  });

  const supabase = createAdminClient();
  const syncStartTime = Date.now();

  try {
    // Fetch connector configuration
    const { data: connectorConfig, error: configError } = await supabase
      .from('connector_configs')
      .select('*')
      .eq('id', connectorId)
      .eq('org_id', orgId)
      .single();

    if (configError || !connectorConfig) {
      throw new Error(
        `Connector config not found: ${configError?.message || 'Not found'}`,
      );
    }

    // Check if connector is active
    if (!connectorConfig.is_active) {
      logger.info('Connector inactive, skipping sync', {
        context: { connectorId },
      });
      return;
    }

    // Update connector status to syncing
    await supabase
      .from('connector_configs')
      .update({
        sync_status: 'syncing',
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectorId);

    // Create connector instance
    const connectorType = connectorConfig.connector_type as ConnectorType;
    const credentials = jsonObject(
      connectorConfig.credentials,
    ) as ConnectorCredentials;
    const connectorSettings = jsonObject(connectorConfig.settings);
    const settings = {
      ...connectorSettings,
      orgId,
      connectorId,
    };

    logger.info('Creating connector instance', {
      context: { connectorType, connectorId },
    });

    const connector = ConnectorRegistry.create(
      connectorType,
      credentials,
      settings,
    );

    // Test connection first
    const testResult = await connector.testConnection();
    if (!testResult.success) {
      throw new Error(`Connection test failed: ${testResult.message}`);
    }

    logger.info('Connection test passed, starting sync', {
      context: { connectorId },
    });

    // Build sync options
    const syncOptions: SyncOptions = {
      fullSync,
      since: since ? new Date(since) : undefined,
      limit,
      fileTypes: stringArray(connectorSettings.fileTypes),
      paths: stringArray(connectorSettings.paths),
      filters: jsonObject(connectorSettings.filters),
    };

    // Execute sync
    const syncResult = await connector.sync(syncOptions);

    logger.info('Sync completed', {
      context: { connectorId },
      data: {
        filesProcessed: syncResult.filesProcessed,
        filesUpdated: syncResult.filesUpdated,
        filesFailed: syncResult.filesFailed,
      },
    });

    // Update connector with last sync timestamp
    await supabase
      .from('connector_configs')
      .update({
        sync_status: 'idle',
        last_sync_at: new Date().toISOString(),
        sync_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectorId);

    // Log sync results (connector_sync_logs table will be created in Phase 5 migration)
    const syncDuration = Date.now() - syncStartTime;
    logger.info('Sync stats', {
      context: { connectorId },
      data: {
        durationMs: syncDuration,
        status: syncResult.success ? 'success' : 'partial',
      },
    });

    // TODO: Once connector_sync_logs table is created, insert sync log here
    // await supabase.from('connector_sync_logs').insert({ ... });

    // Enqueue processing jobs for newly imported documents
    // Check for documents that need processing
    const { data: pendingDocs, error: docsError } = await supabase
      .from('imported_documents')
      .select('id')
      .eq('connector_id', connectorId)
      .eq('sync_status', 'pending')
      .limit(100);

    if (!docsError && pendingDocs && pendingDocs.length > 0) {
      logger.info('Enqueuing document processing jobs', {
        context: { connectorId },
        data: { count: pendingDocs.length },
      });

      // Enqueue process_imported_doc jobs for each pending document
      const jobInserts = pendingDocs.map((doc) => ({
        type: 'process_imported_doc' as const,
        status: 'pending' as const,
        payload: {
          documentId: doc.id,
          connectorId,
          orgId,
        },
        dedupe_key: `process_imported_doc:${doc.id}`,
      }));

      // Insert jobs in batches of 50
      const batchSize = 50;
      await Promise.all(
        Array.from(
          {
            length: Math.max(0, Math.ceil((jobInserts.length - 0) / batchSize)),
          },
          (_, __loopIndex) => 0 + __loopIndex * batchSize,
        ).map(async (i) => {
          const batch = jobInserts.slice(i, i + batchSize);
          await supabase.from('jobs').insert(batch);
        }),
      );

      logger.info('Processing jobs enqueued', {
        context: { connectorId },
        data: { count: pendingDocs.length },
      });
    }

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'connector.synced',
      payload: {
        connectorId,
        orgId,
        syncType,
        filesProcessed: syncResult.filesProcessed,
        filesUpdated: syncResult.filesUpdated,
        filesFailed: syncResult.filesFailed,
        durationMs: syncDuration,
      },
    });

    logger.info('Sync job completed', {
      context: { connectorId },
    });
  } catch (error) {
    logger.error('Sync job failed', {
      context: { connectorId, orgId },
      error: error as Error,
    });

    // Update connector status to error
    await supabase
      .from('connector_configs')
      .update({
        sync_status: 'error',
        sync_error:
          error instanceof Error ? error.message : 'Unknown sync error',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectorId);

    // Log sync failure
    const syncDuration = Date.now() - syncStartTime;
    logger.error('Sync failed', {
      context: { connectorId },
      data: {
        durationMs: syncDuration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      },
    });

    // TODO: Once connector_sync_logs table is created, insert failed sync log here
    // await supabase.from('connector_sync_logs').insert({ ... });

    throw error;
  }
}
