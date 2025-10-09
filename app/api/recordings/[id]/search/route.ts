/**
 * Recording-Specific Search API
 *
 * Search within a specific recording's transcript and document.
 */

import { NextRequest } from 'next/server';
import { apiHandler, requireOrg, successResponse, parseBody, errors } from '@/lib/utils/api';
import { searchRecording } from '@/lib/services/vector-search';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const searchSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  limit: z.number().int().min(1).max(50).optional().default(10),
  threshold: z.number().min(0).max(1).optional().default(0.7),
  source: z.enum(['transcript', 'document']).optional(),
});

type SearchBody = z.infer<typeof searchSchema>;

/**
 * POST /api/recordings/[id]/search
 * Search within a specific recording
 */
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const { orgId } = await requireOrg();
    const recordingId = params.id;

    // Verify recording exists and belongs to org
    const supabase = await createClient();
    const { data: recording, error: recordingError } = await supabase
      .from('recordings')
      .select('id, title, status')
      .eq('id', recordingId)
      .eq('org_id', orgId)
      .single();

    if (recordingError || !recording) {
      return errors.notFound('Recording not found');
    }

    if (recording.status !== 'completed') {
      return errors.badRequest(
        'Recording must be completed before searching. Current status: ' + recording.status
      );
    }

    const body = await parseBody(request, searchSchema);
    const { query, limit, threshold, source } = body as SearchBody;

    // Execute search
    const results = await searchRecording(recordingId, query, orgId, {
      limit,
      threshold,
      source,
    });

    return successResponse({
      recordingId,
      recordingTitle: recording.title,
      query,
      results,
      count: results.length,
    });
  }
);
