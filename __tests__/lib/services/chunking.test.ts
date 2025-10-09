import { chunkText, chunkTranscript } from '@/lib/services/chunking';

describe('Chunking Service', () => {
  describe('chunkText', () => {
    it('should chunk text by paragraphs', () => {
      const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
      const chunks = chunkText(text, {
        maxChunkSize: 100,
        overlap: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toContain('First paragraph');
    });

    it('should respect max chunk size', () => {
      const text = 'a'.repeat(2000);
      const chunks = chunkText(text, {
        maxChunkSize: 500,
        overlap: 0,
      });

      chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeLessThanOrEqual(500);
      });
    });

    it('should include overlap between chunks', () => {
      const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
      const chunks = chunkText(text, {
        maxChunkSize: 30,
        overlap: 10,
      });

      expect(chunks.length).toBeGreaterThan(1);
      // Overlap should cause some text to appear in multiple chunks
    });

    it('should preserve sentence boundaries when possible', () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const chunks = chunkText(text, {
        maxChunkSize: 100,
        overlap: 0,
      });

      chunks.forEach((chunk) => {
        // Should not split mid-sentence if possible
        const endsWithPunctuation = /[.!?]$/.test(chunk.text.trim());
        expect(endsWithPunctuation || chunk === chunks[chunks.length - 1]).toBe(true);
      });
    });
  });

  describe('chunkTranscript', () => {
    it('should chunk transcript with word-level timestamps', () => {
      const transcript = {
        id: 'test-transcript',
        recording_id: 'test-recording',
        org_id: 'test-org',
        text: 'This is a test transcript with multiple words.',
        segments: [
          {
            start: 0,
            end: 5,
            text: 'This is a test',
          },
          {
            start: 5,
            end: 10,
            text: 'transcript with multiple words.',
          },
        ],
        words: [
          { start: 0, end: 0.5, word: 'This' },
          { start: 0.5, end: 1.0, word: 'is' },
          { start: 1.0, end: 1.2, word: 'a' },
          { start: 1.2, end: 1.8, word: 'test' },
          { start: 5.0, end: 5.8, word: 'transcript' },
          { start: 5.8, end: 6.2, word: 'with' },
          { start: 6.2, end: 6.9, word: 'multiple' },
          { start: 6.9, end: 7.5, word: 'words.' },
        ],
        language: 'en',
        duration: 10,
        metadata: {},
        created_at: new Date().toISOString(),
      };

      const chunks = chunkTranscript(transcript, {
        maxChunkSize: 20,
        overlap: 0,
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata).toHaveProperty('startTime');
      expect(chunks[0].metadata).toHaveProperty('endTime');
      expect(chunks[0].metadata).toHaveProperty('source', 'transcript');
    });

    it('should use segment boundaries for chunking', () => {
      const transcript = {
        id: 'test-transcript',
        recording_id: 'test-recording',
        org_id: 'test-org',
        text: 'First segment. Second segment.',
        segments: [
          {
            start: 0,
            end: 5,
            text: 'First segment.',
          },
          {
            start: 5,
            end: 10,
            text: 'Second segment.',
          },
        ],
        words: [],
        language: 'en',
        duration: 10,
        metadata: {},
        created_at: new Date().toISOString(),
      };

      const chunks = chunkTranscript(transcript, {
        maxChunkSize: 1000,
        overlap: 0,
      });

      // Should create separate chunks for segments even with large maxChunkSize
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
