/**
 * Content Classifier Tests
 */

import { classifyContent, isCodeFocused, hasStructuredContent } from '@/lib/services/content-classifier';

describe('Content Classifier', () => {
  describe('classifyContent', () => {
    it('should classify technical content with code blocks', () => {
      const text = `
        Here's an example function:

        \`\`\`typescript
        function hello() {
          console.log('Hello');
        }
        \`\`\`

        This function demonstrates a simple greeting.
      `;

      const classification = classifyContent(text);

      expect(classification.type).toBe('technical');
      expect(classification.confidence).toBeGreaterThan(0.6);
      expect(classification.features.hasCode).toBe(true);
    });

    it('should classify narrative content without technical terms', () => {
      const text = `
        Once upon a time, there was a developer who loved writing clean code.
        They spent their days crafting beautiful solutions to complex problems.
        The developer believed that code should be readable and maintainable.
      `;

      const classification = classifyContent(text);

      expect(classification.type).toBe('narrative');
      expect(classification.features.hasCode).toBe(false);
    });

    it('should classify reference content with lists', () => {
      const text = `
        Features of the product:
        - Authentication system
        - User management
        - Dashboard analytics
        - API integration
        - Real-time updates
      `;

      const classification = classifyContent(text);

      expect(classification.type).toBe('reference');
      expect(classification.features.hasList).toBe(true);
    });

    it('should classify reference content with tables', () => {
      const text = `
        | Feature | Status | Priority |
        |---------|--------|----------|
        | Auth    | Done   | High     |
        | Search  | Pending| Medium   |
      `;

      const classification = classifyContent(text);

      expect(classification.type).toBe('reference');
      expect(classification.features.hasTable).toBe(true);
    });

    it('should classify mixed content with code and lists', () => {
      const text = `
        To install the package:

        \`\`\`bash
        npm install my-package
        \`\`\`

        Features:
        - Fast performance
        - Easy to use
        - Well documented
      `;

      const classification = classifyContent(text);

      expect(classification.type).toBe('mixed');
      expect(classification.features.hasCode).toBe(true);
      expect(classification.features.hasList).toBe(true);
    });

    it('should calculate technical term density', () => {
      const text = `
        The function uses async await to handle promise-based operations.
        The API endpoint accepts authentication tokens for authorization.
      `;

      const classification = classifyContent(text);

      expect(classification.features.technicalTermDensity).toBeGreaterThan(0.1);
      expect(classification.type).toBe('technical');
    });

    it('should handle empty text', () => {
      const text = '';

      const classification = classifyContent(text);

      expect(classification.type).toBeDefined();
      expect(classification.confidence).toBeGreaterThan(0);
    });

    it('should handle text with only whitespace', () => {
      const text = '   \n\n   \t\t   ';

      const classification = classifyContent(text);

      expect(classification.type).toBeDefined();
    });
  });

  describe('isCodeFocused', () => {
    it('should return true for technical content with code', () => {
      const text = `
        \`\`\`javascript
        const x = 10;
        \`\`\`
      `;

      expect(isCodeFocused(text)).toBe(true);
    });

    it('should return false for narrative content', () => {
      const text = 'This is a simple story about coding.';

      expect(isCodeFocused(text)).toBe(false);
    });
  });

  describe('hasStructuredContent', () => {
    it('should return true for content with lists', () => {
      const text = `
        - Item 1
        - Item 2
        - Item 3
      `;

      expect(hasStructuredContent(text)).toBe(true);
    });

    it('should return true for content with tables', () => {
      const text = `
        | Col1 | Col2 |
        |------|------|
        | A    | B    |
      `;

      expect(hasStructuredContent(text)).toBe(true);
    });

    it('should return false for plain paragraphs', () => {
      const text = 'This is a plain paragraph without any structure.';

      expect(hasStructuredContent(text)).toBe(false);
    });
  });
});
