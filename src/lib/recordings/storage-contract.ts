import type { ContentType, FileType } from '@/lib/types/content';
import { generateStoragePath } from '@/lib/validations/library';

export const RECORDING_STORAGE_BUCKETS = ['content', 'recordings'] as const;

export type RecordingStorageBucket = (typeof RECORDING_STORAGE_BUCKETS)[number];

export const CURRENT_RECORDING_STORAGE_BUCKET: RecordingStorageBucket =
  'content';
export const LEGACY_RECORDING_STORAGE_BUCKET: RecordingStorageBucket =
  'recordings';

const SAFE_CONTENT_TYPES: readonly ContentType[] = [
  'recording',
  'video',
  'audio',
  'document',
  'text',
];

const SAFE_FILE_TYPES: readonly FileType[] = [
  'mp4',
  'mov',
  'webm',
  'avi',
  'mp3',
  'wav',
  'm4a',
  'ogg',
  'pdf',
  'docx',
  'doc',
  'txt',
  'md',
];

type StorageObject = {
  name: string;
  metadata?: Record<string, unknown> | null;
};

type StorageBucketClient = {
  list: (
    path: string,
  ) => Promise<{ data: StorageObject[] | null; error: unknown | null }>;
};

type StorageClient = {
  storage: {
    from: (bucket: RecordingStorageBucket) => StorageBucketClient;
  };
};

export type StoragePathValidation =
  | {
      valid: true;
      bucket: RecordingStorageBucket;
      storagePath: string;
      expectedPath: string;
    }
  | {
      valid: false;
      message: string;
      details?: Record<string, string>;
    };

export function isRecordingStorageBucket(
  bucket: unknown,
): bucket is RecordingStorageBucket {
  return (
    typeof bucket === 'string' &&
    RECORDING_STORAGE_BUCKETS.includes(bucket as RecordingStorageBucket)
  );
}

export function buildContentRecordingStoragePath(
  orgId: string,
  contentType: ContentType,
  recordingId: string,
  fileType: FileType,
): string {
  return generateStoragePath(orgId, contentType, recordingId, fileType);
}

export function buildLegacyRecordingStoragePath(
  orgId: string,
  recordingId: string,
): string {
  return `org_${orgId}/recordings/${recordingId}/raw.webm`;
}

export function buildDefaultThumbnailStoragePath(
  orgId: string,
  recordingId: string,
): string {
  return `org_${orgId}/recordings/${recordingId}/thumbnail.jpg`;
}

function getDecodedPath(path: string): string | null {
  try {
    return decodeURIComponent(path);
  } catch {
    return null;
  }
}

function isUnsafeObjectPath(path: string): boolean {
  const decodedPath = getDecodedPath(path);
  if (!decodedPath) {
    return true;
  }

  const variants = path === decodedPath ? [path] : [path, decodedPath];

  return variants.some((variant) => {
    if (
      variant.includes('\0') ||
      variant.includes('\\') ||
      variant.startsWith('/') ||
      variant.endsWith('/')
    ) {
      return true;
    }

    const segments = variant.split('/');
    return segments.some(
      (segment) => segment === '' || segment === '.' || segment === '..',
    );
  });
}

function isSafeFileType(
  fileType: string | null | undefined,
): fileType is FileType {
  return (
    typeof fileType === 'string' &&
    SAFE_FILE_TYPES.includes(fileType as FileType)
  );
}

function isSafeContentType(
  contentType: string | null | undefined,
): contentType is ContentType {
  return (
    typeof contentType === 'string' &&
    SAFE_CONTENT_TYPES.includes(contentType as ContentType)
  );
}

export function inferRecordingStorageBucket({
  storagePath,
  storageBucket,
  orgId,
  recordingId,
}: {
  storagePath: string;
  storageBucket?: unknown;
  orgId: string;
  recordingId: string;
}): RecordingStorageBucket | null {
  if (storageBucket !== undefined && storageBucket !== null) {
    return isRecordingStorageBucket(storageBucket) ? storageBucket : null;
  }

  const legacyPrefix = `org_${orgId}/recordings/${recordingId}/`;
  return storagePath.startsWith(legacyPrefix)
    ? LEGACY_RECORDING_STORAGE_BUCKET
    : CURRENT_RECORDING_STORAGE_BUCKET;
}

