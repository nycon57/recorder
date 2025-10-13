/**
 * Multimodal Search API Route
 *
 * POST /api/search/multimodal - Combined audio (transcript) and visual (frames) search
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { generateEmbedding } from '@/lib/utils/embeddings';
import { withRateLimit } from '@/lib/rate-limit/middleware';
import { z } from 'zod';

/**
 * Multimodal search schema
 */
const multimodalSearchParamsSchema = z.object({
  query: z.string().min(1).max(2000),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  threshold: z.coerce.number().min(0).max(1).optional().default(0.7),
  audioWeight: z.coerce.number().min(0).max(1).optional().default(0.7),
  visualWeight: z.coerce.number().min(0).max(1).optional().default(0.3),
  recordingIds: z.array(z.string().uuid()).optional(),
});

type MultimodalSearchParams = z.infer<typeof multimodalSearchParamsSchema>;

/**
 * POST /api/search/multimodal
 * Perform combined audio+visual search using the multimodal_search database function
 */
export const POST = withRateLimit(
  apiHandler(async (request: NextRequest) => {
    const { orgId, userId } = await requireOrg();
    const body = await request.json();
    
    const params = multimodalSearchParamsSchema.parse(body);
    const {
      query,
      limit = 20,
      threshold = 0.7,
      audioWeight = 0.7,
      visualWeight = 0.3,
      recordingIds,
    } = params as MultimodalSearchParams;

    console.log('[Multimodal Search API] Request:', {
      query: query.substring(0, 50),
      orgId,
      userId,
      limit,
      audioWeight,
      visualWeight,
    });

    // Validate weights sum to 1.0
    if (Math.abs(audioWeight + visualWeight - 1) > 0.001) {
      throw new Error('audioWeight and visualWeight must sum to 1.0');
    }

    const searchStartTime = Date.now();

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Call multimodal_search database function
    const { data: results, error } = await supabaseAdmin.rpc('multimodal_search', {
      query_embedding_1536: `[${queryEmbedding.join(',')}]`,
      query_text: query,
      match_org_id: orgId,
      match_count: limit,
      audio_weight: audioWeight,
      visual_weight: visualWeight,
      match_threshold: threshold,
    });

    if (error) {
      console.error('[Multimodal Search API] Database error:', error);
      throw new Error(`Multimodal search failed: ${error.message}`);
    }

    // Filter by recording IDs if provided
    let filteredResults = results || [];
    if (recordingIds && recordingIds.length > 0) {
      filteredResults = filteredResults.filter((r: any) =>
        recordingIds.includes(r.recording_id)
      );
    }

    // Generate presigned URLs for visual results
    const resultsWithUrls = await Promise.all(
      filteredResults.map(async (result: any) => {
        if (result.result_type === 'visual' && result.metadata?.frame_url) {
          try {
            const { data: urlData } = await supabaseAdmin.storage
              .from(process.env.FRAMES_STORAGE_BUCKET || 'video-frames')
              .createSignedUrl(result.metadata.frame_url, 3600);

            return {
              ...result,
              frameUrl: urlData?.signedUrl || null,
            };
          } catch (error) {
            console.error('[Multimodal Search] Error generating signed URL:', error);
          }
        }
        return result;
      })
    );

    const searchTime = Date.now() - searchStartTime;

    // Separate results by type for metadata
    const audioResults = resultsWithUrls.filter((r: any) => r.result_type === 'audio');
    const visualResults = resultsWithUrls.filter((r: any) => r.result_type === 'visual');

    return successResponse({
      query,
      results: resultsWithUrls,
      count: resultsWithUrls.length,
      mode: 'multimodal',
      timings: {
        searchMs: searchTime,
      },
      metadata: {
        totalResults: resultsWithUrls.length,
        audioCount: audioResults.length,
        visualCount: visualResults.length,
        threshold,
        weights: {
          audio: audioWeight,
          visual: visualWeight,
        },
      },
    });
  }),
  {
    limiter: 'search',
    identifier: async (req) => {
      const { userId } = await requireOrg();
      return userId;
    },
  }
);
