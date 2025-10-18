/**
 * Perform Health Check Cron Route
 *
 * Triggered every 5 minutes to monitor system health and log metrics.
 * Creates a job that will be processed by the background worker.
 */

import { NextRequest } from 'next/server';
import { apiHandler, successResponse } from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/admin';

export const GET = apiHandler(async (request: NextRequest) => {
  const supabase = createClient();

  // Verify this is a valid cron request (Vercel Cron sends a special header)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Create a job to perform health check
  const { data, error } = await supabase.from('jobs').insert({
    type: 'perform_health_check',
    payload: {},
    status: 'pending',
    run_at: new Date().toISOString(),
  }).select().single();

  if (error) {
    console.error('[Cron] Failed to create perform_health_check job:', error);
    return successResponse(
      { success: false, error: error.message },
      undefined,
      500
    );
  }

  console.log('[Cron] Created perform_health_check job:', data.id);

  return successResponse({
    success: true,
    message: 'Health check job queued',
    jobId: data.id,
  });
});

// Allow POST as well (for manual triggers)
export const POST = GET;
