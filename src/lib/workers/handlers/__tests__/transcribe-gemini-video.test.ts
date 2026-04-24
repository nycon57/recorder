/** @jest-environment node */

import { afterAll, describe, expect, it } from '@jest/globals';

import { streamingManager } from '@/lib/services/streaming-processor';

import { resolveTranscribeStoragePayload } from '../transcribe-gemini-video';

describe('resolveTranscribeStoragePayload', () => {
  afterAll(() => {
    streamingManager.cleanup();
  });

  const recording = {
    content_type: 'recording' as const,
    file_type: 'webm' as const,
  };

  it('defaults legacy queued content paths to the content bucket', () => {
    expect(
      resolveTranscribeStoragePayload(
        {
          recordingId: 'rec_1',
          orgId: 'org_1',
          storagePath: 'org_1/recordings/rec_1/raw.webm',
        },
        recording,
      ),
    ).toMatchObject({
      recordingId: 'rec_1',
      orgId: 'org_1',
      storagePath: 'org_1/recordings/rec_1/raw.webm',
      storageBucket: 'content',
    });
  });

  it('infers legacy recordings bucket paths when storageBucket is absent', () => {
    expect(
      resolveTranscribeStoragePayload(
        {
          recordingId: 'rec_1',
          orgId: 'org_1',
          storagePath: 'org_org_1/recordings/rec_1/raw.webm',
        },
        {
          content_type: null,
          file_type: null,
        },
      ),
    ).toMatchObject({
      storagePath: 'org_org_1/recordings/rec_1/raw.webm',
      storageBucket: 'recordings',
    });
  });

  it('rejects payloads without storagePath before worker status changes', () => {
    expect(() =>
      resolveTranscribeStoragePayload(
        {
          recordingId: 'rec_1',
          orgId: 'org_1',
        },
        recording,
      ),
    ).toThrow('storagePath is required');
  });

  it('rejects traversal and paths that reference another recording', () => {
    expect(() =>
      resolveTranscribeStoragePayload(
        {
          recordingId: 'rec_1',
          orgId: 'org_1',
          storagePath: 'org_1/recordings/rec_1/../raw.webm',
        },
        recording,
      ),
    ).toThrow('Invalid storage path');

    expect(() =>
      resolveTranscribeStoragePayload(
        {
          recordingId: 'rec_1',
          orgId: 'org_1',
          storagePath: 'org_1/recordings/other/raw.webm',
        },
        recording,
      ),
    ).toThrow('Storage path does not match this recording');
  });

  it('rejects unsupported explicit buckets', () => {
    expect(() =>
      resolveTranscribeStoragePayload(
        {
          recordingId: 'rec_1',
          orgId: 'org_1',
          storagePath: 'org_1/recordings/rec_1/raw.webm',
          storageBucket: 'avatars',
        },
        recording,
      ),
    ).toThrow('unsupported storage bucket');
  });
});
