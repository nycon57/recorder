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

  it('resolves extracted MP3 payloads for video uploads as derived audio', () => {
    expect(
      resolveTranscribeStoragePayload(
        {
          recordingId: 'video_1',
          orgId: 'org_1',
          storagePath: 'org_1/videos/video_1.mp3',
          storageBucket: 'content',
          contentType: 'audio',
          fileType: 'mp3',
        },
        {
          content_type: 'video',
          file_type: 'mp4',
        },
      ),
    ).toMatchObject({
      recordingId: 'video_1',
      orgId: 'org_1',
      storagePath: 'org_1/videos/video_1.mp3',
      storageBucket: 'content',
      contentType: 'audio',
      fileType: 'mp3',
    });
  });

  it('rejects derived audio paths for non-video source rows', () => {
    expect(() =>
      resolveTranscribeStoragePayload(
        {
          recordingId: 'rec_1',
          orgId: 'org_1',
          storagePath: 'org_1/recordings/rec_1.mp3',
          storageBucket: 'content',
          contentType: 'audio',
          fileType: 'mp3',
        },
        recording,
      ),
    ).toThrow('Storage path does not match this recording');
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

    expect(() =>
      resolveTranscribeStoragePayload(
        {
          recordingId: 'rec_1',
          orgId: 'org_1',
          storagePath: 'org_1/recordings/rec_1/raw.webm%00.mp3',
        },
        recording,
      ),
    ).toThrow('Invalid storage path');
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
