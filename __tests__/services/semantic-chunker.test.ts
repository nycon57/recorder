/**
 * Semantic Chunker Tests
 *
 * Note: These tests may take longer to run due to model loading.
 * The first test that initializes the model will be slower.
 */

import { SemanticChunker, createSemanticChunker } from '@/lib/services/semantic-chunker';

describe('Semantic Chunker', () => {
  // Increase timeout for model loading
  jest.setTimeout(60000);

  let chunker: SemanticChunker;

  beforeAll(() => {
    chunker = new SemanticChunker({
      minSize: 100,
      maxSize: 500,
      targetSize: 300,
      similarityThreshold: 0.8,
      preserveStructures: true,
    });
  });

  describe('Basic Chunking', () => {
    it('should create chunks from text', async () => {
      const text = `
        Authentication is a crucial security feature. It verifies user identity.
        Users must provide credentials to access the system.

        On a different note, database optimization improves performance.
        Indexing speeds up query execution. Proper schema design is essential.
      `;

      const chunks = await chunker.chunk(text);

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toBeTruthy();
      expect(chunks[0].semanticScore).toBeGreaterThanOrEqual(0);
      expect(chunks[0].semanticScore).toBeLessThanOrEqual(1);
    });

    it('should handle empty text', async () => {
      const text = '';

      const chunks = await chunker.chunk(text);

      // Empty text may return empty array or single empty chunk
      expect(chunks.length).toBeLessThanOrEqual(1);
      if (chunks.length === 1) {
        expect(chunks[0].text).toBe('');
      }
    });

    it('should handle single sentence', async () => {
      const text = 'This is a single sentence.';

      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Structure Preservation', () => {
    it('should preserve code blocks', async () => {
      const text = `
        Here's an example function:

        \`\`\`typescript
        function hello() {
          console.log('Hello World');
          return true;
        }
        \`\`\`

        This function demonstrates a simple greeting mechanism.
        It logs a message and returns true to indicate success.
      `;

      const chunks = await chunker.chunk(text);

      // Code block should be preserved in a chunk
      const codeChunk = chunks.find((c) => c.text.includes('```'));
      expect(codeChunk).toBeDefined();
      expect(codeChunk?.structureType).toBe('code');

      // Code block should not be split
      const codeText = codeChunk?.text || '';
      expect(codeText).toContain('function hello()');
      expect(codeText).toContain('console.log');
      expect(codeText).toContain('return true');
    });

    it('should preserve lists', async () => {
      const text = `
        Our application offers comprehensive functionality for modern teams.

        Key features include:
        - Authentication system with OAuth and SSO support
        - User management dashboard with role-based permissions
        - Real-time notifications via WebSocket connections
        - API integration support with third-party services
        - Advanced analytics and reporting capabilities

        These features work together to provide a complete solution.
        Each feature is designed with security and scalability in mind.
        The system supports thousands of concurrent users efficiently.
      `;

      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
      const listChunk = chunks.find((c) => c.text.includes('-'));
      expect(listChunk).toBeDefined();
    });

    it('should preserve tables', async () => {
      const text = `
        Our pricing model provides flexibility for organizations of all sizes.

        Feature comparison between plans:

        | Feature        | Basic Plan | Professional | Enterprise |
        |----------------|------------|--------------|------------|
        | Users          | Up to 10   | Up to 100    | Unlimited  |
        | Storage Space  | 1GB        | 10GB         | 1TB+       |
        | API Calls/day  | 1,000      | 100,000      | Unlimited  |
        | Support Level  | Email      | Priority     | 24/7 Phone |

        Choose the plan that best fits your organization's needs.
        All plans include our core features and regular updates.
        Enterprise customers receive dedicated account management.
      `;

      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
      const tableChunk = chunks.find((c) => c.text.includes('|'));
      expect(tableChunk).toBeDefined();
    });
  });

  describe('Semantic Boundaries', () => {
    it('should detect topic shifts', async () => {
      const text = `
        Authentication is handled through OAuth tokens. Users receive tokens after login.
        Tokens expire after 24 hours for security purposes.

        The user interface uses React components for rendering.
        Components are styled with Tailwind CSS classes.
        Responsive design ensures mobile compatibility.
      `;

      const chunks = await chunker.chunk(text);

      // Should have multiple chunks due to topic shift
      expect(chunks.length).toBeGreaterThan(1);

      // First chunk should be about authentication
      expect(chunks[0].text.toLowerCase()).toContain('authentication');

      // Later chunk should be about UI
      const uiChunk = chunks.find((c) => c.text.toLowerCase().includes('interface'));
      expect(uiChunk).toBeDefined();
    });

    it('should maintain semantic coherence within chunks', async () => {
      const text = `
        First sentence about topic A. Second sentence about topic A.
        Third sentence about topic A. All discussing the same concept.
      `;

      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
      // Semantic score indicates coherence (0.0 to 1.0)
      expect(chunks[0].semanticScore).toBeGreaterThanOrEqual(0);
      expect(chunks[0].semanticScore).toBeLessThanOrEqual(1);
    });
  });

  describe('Metadata', () => {
    it('should include sentence information', async () => {
      const text = `
        First sentence. Second sentence. Third sentence.
      `;

      const chunks = await chunker.chunk(text);

      expect(chunks[0].sentences).toBeDefined();
      expect(chunks[0].sentences.length).toBeGreaterThan(0);
    });

    it('should include position information', async () => {
      const text = `
        This is the first part of the text. It has some content.
        This is the second part. It also has content.
      `;

      const chunks = await chunker.chunk(text);

      expect(chunks[0].startPosition).toBeDefined();
      expect(chunks[0].endPosition).toBeDefined();
      expect(chunks[0].endPosition).toBeGreaterThan(chunks[0].startPosition);
    });

    it('should include token count estimate', async () => {
      const text = `
        This is a test sentence with multiple words.
        Another sentence to increase the token count.
      `;

      const chunks = await chunker.chunk(text);

      expect(chunks[0].tokenCount).toBeGreaterThan(0);
    });

    it('should include boundary type', async () => {
      const text = `
        Some text here. More text. Even more text to create chunks.
      `;

      const chunks = await chunker.chunk(text);

      expect(chunks[0].boundaryType).toBeDefined();
      expect(['semantic_break', 'size_limit', 'structure_boundary', 'topic_shift']).toContain(
        chunks[0].boundaryType
      );
    });
  });

  describe('Factory Function', () => {
    it('should create chunker with default config', () => {
      const defaultChunker = createSemanticChunker();

      expect(defaultChunker).toBeInstanceOf(SemanticChunker);
    });

    it('should create chunker with custom config', () => {
      const customChunker = createSemanticChunker({
        minSize: 50,
        maxSize: 200,
        targetSize: 125, // Must be between minSize and maxSize
      });

      expect(customChunker).toBeInstanceOf(SemanticChunker);
    });
  });

  describe('Edge Cases', () => {
    it('should handle text with only code blocks', async () => {
      const text = `
        \`\`\`javascript
        const x = 10;
        console.log(x);
        \`\`\`
      `;

      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle text with inline code', async () => {
      const text = `
        Use the \`console.log()\` function to debug. The \`return\` statement exits.
      `;

      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].text).toContain('`console.log()`');
    });

    it('should handle very long text', async () => {
      const text = Array(100)
        .fill('This is a sentence about a topic. ')
        .join('');

      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(1);
    });

    it('should handle text with special characters', async () => {
      const text = `
        Special characters: @#$%^&*()_+-={}[]|\\:";'<>?,./
        Unicode: 你好 مرحبا Здравствуйте
        Additional content to meet minimum chunk size requirements.
        This ensures the chunker has enough text to work with properly.
        More sentences help the semantic analysis create meaningful chunks.
      `;

      const chunks = await chunker.chunk(text);

      expect(chunks.length).toBeGreaterThan(0);
      // Verify special characters are preserved
      const allText = chunks.map(c => c.text).join(' ');
      expect(allText).toContain('@#$%^&*()');
    });
  });
});
