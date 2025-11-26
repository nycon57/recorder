/**
 * Document Publisher Service
 *
 * Orchestrates the publishing workflow for bidirectional sync.
 * Publishes documents to external systems (Google Drive, SharePoint, OneDrive)
 * and manages publication state, logs, and tracking.
 */

import { createHash } from 'crypto';

import { supabaseAdmin } from '@/lib/supabase/admin';
import { ConnectorRegistry } from '@/lib/connectors/registry';
import { ConnectorType } from '@/lib/connectors/base';

import {
  PublishOptions,
  PublishResult,
  PublishErrorCode,
  RETRYABLE_ERROR_CODES,
  PublishableConnector,
  BrandingConfig,
  DEFAULT_BRANDING_CONFIG,
  PublishedDocument,
  PublishedDocumentRow,
  PublishLogRow,
  mapPublishedDocumentRow,
  PublishDestination,
  PublishFormat,
  ConnectorPublishOptions,
} from '@/lib/types/publishing';

// =====================================================
// TYPES
// =====================================================

/** Document row from the documents table */
interface DocumentRow {
  id: string;
  content_id: string;
  content: string;
  format: string;
  created_at: string;
  updated_at: string;
}

/** Connector config row from the connector_configs table */
interface ConnectorConfigRow {
  id: string;
  org_id: string;
  connector_type: string;
  name: string;
  credentials: Record<string, unknown>;
  config: Record<string, unknown>;
  settings?: Record<string, unknown>;
  is_active: boolean;
  supports_publish?: boolean;
}

/** Content row from the content table */
interface ContentRow {
  id: string;
  title: string;
  org_id: string;
}

// =====================================================
// DOCUMENT PUBLISHER CLASS
// =====================================================

/**
 * Document Publisher Service
 *
 * Handles publishing documents to external systems like Google Drive,
 * SharePoint, and OneDrive. Manages publication state, logging, and
 * error handling.
 *
 * @example
 * ```typescript
 * const publisher = new DocumentPublisher();
 *
 * const result = await publisher.publish({
 *   contentId: 'content-uuid',
 *   documentId: 'document-uuid',
 *   orgId: 'org-uuid',
 *   userId: 'user-uuid',
 *   connectorId: 'connector-uuid',
 *   destination: 'google_drive',
 *   folderId: 'optional-folder-id',
 *   format: 'native',
 *   branding: {
 *     includeVideoLink: true,
 *     includePoweredByFooter: true,
 *   },
 * });
 *
 * if (result.success) {
 *   console.log('Published to:', result.externalUrl);
 * }
 * ```
 */
