import { describe, expect, it, jest } from '@jest/globals';

import { enqueueUniqueJob } from '../job-enqueue';

type InsertResult = Promise<{
  error: { code?: string; message: string } | null;
}>;

describe('enqueueUniqueJob', () => {
  it('inserts a deduped job once', async () => {
    const insert = jest.fn<() => InsertResult>().mockResolvedValue({ error: null });
    const supabase = {
      from: jest.fn().mockReturnValue({ insert }),
    };

    const result = await enqueueUniqueJob(supabase as never, {
      type: 'compile_wiki',
      status: 'pending',
      payload: { recordingId: 'content_1', orgId: 'org_1' },
      dedupe_key: 'compile_wiki:content_1',
    }, 'compile_wiki job');

    expect(result).toEqual({ inserted: true, duplicate: false });
    expect(supabase.from).toHaveBeenCalledWith('jobs');
    expect(insert).toHaveBeenCalledWith({
      type: 'compile_wiki',
      status: 'pending',
      payload: { recordingId: 'content_1', orgId: 'org_1' },
      dedupe_key: 'compile_wiki:content_1',
    });
  });

  it('treats unique dedupe collisions as already enqueued', async () => {
    const insert = jest.fn<() => InsertResult>().mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value' },
    });
    const supabase = {
      from: jest.fn().mockReturnValue({ insert }),
    };

    await expect(
      enqueueUniqueJob(supabase as never, {
        type: 'compile_wiki',
        status: 'pending',
        payload: { recordingId: 'content_1', orgId: 'org_1' },
        dedupe_key: 'compile_wiki:content_1',
      }, 'compile_wiki job'),
    ).resolves.toEqual({ inserted: false, duplicate: true });
  });

  it('fails closed when callers forget the dedupe key', async () => {
    const insert = jest.fn();
    const supabase = {
      from: jest.fn().mockReturnValue({ insert }),
    };

    await expect(
      enqueueUniqueJob(supabase as never, {
        type: 'compile_wiki',
        status: 'pending',
        payload: { recordingId: 'content_1', orgId: 'org_1' },
      }, 'compile_wiki job'),
    ).rejects.toThrow('Cannot enqueue unique compile_wiki job without a dedupe_key');
    expect(insert).not.toHaveBeenCalled();
  });

  it('throws non-duplicate insert failures', async () => {
    const insert = jest.fn<() => InsertResult>().mockResolvedValue({
      error: { code: 'XX000', message: 'queue unavailable' },
    });
    const supabase = {
      from: jest.fn().mockReturnValue({ insert }),
    };

    await expect(
      enqueueUniqueJob(supabase as never, {
        type: 'compile_wiki',
        status: 'pending',
        payload: { recordingId: 'content_1', orgId: 'org_1' },
        dedupe_key: 'compile_wiki:content_1',
      }, 'compile_wiki job'),
    ).rejects.toThrow('Failed to enqueue compile_wiki job: queue unavailable');
  });
});
