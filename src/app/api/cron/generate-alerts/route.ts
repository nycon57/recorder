/**
 * Generate Alerts Cron Route
 *
 * Triggered every 15 minutes to generate alerts based on configured thresholds.
 * Creates a job that will be processed by the background worker.
 */

import { NextRequest, NextResponse } from 'next/server';
import { apiHandler, successResponse, errorResponse } from '@/lib/utils/api';
import { createClient } from '@/lib/supabase/admin';

export const GET = apiHandler(async (request: NextRequest) => {
  const supabase = createClient();

  // Verify this is a valid cron request (Vercel Cron sends a special header)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed: require CRON_SECRET in production
  if (!cronSecret) {
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      console.error('[Cron] CRON_SECRET not set in production');
      return errorResponse('Unauthorized - CRON_SECRET not configured', 'UNAUTHORIZED', 401);
    }
    // In non-production, allow if secret is not set (for local development)
  } else if (authHeader !== `Bearer ${cronSecret}`) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401);
  }

  // Create a job to generate alerts
  const { data, error } = await supabase.from('jobs').insert({
    type: 'generate_alerts',
    payload: {},
    status: 'pending',
    run_at: new Date().toISOString(),
  }).select().single();

  if (error) {
    console.error('[Cron] Failed to create generate_alerts job:', error);
    return successResponse(
      { success: false, error: error.message },
      undefined,
      500
    );
  }

  console.log('[Cron] Created generate_alerts job:', data.id);

  return successResponse({
    success: true,
    message: 'Alert generation job queued',
    jobId: data.id,
  });
});

// Allow POST as well (for manual triggers)
export const POST = GET;