export class DocumentPublisher {
  /**
   * Publish a document to an external system.
   *
   * This method orchestrates the complete publishing workflow:
   * 1. Creates a pending log entry for tracking
   * 2. Fetches document content from the documents table
   * 3. Fetches connector config from the connector_configs table
   * 4. Prepares branding config (merges defaults with provided)
   * 5. Prepares document content (adds branding elements)
   * 6. Creates connector instance using ConnectorRegistry.create()
   * 7. Calls connector.publishDocument() (cast to PublishableConnector)
   * 8. Creates/updates publication record in published_documents
   * 9. Updates log entry with success
   * 10. Returns PublishResult
   *
   * @param options - Publishing options including content, connector, and branding settings
   * @returns Publishing result with success status, publication record, and external URL
   */
  async publish(options: PublishOptions): Promise<PublishResult> {
    const startTime = Date.now();
    let logId: string | null = null;
    let apiCallsMade = 0;
    let contentSizeBytes = 0;

    try {
      // Step 1: Create pending log entry
      logId = await this.createPendingLog(options);
      apiCallsMade++;

      // Step 2: Fetch document content from documents table
      const document = await this.getDocument(options.documentId);
      if (!document) {
        throw new PublishError('Document not found', 'NOT_FOUND');
      }
      apiCallsMade++;

      // Verify document belongs to content
      if (document.content_id !== options.contentId) {
        throw new PublishError(
          'Document does not belong to the specified content',
          'NOT_FOUND'
        );
      }

      // Step 3: Fetch content for title and org verification
      const content = await this.getContent(options.contentId);
      if (!content) {
        throw new PublishError('Content not found', 'NOT_FOUND');
      }
      if (content.org_id !== options.orgId) {
        throw new PublishError('Content does not belong to organization', 'PERMISSION_DENIED');
      }
      apiCallsMade++;

      // Step 4: Fetch connector config from connector_configs table
      const connectorConfig = await this.getConnectorConfig(options.connectorId);
      if (!connectorConfig) {
        throw new PublishError('Connector not found', 'NOT_FOUND');
      }
      if (connectorConfig.org_id !== options.orgId) {
        throw new PublishError('Connector does not belong to organization', 'PERMISSION_DENIED');
      }
      if (!connectorConfig.is_active) {
        throw new PublishError('Connector is not active', 'UNAUTHORIZED');
      }
      apiCallsMade++;

      // Step 5: Prepare branding config (merge defaults with provided)
      const brandingConfig: BrandingConfig = {
        ...DEFAULT_BRANDING_CONFIG,
        ...options.branding,
      };

      // Step 6: Prepare document content with branding elements
      const title = options.customTitle || content.title;
      const preparedContent = this.prepareContent(
        document.content,
        brandingConfig,
        options.contentId,
        title
      );
      contentSizeBytes = Buffer.byteLength(preparedContent, 'utf-8');

      // Step 7: Create connector instance using ConnectorRegistry.create()
      const connectorType = this.mapDestinationToConnectorType(options.destination);
      const connector = ConnectorRegistry.create(
        connectorType,
        connectorConfig.credentials,
        {
          ...connectorConfig.config,
          ...connectorConfig.settings,
          connectorId: options.connectorId,
        }
      );

      // Cast to PublishableConnector and verify it supports publishing
      const publishableConnector = connector as unknown as PublishableConnector;
      if (
        typeof publishableConnector.supportsPublish !== 'function' ||
        !publishableConnector.supportsPublish()
      ) {
        throw new PublishError(
          'Connector does not support publishing. Please re-authenticate with write permissions.',
          'PERMISSION_DENIED'
        );
      }

      // Step 8: Call connector.publishDocument()
      const format: PublishFormat = options.format || 'native';
      const publishOptions: ConnectorPublishOptions = {
        title,
        content: preparedContent,
        format,
        folderId: options.folderId,
        metadata: {
          contentId: options.contentId,
          documentId: options.documentId,
          orgId: options.orgId,
          publishedBy: options.userId,
          publishedAt: new Date().toISOString(),
        },
      };

      const publishResult = await publishableConnector.publishDocument(publishOptions);
      apiCallsMade++;

      // Step 9: Create/update publication record in published_documents
      const contentHash = this.generateContentHash(preparedContent);
      const publication = await this.upsertPublication({
        contentId: options.contentId,
        documentId: options.documentId,
        connectorId: options.connectorId,
        orgId: options.orgId,
        publishedBy: options.userId,
        destination: options.destination,
        externalId: publishResult.externalId,
        externalUrl: publishResult.externalUrl,
        externalPath: publishResult.externalPath,
        folderId: options.folderId,
        folderPath: options.folderPath,
        format,
        customTitle: options.customTitle,
        brandingConfig,
        contentHash,
      });
      apiCallsMade++;

      // Step 10: Update log entry with success
      const durationMs = Date.now() - startTime;
      await this.updateLog(logId, {
        status: 'success',
        publishedDocumentId: publication.id,
        durationMs,
        contentSizeBytes,
        apiCallsMade,
        resultMetadata: {
          externalId: publishResult.externalId,
          externalUrl: publishResult.externalUrl,
        },
      });

      // Update connector last_publish_at
      await supabaseAdmin
        .from('connector_configs')
        .update({ last_publish_at: new Date().toISOString() })
        .eq('id', options.connectorId);

      console.log(
        `[DocumentPublisher] Successfully published document ${options.documentId} to ${options.destination} in ${durationMs}ms`
      );

      return {
        success: true,
        publication,
        externalUrl: publishResult.externalUrl,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorCode = this.getErrorCode(error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      console.error(
        `[DocumentPublisher] Failed to publish document ${options.documentId}:`,
        errorMessage
      );

      // Update log with failure
      if (logId) {
        await this.updateLog(logId, {
          status: 'failed',
          errorMessage,
          errorCode,
          durationMs,
          contentSizeBytes,
          apiCallsMade,
        });
      }

      return {
        success: false,
        error: errorMessage,
        errorCode,
      };
    }
  }

  /**
   * Prepare document content with branding elements.
   *
   * Adds the following based on branding config:
   * - Video link at the top if branding.includeVideoLink is true
   * - Embedded video player iframe if branding.includeEmbeddedPlayer is true
   * - Footer if branding.includePoweredByFooter is true or customFooterText exists
   *
   * Uses environment variable NEXT_PUBLIC_APP_URL for URLs.
   *
   * @param markdown - Original markdown content
   * @param branding - Branding configuration
   * @param contentId - Content ID for generating URLs
   * @param title - Document title
   * @returns Prepared markdown content with branding
   */
  private prepareContent(
    markdown: string,
    branding: BrandingConfig,
    contentId: string,
    title: string
  ): string {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://tribora.app';
    const videoUrl = `${appUrl}/library/${contentId}`;
    const parts: string[] = [];

    // Add video link at top if branding.includeVideoLink is true
    if (branding.includeVideoLink) {
      parts.push(`> **Watch the original video:** [${title}](${videoUrl})\n`);
    }

    // Add embedded player iframe if branding.includeEmbeddedPlayer is true
    if (branding.includeEmbeddedPlayer) {
      const embedUrl = `${appUrl}/embed/${contentId}`;
      parts.push(
        `<iframe src="${embedUrl}" width="100%" height="400" frameborder="0" allowfullscreen></iframe>\n`
      );
    }

    // Add main content
    parts.push(markdown);

    // Add footer if branding.includePoweredByFooter is true or customFooterText exists
    if (branding.customFooterText) {
      parts.push(`\n---\n${branding.customFooterText}`);
    } else if (branding.includePoweredByFooter) {
      parts.push(
        `\n---\n*Generated with [Tribora](https://tribora.app) - Turn screen recordings into structured documentation*`
      );
    }

    return parts.join('\n');
  }

  /**
   * Map error to a PublishErrorCode.
   *
   * Maps different error types:
   * - 429 -> 'RATE_LIMITED'
   * - Timeout -> 'TIMEOUT'
   * - 503 -> 'SERVICE_UNAVAILABLE'
   * - 401 -> 'UNAUTHORIZED'
   * - 403 -> 'PERMISSION_DENIED'
   * - 404 -> 'NOT_FOUND'
   * - Default -> 'UNKNOWN_ERROR'
   *
   * @param error - Error object or unknown error
   * @returns Appropriate error code
   */
  private getErrorCode(error: unknown): PublishErrorCode {
    if (error instanceof PublishError) {
      return error.code;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      const statusMatch = message.match(/(\d{3})/);
      const status = statusMatch ? parseInt(statusMatch[1], 10) : 0;

      // Check HTTP status codes
      if (status === 429 || message.includes('rate limit') || message.includes('too many requests')) {
        return 'RATE_LIMITED';
      }
      if (status === 503 || message.includes('service unavailable') || message.includes('unavailable')) {
        return 'SERVICE_UNAVAILABLE';
      }
      if (status === 401 || message.includes('unauthorized') || message.includes('authentication')) {
        return 'UNAUTHORIZED';
      }
      if (status === 403 || message.includes('permission') || message.includes('forbidden') || message.includes('access denied')) {
        return 'PERMISSION_DENIED';
      }
      if (status === 404 || message.includes('not found')) {
        return 'NOT_FOUND';
      }
      if (message.includes('timeout') || message.includes('timed out')) {
        return 'TIMEOUT';
      }
      if (message.includes('quota') || message.includes('limit exceeded')) {
        return 'QUOTA_EXCEEDED';
      }
      if (message.includes('too large') || message.includes('size')) {
        return 'CONTENT_TOO_LARGE';
      }
      if (message.includes('invalid format') || message.includes('unsupported')) {
        return 'INVALID_FORMAT';
      }
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Check if an error is retryable.
   *
   * Checks RETRYABLE_ERROR_CODES from types.
   *
   * @param error - Error object or unknown error
   * @returns True if the error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    const errorCode = this.getErrorCode(error);
    return RETRYABLE_ERROR_CODES.includes(errorCode);
  }

  /**
   * Generate a SHA-256 hash of content for version tracking.
   *
   * Uses crypto.createHash('sha256').
   *
   * @param content - Content to hash
   * @returns Hex-encoded SHA-256 hash
   */
  private generateContentHash(content: string): string {
    return createHash('sha256').update(content, 'utf-8').digest('hex');
  }

  // =====================================================
  // DATABASE OPERATIONS
  // =====================================================

  /**
   * Create a pending log entry at start with status 'pending'.
   *
   * @param options - Publish options
   * @returns Log entry ID
   */
  private async createPendingLog(options: PublishOptions): Promise<string> {
    const logRow = {
      content_id: options.contentId,
      org_id: options.orgId,
      user_id: options.userId || null,
      action: 'publish',
      destination: options.destination,
      status: 'pending',
      trigger_type: options.triggerType || 'manual',
      api_calls_made: 0,
      request_metadata: {
        documentId: options.documentId,
        connectorId: options.connectorId,
        folderId: options.folderId,
        folderPath: options.folderPath,
        format: options.format,
        customTitle: options.customTitle,
        branding: options.branding,
      },
      result_metadata: {},
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin
      .from('publish_logs')
      .insert(logRow)
      .select('id')
      .single();

    if (error) {
      console.error('[DocumentPublisher] Failed to create log entry:', error);
      throw new Error(`Failed to create log entry: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update log entry to 'success' or 'failed' on completion.
   *
   * Tracks duration_ms, content_size_bytes, api_calls_made.
   *
   * @param logId - Log entry ID
   * @param updates - Fields to update
   */
  private async updateLog(
    logId: string,
    updates: {
      status: 'success' | 'failed';
      publishedDocumentId?: string;
      errorMessage?: string;
      errorCode?: string;
      durationMs?: number;
      contentSizeBytes?: number;
      apiCallsMade?: number;
      resultMetadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    const updateData: Partial<PublishLogRow> = {
      status: updates.status,
      completed_at: new Date().toISOString(),
    };

    if (updates.publishedDocumentId) {
      updateData.published_document_id = updates.publishedDocumentId;
    }
    if (updates.errorMessage) {
      updateData.error_message = updates.errorMessage;
    }
    if (updates.errorCode) {
      updateData.error_code = updates.errorCode;
    }
    if (updates.durationMs !== undefined) {
      updateData.duration_ms = updates.durationMs;
    }
    if (updates.contentSizeBytes !== undefined) {
      updateData.content_size_bytes = updates.contentSizeBytes;
    }
    if (updates.apiCallsMade !== undefined) {
      updateData.api_calls_made = updates.apiCallsMade;
    }
    if (updates.resultMetadata) {
      updateData.result_metadata = updates.resultMetadata;
    }

    const { error } = await supabaseAdmin
      .from('publish_logs')
      .update(updateData)
      .eq('id', logId);

    if (error) {
      console.error('[DocumentPublisher] Failed to update log entry:', error);
      // Don't throw - log failure shouldn't fail the publish
    }
  }

  /**
   * Get document by ID from documents table.
   *
   * @param documentId - Document ID
   * @returns Document row or null if not found
   */
  private async getDocument(documentId: string): Promise<DocumentRow | null> {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('id, content_id, content, format, created_at, updated_at')
      .eq('id', documentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch document: ${error.message}`);
    }

    return data as DocumentRow;
  }

  /**
   * Get content by ID for title.
   *
   * @param contentId - Content ID
   * @returns Content row or null if not found
   */
  private async getContent(contentId: string): Promise<ContentRow | null> {
    const { data, error } = await supabaseAdmin
      .from('content')
      .select('id, title, org_id')
      .eq('id', contentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch content: ${error.message}`);
    }

    return data as ContentRow;
  }

  /**
   * Get connector config by ID from connector_configs table.
   *
   * @param connectorId - Connector ID
   * @returns Connector config row or null if not found
   */
  private async getConnectorConfig(
    connectorId: string
  ): Promise<ConnectorConfigRow | null> {
    const { data, error } = await supabaseAdmin
      .from('connector_configs')
      .select('id, org_id, connector_type, name, credentials, config, settings, is_active, supports_publish')
      .eq('id', connectorId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Not found
      }
      throw new Error(`Failed to fetch connector config: ${error.message}`);
    }

    return data as ConnectorConfigRow;
  }

  /**
   * Create or update a publication record in published_documents.
   *
   * @param params - Publication parameters
   * @returns Published document record
   */
  private async upsertPublication(params: {
    contentId: string;
    documentId: string;
    connectorId: string;
    orgId: string;
    publishedBy?: string;
    destination: PublishDestination;
    externalId: string;
    externalUrl: string;
    externalPath?: string;
    folderId?: string;
    folderPath?: string;
    format: PublishFormat;
    customTitle?: string;
    brandingConfig: BrandingConfig;
    contentHash: string;
  }): Promise<PublishedDocument> {
    const now = new Date().toISOString();

    // Check for existing publication
    const { data: existing } = await supabaseAdmin
      .from('published_documents')
      .select('id, document_version')
      .eq('content_id', params.contentId)
      .eq('connector_id', params.connectorId)
      .eq('destination', params.destination)
      .is('deleted_at', null)
      .single();

    const publicationData: Partial<PublishedDocumentRow> = {
      content_id: params.contentId,
      document_id: params.documentId,
      connector_id: params.connectorId,
      org_id: params.orgId,
      published_by: params.publishedBy || null,
      destination: params.destination,
      external_id: params.externalId,
      external_url: params.externalUrl,
      external_path: params.externalPath || null,
      folder_id: params.folderId || null,
      folder_path: params.folderPath || null,
      format: params.format,
      custom_title: params.customTitle || null,
      branding_config: params.brandingConfig as unknown as Record<string, unknown>,
      status: 'published',
      last_published_at: now,
      last_synced_at: now,
      content_hash: params.contentHash,
      retry_count: 0,
      last_error: null,
      updated_at: now,
    };

    let result: PublishedDocumentRow;

    if (existing) {
      // Update existing publication
      publicationData.document_version = (existing.document_version || 0) + 1;

      const { data, error } = await supabaseAdmin
        .from('published_documents')
        .update(publicationData)
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to update publication: ${error.message}`);
      }
      result = data as PublishedDocumentRow;
    } else {
      // Create new publication
      publicationData.document_version = 1;
      publicationData.created_at = now;

      const { data, error } = await supabaseAdmin
        .from('published_documents')
        .insert(publicationData)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create publication: ${error.message}`);
      }
      result = data as PublishedDocumentRow;
    }

    return mapPublishedDocumentRow(result);
  }

  /**
   * Map PublishDestination to ConnectorType.
   *
   * @param destination - Publish destination
   * @returns Connector type
   */
  private mapDestinationToConnectorType(
    destination: PublishDestination
  ): ConnectorType {
    switch (destination) {
      case 'google_drive':
        return ConnectorType.GOOGLE_DRIVE;
      case 'sharepoint':
        return ConnectorType.SHAREPOINT;
      case 'onedrive':
        return ConnectorType.ONEDRIVE;
      case 'notion':
        return ConnectorType.NOTION;
      default:
        throw new Error(`Unsupported destination: ${destination}`);
    }
  }

  // =====================================================
  // ADDITIONAL PUBLIC METHODS
  // =====================================================

  /**
   * Delete a publication (soft delete in DB, optionally delete from external system).
   *
   * @param publicationId - Publication ID to delete
   * @param orgId - Organization ID for authorization
   * @param userId - User performing the deletion
   * @param deleteExternal - Whether to delete the document from external system
   * @returns Result with success status
   */
  async deletePublication(
    publicationId: string,
    orgId: string,
    userId: string | undefined,
    deleteExternal: boolean
  ): Promise<{ success: boolean; error?: string }> {
    const startTime = Date.now();

    try {
      // 1. Fetch publication
      const { data: publication, error: fetchError } = await supabaseAdmin
        .from('published_documents')
        .select('*, connector_configs!inner(*)')
        .eq('id', publicationId)
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .single();

      if (fetchError || !publication) {
        return { success: false, error: 'Publication not found' };
      }

      // 2. Optionally delete from external system
      if (deleteExternal) {
        try {
          const connectorConfig = (publication as unknown as { connector_configs: ConnectorConfigRow }).connector_configs;
          const connector = ConnectorRegistry.create(
            connectorConfig.connector_type as ConnectorType,
            connectorConfig.credentials,
            connectorConfig.settings
          ) as unknown as PublishableConnector;

          await connector.deleteDocument(publication.external_id);
        } catch (externalError) {
          console.error(
            '[DocumentPublisher] Failed to delete external document:',
            externalError
          );
          // Continue with soft delete even if external delete fails
        }
      }

      // 3. Soft delete publication
      const now = new Date().toISOString();
      const { error: deleteError } = await supabaseAdmin
        .from('published_documents')
        .update({ deleted_at: now, updated_at: now })
        .eq('id', publicationId);

      if (deleteError) {
        return { success: false, error: 'Failed to delete publication' };
      }

      // 4. Log deletion
      await supabaseAdmin.from('publish_logs').insert({
        published_document_id: publicationId,
        content_id: publication.content_id,
        org_id: orgId,
        user_id: userId || null,
        action: 'delete',
        destination: publication.destination as PublishDestination,
        status: 'success',
        duration_ms: Date.now() - startTime,
        trigger_type: 'manual',
        request_metadata: { deleteExternal },
        result_metadata: { deletedAt: now },
        api_calls_made: 1,
        created_at: now,
        completed_at: now,
      });

      return { success: true };
    } catch (error) {
      console.error('[DocumentPublisher] Delete error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Sync a published document (re-publish with updated content).
   *
   * @param publicationId - Publication ID to sync
   * @param orgId - Organization ID for authorization
   * @param userId - User performing the sync
   * @returns Publishing result
   */
  async syncPublication(
    publicationId: string,
    orgId: string,
    userId?: string
  ): Promise<PublishResult> {
    // Fetch existing publication
    const { data: publication, error: fetchError } = await supabaseAdmin
      .from('published_documents')
      .select('*')
      .eq('id', publicationId)
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !publication) {
      return {
        success: false,
        error: 'Publication not found',
        errorCode: 'NOT_FOUND',
      };
    }

    // Re-publish with existing settings
    return this.publish({
      contentId: publication.content_id,
      documentId: publication.document_id,
      orgId,
      userId,
      connectorId: publication.connector_id,
      destination: publication.destination as PublishDestination,
      folderId: publication.folder_id || undefined,
      folderPath: publication.folder_path || undefined,
      format: publication.format as PublishFormat,
      branding: publication.branding_config as Partial<BrandingConfig>,
      customTitle: publication.custom_title || undefined,
      triggerType: 'auto',
    });
  }
}

// =====================================================
// CUSTOM ERROR CLASS
// =====================================================

/**
 * Custom error class for publish operations with error code.
 */
class PublishError extends Error {
  constructor(
    message: string,
    public readonly code: PublishErrorCode
  ) {
    super(message);
    this.name = 'PublishError';
  }
}

// =====================================================
// EXPORTS
// =====================================================

/** Singleton instance for convenience */
export const documentPublisher = new DocumentPublisher();

export default DocumentPublisher;
