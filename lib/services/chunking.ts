/**
 * Text Chunking Service
 *
 * Splits large text into smaller chunks for embedding generation and vector search.
 * Uses sliding window with overlap to preserve context across chunk boundaries.
 *
 * PERF-AI-005: Enhanced sentence boundary detection for improved relevance.
 */

interface ChunkOptions {
  /** Maximum chunk size in tokens (default: 500) */
  maxTokens?: number;
  /** Overlap between chunks in tokens (default: 50) */
  overlapTokens?: number;
  /** Minimum chunk size in tokens (default: 100) */
  minTokens?: number;
  /** Chunking strategy to use (default: 'sentence') */
  strategy?: 'sentence' | 'paragraph' | 'hybrid';
}

interface TextChunk {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
  estimatedTokens: number;
  /** PERF-AI-005: Track chunking strategy used */
  strategy?: string;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * PERF-AI-005: Enhanced sentence boundary detection
 *
 * Improvements over simple regex:
 * 1. Handles abbreviations (Dr., Mr., Mrs., Ms., etc.)
 * 2. Handles decimal numbers (3.14, $19.99)
 * 3. Handles URLs and email addresses
 * 4. Handles ellipsis (...) as potential sentence boundaries
 * 5. Handles multi-line breaks as strong sentence boundaries
 */
function splitIntoSentences(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Common abbreviations that shouldn't end sentences (bounded for security)
  const abbreviations = /\b(Dr|Mr|Mrs|Ms|Prof|Jr|Sr|vs|etc|Inc|Ltd|Corp|Co|No|Vol|pp|ed|Rev|St|Ave|Blvd|Rd|Fig|e\.g|i\.e|a\.m|p\.m|U\.S|U\.K)\./gi;

  // Preserve abbreviations by replacing with placeholder
  const preserved = text.replace(abbreviations, (match) => match.replace(/\./g, '<<DOT>>'));

  // Preserve decimal numbers (e.g., 3.14, $19.99)
  const preservedDecimals = preserved.replace(/(\d)\.(\d)/g, '$1<<DOT>>$2');

  // Preserve URLs (simplified pattern with bounded quantifiers)
  const preservedUrls = preservedDecimals.replace(
    /https?:\/\/[^\s]{1,500}/gi,
    (match) => match.replace(/\./g, '<<DOT>>')
  );

  // Preserve email addresses (simplified pattern with bounded quantifiers)
  const preservedEmails = preservedUrls.replace(
    /[a-zA-Z0-9._%+-]{1,100}@[a-zA-Z0-9.-]{1,100}\.[a-zA-Z]{2,10}/g,
    (match) => match.replace(/\./g, '<<DOT>>')
  );

  // Now split on sentence boundaries
  // Pattern: sentence-ending punctuation followed by:
  // - One or more whitespace characters
  // - OR end of string
  // - OR a capital letter (new sentence start)
  const sentencePattern = /(?<=[.!?])\s+(?=[A-Z"])|(?<=[.!?])(?=\s*$)|(?<=\.{3})\s+|(?<=\n\n+)/g;

  const sentences = preservedEmails.split(sentencePattern);

  // Restore dots in abbreviations/decimals/URLs
  return sentences
    .map(s => s.replace(/<<DOT>>/g, '.').trim())
    .filter(s => s.length > 0);
}

/**
 * PERF-AI-005: Split text into paragraphs for hybrid chunking
 */
function splitIntoParagraphs(text: string): string[] {
  // Split on double newlines or more
  const paragraphs = text.split(/\n\s*\n+/);
  return paragraphs.map(p => p.trim()).filter(p => p.length > 0);
}

/**
 * Chunk text for embedding generation
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const {
    maxTokens = 500,
    overlapTokens = 50,
    minTokens = 100,
  } = options;

  // Split into sentences
  const sentences = splitIntoSentences(text);
  const chunks: TextChunk[] = [];

  let currentChunk: string[] = [];
  let currentTokens = 0;
  let charPosition = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    // If adding this sentence would exceed maxTokens, finalize current chunk
    if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
      // Create chunk
      const chunkText = currentChunk.join(' ');
      const startChar = charPosition - chunkText.length;

      chunks.push({
        text: chunkText,
        index: chunks.length,
        startChar,
        endChar: charPosition,
        estimatedTokens: currentTokens,
      });

      // Start new chunk with overlap
      // Keep last N sentences for overlap
      const overlapSentences: string[] = [];
      let overlapTokenCount = 0;
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        const s = currentChunk[i];
        const tokens = estimateTokens(s);
        if (overlapTokenCount + tokens <= overlapTokens) {
          overlapSentences.unshift(s);
          overlapTokenCount += tokens;
        } else {
          break;
        }
      }

      currentChunk = overlapSentences;
      currentTokens = overlapTokenCount;
    }

    // Add sentence to current chunk
    currentChunk.push(sentence);
    currentTokens += sentenceTokens;
    charPosition += sentence.length + 1; // +1 for space
  }

  // Add final chunk if it meets minimum size
  if (currentChunk.length > 0 && currentTokens >= minTokens) {
    const chunkText = currentChunk.join(' ');
    const startChar = charPosition - chunkText.length;

    chunks.push({
      text: chunkText,
      index: chunks.length,
      startChar,
      endChar: charPosition,
      estimatedTokens: currentTokens,
    });
  }

  return chunks;
}

/**
 * Chunk transcript with segment metadata
 */
export function chunkTranscriptWithSegments(
  text: string,
  segments: Array<{
    start: number;
    end: number;
    text: string;
  }>,
  options: ChunkOptions = {}
): Array<TextChunk & { startTime?: number; endTime?: number }> {
  const chunks = chunkText(text, options);

  // Enrich chunks with timing information
  return chunks.map(chunk => {
    // Find segments that overlap with this chunk
    const overlappingSegments = segments.filter(segment => {
      const segmentStart = text.indexOf(segment.text);
      const segmentEnd = segmentStart + segment.text.length;

      return (
        (segmentStart >= chunk.startChar && segmentStart <= chunk.endChar) ||
        (segmentEnd >= chunk.startChar && segmentEnd <= chunk.endChar) ||
        (segmentStart <= chunk.startChar && segmentEnd >= chunk.endChar)
      );
    });

    // Calculate start and end times from overlapping segments
    const startTime =
      overlappingSegments.length > 0
        ? Math.min(...overlappingSegments.map(s => s.start))
        : undefined;

    const endTime =
      overlappingSegments.length > 0
        ? Math.max(...overlappingSegments.map(s => s.end))
        : undefined;

    return {
      ...chunk,
      startTime,
      endTime,
    };
  });
}

/**
 * Chunk markdown document preserving structure
 */
export function chunkMarkdown(
  markdown: string,
  options: ChunkOptions = {}
): TextChunk[] {
  const { maxTokens = 500 } = options;

  // Split by headings first
  const sections = markdown.split(/(?=^#{1,6} )/gm);
  const chunks: TextChunk[] = [];
  let charPosition = 0;

  for (const section of sections) {
    const sectionTokens = estimateTokens(section);

    if (sectionTokens <= maxTokens) {
      // Section fits in one chunk
      chunks.push({
        text: section.trim(),
        index: chunks.length,
        startChar: charPosition,
        endChar: charPosition + section.length,
        estimatedTokens: sectionTokens,
      });
      charPosition += section.length;
    } else {
      // Section is too large, chunk it normally
      const subChunks = chunkText(section, options);
      subChunks.forEach(subChunk => {
        chunks.push({
          ...subChunk,
          index: chunks.length,
          startChar: charPosition + subChunk.startChar,
          endChar: charPosition + subChunk.endChar,
        });
      });
      charPosition += section.length;
    }
  }

  return chunks;
}

/**
 * Video transcript chunk with visual context
 */
export interface VideoTranscriptChunk extends TextChunk {
  startTime?: number;
  endTime?: number;
  contentType: 'audio' | 'visual' | 'combined';
  hasVisualContext: boolean;
  visualDescription?: string;
  timestampRange?: string;
}

interface VisualEvent {
  timestamp: string; // "MM:SS"
  type: 'click' | 'type' | 'navigate' | 'scroll' | 'other';
  target?: string;
  location?: string;
  description: string;
}

interface AudioSegment {
  timestamp: string;
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * Convert MM:SS timestamp to seconds
 */
function timestampToSeconds(timestamp: string): number {
  const parts = timestamp.split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    return mins * 60 + secs;
  }
  return 0;
}

/**
 * Convert seconds to MM:SS format
 */
function secondsToTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Chunk video transcript by merging audio segments with visual events
 * Creates rich chunks that include both what was said and what happened on screen
 */
export function chunkVideoTranscript(
  audioTranscript: string,
  audioSegments: AudioSegment[],
  visualEvents: VisualEvent[],
  options: ChunkOptions = {}
): VideoTranscriptChunk[] {
  const { maxTokens = 500, overlapTokens = 50, minTokens = 100 } = options;

  const chunks: VideoTranscriptChunk[] = [];

  // Sort audio segments and visual events by timestamp
  const sortedAudio = [...audioSegments].sort((a, b) => a.startTime - b.startTime);
  const sortedVisual = [...visualEvents].sort(
    (a, b) => timestampToSeconds(a.timestamp) - timestampToSeconds(b.timestamp)
  );

  // Group audio segments into chunks
  let currentAudioChunk: AudioSegment[] = [];
  let currentTokens = 0;

  for (let i = 0; i < sortedAudio.length; i++) {
    const segment = sortedAudio[i];
    const segmentTokens = estimateTokens(segment.text);

    // Check if adding this segment exceeds maxTokens
    if (currentTokens + segmentTokens > maxTokens && currentAudioChunk.length > 0) {
      // Finalize current chunk
      const chunk = createCombinedChunk(
        currentAudioChunk,
        sortedVisual,
        chunks.length
      );
      chunks.push(chunk);

      // Start new chunk with overlap (keep last segment)
      currentAudioChunk = currentAudioChunk.length > 0 ? [currentAudioChunk[currentAudioChunk.length - 1]] : [];
      currentTokens = currentAudioChunk.length > 0 ? estimateTokens(currentAudioChunk[0].text) : 0;
    }

    currentAudioChunk.push(segment);
    currentTokens += segmentTokens;
  }

  // Add final chunk
  if (currentAudioChunk.length > 0 && currentTokens >= minTokens) {
    const chunk = createCombinedChunk(
      currentAudioChunk,
      sortedVisual,
      chunks.length
    );
    chunks.push(chunk);
  }

  // Add any remaining visual-only events (periods with no audio)
  const visualOnlyChunks = createVisualOnlyChunks(
    sortedVisual,
    sortedAudio,
    chunks.length,
    maxTokens
  );
  chunks.push(...visualOnlyChunks);

  return chunks.sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
}

/**
 * Create a combined chunk from audio segments and overlapping visual events
 */
function createCombinedChunk(
  audioSegments: AudioSegment[],
  allVisualEvents: VisualEvent[],
  index: number
): VideoTranscriptChunk {
  const startTime = audioSegments[0].startTime;
  const endTime = audioSegments[audioSegments.length - 1].endTime;

  // Find visual events that overlap with this time range
  const overlappingVisual = allVisualEvents.filter(event => {
    const eventTime = timestampToSeconds(event.timestamp);
    return eventTime >= startTime && eventTime <= endTime;
  });

  // Merge audio and visual into combined text
  const audioText = audioSegments.map(seg => seg.text).join(' ');

  let combinedText = audioText;
  let visualDescription = '';

  if (overlappingVisual.length > 0) {
    visualDescription = overlappingVisual
      .map(event => {
        const parts = [
          event.target || event.type,
          event.location ? `at ${event.location}` : '',
          ':',
          event.description,
        ].filter(Boolean);
        return parts.join(' ');
      })
      .join('; ');

    combinedText = `${audioText}\n\nVisual: ${visualDescription}`;
  }

  const timestampRange = `${secondsToTimestamp(startTime)} - ${secondsToTimestamp(endTime)}`;

  return {
    text: combinedText,
    index,
    startChar: 0, // Relative to full transcript
    endChar: combinedText.length,
    estimatedTokens: estimateTokens(combinedText),
    startTime,
    endTime,
    contentType: overlappingVisual.length > 0 ? 'combined' : 'audio',
    hasVisualContext: overlappingVisual.length > 0,
    visualDescription: visualDescription || undefined,
    timestampRange,
  };
}

/**
 * Create visual-only chunks for periods with screen activity but no audio
 */
function createVisualOnlyChunks(
  allVisualEvents: VisualEvent[],
  audioSegments: AudioSegment[],
  startIndex: number,
  maxTokens: number
): VideoTranscriptChunk[] {
  const chunks: VideoTranscriptChunk[] = [];

  // Find visual events that don't overlap with any audio
  const visualOnlyEvents = allVisualEvents.filter(event => {
    const eventTime = timestampToSeconds(event.timestamp);
    return !audioSegments.some(
      seg => eventTime >= seg.startTime && eventTime <= seg.endTime
    );
  });

  if (visualOnlyEvents.length === 0) return chunks;

  // Group visual-only events into chunks
  let currentGroup: VisualEvent[] = [];
  let currentTokens = 0;

  for (const event of visualOnlyEvents) {
    const eventTokens = estimateTokens(event.description);

    if (currentTokens + eventTokens > maxTokens && currentGroup.length > 0) {
      chunks.push(createVisualOnlyChunk(currentGroup, chunks.length + startIndex));
      currentGroup = [];
      currentTokens = 0;
    }

    currentGroup.push(event);
    currentTokens += eventTokens;
  }

  if (currentGroup.length > 0) {
    chunks.push(createVisualOnlyChunk(currentGroup, chunks.length + startIndex));
  }

  return chunks;
}

/**
 * Create a visual-only chunk from a group of visual events
 */
function createVisualOnlyChunk(
  events: VisualEvent[],
  index: number
): VideoTranscriptChunk {
  const startTime = timestampToSeconds(events[0].timestamp);
  const endTime = timestampToSeconds(events[events.length - 1].timestamp);

  const visualText = events
    .map(event => {
      const parts = [
        `[${event.timestamp}]`,
        event.target || event.type,
        event.location ? `at ${event.location}` : '',
        '-',
        event.description,
      ].filter(Boolean);
      return parts.join(' ');
    })
    .join('\n');

  const timestampRange = `${secondsToTimestamp(startTime)} - ${secondsToTimestamp(endTime)}`;

  return {
    text: `Visual actions: ${visualText}`,
    index,
    startChar: 0,
    endChar: visualText.length,
    estimatedTokens: estimateTokens(visualText),
    startTime,
    endTime,
    contentType: 'visual',
    hasVisualContext: true,
    visualDescription: visualText,
    timestampRange,
  };
}
