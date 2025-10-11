/**
 * Single Share API
 *
 * Manage individual share links.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse, errors } from '@/lib/utils/api';
import { deleteShare, updateShare } from '@/lib/services/sharing';

/**
 * DELETE /api/share/[id]
 * Delete a share link
 */
export const DELETE = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const { id: shareId } = await params;

    await deleteShare(shareId, orgId);

    return successResponse({ deleted: true });
  }
);

/**
 * PATCH /api/share/[id]
 * Update share settings (expiration, max views)
 */
export const PATCH = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const { id: shareId } = await params;
    const body = await request.json();

    const { expiresAt, maxViews } = body;

    await updateShare(shareId, orgId, {
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      maxViews: maxViews || null,
    });

    return successResponse({ updated: true });
  }
);
