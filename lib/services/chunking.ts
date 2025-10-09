/**
 * Text Chunking Service
 *
 * Splits large text into smaller chunks for embedding generation and vector search.
 * Uses sliding window with overlap to preserve context across chunk boundaries.
 */

interface ChunkOptions {
  /** Maximum chunk size in tokens (default: 500) */
  maxTokens?: number;
  /** Overlap between chunks in tokens (default: 50) */
  overlapTokens?: number;
  /** Minimum chunk size in tokens (default: 100) */
  minTokens?: number;
}

interface TextChunk {
  text: string;
  index: number;
  startChar: number;
  endChar: number;
  estimatedTokens: number;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Split text into sentences (simple heuristic)
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
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
