/**
 * Document Parser Service
 *
 * Multi-format document parser supporting PDF, DOCX, TXT, MD, HTML, and more.
 * Extracts text content and metadata from various document formats.
 */

import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { Readable } from 'stream';

export interface ParsedDocument {
  content: string;
  title?: string;
  metadata: DocumentMetadata;
  format: DocumentFormat;
}

export interface DocumentMetadata {
  pageCount?: number;
  wordCount?: number;
  characterCount?: number;
  author?: string;
  createdAt?: Date;
  modifiedAt?: Date;
  language?: string;
  encoding?: string;
  [key: string]: any;
}

export type DocumentFormat =
  | 'pdf'
  | 'docx'
  | 'doc'
  | 'txt'
  | 'md'
  | 'markdown'
  | 'html'
  | 'json'
  | 'csv'
  | 'xml'
  | 'rtf'
  | 'unknown';

export interface ParserOptions {
  /** Extract metadata from document */
  extractMetadata?: boolean;
  /** Maximum content length (characters) */
  maxLength?: number;
  /** Preserve formatting (if applicable) */
  preserveFormatting?: boolean;
  /** Clean extracted text */
  cleanText?: boolean;
}

/**
 * Document Parser - Main parsing service
 */
export class DocumentParser {
  /**
   * Parse document from Buffer
   */
  static async parseBuffer(
    buffer: Buffer,
    mimeType: string,
    options: ParserOptions = {}
  ): Promise<ParsedDocument> {
    const format = this.detectFormat(mimeType);

    switch (format) {
      case 'pdf':
        return this.parsePDF(buffer, options);
      case 'docx':
        return this.parseDOCX(buffer, options);
      case 'txt':
      case 'md':
      case 'markdown':
        return this.parseText(buffer, format, options);
      case 'html':
        return this.parseHTML(buffer, options);
      case 'json':
        return this.parseJSON(buffer, options);
      case 'csv':
        return this.parseCSV(buffer, options);
      case 'xml':
        return this.parseXML(buffer, options);
      default:
        throw new Error(`Unsupported document format: ${format}`);
    }
  }

  /**
   * Parse document from file path or stream
   */
  static async parseFile(
    filePath: string,
    mimeType: string,
    options: ParserOptions = {}
  ): Promise<ParsedDocument> {
    const fs = await import('fs');
    const buffer = await fs.promises.readFile(filePath);
    return this.parseBuffer(buffer, mimeType, options);
  }

  /**
   * Detect document format from MIME type
   */
  static detectFormat(mimeType: string): DocumentFormat {
    const mimeMap: Record<string, DocumentFormat> = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/msword': 'doc',
      'text/plain': 'txt',
      'text/markdown': 'md',
      'text/html': 'html',
      'application/json': 'json',
      'text/csv': 'csv',
      'application/xml': 'xml',
      'text/xml': 'xml',
      'application/rtf': 'rtf',
      'text/rtf': 'rtf',
    };

