import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { SpeechClient } from '@google-cloud/speech';

import { getGoogleAuth } from './credentials';

// Lazy initialization to support environment variable loading
let _googleAI: GoogleGenerativeAI | null = null;
let _fileManager: GoogleAIFileManager | null = null;

/**
 * Get Google AI client (Gemini)
 * Lazily initialized on first use
 */
export function getGoogleAI(): GoogleGenerativeAI {
  if (_googleAI) {
    return _googleAI;
  }

  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error('Missing GOOGLE_AI_API_KEY environment variable');
  }

  _googleAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
  return _googleAI;
}

/**
 * Get Google AI File Manager for uploading large files (>20MB)
 * Required for videos larger than 20MB which can't use inline base64
 * Lazily initialized on first use
 */
export function getFileManager(): GoogleAIFileManager {
  if (_fileManager) {
    return _fileManager;
  }

  if (!process.env.GOOGLE_AI_API_KEY) {
    throw new Error('Missing GOOGLE_AI_API_KEY environment variable');
  }

  _fileManager = new GoogleAIFileManager(process.env.GOOGLE_AI_API_KEY);
  return _fileManager;
}

// Re-export FileState enum for use in handlers
export { FileState };

// Legacy export for backwards compatibility
export const googleAI = new Proxy({} as GoogleGenerativeAI, {
  get(target, prop) {
    return (getGoogleAI() as any)[prop];
  },
});

// Lazy initialization of Speech-to-Text client
// Supports both file-based credentials (dev) and base64 (production)
let _speechClient: SpeechClient | null = null;

/**
 * Get Speech-to-Text client with proper authentication
 * Creates client lazily on first use to avoid initialization errors
 */
export function getSpeechClient(): SpeechClient {
  if (_speechClient) {
    return _speechClient;
  }

  try {
    const auth = getGoogleAuth();
    _speechClient = new SpeechClient({ auth });
    console.log('[Google] Speech-to-Text client initialized');
    return _speechClient;
  } catch (error) {
    console.error('[Google] Failed to initialize Speech-to-Text client:', error);
    throw error;
  }
}

// Legacy export for backwards compatibility (deprecated)
export const speechClient = null; // Use getSpeechClient() instead

// Configuration constants
export const GOOGLE_CONFIG = {
  // Transcription (Speech-to-Text)
  SPEECH_MODEL: 'latest_long', // Best for long-form audio
  SPEECH_LANGUAGE: 'en-US',
  ENABLE_WORD_TIME_OFFSETS: true,

  // Document generation (Gemini 2.5)
  DOCIFY_MODEL: 'gemini-2.5-flash', // Balanced model with 1M token context
  // Alternative: 'gemini-2.5-flash-lite' for fastest/cheapest
  // Alternative: 'gemini-2.5-pro' for best quality
  DOCIFY_TEMPERATURE: 0.7,
  DOCIFY_MAX_TOKENS: 8192,

  // Chat (Gemini 2.5)
  CHAT_MODEL: 'gemini-2.5-flash', // Balanced model
  // Alternative: 'gemini-2.5-flash-lite' for high-throughput
  CHAT_TEMPERATURE: 0.7,
  CHAT_MAX_TOKENS: 2048,

  // Embeddings (Gemini Embedding)
  EMBEDDING_MODEL: 'gemini-embedding-001', // Primary embedding model
  // Alternative: 'gemini-embedding-exp-03-07' for experimental features
  EMBEDDING_DIMENSIONS: 1536, // Using 1536 to match database vector dimension (supports 768, 1536, or 3072)
  EMBEDDING_TASK_TYPE: 'RETRIEVAL_DOCUMENT' as const,
  EMBEDDING_QUERY_TASK_TYPE: 'RETRIEVAL_QUERY' as const,

  // Chunking (same as before)
  CHUNK_SIZE: 500,
  CHUNK_OVERLAP: 50,
};

// Prompt templates (same structure as OpenAI)
export const PROMPTS = {
  DOCIFY: `You are an expert technical writer. Convert the following transcript into a well-structured, readable document in Markdown format.

Guidelines:
- Create a clear hierarchy with headings (##, ###)
- Extract key points and organize them logically
- Preserve important details, especially technical terms and steps
- Use bullet points and numbered lists where appropriate
- Include code blocks if code is mentioned (use \`\`\` with language tags)
- Write in a professional, clear style
- Add a brief summary at the beginning
- Remove filler words and verbal tics

Output the structured Markdown document:`,

  CHAT_SYSTEM: `You are a helpful AI assistant that answers questions based on the provided knowledge base of recordings and documents.

Instructions:
- Answer questions using ONLY the information provided in the context below
- If you don't know the answer or the context doesn't contain relevant information, say so
- Cite sources by referencing the recording titles when possible
- Be concise but thorough
- If the question is unclear, ask for clarification
- Format your response in Markdown

Context from knowledge base:
{context}`,

  CHAT_USER: `Question: {query}

Please provide an answer based on the context provided.`,
} as const;
