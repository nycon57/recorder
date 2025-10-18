/**
 * Generate Recommendations Cron Route
 *
 * Triggered daily at midnight to analyze usage patterns and generate
 * optimization recommendations. Creates a job that will be processed
 * by the background worker.
 */

import { NextRequest } from 'next/server';
import { apiHandler, successResponse } from '@/lib/utils/api';
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
      return new Response('Unauthorized - CRON_SECRET not configured', { status: 401 });
    }
    // In non-production, allow if secret is not set (for local development)
  } else if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Create a job to generate recommendations
  const { data, error } = await supabase.from('jobs').insert({
    type: 'generate_recommendations',
    payload: {},
    status: 'pending',
    run_at: new Date().toISOString(),
  }).select().single();

  if (error) {
    console.error('[Cron] Failed to create generate_recommendations job:', error);
    throw new Error(`Failed to create generate_recommendations job: ${error.message}`);
  }

  console.log('[Cron] Created generate_recommendations job:', data.id);

  return successResponse({
    success: true,
    message: 'Recommendation generation job queued',
    jobId: data.id,
  });
});

// Allow POST as well (for manual triggers)
export const POST = GET;
