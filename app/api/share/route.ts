/**
 * Share API
 *
 * Create and manage share links for recordings and conversations.
 */

import { NextRequest } from 'next/server';
import { z } from 'zod';

import { apiHandler, requireOrg, successResponse, parseBody } from '@/lib/utils/api';
import {
  createRecordingShare,
  createConversationShare,
  listResourceShares,
  deleteShare,
  type ShareOptions,
} from '@/lib/services/sharing';
import { withRateLimit } from '@/lib/rate-limit/middleware';

const createShareSchema = z.object({
  resourceType: z.enum(['recording', 'conversation']),
  resourceId: z.string().uuid(),
  shareType: z.enum(['public', 'password']),
  password: z.string().min(4).optional(),
  expiresAt: z.string().datetime().optional(),
  maxViews: z.number().int().positive().optional(),
});

type CreateShareBody = z.infer<typeof createShareSchema>;

/**
 * POST /api/share
 * Create a new share link
 */
export const POST = withRateLimit(
  apiHandler(async (request: NextRequest) => {
    const { orgId, userId } = await requireOrg();
    const body = await parseBody(request, createShareSchema);

  const {
    resourceType,
    resourceId,
    shareType,
    password,
    expiresAt,
    maxViews,
  } = body as CreateShareBody;

  // Validate password for password-protected shares
  if (shareType === 'password' && !password) {
    return new Response('Password is required for password-protected shares', {
      status: 400,
    });
  }

  const options: ShareOptions = {
    shareType,
    password,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    maxViews,
  };

  // Create share based on resource type
  const share =
    resourceType === 'recording'
      ? await createRecordingShare(resourceId, orgId, userId, options)
      : await createConversationShare(resourceId, orgId, userId, options);

  // Build share URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const shareUrl = `${baseUrl}/s/${share.shareId}`;

    return successResponse({
      share: {
        ...share,
        url: shareUrl,
      },
    });
  }),
  {
    limiter: 'share',
    identifier: async (req) => {
      const { orgId } = await requireOrg();
      return orgId;
    },
  }
);

/**
 * GET /api/share?resourceType=recording&resourceId=uuid
 * List shares for a resource
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const searchParams = request.nextUrl.searchParams;
  const resourceType = searchParams.get('resourceType') as 'recording' | 'conversation';
  const resourceId = searchParams.get('resourceId');

  if (!resourceType || !resourceId) {
    return new Response('resourceType and resourceId are required', {
      status: 400,
    });
  }

  const shares = await listResourceShares(resourceType, resourceId, orgId);

  // Build share URLs
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const sharesWithUrls = shares.map((share) => ({
    ...share,
    url: `${baseUrl}/s/${share.shareId}`,
  }));

  return successResponse({ shares: sharesWithUrls });
});
