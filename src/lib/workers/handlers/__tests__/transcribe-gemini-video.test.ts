/** @jest-environment node */

import { afterAll, describe, expect, it } from '@jest/globals';

import { streamingManager } from '@/lib/services/streaming-processor';

import {
  buildTranscribeVideoSource,
  resolveTranscribeMediaMetadata,
  resolveTranscribeStoragePayload,
} from '../transcribe-gemini-video';

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
    const resolved = resolveTranscribeStoragePayload(
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
    );

    expect(resolved).toMatchObject({
      recordingId: 'video_1',
      orgId: 'org_1',
      storagePath: 'org_1/videos/video_1.mp3',
      storageBucket: 'content',
      contentType: 'audio',
      fileType: 'mp3',
    });

    const mediaMetadata = resolveTranscribeMediaMetadata(resolved.fileType);
    expect(mediaMetadata).toEqual({
      fileExtension: 'mp3',
      mediaKind: 'audio',
      mimeType: 'audio/mpeg',
    });

    expect(
      buildTranscribeVideoSource({
        geminiFileUri: null,
        geminiMimeType: null,
        videoBase64: 'base64-audio',
        fallbackMimeType: mediaMetadata.mimeType,
      }),
    ).toEqual({
      type: 'inline',
      base64: 'base64-audio',
      mimeType: 'audio/mpeg',
    });

    expect(
      buildTranscribeVideoSource({
        geminiFileUri: 'gemini://derived-audio',
        geminiMimeType: null,
        videoBase64: null,
        fallbackMimeType: mediaMetadata.mimeType,
      }),
    ).toEqual({
      type: 'fileApi',
      fileUri: 'gemini://derived-audio',
      mimeType: 'audio/mpeg',
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
