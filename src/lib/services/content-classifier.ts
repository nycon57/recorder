/**
 * Content Classification Service
 *
 * Classifies content type to determine optimal chunking strategy:
 * - Technical: code, APIs, configurations
 * - Narrative: stories, explanations, tutorials
 * - Reference: lists, tables, documentation
 */

import type { ContentType, ContentClassification } from '@/lib/types/chunking';

/**
 * Technical terms for classification
 */
const TECHNICAL_TERMS = new Set([
  'function',
  'class',
  'interface',
  'component',
  'api',
  'endpoint',
  'database',
  'query',
  'server',
  'client',
  'authentication',
  'authorization',
  'async',
  'await',
  'promise',
  'error',
  'exception',
  'variable',
  'constant',
  'parameter',
  'return',
  'import',
  'export',
  'configuration',
  'deployment',
  'docker',
  'kubernetes',
  'typescript',
  'javascript',
  'python',
  'java',
  'react',
  'nextjs',
  'supabase',
  'postgres',
  'redis',
  'webhook',
  'middleware',
  'schema',
  'migration',
  'model',
  'service',
  'repository',
  'controller',
  'route',
  'handler',
  'method',
  'property',
  'constructor',
  'decorator',
  'generic',
  'enum',
  'type',
  'typeof',
  'instanceof',
  'extends',
  'implements',
  'override',
  'static',
  'private',
  'public',
  'protected',
  'abstract',
  'virtual',
  'final',
]);

/**
 * Classify content type
 *
 * @param text - Text to classify
 * @returns Content classification with type, confidence, and features
 */
export function classifyContent(text: string): ContentClassification {
  const hasCode = /```[\s\S]*?```|`[^`]+`/.test(text);
  const hasList = /(?:^|\n)\s*[-*+]\s+.+/m.test(text) || /(?:^|\n)\s*\d+\.\s+.+/m.test(text);
  const hasTable = /\|.+\|/.test(text) && /\|[-:| ]+\|/.test(text);

  // Calculate technical term density
  const words = text.toLowerCase().split(/\s+/);
  const technicalCount = words.filter((w) => TECHNICAL_TERMS.has(w)).length;
  const technicalTermDensity = technicalCount / Math.max(words.length, 1);

  // Calculate average sentence length
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength =
    sentences.reduce((sum, s) => sum + s.length, 0) /
    Math.max(sentences.length, 1);

  // Classification logic
  let type: ContentType = 'narrative';
  let confidence = 0.5;

  // Check for mixed content first (multiple structural elements)
  if (hasCode && (hasList || hasTable)) {
    type = 'mixed';
    confidence = 0.6;
  }
  // Check for reference content (lists/tables)
  else if (hasList || hasTable) {
    type = 'reference';
    confidence = 0.8;
  }
  // Check for technical content (code or high technical density)
  else if (hasCode || technicalTermDensity > 0.15) {
    type = 'technical';
    confidence = 0.7 + Math.min(technicalTermDensity, 0.3);
  }
  // Default to narrative for longer prose
  else if (avgSentenceLength > 100) {
    type = 'narrative';
    confidence = 0.7;
  }

  return {
    type,
    confidence,
    features: {
      hasCode,
      hasList,
      hasTable,
      technicalTermDensity,
      averageSentenceLength: avgSentenceLength,
    },
  };
}

/**
 * Determine if content is primarily code-focused
 *
 * @param text - Text to check
 * @returns True if content is code-focused
 */
export function isCodeFocused(text: string): boolean {
  const classification = classifyContent(text);
  return classification.type === 'technical' && classification.features.hasCode;
}

/**
 * Determine if content has structured elements (lists, tables)
 *
 * @param text - Text to check
 * @returns True if content has structured elements
 */
export function hasStructuredContent(text: string): boolean {
  const classification = classifyContent(text);
  return classification.features.hasList || classification.features.hasTable;
}
