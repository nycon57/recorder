/**
 * Publish API Routes
 *
 * POST /api/library/[id]/publish - Publish content to external system
 * GET /api/library/[id]/publish - List publications for content
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  generateRequestId,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { DocumentPublisher } from '@/lib/services/document-publisher';
import {
  validatePublishRequest,
  type PublishRequestInput,
} from '@/lib/validations/publishing';
import type {
  PublishedDocumentRow,
  PublishDestination,
  PublishFormat,
} from '@/lib/types/publishing';
import { mapPublishedDocumentRow } from '@/lib/types/publishing';

// Next.js 15 route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/library/[id]/publish
 *
 * Publish a document to an external system (Google Drive, SharePoint, OneDrive).
 * Requires the content to have a completed document.
 *
 * @route POST /api/library/[id]/publish
 * @access Protected - Requires organization context
 *
 * @params {
 *   id: string;  // Content UUID
 * }
 *
 * @body {
 *   destination: 'google_drive' | 'sharepoint' | 'onedrive' | 'notion';
 *   connectorId?: string;           // Optional: specific connector to use
 *   folderId?: string;              // Optional: external folder ID
 *   folderPath?: string;            // Optional: folder path for navigation
 *   format?: 'native' | 'markdown' | 'pdf' | 'html';  // Default: 'native'
 *   branding?: {
 *     includeVideoLink?: boolean;
 *     includePoweredByFooter?: boolean;
 *     includeEmbeddedPlayer?: boolean;
 *     customFooterText?: string;
 *   };
 *   customTitle?: string;           // Optional: override content title
 * }
 *
 * @returns {
 *   success: true;
 *   publication: {
 *     id: string;
 *     contentId: string;
 *     documentId: string;
 *     connectorId: string;
 *     destination: string;
 *     externalId: string;
 *     externalUrl: string;
 *     externalPath?: string;
 *     folderId?: string;
 *     folderPath?: string;
 *     format: string;
 *     customTitle?: string;
 *     brandingConfig: object;
 *     status: string;
 *     lastPublishedAt?: string;
 *     lastSyncedAt?: string;
 *     createdAt: string;
 *     updatedAt: string;
 *   };
 *   externalUrl: string;  // Direct link to published document
 * }
 *
 * @security
 *   - Org-level data isolation via requireOrg()
 *   - Verifies content belongs to organization
 *   - Verifies content has completed document
 *   - Verifies connector is active and supports publishing
 *
 * @errors
 *   - 400: Validation error, content not ready for publishing
 *   - 401: Unauthorized
 *   - 403: Forbidden - No org context
 *   - 404: Content not found, document not found, connector not found
 *   - 500: Internal server error, publish operation failed
 */
