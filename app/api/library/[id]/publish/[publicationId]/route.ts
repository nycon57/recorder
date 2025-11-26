/**
 * Publication Management API Routes
 *
 * DELETE /api/library/[id]/publish/[publicationId] - Delete a publication
 */

import { NextRequest, NextResponse } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
  generateRequestId,
  parseSearchParams,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { DocumentPublisher } from '@/lib/services/document-publisher';
import { deletePublicationQuerySchema } from '@/lib/validations/publishing';

// Next.js 15 route segment config
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * DELETE /api/library/[id]/publish/[publicationId]
 *
 * Delete a publication. Performs soft delete in database and optionally
 * deletes the document from the external system.
 *
 * @route DELETE /api/library/[id]/publish/[publicationId]
 * @access Protected - Requires organization context
 *
 * @params {
 *   id: string;             // Content UUID
 *   publicationId: string;  // Publication UUID
 * }
 *
 * @queryParams {
 *   deleteExternal?: boolean;  // If true, also deletes from external system (default: false)
 * }
 *
 * @returns {
 *   success: boolean;
 *   message: string;
 *   deletedAt: string;  // Timestamp of soft delete
 * }
 *
 * @security
 *   - Org-level data isolation via requireOrg()
 *   - Verifies publication belongs to organization
 *   - Verifies publication belongs to specified content
 *   - Soft delete by default (can be recovered)
 *   - External delete is optional and best-effort
 *
 * @errors
 *   - 400: Invalid request parameters
 *   - 401: Unauthorized
 *   - 403: Forbidden - No org context
 *   - 404: Publication not found or already deleted
 *   - 500: Internal server error
 */
export const DELETE = apiHandler(
  async (
    request: NextRequest,
    {
      params,
    }: { params: Promise<{ id: string; publicationId: string }> }
  ) => {
    const requestId = generateRequestId();
    const { orgId, userId } = await requireOrg();
    const { id: contentId, publicationId } = await params;

    console.log(
      `[Publication Delete API] Request for publication ${publicationId}, content ${contentId}, org ${orgId}`
    );

    try {
      // 1. Parse query parameters
      const queryParams = parseSearchParams(
        request,
        deletePublicationQuerySchema
      );
      const deleteExternal = queryParams.deleteExternal || false;

      console.log(
        `[Publication Delete API] Delete external: ${deleteExternal}`
      );

      // 2. Verify publication exists and belongs to org and content
      const { data: publication, error: fetchError } = await supabaseAdmin
        .from('published_documents')
        .select('id, content_id, org_id, external_id, destination, deleted_at')
        .eq('id', publicationId)
        .eq('org_id', orgId)
        .single();

      if (fetchError || !publication) {
        console.error(
          '[Publication Delete API] Publication not found:',
          fetchError
        );
        return errors.notFound('Publication', requestId);
      }

      // Verify publication belongs to specified content
      if (publication.content_id !== contentId) {
        console.error(
          '[Publication Delete API] Publication does not belong to content'
        );
        return errors.badRequest(
          'Publication does not belong to this content',
          { publicationId, contentId },
          requestId
        );
      }

      // Check if already deleted (idempotent)
      if (publication.deleted_at) {
        console.log(
          `[Publication Delete API] Publication already deleted: ${publicationId}`
        );
        return successResponse(
          {
            success: true,
            message: 'Publication already deleted',
            deletedAt: publication.deleted_at,
          },
          requestId
        );
      }

      // 3. Delete publication using DocumentPublisher service
      const publisher = new DocumentPublisher();
      const result = await publisher.deletePublication(
        publicationId,
        orgId,
        userId,
        deleteExternal
      );

      if (!result.success) {
        console.error('[Publication Delete API] Delete failed:', result.error);
        return errors.internalError(requestId);
      }

      console.log(
        `[Publication Delete API] Successfully deleted publication ${publicationId}${deleteExternal ? ' (including external)' : ''}`
      );

      return successResponse(
        {
          success: true,
          message: deleteExternal
            ? 'Publication deleted from database and external system'
            : 'Publication deleted from database',
          deletedAt: new Date().toISOString(),
        },
        requestId
      );
    } catch (error: any) {
      console.error('[Publication Delete API] Request error:', error);

      // Check if it's a validation error
      if (error.message?.includes('Invalid search params')) {
        return errors.validationError(error.message, requestId);
      }

      return errors.internalError(requestId);
    }
  }
);