    return mimeMap[mimeType] || 'unknown';
  }

  /**
   * Parse PDF document
   */
  private static async parsePDF(
    buffer: Buffer,
    options: ParserOptions
  ): Promise<ParsedDocument> {
    try {
      const data = await pdfParse(buffer);

      let content = data.text;

      // Clean text if requested
      if (options.cleanText) {
        content = this.cleanText(content);
      }

      // Apply max length if specified
      if (options.maxLength && content.length > options.maxLength) {
        content = content.substring(0, options.maxLength);
      }

      const metadata: DocumentMetadata = {
        pageCount: data.numpages,
        wordCount: this.countWords(content),
        characterCount: content.length,
      };

      // Extract metadata if requested
      if (options.extractMetadata && data.info) {
        if (data.info.Title) metadata.title = data.info.Title;
        if (data.info.Author) metadata.author = data.info.Author;
        if (data.info.CreationDate) {
          metadata.createdAt = this.parsePDFDate(data.info.CreationDate);
        }
        if (data.info.ModDate) {
          metadata.modifiedAt = this.parsePDFDate(data.info.ModDate);
        }
      }

      return {
        content,
        title: metadata.title,
        metadata,
        format: 'pdf',
      };
    } catch (error) {
      throw new Error(
        `Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse DOCX document
   */
  private static async parseDOCX(
    buffer: Buffer,
    options: ParserOptions
  ): Promise<ParsedDocument> {
    try {
      const result = await mammoth.extractRawText({ buffer });

      let content = result.value;

      // Clean text if requested
      if (options.cleanText) {
        content = this.cleanText(content);
      }

      // Apply max length if specified
      if (options.maxLength && content.length > options.maxLength) {
        content = content.substring(0, options.maxLength);
      }

      const metadata: DocumentMetadata = {
        wordCount: this.countWords(content),
        characterCount: content.length,
      };

      // Extract title from first heading if available
      const titleMatch = content.match(/^(.+?)(?:\n|$)/);
      const title = titleMatch ? titleMatch[1].trim() : undefined;

      return {
        content,
        title,
        metadata,
        format: 'docx',
      };
    } catch (error) {
      throw new Error(
        `Failed to parse DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse plain text or markdown
   */
  private static async parseText(
    buffer: Buffer,
    format: DocumentFormat,
    options: ParserOptions
  ): Promise<ParsedDocument> {
    try {
      let content = buffer.toString('utf-8');

      // Clean text if requested
      if (options.cleanText) {
        content = this.cleanText(content);
      }

      // Apply max length if specified
      if (options.maxLength && content.length > options.maxLength) {
        content = content.substring(0, options.maxLength);
      }

      const metadata: DocumentMetadata = {
        wordCount: this.countWords(content),
        characterCount: content.length,
        encoding: 'utf-8',
      };

      // Extract title from markdown heading or first line
      let title: string | undefined;
      if (format === 'md' || format === 'markdown') {
        const headingMatch = content.match(/^#\s+(.+?)(?:\n|$)/);
        title = headingMatch ? headingMatch[1].trim() : undefined;
      } else {
        const firstLine = content.split('\n')[0]?.trim();
        title = firstLine && firstLine.length < 100 ? firstLine : undefined;
      }

      return {
        content,
        title,
        metadata,
        format,
      };
    } catch (error) {
      throw new Error(
        `Failed to parse text: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse HTML document
   */
  private static async parseHTML(
    buffer: Buffer,
    options: ParserOptions
  ): Promise<ParsedDocument> {
    try {
      const html = buffer.toString('utf-8');

      // Extract text content (strip HTML tags)
      let content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      // Clean text if requested
      if (options.cleanText) {
        content = this.cleanText(content);
      }

      // Apply max length if specified
      if (options.maxLength && content.length > options.maxLength) {
        content = content.substring(0, options.maxLength);
      }

      // Extract title from HTML
      const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : undefined;

      const metadata: DocumentMetadata = {
        wordCount: this.countWords(content),
        characterCount: content.length,
      };

      return {
        content,
        title,
        metadata,
        format: 'html',
      };
    } catch (error) {
      throw new Error(
        `Failed to parse HTML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse JSON document
   */
  private static async parseJSON(
    buffer: Buffer,
    options: ParserOptions
  ): Promise<ParsedDocument> {
    try {
      const json = JSON.parse(buffer.toString('utf-8'));

      // Convert JSON to readable text
      let content = JSON.stringify(json, null, 2);

      // Apply max length if specified
      if (options.maxLength && content.length > options.maxLength) {
        content = content.substring(0, options.maxLength);
      }

      const metadata: DocumentMetadata = {
        wordCount: this.countWords(content),
        characterCount: content.length,
      };

      return {
        content,
        metadata,
        format: 'json',
      };
    } catch (error) {
      throw new Error(
        `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse CSV document
   */
  private static async parseCSV(
    buffer: Buffer,
    options: ParserOptions
  ): Promise<ParsedDocument> {
    try {
      let content = buffer.toString('utf-8');

      // Convert CSV to readable format
      const lines = content.split('\n');
      const headers = lines[0]?.split(',').map((h) => h.trim());

      // Format as readable text
      if (headers && headers.length > 0) {
        const formattedLines = lines.slice(1).map((line, index) => {
          const values = line.split(',').map((v) => v.trim());
          const row = headers
            .map((header, i) => `${header}: ${values[i] || ''}`)
            .join(', ');
          return `Row ${index + 1}: ${row}`;
        });

        content = `Headers: ${headers.join(', ')}\n\n${formattedLines.join('\n')}`;
      }

      // Apply max length if specified
      if (options.maxLength && content.length > options.maxLength) {
        content = content.substring(0, options.maxLength);
      }

      const metadata: DocumentMetadata = {
        wordCount: this.countWords(content),
        characterCount: content.length,
        rowCount: lines.length - 1, // Exclude header
        columnCount: headers?.length,
      };

      return {
        content,
        metadata,
        format: 'csv',
      };
    } catch (error) {
      throw new Error(
        `Failed to parse CSV: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Parse XML document
   */
  private static async parseXML(
    buffer: Buffer,
    options: ParserOptions
  ): Promise<ParsedDocument> {
    try {
      const xml = buffer.toString('utf-8');

      // Extract text content from XML
      let content = xml
        .replace(/<\?xml[^>]*\?>/g, '')
        .replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // Clean text if requested
      if (options.cleanText) {
        content = this.cleanText(content);
      }

      // Apply max length if specified
      if (options.maxLength && content.length > options.maxLength) {
        content = content.substring(0, options.maxLength);
      }

      const metadata: DocumentMetadata = {
        wordCount: this.countWords(content),
        characterCount: content.length,
      };

      return {
        content,
        metadata,
        format: 'xml',
      };
    } catch (error) {
      throw new Error(
        `Failed to parse XML: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Clean extracted text
   */
  private static cleanText(text: string): string {
    return (
      text
        // Remove extra whitespace
        .replace(/\s+/g, ' ')
        // Remove control characters
        .replace(/[\x00-\x1F\x7F]/g, '')
        // Trim
        .trim()
    );
  }

  /**
   * Count words in text
   */
  private static countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  /**
   * Parse PDF date format
   */
  private static parsePDFDate(dateString: string): Date | undefined {
    try {
      // PDF dates are in format: D:YYYYMMDDHHmmSSOHH'mm'
      const match = dateString.match(
        /D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/
      );
      if (match) {
        const [, year, month, day, hour, minute, second] = match;
        return new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          parseInt(second)
        );
      }
    } catch (error) {
      console.warn('Failed to parse PDF date:', error);
    }
    return undefined;
  }

  /**
   * Get supported formats
   */
  static getSupportedFormats(): DocumentFormat[] {
    return [
      'pdf',
      'docx',
      'doc',
      'txt',
      'md',
      'markdown',
      'html',
      'json',
      'csv',
      'xml',
    ];
  }

  /**
   * Check if format is supported
   */
  static isSupported(mimeType: string): boolean {
    const format = this.detectFormat(mimeType);
    return format !== 'unknown';
  }

  /**
   * Get MIME types for a format
   */
  static getMimeTypes(format: DocumentFormat): string[] {
    const mimeTypes: Record<DocumentFormat, string[]> = {
      pdf: ['application/pdf'],
      docx: [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      doc: ['application/msword'],
      txt: ['text/plain'],
      md: ['text/markdown'],
      markdown: ['text/markdown'],
      html: ['text/html'],
      json: ['application/json'],
      csv: ['text/csv'],
      xml: ['application/xml', 'text/xml'],
      rtf: ['application/rtf', 'text/rtf'],
      unknown: [],
    };

    return mimeTypes[format] || [];
  }
}
