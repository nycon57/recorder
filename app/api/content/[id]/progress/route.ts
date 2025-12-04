/**
 * Content Processing Progress API
 *
 * Provides real-time progress information for content being processed,
 * especially for segmented video processing.
 *
 * GET /api/content/[id]/progress
 *
 * Returns:
 * - Overall progress percentage
 * - Per-segment status and key findings
 * - Estimated time remaining
 * - Number of searchable chunks already available
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'content-progress-api' });

interface SegmentProgress {
  index: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startTime: number;
  duration: number;
  keyMomentsCount: number;
  embeddingsGenerated: boolean;
  errorMessage?: string;
}

interface ProgressResponse {
  contentId: string;
  title: string;
  status: string;
  processingStrategy: 'single' | 'segmented';
  progress: {
    percent: number;
    completedSegments: number;
    totalSegments: number;
    searchableChunks: number;
    totalKeyMoments: number;
  };
  segments: SegmentProgress[];
  timing: {
    startedAt: string | null;
    estimatedCompletionAt: string | null;
    averageSegmentTime: number | null; // seconds
  };
  messages: {
    primary: string;
    secondary: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: contentId } = await params;

    const supabase = createAdminClient();

    // Get content with processing info
    const { data: content, error: contentError } = await supabase
      .from('content')
      .select(`
        id,
        title,
        status,
        org_id,
        processing_strategy,
        total_segments,
        completed_segments,
        estimated_completion_at,
        created_at,
        updated_at
      `)
      .eq('id', contentId)
      .eq('org_id', orgId)
      .single();

    if (contentError || !content) {
      return NextResponse.json(
        { error: 'Content not found' },
        { status: 404 }
      );
    }

    // Get segment details if segmented processing
    let segments: SegmentProgress[] = [];
    let totalKeyMoments = 0;

    if (content.processing_strategy === 'segmented' && content.total_segments > 0) {
      const { data: segmentData } = await supabase
        .from('segment_transcripts')
        .select(`
          segment_index,
          status,
          segment_start_time,
          segment_duration,
          key_moments_count,
          embeddings_generated,
          error_message,
          processed_at,
          created_at
        `)
        .eq('content_id', contentId)
        .order('segment_index', { ascending: true });

      if (segmentData) {
        segments = segmentData.map(s => ({
          index: s.segment_index,
          status: s.status || 'pending',
          startTime: Number(s.segment_start_time),
          duration: Number(s.segment_duration),
          keyMomentsCount: s.key_moments_count || 0,
          embeddingsGenerated: s.embeddings_generated || false,
          errorMessage: s.error_message || undefined,
        }));

        totalKeyMoments = segments.reduce((sum, s) => sum + s.keyMomentsCount, 0);
      }
    }

    // Get searchable chunks count
    const { count: searchableChunks } = await supabase
      .from('transcript_chunks')
      .select('*', { count: 'exact', head: true })
      .eq('content_id', contentId)
      .not('embedding', 'is', null);

    // Calculate average segment processing time
    let averageSegmentTime: number | null = null;
    if (segments.length > 0) {
      const completedSegments = segments.filter(s => s.status === 'completed');
      if (completedSegments.length > 0) {
        // Use 3 minutes as default estimate per segment
        averageSegmentTime = 180;
      }
    }

    // Calculate progress
    const totalSegments = content.total_segments || 1;
    const completedSegments = content.completed_segments || 0;
    const progressPercent = Math.round((completedSegments / totalSegments) * 100);

    // Generate user-friendly messages
    const messages = generateProgressMessages(
      content.status,
      content.processing_strategy,
      completedSegments,
      totalSegments,
      totalKeyMoments,
      searchableChunks || 0
    );

    const response: ProgressResponse = {
      contentId: content.id,
      title: content.title || 'Untitled',
      status: content.status,
      processingStrategy: content.processing_strategy || 'single',
      progress: {
        percent: progressPercent,
        completedSegments,
        totalSegments,
        searchableChunks: searchableChunks || 0,
        totalKeyMoments,
      },
      segments,
      timing: {
        startedAt: content.created_at,
        estimatedCompletionAt: content.estimated_completion_at,
        averageSegmentTime,
      },
      messages,
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error('Failed to get content progress', {
      error: error as Error,
    });

    return NextResponse.json(
      { error: 'Failed to get progress' },
      { status: 500 }
    );
  }
}

/**
 * Generate user-friendly progress messages
 */
function generateProgressMessages(
  status: string,
  strategy: string,
  completed: number,
  total: number,
  keyMoments: number,
  searchableChunks: number
): { primary: string; secondary: string } {
  if (status === 'completed') {
    return {
      primary: 'Processing complete',
      secondary: `Found ${keyMoments} key moments across ${total} segments`,
    };
  }

  if (status === 'error') {
    return {
      primary: 'Processing encountered an error',
      secondary: 'Please try uploading again or contact support',
    };
  }

  if (strategy === 'single') {
    return {
      primary: 'Analyzing your recording...',
      secondary: 'This typically takes 2-4 minutes',
    };
  }

  // Segmented processing
  if (completed === 0) {
    return {
      primary: `Preparing to analyze ${total} segments`,
      secondary: 'Your video is being split for parallel processing',
    };
  }

  if (completed < total) {
    const remaining = total - completed;
    const searchableNote = searchableChunks > 0
      ? ` • ${searchableChunks} chunks already searchable`
      : '';

    return {
      primary: `Analyzing segment ${completed + 1} of ${total}`,
      secondary: `${keyMoments} key moments found so far${searchableNote}`,
    };
  }

  return {
    primary: 'Finalizing analysis...',
    secondary: 'Merging segment results',
  };
}