export const POST = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const requestId = generateRequestId();
    const { orgId, userId } = await requireOrg();
    const { id: contentId } = await params;

    console.log(
      `[Publish API] POST request for content ${contentId}, org ${orgId}`
    );

    try {
      // 1. Parse and validate request body
      const body = await request.json();
      const validated: PublishRequestInput = validatePublishRequest(body);

      // 2. Verify content exists and belongs to org
      const { data: content, error: contentError } = await supabaseAdmin
        .from('content')
        .select('id, title, status, org_id')
        .eq('id', contentId)
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .single();

      if (contentError || !content) {
        console.error('[Publish API] Content not found:', contentError);
        return errors.notFound('Content', requestId);
      }

      // 3. Verify content has completed document
      const { data: document, error: docError } = await supabaseAdmin
        .from('documents')
        .select('id, content_id')
        .eq('content_id', contentId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (docError || !document) {
        console.error(
          '[Publish API] No document found for content:',
          docError
        );
        return errors.badRequest(
          'Content does not have a generated document. Please wait for processing to complete.',
          { contentId, status: content.status },
          requestId
        );
      }

      // 4. Determine connector to use
      let connectorId = validated.connectorId;

      // If no connector specified, find default for destination
      if (!connectorId) {
        const { data: defaultConnector, error: connectorError } =
          await supabaseAdmin
            .from('connector_configs')
            .select('id')
            .eq('org_id', orgId)
            .eq('connector_type', validated.destination)
            .eq('is_active', true)
            .eq('supports_publish', true)
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

        if (connectorError || !defaultConnector) {
          return errors.badRequest(
            `No active connector found for ${validated.destination}. Please connect and authorize a ${validated.destination} connector first.`,
            { destination: validated.destination },
            requestId
          );
        }

        connectorId = defaultConnector.id;
      } else {
        // Verify specified connector exists and is valid
        const { data: connector, error: connectorError } =
          await supabaseAdmin
            .from('connector_configs')
            .select('id, connector_type, is_active, supports_publish')
            .eq('id', connectorId)
            .eq('org_id', orgId)
            .single();

        if (connectorError || !connector) {
          return errors.notFound('Connector', requestId);
        }

        if (!connector.is_active) {
          return errors.badRequest(
            'Connector is not active',
            { connectorId },
            requestId
          );
        }

        if (!connector.supports_publish) {
          return errors.badRequest(
            'Connector does not have write permissions for publishing',
            { connectorId },
            requestId
          );
        }

        if (connector.connector_type !== validated.destination) {
          return errors.badRequest(
            `Connector type (${connector.connector_type}) does not match requested destination (${validated.destination})`,
            { connectorId, destination: validated.destination },
            requestId
          );
        }
      }

      // 5. Publish document using DocumentPublisher service
      const publisher = new DocumentPublisher();
      const result = await publisher.publish({
        contentId,
        documentId: document.id,
        orgId,
        userId,
        connectorId,
        destination: validated.destination,
        folderId: validated.folderId,
        folderPath: validated.folderPath,
        format: validated.format,
        branding: validated.branding,
        customTitle: validated.customTitle,
        triggerType: 'manual',
      });

      if (!result.success) {
        console.error('[Publish API] Publish failed:', result.error);
        return errors.internalError(requestId);
      }

      console.log(
        `[Publish API] Successfully published content ${contentId} to ${validated.destination}`
      );

      return successResponse(
        {
          success: true,
          publication: result.publication!,
          externalUrl: result.externalUrl!,
        },
        requestId,
        201
      );
    } catch (error: any) {
      console.error('[Publish API] Request error:', error);

      // Check if it's a validation error
      if (error.name === 'ZodError') {
        return errors.validationError(error.errors, requestId);
      }

      return errors.internalError(requestId);
    }
  }
);

/**
 * GET /api/library/[id]/publish
 *
 * List all publications for a content item.
 *
 * @route GET /api/library/[id]/publish
 * @access Protected - Requires organization context
 *
 * @params {
 *   id: string;  // Content UUID
 * }
 *
 * @returns {
 *   publications: Array<{
 *     id: string;
 *     contentId: string;
 *     documentId: string;
 *     connectorId: string;
 *     destination: string;
 *     externalId: string;
 *     externalUrl: string;
 *     externalPath?: string;
 *     folderId?: string;
 *     folderPath?: string;
 *     format: string;
 *     customTitle?: string;
 *     brandingConfig: object;
 *     status: string;
 *     lastPublishedAt?: string;
 *     lastSyncedAt?: string;
 *     createdAt: string;
 *     updatedAt: string;
 *   }>;
 *   total: number;
 * }
 *
 * @security
 *   - Org-level data isolation
 *   - Only returns active (non-deleted) publications
 *
 * @errors
 *   - 401: Unauthorized
 *   - 403: Forbidden - No org context
 *   - 404: Content not found
 *   - 500: Internal server error
 */
export const GET = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) => {
    const requestId = generateRequestId();
    const { orgId } = await requireOrg();
    const { id: contentId } = await params;

    try {
      // 1. Verify content exists and belongs to org
      const { data: content, error: contentError } = await supabaseAdmin
        .from('content')
        .select('id')
        .eq('id', contentId)
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .single();

      if (contentError || !content) {
        return errors.notFound('Content', requestId);
      }

      // 2. Fetch all active publications for this content
      const { data: publications, error: pubError } = await supabaseAdmin
        .from('published_documents')
        .select('*')
        .eq('content_id', contentId)
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (pubError) {
        console.error('[Publish API] Error fetching publications:', pubError);
        return errors.internalError(requestId);
      }

      // 3. Map database rows to models
      const mappedPublications = (publications || []).map((pub) =>
        mapPublishedDocumentRow(pub as PublishedDocumentRow)
      );

      return successResponse(
        {
          publications: mappedPublications,
          total: mappedPublications.length,
        },
        requestId
      );
    } catch (error: any) {
      console.error('[Publish API] Request error:', error);
      return errors.internalError(requestId);
    }
  }
);
