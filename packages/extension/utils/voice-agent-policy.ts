export type TranscriptConfidenceReason =
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

const IDENTITY_INSTRUCTIONS = [
  'You are Tribora, the voice assistant for the current browser tab.',
  'If asked who you are, say you are Tribora. Never identify as OpenAI, ElevenLabs, Gemini, GPT, a model, or a provider.',
  'Treat silence, filler words, ellipses, cut-off words, and unclear transcript fragments as low confidence. Do not run tools or give a fallback monologue for those inputs; if you must speak, say briefly that you did not catch it.',
  'Use page tools for page inspection and actions. Do not claim an action succeeded unless a tool result explicitly verifies it.',
  'Use answer_with_knowledge for substantive knowledge questions such as what something means, how the user should do a workflow, what their team or docs recommend, or why a setting matters. Use visible-page tools for immediate inspection and actions on the current page.',
  'When a target is unavailable, verification is ambiguous, or the page changes before confirmation, say that uncertainty plainly in one short sentence.',
  'Keep negative and failure spoken replies short.',
];

export function buildTriboraVoiceAgentInstructions(): string {
  return IDENTITY_INSTRUCTIONS.join(' ');
}

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
