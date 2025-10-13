/**
 * Semantic Chunker Unit Tests
 */

import { SemanticChunker } from '@/lib/services/semantic-chunker';
import type { ChunkingConfig, SemanticChunk } from '@/lib/types/chunking';

// Mock Xenova transformers
jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn().mockResolvedValue(
    jest.fn().mockImplementation((text: string) => ({
      data: new Float32Array(384).fill(0.5), // Mock 384-dimensional embedding
    }))
  ),
}));

describe('SemanticChunker', () => {
  let chunker: SemanticChunker;

  beforeEach(() => {
    chunker = new SemanticChunker({
      minSize: 100,
      maxSize: 500,
      targetSize: 300,
      similarityThreshold: 0.85,
      preserveStructures: true,
    });
  });

  describe('chunk', () => {
    it('should handle empty text', async () => {
      const chunks = await chunker.chunk('');
      expect(chunks).toEqual([]);
    });

    it('should handle very short text', async () => {
      const shortText = 'This is short.';
      const chunks = await chunker.chunk(shortText);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].text).toBe(shortText);
      expect(chunks[0].boundaryType).toBe('size_limit');
    });

    it('should split text at semantic boundaries', async () => {
      const text = `
        The quick brown fox jumps over the lazy dog.
        This is a completely different topic.
        Now we discuss something entirely new.
      `.trim();

      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeGreaterThan(0);
        expect(chunk.sentences.length).toBeGreaterThan(0);
        expect(chunk.semanticScore).toBeGreaterThanOrEqual(0);
        expect(chunk.semanticScore).toBeLessThanOrEqual(1);
      });
    });

    it('should preserve code blocks', async () => {
      const textWithCode = `
        Here is some text before code.

        \`\`\`javascript
        function hello() {
          console.log("Hello, world!");
        }
        \`\`\`

        And some text after code.
      `.trim();

      const chunks = await chunker.chunk(textWithCode);

      // Check that code block is preserved
      const hasCodeBlock = chunks.some(chunk =>
        chunk.text.includes('```javascript') &&
        chunk.text.includes('function hello()')
      );
      expect(hasCodeBlock).toBe(true);
    });

    it('should detect and preserve lists', async () => {
      const textWithList = `
        Here are the steps:

        - First step
        - Second step
        - Third step

        That concludes the list.
      `.trim();

      const chunks = await chunker.chunk(textWithList);

      // Check that list is detected
      const hasListChunk = chunks.some(chunk =>
        chunk.structureType === 'list' ||
        (chunk.text.includes('- First step') &&
         chunk.text.includes('- Second step'))
      );
      expect(hasListChunk).toBe(true);
    });

    it('should detect and preserve tables', async () => {
      const textWithTable = `
        Here is a table:

        | Column 1 | Column 2 |
        |----------|----------|
        | Value 1  | Value 2  |
        | Value 3  | Value 4  |

        End of table.
      `.trim();

      const chunks = await chunker.chunk(textWithTable);

      const hasTableChunk = chunks.some(chunk =>
        chunk.structureType === 'table' ||
        chunk.text.includes('| Column 1 | Column 2 |')
      );
      expect(hasTableChunk).toBe(true);
    });

    it('should respect max size constraints', async () => {
      const longText = 'This is a sentence. '.repeat(100);
      const chunks = await chunker.chunk(longText);

      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeLessThanOrEqual(500); // maxSize from config
      });
    });

    it('should calculate token counts', async () => {
      const text = 'This is a test sentence for token counting.';
      const chunks = await chunker.chunk(text);

      chunks.forEach(chunk => {
        expect(chunk.tokenCount).toBeGreaterThan(0);
        // Rough estimate: 1 token ≈ 4 characters
        expect(chunk.tokenCount).toBeCloseTo(chunk.text.length / 4, 0);
      });
    });

    it('should handle mixed content types', async () => {
      const mixedContent = `
        # Introduction

        This is a paragraph explaining something.

        ## Code Example

        \`\`\`python
        def greet(name):
            return f"Hello, {name}!"
        \`\`\`

        ## List of Features

        - Feature one
        - Feature two
        - Feature three

        ## Data Table

        | Name  | Age |
        |-------|-----|
        | Alice | 30  |
        | Bob   | 25  |

        ## Conclusion

        That's all for now.
      `.trim();

      const chunks = await chunker.chunk(mixedContent);

      expect(chunks.length).toBeGreaterThan(0);

      // Check for different structure types
      const structureTypes = new Set(chunks.map(c => c.structureType));
      expect(structureTypes.size).toBeGreaterThan(1);
    });

    it('should handle special characters', async () => {
      const textWithSpecialChars = `
        This text has "quotes" and 'apostrophes'.
        It also has émojis 😀 and spëcial cháracters.
        Even some symbols: @#$%^&*()
      `.trim();

      const chunks = await chunker.chunk(textWithSpecialChars);

      expect(chunks.length).toBeGreaterThan(0);
      chunks.forEach(chunk => {
        expect(chunk.text).toBeTruthy();
      });
    });

    it('should provide metadata with each chunk', async () => {
      const text = 'First sentence. Second sentence. Third sentence.';
      const metadata = { recordingId: 'test-123', contentType: 'technical' };

      const chunks = await chunker.chunk(text, metadata);

      chunks.forEach(chunk => {
        expect(chunk).toHaveProperty('text');
        expect(chunk).toHaveProperty('startPosition');
        expect(chunk).toHaveProperty('endPosition');
        expect(chunk).toHaveProperty('sentences');
        expect(chunk).toHaveProperty('semanticScore');
        expect(chunk).toHaveProperty('structureType');
        expect(chunk).toHaveProperty('boundaryType');
        expect(chunk).toHaveProperty('tokenCount');
      });
    });

    it('should maintain position tracking', async () => {
      const text = 'First chunk content. Second chunk content. Third chunk content.';
      const chunks = await chunker.chunk(text);

      // Check that positions are sequential
      for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1];
        const currChunk = chunks[i];
        expect(currChunk.startPosition).toBeGreaterThanOrEqual(prevChunk.endPosition);
      }
    });
  });

  describe('configuration', () => {
    it('should respect custom configuration', async () => {
      const customChunker = new SemanticChunker({
        minSize: 50,
        maxSize: 200,
        targetSize: 100,
        similarityThreshold: 0.7,
        preserveStructures: false,
      });

      const text = 'Short text. '.repeat(20);
      const chunks = await customChunker.chunk(text);

      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeLessThanOrEqual(200);
      });
    });

    it('should use environment variables when no config provided', () => {
      process.env.SEMANTIC_CHUNK_MIN_SIZE = '150';
      process.env.SEMANTIC_CHUNK_MAX_SIZE = '600';
      process.env.SEMANTIC_CHUNK_TARGET_SIZE = '400';
      process.env.SEMANTIC_SIMILARITY_THRESHOLD = '0.9';

      const envChunker = new SemanticChunker();

      // Config should be set from environment
      expect(envChunker['config'].minSize).toBe(150);
      expect(envChunker['config'].maxSize).toBe(600);
      expect(envChunker['config'].targetSize).toBe(400);
      expect(envChunker['config'].similarityThreshold).toBe(0.9);

      // Clean up
      delete process.env.SEMANTIC_CHUNK_MIN_SIZE;
      delete process.env.SEMANTIC_CHUNK_MAX_SIZE;
      delete process.env.SEMANTIC_CHUNK_TARGET_SIZE;
      delete process.env.SEMANTIC_SIMILARITY_THRESHOLD;
    });
  });

  describe('edge cases', () => {
    it('should handle text with only whitespace', async () => {
      const chunks = await chunker.chunk('   \n\t  ');
      expect(chunks).toEqual([]);
    });

    it('should handle text with no sentence boundaries', async () => {
      const text = 'This is one long continuous text without any punctuation marks that would normally indicate sentence boundaries';
      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text.length).toBeGreaterThan(0);
    });

    it('should handle text with unusual line breaks', async () => {
      const text = `Line one\r\nLine two\rLine three\n\n\nLine four`;
      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle very long single sentences', async () => {
      const longSentence = 'This is ' + 'a very long continuous sentence that goes on and on '.repeat(50) + '.';
      const chunks = await chunker.chunk(longSentence);

      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeLessThanOrEqual(500); // maxSize
      });
    });

    it('should handle text with nested code blocks', async () => {
      const nestedCode = `
        Outer text
        \`\`\`
        Outer code
        \`Inline code\`
        More outer code
        \`\`\`
        End text
      `.trim();

      const chunks = await chunker.chunk(nestedCode);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('performance', () => {
    it('should handle large documents efficiently', async () => {
      const largeText = 'This is a sentence. '.repeat(1000);

      const startTime = Date.now();
      const chunks = await chunker.chunk(largeText);
      const endTime = Date.now();

      expect(chunks.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});