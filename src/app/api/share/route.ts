/**
 * Share API
 *
 * Create and manage share links for recordings.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

import {
  apiHandler,
  requireOrg,
  successResponse,
  parseBody,
} from '@/lib/utils/api';
import {
  createRecordingShare,
  listResourceShares,
  type ShareOptions,
} from '@/lib/services/sharing';
import { withRateLimit } from '@/lib/rate-limit/middleware';

const createShareSchema = z.object({
  target_type: z.enum(['recording', 'document']).optional(),
  target_id: z.string().uuid().optional(),
  resourceType: z.enum(['recording', 'document', 'conversation']).optional(),
  resourceId: z.string().uuid().optional(),
  shareType: z.enum(['public', 'password']).optional(),
  share_type: z.enum(['public', 'password']).optional(),
  password: z.string().min(4).optional(),
  expiresAt: z.string().datetime().optional(),
  expires_at: z.string().datetime().optional(),
  maxViews: z.number().int().positive().optional(),
  max_views: z.number().int().positive().optional(),
});

type CreateShareBody = z.infer<typeof createShareSchema>;

/**
 * POST /api/share
 * Create a new share link
 */
export const POST = withRateLimit(
  apiHandler(async (request: NextRequest) => {
    const [{ orgId, userId }, body] = await Promise.all([
      requireOrg(),
      parseBody(request, createShareSchema),
    ]);

    const {
      target_type,
      target_id,
      resourceType,
      resourceId,
      shareType,
      share_type,
      password,
      expiresAt,
      expires_at,
      maxViews,
      max_views,
    } = body as CreateShareBody;

    if (resourceType === 'conversation') {
      return new Response('Conversation shares are no longer supported', {
        status: 400,
      });
    }

    const normalizedTargetType = target_type ?? resourceType ?? 'recording';
    const normalizedTargetId = target_id ?? resourceId;
    const normalizedShareType =
      shareType ?? share_type ?? (password ? 'password' : 'public');

    if (!normalizedTargetId) {
      return new Response('target_id is required', {
        status: 400,
      });
    }

    if (normalizedShareType === 'password' && !password) {
      return new Response(
        'Password is required for password-protected shares',
        {
          status: 400,
        },
      );
    }

    if (normalizedTargetType !== 'recording') {
      return new Response('Only recording shares are currently supported', {
        status: 400,
      });
    }

    const options: ShareOptions = {
      shareType: normalizedShareType,
      password,
      expiresAt: expiresAt
        ? new Date(expiresAt)
        : expires_at
          ? new Date(expires_at)
          : undefined,
      maxViews: maxViews ?? max_views,
    };

    const share = await createRecordingShare(
      normalizedTargetId,
      orgId,
      userId,
      options,
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/s/${share.shareId}`;

    return successResponse({
      id: share.id,
      share_id: share.shareId,
      target_type: share.targetType,
      target_id: share.targetId,
      access_count: share.viewCount,
      created_at: share.createdAt.toISOString(),
      expires_at: share.expiresAt?.toISOString() ?? null,
      password_hash: share.shareType === 'password' ? '__protected__' : null,
      url: shareUrl,
    });
  }),
  {
    limiter: 'share',
    identifier: async () => {
      const { orgId } = await requireOrg();
      return orgId;
    },
  },
);

/**
 * GET /api/share?target_id=uuid
 * List shares for a resource
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const searchParams = request.nextUrl.searchParams;
  const targetType =
    searchParams.get('targetType') ??
    searchParams.get('target_type') ??
    searchParams.get('resourceType') ??
    'recording';
  const targetId =
    searchParams.get('targetId') ??
    searchParams.get('target_id') ??
    searchParams.get('resourceId');

  if (!targetId) {
    return new Response('target_id is required', {
      status: 400,
    });
  }

  if (targetType !== 'recording' && targetType !== 'document') {
    return new Response('Invalid target type', {
      status: 400,
    });
  }

  const shares = await listResourceShares(targetType, targetId, orgId);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const sharesWithUrls = shares.map((share) => ({
    id: share.id,
    share_id: share.shareId,
    target_type: share.targetType,
    target_id: share.targetId,
    access_count: share.viewCount,
    created_at: share.createdAt.toISOString(),
    expires_at: share.expiresAt?.toISOString() ?? null,
    password_hash: share.shareType === 'password' ? '__protected__' : null,
    url: `${baseUrl}/s/${share.shareId}`,
  }));

  return successResponse(sharesWithUrls);
});
