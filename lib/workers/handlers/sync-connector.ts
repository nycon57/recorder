/**
 * Connector Sync Handler
 *
 * Handles connector sync jobs by calling the appropriate connector's sync method
 * and updating the database with sync results.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { ConnectorRegistry } from '@/lib/connectors/registry';
import { ConnectorType, type SyncOptions } from '@/lib/connectors/base';

type Job = Database['public']['Tables']['jobs']['Row'];

interface SyncConnectorPayload {
  connectorId: string;
  orgId: string;
  syncType?: 'manual' | 'scheduled' | 'webhook';
  fullSync?: boolean;
  since?: string; // ISO date string
  limit?: number;
}

/**
 * Handle connector sync job
 */
export async function syncConnector(job: Job): Promise<void> {
  const payload = job.payload as unknown as SyncConnectorPayload;
  const { connectorId, orgId, syncType = 'scheduled', fullSync, since, limit } = payload;

  console.log(`[Sync-Connector] Starting sync for connector ${connectorId} (${syncType})`);

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
      throw new Error(`Connector config not found: ${configError?.message || 'Not found'}`);
    }

    // Check if connector is active
    if (!connectorConfig.is_active) {
      console.log(`[Sync-Connector] Connector ${connectorId} is inactive, skipping sync`);
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
    const credentials = connectorConfig.credentials as any;
    const settings = connectorConfig.settings as any;

    console.log(`[Sync-Connector] Creating ${connectorType} connector instance`);

    const connector = ConnectorRegistry.create(connectorType, credentials, settings);

    // Test connection first
    const testResult = await connector.testConnection();
    if (!testResult.success) {
      throw new Error(`Connection test failed: ${testResult.message}`);
    }

    console.log(`[Sync-Connector] Connection test passed, starting sync`);

    // Build sync options
    const syncOptions: SyncOptions = {
      fullSync,
      since: since ? new Date(since) : undefined,
      limit,
      fileTypes: settings?.fileTypes,
      paths: settings?.paths,
      filters: settings?.filters,
    };

    // Execute sync
    const syncResult = await connector.sync(syncOptions);

    console.log(
      `[Sync-Connector] Sync completed: ${syncResult.filesProcessed} processed, ${syncResult.filesUpdated} updated, ${syncResult.filesFailed} failed`
    );

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
    console.log(
      `[Sync-Connector] Sync stats - Duration: ${syncDuration}ms, Status: ${syncResult.success ? 'success' : 'partial'}`
    );

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
      console.log(
        `[Sync-Connector] Enqueuing ${pendingDocs.length} document processing jobs`
      );

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
      for (let i = 0; i < jobInserts.length; i += batchSize) {
        const batch = jobInserts.slice(i, i + batchSize);
        await supabase.from('jobs').insert(batch);
      }

      console.log(
        `[Sync-Connector] Enqueued ${pendingDocs.length} processing jobs for connector ${connectorId}`
      );
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

    console.log(`[Sync-Connector] Sync job completed for connector ${connectorId}`);
  } catch (error) {
    console.error(`[Sync-Connector] Error:`, error);

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
    console.log(
      `[Sync-Connector] Sync failed - Duration: ${syncDuration}ms, Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );

    // TODO: Once connector_sync_logs table is created, insert failed sync log here
    // await supabase.from('connector_sync_logs').insert({ ... });

    throw error;
  }
}
