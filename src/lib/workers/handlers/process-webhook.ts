/**
 * Process Webhook Handler
 *
 * Handles asynchronous processing of webhook events from connectors.
 * Routes webhook events to appropriate connector handlers for processing.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { ConnectorRegistry } from '@/lib/connectors/registry';
import { ConnectorType, type WebhookEvent as BaseWebhookEvent } from '@/lib/connectors/base';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'process-webhook' });

type Job = Database['public']['Tables']['jobs']['Row'];

interface ProcessWebhookPayload {
  webhookEventId: string;
  connectorId: string;
  orgId: string;
  webhookEvent?: any; // Webhook event data when webhook_events table doesn't exist yet
}

/**
 * Process webhook event
 */
export async function processWebhook(job: Job): Promise<void> {
  const payload = job.payload as unknown as ProcessWebhookPayload;
  const { webhookEventId, connectorId, orgId } = payload;

  logger.info('Starting webhook processing', {
    context: { webhookEventId, connectorId, orgId },
  });

  const supabase = createAdminClient();

  try {
    // TODO: Fetch webhook event from webhook_events table (to be created in Phase 5 migration)
    // For now, extract webhook data from job payload
    const webhookEventData = (job.payload as any).webhookEvent;

    if (!webhookEventData) {
      throw new Error('Webhook event data not found in job payload');
    }

    logger.info('Processing webhook event', {
      context: { webhookEventId, eventType: webhookEventData.event_type },
    });

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
      logger.info('Connector inactive, skipping processing', {
        context: { connectorId, webhookEventId },
      });

      // Mark as processed but note it was skipped
      await supabase
        .from('webhook_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          processing_error: 'Connector is inactive',
        })
        .eq('id', webhookEventId);

      return;
    }

    // Check if connector supports webhooks
    const connectorType = connectorConfig.connector_type as ConnectorType;
    const supportsWebhooks = ConnectorRegistry.supportsWebhooks(connectorType);

    if (!supportsWebhooks) {
      logger.warn('Connector does not support webhooks', {
        context: { connectorType, webhookEventId },
      });

      await supabase
        .from('webhook_events')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          processing_error: 'Connector does not support webhooks',
        })
        .eq('id', webhookEventId);

      return;
    }

    logger.info('Processing webhook from source', {
      context: {
        webhookEventId,
        eventType: webhookEventData.event_type,
        eventSource: webhookEventData.event_source || 'unknown',
      },
    });

    // Create connector instance
    const credentials = connectorConfig.credentials as any;
    const settings = connectorConfig.settings as any;

    const connector = ConnectorRegistry.create(connectorType, credentials, settings);

    // Check if connector has webhook handler
    if (!connector.handleWebhook) {
      throw new Error(`Connector ${connectorType} does not implement handleWebhook`);
    }

    // Transform webhook event to connector format
    const connectorWebhookEvent: BaseWebhookEvent = {
      id: webhookEventData.event_id || webhookEventId,
      type: webhookEventData.event_type,
      source: webhookEventData.event_source || 'webhook',
      payload: webhookEventData.payload || webhookEventData,
      timestamp: new Date(webhookEventData.received_at || Date.now()),
    };

    // Call connector's webhook handler
    await connector.handleWebhook(connectorWebhookEvent);

    logger.info('Successfully processed webhook', {
      context: { webhookEventId, connectorId },
    });

    // TODO: Mark webhook as processed in webhook_events table (to be created in Phase 5)
    // await supabase.from('webhook_events').update({ processed: true, ... }).eq('id', webhookEventId);

    // Handle specific webhook event types
    await handleWebhookEventType(
      webhookEventData.event_type,
      webhookEventData.payload || webhookEventData,
      connectorId,
      orgId,
      supabase
    );

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'webhook.processed',
      payload: {
        webhookEventId,
        connectorId,
        orgId,
        eventType: webhookEventData.event_type,
        eventSource: webhookEventData.event_source || 'webhook',
      },
    });
  } catch (error) {
    logger.error('Webhook processing failed', {
      context: { webhookEventId, connectorId, orgId },
      error: error as Error,
    });

    throw error;
  }
}

/**
 * Handle specific webhook event types
 */
async function handleWebhookEventType(
  eventType: string,
  payload: any,
  connectorId: string,
  orgId: string,
  supabase: ReturnType<typeof createAdminClient>
): Promise<void> {
  // Handle file/document change events
  if (
    eventType.includes('file.created') ||
    eventType.includes('file.updated') ||
    eventType.includes('document.created') ||
    eventType.includes('document.updated')
  ) {
    logger.info('Handling file/document change event', {
      context: { eventType, connectorId, orgId },
    });

    // Enqueue a targeted sync job for this specific file/document
    const fileId = payload?.fileId || payload?.documentId || payload?.id;

    if (fileId) {
      // Check if imported document already exists
      const { data: existingDoc } = await supabase
        .from('imported_documents')
        .select('id')
        .eq('connector_id', connectorId)
        .eq('external_id', fileId)
        .maybeSingle();

      if (existingDoc) {
        // Document exists, enqueue processing job to update it
        await supabase.from('jobs').insert({
          type: 'process_imported_doc',
          status: 'pending',
          payload: {
            documentId: existingDoc.id,
            connectorId,
            orgId,
          },
          dedupe_key: `process_imported_doc:${existingDoc.id}:${Date.now()}`,
        });

        logger.info('Enqueued update job for document', {
          context: { documentId: existingDoc.id, fileId },
        });
      } else {
        // New document, trigger sync to import it
        await supabase.from('jobs').insert({
          type: 'sync_connector',
          status: 'pending',
          payload: {
            connectorId,
            orgId,
            syncType: 'webhook',
            fullSync: false,
          },
          dedupe_key: `sync_connector:${connectorId}:webhook:${Date.now()}`,
        });

        logger.info('Enqueued sync job for new document', {
          context: { fileId, connectorId },
        });
      }
    }
  }

  // Handle file/document deletion events
  else if (
    eventType.includes('file.deleted') ||
    eventType.includes('document.deleted')
  ) {
    logger.info('Handling file/document deletion', {
      context: { eventType, connectorId },
    });

    const fileId = payload?.fileId || payload?.documentId || payload?.id;

    if (fileId) {
      // Mark imported document as deleted
      await supabase
        .from('imported_documents')
        .update({
          is_deleted: true,
          updated_at: new Date().toISOString(),
        })
        .eq('connector_id', connectorId)
        .eq('external_id', fileId);

      // Optionally delete chunks to free up storage
      const { data: doc } = await supabase
        .from('imported_documents')
        .select('id')
        .eq('connector_id', connectorId)
        .eq('external_id', fileId)
        .maybeSingle();

      if (doc) {
        await supabase
          .from('imported_doc_chunks')
          .delete()
          .eq('imported_document_id', doc.id);

        logger.info('Deleted chunks for document', {
          context: { documentId: doc.id, fileId },
        });
      }
    }
  }

  // Handle permission change events
  else if (eventType.includes('permissions.changed')) {
    logger.info('Handling permissions change', {
      context: { eventType, connectorId },
    });

    // Enqueue sync job to re-check accessible documents
    await supabase.from('jobs').insert({
      type: 'sync_connector',
      status: 'pending',
      payload: {
        connectorId,
        orgId,
        syncType: 'webhook',
        fullSync: true, // Full sync to check all permissions
      },
      dedupe_key: `sync_connector:${connectorId}:permissions:${Date.now()}`,
    });
  }

  // Other event types can be handled here as needed
  else {
    logger.info('No special handling required for event type', {
      context: { eventType },
    });
  }
}
