import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { withRateLimit } from '@/lib/rate-limit/middleware';
import { QuotaManager } from '@/lib/services/quotas/quota-manager';
import { RateLimiter } from '@/lib/services/quotas/rate-limiter';

// GET /api/recordings - List all recordings for the current org
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();
  const supabase = await createClient();

  // Parse query params
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
  const offset = parseInt(url.searchParams.get('offset') || '0');

  // Query recordings
  const { data: recordings, error, count } = await supabase
    .from('recordings')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Error fetching recordings:', error);
    return errors.internalError();
  }

  return successResponse({
    data: recordings || [],
    pagination: {
      total: count || 0,
      limit,
      offset,
      hasMore: (count || 0) > offset + limit,
    },
  });
});

// POST /api/recordings - Create a new recording entry
export const POST = withRateLimit(
  apiHandler(async (request: NextRequest) => {
    const { orgId, userId } = await requireOrg();
    // Use admin client to bypass RLS - auth already validated via requireOrg()
    const supabase = supabaseAdmin;

    // Phase 6: Rate limiting (upload limiter is already applied by withRateLimit wrapper)
    // Additional check for recording quota
    const quotaCheck = await QuotaManager.checkQuota(orgId, 'recording');
    if (!quotaCheck.allowed) {
      return errors.quotaExceeded({
        remaining: quotaCheck.remaining,
        limit: quotaCheck.limit,
        resetAt: quotaCheck.resetAt.toISOString(),
        message: quotaCheck.message,
      });
    }

    // Phase 6: Consume quota
    await QuotaManager.consumeQuota(orgId, 'recording');

  const body = await request.json();
  const { title, description, metadata } = body;

  // Create recording entry
  const { data: recording, error } = await supabase
    .from('recordings')
    .insert({
      org_id: orgId,
      created_by: userId,
      title: title || null,
      description: description || null,
      status: 'uploading',
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating recording:', error);
    return errors.internalError();
  }

  // Generate signed upload URL
  const storagePath = `org_${orgId}/recordings/${recording.id}/raw.webm`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('recordings')
    .createSignedUploadUrl(storagePath);

  if (uploadError) {
    console.error('Error creating upload URL:', uploadError);
    return errors.internalError();
  }

    return successResponse(
      {
        recording,
        uploadUrl: uploadData.signedUrl,
        uploadPath: uploadData.path,
        token: uploadData.token,
      },
      undefined,
      201
    );
  }),
  {
    limiter: 'upload',
    identifier: async (req) => {
      const { orgId } = await requireOrg();
      return orgId;
    },
  }
);
