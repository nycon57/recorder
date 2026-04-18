import { describe, expect, it } from '@jest/globals';

import {
  SOURCE_STATUS,
  getQueuedSourceStatusForJob,
  getQueuedSourceStatusForReprocessStep,
  getStatusBadgeVariant,
  getStatusDisplayState,
  getStatusLabel,
  isErrorStatus,
  isProcessingStatus,
  normalizeSourceStatus,
} from '../status-helpers';

describe('status-helpers source lifecycle contract', () => {
  it('normalizes legacy failed values to the canonical error status', () => {
    expect(normalizeSourceStatus('failed')).toBe(SOURCE_STATUS.ERROR);
    expect(getStatusLabel('failed')).toBe('Failed');
    expect(getStatusBadgeVariant('failed')).toBe('destructive');
    expect(getStatusDisplayState('failed')).toBe('failed');
    expect(isErrorStatus('failed')).toBe(true);
  });

  it('maps raw source statuses to shared display states', () => {
    expect(getStatusDisplayState(SOURCE_STATUS.UPLOADING)).toBe('uploading');
    expect(getStatusDisplayState(SOURCE_STATUS.UPLOADED)).toBe('queued');
    expect(getStatusDisplayState(SOURCE_STATUS.TRANSCRIBING)).toBe(
      'processing',
    );
    expect(getStatusDisplayState(SOURCE_STATUS.TRANSCRIBED)).toBe('processing');
    expect(getStatusDisplayState(SOURCE_STATUS.DOCUMENT_GENERATING)).toBe(
      'processing',
    );
    expect(getStatusDisplayState(SOURCE_STATUS.COMPLETED)).toBe('ready');
    expect(getStatusLabel(SOURCE_STATUS.TRANSCRIBED)).toBe('Processing');
    expect(isProcessingStatus(SOURCE_STATUS.UPLOADED)).toBe(false);
    expect(isProcessingStatus(SOURCE_STATUS.TRANSCRIBED)).toBe(true);
  });

  it('derives queued lifecycle statuses from worker job types', () => {
    expect(getQueuedSourceStatusForJob('transcribe')).toBe(
      SOURCE_STATUS.TRANSCRIBING,
    );
    expect(getQueuedSourceStatusForJob('extract_audio')).toBe(
      SOURCE_STATUS.TRANSCRIBING,
    );
    expect(getQueuedSourceStatusForJob('extract_text_pdf')).toBe(
      SOURCE_STATUS.TRANSCRIBING,
    );
    expect(getQueuedSourceStatusForJob('extract_text_docx')).toBe(
      SOURCE_STATUS.TRANSCRIBING,
    );
    expect(getQueuedSourceStatusForJob('process_text_note')).toBe(
      SOURCE_STATUS.TRANSCRIBING,
    );
    expect(getQueuedSourceStatusForJob('doc_generate')).toBe(
      SOURCE_STATUS.DOCUMENT_GENERATING,
    );
    expect(getQueuedSourceStatusForJob('generate_embeddings')).toBeNull();
  });

  it('maps reprocess steps onto the source lifecycle only when the lifecycle should change', () => {
    expect(getQueuedSourceStatusForReprocessStep('transcribe')).toBe(
      SOURCE_STATUS.TRANSCRIBING,
    );
    expect(getQueuedSourceStatusForReprocessStep('document')).toBe(
      SOURCE_STATUS.DOCUMENT_GENERATING,
    );
    expect(getQueuedSourceStatusForReprocessStep('all')).toBe(
      SOURCE_STATUS.TRANSCRIBING,
    );
    expect(getQueuedSourceStatusForReprocessStep('embeddings')).toBeNull();
  });
});
