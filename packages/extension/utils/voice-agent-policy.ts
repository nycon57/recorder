export { buildTriboraVoiceAgentInstructions } from '@tribora/shared';

type TranscriptConfidenceReason =
  | 'empty'
  | 'punctuation'
  | 'filler'
  | 'fragment';

export interface TranscriptConfidenceResult {
  lowConfidence: boolean;
  reason: TranscriptConfidenceReason | null;
}

const FILLER_WORDS = new Set([
  'ah',
  'eh',
  'er',
  'hm',
  'hmm',
  'huh',
  'like',
  'mm',
  'mmm',
  'uh',
  'um',
]);

export function classifyTranscriptConfidence(
  transcript: string,
): TranscriptConfidenceResult {
  const trimmed = transcript.trim();
  if (!trimmed) {
    return { lowConfidence: true, reason: 'empty' };
  }

  const punctuationOnly = trimmed.replace(/[\s.,!?;:…'"`()[\]{}<>/\\|_-]/g, '');
  if (!punctuationOnly) {
    return { lowConfidence: true, reason: 'punctuation' };
  }

  const words = trimmed
    .toLowerCase()
    .replace(/[^\p{L}\p{N}'\s-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

  if (words.length > 0 && words.every((word) => FILLER_WORDS.has(word))) {
    return { lowConfidence: true, reason: 'filler' };
  }

  const hasCutOffWord = /(?:^|\s)[\p{L}\p{N}]{1,12}-$|-$|…$/u.test(
    trimmed,
  );
  if (hasCutOffWord && words.length <= 3) {
    return { lowConfidence: true, reason: 'fragment' };
  }

  return { lowConfidence: false, reason: null };
}

export function isLowConfidenceTranscript(transcript: string): boolean {
  return classifyTranscriptConfidence(transcript).lowConfidence;
}
