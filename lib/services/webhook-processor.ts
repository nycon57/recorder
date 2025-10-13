/**
 * Webhook Processor Service
 *
 * Webhook event processor for all connector types.
 * Handles webhook verification, event routing, and processing.
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { ConnectorRegistry } from '@/lib/connectors/registry';
import { ConnectorType, WebhookEvent } from '@/lib/connectors/base';
import { createHmac, randomBytes } from 'crypto';

export interface WebhookPayload {
  connectorId: string;
  eventType: string;
  eventSource: string;
  eventId?: string;
  payload: any;
  headers?: Record<string, string>;
  signature?: string;
}

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
}

export interface WebhookProcessingResult {
  success: boolean;
  eventId?: string;
  processed: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

/**
 * Webhook Processor - Main webhook handling service
 */
export class WebhookProcessor {
  /**
   * Process incoming webhook
   */
  static async processWebhook(
    payload: WebhookPayload
  ): Promise<WebhookProcessingResult> {
    const { connectorId, eventType, eventSource, eventId, payload: eventPayload, headers } = payload;

    try {
      // Get connector configuration
      const { data: config, error: configError } = await supabaseAdmin
        .from('connector_configs')
        .select('*')
        .eq('id', connectorId)
        .single();

      if (configError || !config) {
        return {
          success: false,
          processed: false,
          error: 'Connector not found',
        };
      }

      // Verify webhook signature if secret is configured
      if (config.webhook_secret && payload.signature) {
        const verification = this.verifySignature(
          eventPayload,
          payload.signature,
          config.webhook_secret
        );

        if (!verification.valid) {
          return {
            success: false,
            processed: false,
            error: verification.error || 'Signature verification failed',
          };
        }
      }

      // Create webhook event record
      const webhookEventId = await this.createWebhookEvent({
        connectorId,
        orgId: config.org_id,
        eventType,
        eventSource,
        eventId,
        payload: eventPayload,
        headers,
      });

      // Route to appropriate connector handler
      const processingResult = await this.routeWebhookToConnector(
        config.connector_type as ConnectorType,
        config,
        eventPayload
      );

      // Update webhook event record
      await this.updateWebhookEvent(webhookEventId, processingResult.success);

      // If webhook indicates file changes, trigger sync
      if (processingResult.success && this.shouldTriggerSync(eventType)) {
        await this.triggerConnectorSync(connectorId, config.org_id);
      }

      return {
        success: true,
        eventId: webhookEventId,
        processed: processingResult.success,
        metadata: processingResult.metadata,
      };
    } catch (error) {
      return {
        success: false,
        processed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify webhook signature
   */
  static verifySignature(
    payload: any,
    signature: string,
    secret: string
  ): WebhookVerificationResult {
    try {
      // Google Drive uses HMAC SHA256
      const expectedSignature = createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expectedSignature) {
        // Try with different signature formats
        const signatureVariants = [
          signature,
          signature.replace('sha256=', ''),
          signature.replace('sha1=', ''),
        ];

        const isValid = signatureVariants.some((sig) => {
          const computed = createHmac('sha256', secret)
            .update(JSON.stringify(payload))
            .digest('hex');
          return sig === computed || sig === `sha256=${computed}`;
        });

        if (!isValid) {
          return {
            valid: false,
            error: 'Invalid signature',
          };
        }
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Signature verification failed',
      };
    }
  }

  /**
   * Verify Google Drive webhook
   */
  static verifyGoogleDriveWebhook(
    channelId: string,
    resourceState: string,
    token?: string
  ): WebhookVerificationResult {
    // Google Drive sends resource state changes
    const validStates = ['sync', 'add', 'update', 'remove', 'trash'];

    if (!validStates.includes(resourceState)) {
      return {
        valid: false,
        error: `Invalid resource state: ${resourceState}`,
      };
    }

    // If token is provided, verify it matches
    if (token) {
      // Token verification logic here
      // This should match the token stored during channel creation
    }

    return { valid: true };
  }

  /**
   * Verify Zoom webhook
   */
  static verifyZoomWebhook(
    payload: any,
    signature: string,
    secret: string
  ): WebhookVerificationResult {
    try {
      // Zoom uses SHA256 HMAC
      const message = `v0:${payload.event_ts}:${JSON.stringify(payload)}`;
      const expectedSignature = createHmac('sha256', secret)
        .update(message)
        .digest('hex');

      const computedSignature = `v0=${expectedSignature}`;

      if (signature !== computedSignature) {
        return {
          valid: false,
          error: 'Invalid Zoom signature',
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Zoom signature verification failed',
      };
    }
  }

  /**
   * Verify Microsoft Teams webhook
   */
  static verifyTeamsWebhook(
    payload: any,
    signature: string,
    secret: string
  ): WebhookVerificationResult {
    try {
      // Teams uses HMAC SHA256
      const expectedSignature = createHmac('sha256', secret)
        .update(JSON.stringify(payload))
        .digest('base64');

      if (signature !== expectedSignature) {
        return {
          valid: false,
          error: 'Invalid Teams signature',
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Teams signature verification failed',
      };
    }
  }

  /**
   * Route webhook to connector handler
   */
  private static async routeWebhookToConnector(
    connectorType: ConnectorType,
    config: any,
    payload: any
  ): Promise<{ success: boolean; metadata?: Record<string, any> }> {
    try {
      // Create connector instance
      const connector = ConnectorRegistry.create(
        connectorType,
        config.credentials,
        config.settings
      );

      // Check if connector has webhook handler
      if (!connector.handleWebhook) {
        return {
          success: false,
          metadata: { reason: 'Connector does not support webhooks' },
        };
      }

      // Create webhook event object
      const webhookEvent: WebhookEvent = {
        id: randomBytes(16).toString('hex'),
        type: payload.event_type || payload.type || 'unknown',
        source: connectorType,
        payload,
        timestamp: new Date(),
      };

      // Handle webhook
      await connector.handleWebhook(webhookEvent);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Create webhook event record
   */
  private static async createWebhookEvent(event: {
    connectorId: string;
    orgId: string;
    eventType: string;
    eventSource: string;
    eventId?: string;
    payload: any;
    headers?: Record<string, string>;
  }): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('webhook_events')
      .insert({
        connector_id: event.connectorId,
        org_id: event.orgId,
        event_type: event.eventType,
        event_source: event.eventSource,
        event_id: event.eventId,
        payload: event.payload,
        headers: event.headers,
        processed: false,
        retry_count: 0,
        received_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create webhook event: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update webhook event record
   */
  private static async updateWebhookEvent(
    eventId: string,
    success: boolean,
    error?: string
  ): Promise<void> {
    await supabaseAdmin
      .from('webhook_events')
      .update({
        processed: success,
        processed_at: new Date().toISOString(),
        processing_error: error,
      })
      .eq('id', eventId);
  }

  /**
   * Check if event should trigger sync
   */
  private static shouldTriggerSync(eventType: string): boolean {
    const syncTriggerEvents = [
      'file.created',
      'file.updated',
      'file.deleted',
      'file.moved',
      'page.created',
      'page.updated',
      'recording.completed',
      'channel.created',
      'message.created',
      'add',
      'update',
      'remove',
      'change',
    ];

    return syncTriggerEvents.some((trigger) =>
      eventType.toLowerCase().includes(trigger.toLowerCase())
    );
  }

  /**
   * Trigger connector sync
   */
  private static async triggerConnectorSync(
    connectorId: string,
    orgId: string
  ): Promise<void> {
    try {
      // Create sync job
      await supabaseAdmin.from('jobs').insert({
        type: 'sync_connector',
        status: 'pending',
        payload: {
          connectorId,
          orgId,
          syncType: 'webhook',
        },
        org_id: orgId,
      });
    } catch (error) {
      console.error('[WebhookProcessor] Failed to trigger sync:', error);
    }
  }

  /**
   * Process failed webhook events (retry mechanism)
   */
  static async processFailedWebhooks(
    options?: {
      maxRetries?: number;
      batchSize?: number;
    }
  ): Promise<{ processed: number; failed: number }> {
    const maxRetries = options?.maxRetries || 3;
    const batchSize = options?.batchSize || 10;

    try {
      // Get failed webhook events
      const { data: events, error } = await supabaseAdmin
        .from('webhook_events')
        .select('*')
        .eq('processed', false)
        .lt('retry_count', maxRetries)
        .order('received_at', { ascending: true })
        .limit(batchSize);

      if (error || !events || events.length === 0) {
        return { processed: 0, failed: 0 };
      }

      let processed = 0;
      let failed = 0;

      for (const event of events) {
        try {
          const result = await this.processWebhook({
            connectorId: event.connector_id,
            eventType: event.event_type,
            eventSource: event.event_source,
            eventId: event.event_id,
            payload: event.payload,
            headers: event.headers,
          });

          if (result.success) {
            processed++;
          } else {
            // Increment retry count
            await supabaseAdmin
              .from('webhook_events')
              .update({
                retry_count: event.retry_count + 1,
                processing_error: result.error,
              })
              .eq('id', event.id);
            failed++;
          }
        } catch (error) {
          failed++;
          console.error(`[WebhookProcessor] Failed to process event ${event.id}:`, error);
        }
      }

      return { processed, failed };
    } catch (error) {
      console.error('[WebhookProcessor] Error processing failed webhooks:', error);
      return { processed: 0, failed: 0 };
    }
  }

  /**
   * Get webhook statistics
   */
  static async getWebhookStats(
    connectorId: string
  ): Promise<{
    totalEvents: number;
    processedEvents: number;
    failedEvents: number;
    recentEvents: number;
  }> {
    try {
      const { data: allEvents } = await supabaseAdmin
        .from('webhook_events')
        .select('id', { count: 'exact', head: true })
        .eq('connector_id', connectorId);

      const { data: processedEvents } = await supabaseAdmin
        .from('webhook_events')
        .select('id', { count: 'exact', head: true })
        .eq('connector_id', connectorId)
        .eq('processed', true);

      const { data: failedEvents } = await supabaseAdmin
        .from('webhook_events')
        .select('id', { count: 'exact', head: true })
        .eq('connector_id', connectorId)
        .eq('processed', false);

      // Get events from last 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentEvents } = await supabaseAdmin
        .from('webhook_events')
        .select('id', { count: 'exact', head: true })
        .eq('connector_id', connectorId)
        .gte('received_at', yesterday);

      return {
        totalEvents: allEvents?.length || 0,
        processedEvents: processedEvents?.length || 0,
        failedEvents: failedEvents?.length || 0,
        recentEvents: recentEvents?.length || 0,
      };
    } catch (error) {
      console.error('[WebhookProcessor] Failed to get webhook stats:', error);
      return {
        totalEvents: 0,
        processedEvents: 0,
        failedEvents: 0,
        recentEvents: 0,
      };
    }
  }

  /**
   * Clean up old webhook events
   */
  static async cleanupOldEvents(daysToKeep = 30): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabaseAdmin
        .from('webhook_events')
        .delete()
        .eq('processed', true)
        .lt('received_at', cutoffDate)
        .select('id');

      if (error) {
        throw new Error(`Failed to cleanup old events: ${error.message}`);
      }

      return data?.length || 0;
    } catch (error) {
      console.error('[WebhookProcessor] Failed to cleanup old events:', error);
      return 0;
    }
  }

  /**
   * Generate webhook secret
   */
  static generateWebhookSecret(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Get webhook URL for connector
   */
  static getWebhookUrl(connectorId: string, baseUrl: string): string {
    return `${baseUrl}/api/webhooks/${connectorId}`;
  }
}
