import { describe, expect, it, jest } from '@jest/globals';

import { enqueueCompileWikiJob } from '../compile-wiki-queue';

type InsertResult = Promise<{
  error: { code?: string; message: string } | null;
}>;

describe('enqueueCompileWikiJob', () => {
  it('queues compile_wiki with a stable content dedupe key', async () => {
    const insert = jest.fn<() => InsertResult>().mockResolvedValue({ error: null });
    const supabase = {
      from: jest.fn().mockReturnValue({ insert }),
    };

    await enqueueCompileWikiJob(supabase as never, {
      recordingId: 'content_1',
      orgId: 'org_1',
      source: 'Test',
    });

    expect(supabase.from).toHaveBeenCalledWith('jobs');
    expect(insert).toHaveBeenCalledWith({
      type: 'compile_wiki',
      status: 'pending',
      payload: {
        recordingId: 'content_1',
        contentId: 'content_1',
        orgId: 'org_1',
        sourceType: null,
      },
      dedupe_key: 'compile_wiki:content_1',
      priority: 2,
    });
  });

  it('preserves the source content type in the compile_wiki payload', async () => {
    const insert = jest.fn<() => InsertResult>().mockResolvedValue({ error: null });
    const supabase = {
      from: jest.fn().mockReturnValue({ insert }),
    };

    await enqueueCompileWikiJob(supabase as never, {
      recordingId: 'content_2',
      orgId: 'org_1',
      sourceType: 'document',
      source: 'Test',
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          recordingId: 'content_2',
          contentId: 'content_2',
          orgId: 'org_1',
          sourceType: 'document',
        },
        dedupe_key: 'compile_wiki:content_2',
      })
    );
  });

  it('treats duplicate dedupe keys as already queued', async () => {
    const insert = jest.fn<() => InsertResult>().mockResolvedValue({
      error: { code: '23505', message: 'duplicate key value' },
    });
    const supabase = {
      from: jest.fn().mockReturnValue({ insert }),
    };

    await expect(
      enqueueCompileWikiJob(supabase as never, {
        recordingId: 'content_1',
        orgId: 'org_1',
        source: 'Test',
      }),
    ).resolves.toBeUndefined();
  });

  it('throws non-dedupe enqueue failures', async () => {
    const insert = jest.fn<() => InsertResult>().mockResolvedValue({
      error: { code: 'XX000', message: 'queue unavailable' },
    });
    const supabase = {
      from: jest.fn().mockReturnValue({ insert }),
    };

    await expect(
      enqueueCompileWikiJob(supabase as never, {
        recordingId: 'content_1',
        orgId: 'org_1',
        source: 'Test',
      }),
    ).rejects.toThrow('Failed to enqueue compile_wiki job: queue unavailable');
  });
});
