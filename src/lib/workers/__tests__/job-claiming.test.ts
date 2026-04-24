import { describe, expect, jest, test } from '@jest/globals';

import type { LightweightSupabaseClient } from '@/lib/supabase/types';
import type { Database, Json } from '@/lib/types/database';

import { claimJobById, claimPendingJobs } from '../job-claiming';

type JobRow = Database['public']['Tables']['jobs']['Row'];

function makeJobRow(
  overrides: Partial<JobRow> & { content?: Json } = {},
): JobRow & { content?: Json } {
  return {
    id: 'job-1',
    type: 'transcribe',
    status: 'processing',
    payload: { contentId: 'content-1' },
    result: null,
    error: null,
    attempts: 0,
    max_attempts: 3,
    run_at: '2026-04-24T01:00:00.000Z',
    started_at: '2026-04-24T01:00:01.000Z',
    completed_at: null,
    dedupe_key: null,
    created_at: '2026-04-24T00:59:00.000Z',
    progress_percent: 0,
    progress_message: 'Starting job...',
    content_id: 'content-1',
    priority: 0,
    segments_completed: 0,
    total_segments: null,
    parent_job_id: null,
    ...overrides,
  };
}

describe('job claiming', () => {
  test('claims pending jobs through the atomic RPC and preserves prefetched content', async () => {
    const claimedAt = new Date('2026-04-24T01:00:01.000Z');
    const rpc =
      jest.fn<
        () => Promise<{ data: ReturnType<typeof makeJobRow>[]; error: null }>
      >();
    rpc.mockResolvedValue({
      data: [
        makeJobRow({
          content: {
            id: 'content-1',
            org_id: 'org-1',
            title: 'Demo recording',
            status: 'uploaded',
            content_type: 'video',
            file_type: 'mp4',
            storage_path_raw: 'raw/demo.mp4',
            storage_path_processed: null,
            file_size: 12345,
          },
        }),
      ],
      error: null,
    });

    const result = await claimPendingJobs(
      { rpc } as unknown as LightweightSupabaseClient,
      3,
      claimedAt,
    );

    expect(rpc).toHaveBeenCalledWith('claim_pending_jobs', {
      p_batch_size: 3,
      p_claimed_at: claimedAt.toISOString(),
    });
    expect(result.error).toBeNull();
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0]).toMatchObject({
      id: 'job-1',
      status: 'processing',
      content: {
        id: 'content-1',
        org_id: 'org-1',
        title: 'Demo recording',
      },
    });
  });

  test('does not claim when batch size is zero', async () => {
    const rpc = jest.fn();

    const result = await claimPendingJobs(
      { rpc } as unknown as LightweightSupabaseClient,
      0,
    );

    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({ jobs: [], error: null });
  });

  test('returns no job when an id-specific claim loses the status precondition', async () => {
    const claimedAt = new Date('2026-04-24T01:00:01.000Z');
    const maybeSingle = jest.fn<() => Promise<{ data: null; error: null }>>();
    maybeSingle.mockResolvedValue({ data: null, error: null });
    const select = jest.fn().mockReturnValue({ maybeSingle });
    const claimChain = {
      eq: jest.fn(() => claimChain),
      select,
    };
    const update = jest.fn().mockReturnValue(claimChain);
    const from = jest.fn().mockReturnValue({ update });

    const result = await claimJobById(
      { from } as unknown as LightweightSupabaseClient,
      'job-lost',
      claimedAt,
    );

    expect(from).toHaveBeenCalledWith('jobs');
    expect(update).toHaveBeenCalledWith({
      status: 'processing',
      started_at: claimedAt.toISOString(),
      progress_percent: 0,
      progress_message: 'Starting job...',
    });
    expect(claimChain.eq).toHaveBeenNthCalledWith(1, 'id', 'job-lost');
    expect(claimChain.eq).toHaveBeenNthCalledWith(2, 'status', 'pending');
    expect(result).toEqual({ job: null, error: null });
  });
});