export function validateRecordingStoragePath({
  storagePath,
  bucket,
  orgId,
  recordingId,
  contentType,
  fileType,
  allowLegacyRecordingsBucket = true,
}: {
  storagePath: unknown;
  bucket: unknown;
  orgId: string;
  recordingId: string;
  contentType?: ContentType | null;
  fileType?: FileType | null;
  allowLegacyRecordingsBucket?: boolean;
}): StoragePathValidation {
  if (!isRecordingStorageBucket(bucket)) {
    return {
      valid: false,
      message: 'Unsupported storage bucket',
      details: { bucket: String(bucket) },
    };
  }

  if (typeof storagePath !== 'string' || storagePath.length === 0) {
    return {
      valid: false,
      message: 'Storage path is required',
    };
  }

  if (isUnsafeObjectPath(storagePath)) {
    return {
      valid: false,
      message: 'Invalid storage path',
    };
  }

  if (bucket === CURRENT_RECORDING_STORAGE_BUCKET) {
    if (!isSafeContentType(contentType) || !isSafeFileType(fileType)) {
      return {
        valid: false,
        message: 'Recording is missing file metadata for content storage',
      };
    }

    const expectedPath = buildContentRecordingStoragePath(
      orgId,
      contentType,
      recordingId,
      fileType,
    );

    if (storagePath !== expectedPath) {
      return {
        valid: false,
        message: 'Storage path does not match this recording',
        details: { expectedPath },
      };
    }

    return {
      valid: true,
      bucket,
      storagePath,
      expectedPath,
    };
  }

  if (!allowLegacyRecordingsBucket) {
    return {
      valid: false,
      message: 'Legacy recording storage paths are not accepted here',
    };
  }

  if (fileType && fileType !== 'webm') {
    return {
      valid: false,
      message: 'Legacy recording storage only supports webm files',
    };
  }

  const expectedPath = buildLegacyRecordingStoragePath(orgId, recordingId);

  if (storagePath !== expectedPath) {
    return {
      valid: false,
      message: 'Storage path does not match this recording',
      details: { expectedPath },
    };
  }

  return {
    valid: true,
    bucket,
    storagePath,
    expectedPath,
  };
}

export function validateThumbnailStoragePath({
  thumbnailPath,
  orgId,
  recordingId,
}: {
  thumbnailPath: unknown;
  orgId: string;
  recordingId: string;
}): StoragePathValidation {
  if (typeof thumbnailPath !== 'string' || thumbnailPath.length === 0) {
    return {
      valid: false,
      message: 'Thumbnail path is required',
    };
  }

  if (isUnsafeObjectPath(thumbnailPath)) {
    return {
      valid: false,
      message: 'Invalid thumbnail path',
    };
  }

  const expectedPrefix = `org_${orgId}/recordings/${recordingId}/thumbnail.`;
  const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  const extension = thumbnailPath.slice(expectedPrefix.length).toLowerCase();

  if (
    !thumbnailPath.startsWith(expectedPrefix) ||
    !allowedExtensions.includes(extension)
  ) {
    return {
      valid: false,
      message: 'Thumbnail path does not match this recording',
      details: {
        expectedPattern: `${expectedPrefix}{${allowedExtensions.join(',')}}`,
      },
    };
  }

  return {
    valid: true,
    bucket: 'content',
    storagePath: thumbnailPath,
    expectedPath: thumbnailPath,
  };
}

function splitStorageObjectPath(storagePath: string): {
  parentPath: string;
  objectName: string;
} {
  const lastSlashIndex = storagePath.lastIndexOf('/');

  if (lastSlashIndex === -1) {
    return {
      parentPath: '',
      objectName: storagePath,
    };
  }

  return {
    parentPath: storagePath.slice(0, lastSlashIndex),
    objectName: storagePath.slice(lastSlashIndex + 1),
  };
}

export async function findExactStorageObject(
  supabase: StorageClient,
  bucket: RecordingStorageBucket,
  storagePath: string,
): Promise<{
  exists: boolean;
  object: StorageObject | null;
  error: unknown | null;
}> {
  const { parentPath, objectName } = splitStorageObjectPath(storagePath);
  const { data, error } = await supabase.storage.from(bucket).list(parentPath);

  if (error) {
    return {
      exists: false,
      object: null,
      error,
    };
  }

  const object = data?.find((item) => item.name === objectName) ?? null;

  return {
    exists: Boolean(object),
    object,
    error: null,
  };
}
