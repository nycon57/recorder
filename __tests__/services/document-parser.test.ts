/**
 * Document Parser Service Tests
 *
 * Tests multi-format document parsing (PDF, DOCX, TXT, MD, HTML, CSV, JSON, XML).
 */

import { DocumentParser } from '@/lib/services/document-parser';

// Mock dependencies
jest.mock('mammoth');
jest.mock('pdf-parse');

import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

describe('DocumentParser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('detectFormat()', () => {
    it('should detect PDF format', () => {
      expect(DocumentParser.detectFormat('application/pdf')).toBe('pdf');
    });

    it('should detect DOCX format', () => {
      expect(
        DocumentParser.detectFormat(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
      ).toBe('docx');
    });

    it('should detect text formats', () => {
      expect(DocumentParser.detectFormat('text/plain')).toBe('txt');
      expect(DocumentParser.detectFormat('text/markdown')).toBe('md');
      expect(DocumentParser.detectFormat('text/html')).toBe('html');
    });

    it('should return unknown for unsupported types', () => {
      expect(DocumentParser.detectFormat('application/x-executable')).toBe('unknown');
    });
  });

  describe('parsePDF()', () => {
    it('should parse PDF successfully', async () => {
      (pdfParse as any).mockResolvedValue({
        text: 'PDF content with multiple lines',
        numpages: 3,
        info: {
          Title: 'Test PDF',
          Author: 'Test Author',
          CreationDate: 'D:20240101120000',
        },
      });

      const buffer = Buffer.from('PDF content');
      const result = await DocumentParser.parseBuffer(buffer, 'application/pdf', {
        extractMetadata: true,
      });

      expect(result.format).toBe('pdf');
      expect(result.content).toBe('PDF content with multiple lines');
      expect(result.metadata.pageCount).toBe(3);
      expect(result.metadata.title).toBe('Test PDF');
      expect(result.metadata.author).toBe('Test Author');
    });

    it('should clean text when requested', async () => {
      (pdfParse as any).mockResolvedValue({
        text: 'Content   with    extra    spaces',
        numpages: 1,
      });

      const buffer = Buffer.from('PDF');
      const result = await DocumentParser.parseBuffer(buffer, 'application/pdf', {
        cleanText: true,
      });

      expect(result.content).toBe('Content with extra spaces');
    });

    it('should apply max length', async () => {
      (pdfParse as any).mockResolvedValue({
        text: 'A'.repeat(1000),
        numpages: 1,
      });

      const buffer = Buffer.from('PDF');
      const result = await DocumentParser.parseBuffer(buffer, 'application/pdf', {
        maxLength: 100,
      });

      expect(result.content.length).toBe(100);
    });
  });

  describe('parseDOCX()', () => {
    it('should parse DOCX successfully', async () => {
      (mammoth.extractRawText as any).mockResolvedValue({
        value: 'DOCX content\nWith multiple lines',
      });

      const buffer = Buffer.from('DOCX content');
      const result = await DocumentParser.parseBuffer(
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      expect(result.format).toBe('docx');
      expect(result.content).toContain('DOCX content');
      expect(result.metadata.wordCount).toBeGreaterThan(0);
    });

    it('should extract title from first line', async () => {
      (mammoth.extractRawText as any).mockResolvedValue({
        value: 'Document Title\nBody content',
      });

      const buffer = Buffer.from('DOCX');
      const result = await DocumentParser.parseBuffer(
        buffer,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );

      expect(result.title).toBe('Document Title');
    });
  });

  describe('parseText()', () => {
    it('should parse plain text', async () => {
      const buffer = Buffer.from('Plain text content\nLine 2');
      const result = await DocumentParser.parseBuffer(buffer, 'text/plain');

      expect(result.format).toBe('txt');
      expect(result.content).toBe('Plain text content\nLine 2');
      expect(result.metadata.encoding).toBe('utf-8');
    });

    it('should parse markdown and extract title', async () => {
      const buffer = Buffer.from('# Markdown Title\n\nContent here');
      const result = await DocumentParser.parseBuffer(buffer, 'text/markdown');

      expect(result.format).toBe('md');
      expect(result.title).toBe('Markdown Title');
    });
  });

  describe('parseHTML()', () => {
    it('should parse HTML and strip tags', async () => {
      const html = `
        <html>
          <head><title>Page Title</title></head>
          <body>
            <script>alert('test');</script>
            <h1>Heading</h1>
            <p>Paragraph &amp; content</p>
          </body>
        </html>
      `;

      const buffer = Buffer.from(html);
      const result = await DocumentParser.parseBuffer(buffer, 'text/html');

      expect(result.format).toBe('html');
      expect(result.title).toBe('Page Title');
      expect(result.content).toContain('Heading');
      expect(result.content).toContain('Paragraph & content');
      expect(result.content).not.toContain('<script>');
    });

    it('should decode HTML entities', async () => {
      const html = '<html><body>&lt;tag&gt; &quot;quoted&quot;</body></html>';
      const buffer = Buffer.from(html);
      const result = await DocumentParser.parseBuffer(buffer, 'text/html');

      expect(result.content).toContain('<tag>');
      expect(result.content).toContain('"quoted"');
    });
  });

  describe('parseJSON()', () => {
    it('should parse JSON', async () => {
      const json = { key: 'value', nested: { data: 123 } };
      const buffer = Buffer.from(JSON.stringify(json));
      const result = await DocumentParser.parseBuffer(buffer, 'application/json');

      expect(result.format).toBe('json');
      expect(result.content).toContain('"key"');
      expect(result.content).toContain('"value"');
    });

    it('should handle invalid JSON', async () => {
      const buffer = Buffer.from('Invalid JSON{');

      await expect(
        DocumentParser.parseBuffer(buffer, 'application/json')
      ).rejects.toThrow();
    });
  });

  describe('parseCSV()', () => {
    it('should parse CSV', async () => {
      const csv = 'Name,Age,City\nJohn,30,NYC\nJane,25,LA';
      const buffer = Buffer.from(csv);
      const result = await DocumentParser.parseBuffer(buffer, 'text/csv');

      expect(result.format).toBe('csv');
      expect(result.content).toContain('Name');
      expect(result.content).toContain('John');
      expect(result.metadata.rowCount).toBe(2);
      expect(result.metadata.columnCount).toBe(3);
    });
  });

  describe('parseXML()', () => {
    it('should parse XML', async () => {
      const xml = '<?xml version="1.0"?><root><item>Content</item></root>';
      const buffer = Buffer.from(xml);
      const result = await DocumentParser.parseBuffer(buffer, 'text/xml');

      expect(result.format).toBe('xml');
      expect(result.content).toContain('Content');
      expect(result.content).not.toContain('<?xml');
    });

    it('should handle CDATA sections', async () => {
      const xml = '<root><![CDATA[Special content]]></root>';
      const buffer = Buffer.from(xml);
      const result = await DocumentParser.parseBuffer(buffer, 'application/xml');

      expect(result.content).toContain('Special content');
    });
  });

  describe('getSupportedFormats()', () => {
    it('should return all supported formats', () => {
      const formats = DocumentParser.getSupportedFormats();

      expect(formats).toContain('pdf');
      expect(formats).toContain('docx');
      expect(formats).toContain('txt');
      expect(formats).toContain('md');
      expect(formats).toContain('html');
      expect(formats).toContain('json');
      expect(formats).toContain('csv');
      expect(formats).toContain('xml');
    });
  });

  describe('isSupported()', () => {
    it('should check if MIME type is supported', () => {
      expect(DocumentParser.isSupported('application/pdf')).toBe(true);
      expect(DocumentParser.isSupported('text/plain')).toBe(true);
      expect(DocumentParser.isSupported('application/x-executable')).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unsupported format', async () => {
      const buffer = Buffer.from('content');

      await expect(
        DocumentParser.parseBuffer(buffer, 'application/unsupported')
      ).rejects.toThrow('Unsupported document format');
    });

    it('should handle PDF parsing errors', async () => {
      (pdfParse as any).mockRejectedValue(new Error('Corrupted PDF'));

      const buffer = Buffer.from('PDF');

      await expect(
        DocumentParser.parseBuffer(buffer, 'application/pdf')
      ).rejects.toThrow('Failed to parse PDF');
    });

    it('should handle DOCX parsing errors', async () => {
      (mammoth.extractRawText as any).mockRejectedValue(new Error('Invalid DOCX'));

      const buffer = Buffer.from('DOCX');

      await expect(
        DocumentParser.parseBuffer(
          buffer,
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
      ).rejects.toThrow('Failed to parse DOCX');
    });
  });
});
