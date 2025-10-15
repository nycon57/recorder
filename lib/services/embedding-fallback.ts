/**
 * Embedding Generation with Automatic Fallback
 *
 * Tries Google Gemini first, falls back to OpenAI if Google fails.
 * Ensures reliability during Google API overload (503 errors).
 */

import { GoogleGenAI } from '@google/genai';
import { GOOGLE_CONFIG } from '@/lib/google/client';
import OpenAI from 'openai';

// Lazy initialization
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

/**
 * Generate embedding with automatic fallback:
 * 1. Try Google Gemini (preferred)
 * 2. Fall back to OpenAI if Google fails
 *
 * Note: Both models produce 1536-dimensional embeddings
 */
export async function generateEmbeddingWithFallback(
  text: string,
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' = 'RETRIEVAL_QUERY'
): Promise<{
  embedding: number[];
  provider: 'google' | 'openai';
}> {
  // Try Google first
  try {
    console.log('[Embeddings] Attempting Google Gemini...');
    const embedding = await generateGoogleEmbedding(text, taskType);
    console.log('[Embeddings] ✓ Google successful');
    return { embedding, provider: 'google' };
  } catch (googleError: any) {
    const isOverloaded =
      googleError.message?.includes('503') ||
      googleError.message?.includes('overloaded') ||
      googleError.status === 503;

    if (isOverloaded) {
      console.warn('[Embeddings] Google overloaded, falling back to OpenAI...');
      try {
        const embedding = await generateOpenAIEmbedding(text);
        console.log('[Embeddings] ✓ OpenAI fallback successful');
        return { embedding, provider: 'openai' };
      } catch (openaiError: any) {
        console.error('[Embeddings] Both providers failed:', {
          google: googleError.message,
          openai: openaiError.message,
        });
        throw new Error('All embedding providers failed');
      }
    }

    // If it's not an overload error, throw the original error
    throw googleError;
  }
}

/**
 * Generate embedding using Google Gemini with retry logic
 */
async function generateGoogleEmbedding(
  text: string,
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT'
): Promise<number[]> {
  const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

  const maxRetries = 2; // Reduced retries since we have fallback
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await genai.models.embedContent({
        model: GOOGLE_CONFIG.EMBEDDING_MODEL,
        contents: text,
        config: {
          taskType,
          outputDimensionality: GOOGLE_CONFIG.EMBEDDING_DIMENSIONS, // 1536
        },
      });

      if (!result.embeddings?.[0]?.values) {
        throw new Error('No embedding values returned');
      }

      return result.embeddings[0].values;
    } catch (error: any) {
      lastError = error;

      // Only retry on temporary errors
      const is503 = error.message?.includes('503') || error.status === 503;
      const is429 = error.message?.includes('429') || error.status === 429;

      if ((is503 || is429) && attempt < maxRetries) {
        const waitTime = 1000; // 1 second (reduced since we have fallback)
        console.log(`[Embeddings] Retrying Google in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error('Failed to generate Google embedding');
}

/**
 * Generate embedding using OpenAI text-embedding-3-small
 * Configured to output 1536 dimensions (same as Google)
 */
async function generateOpenAIEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAIClient();

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536, // Match Google's dimension
  });

  if (!response.data?.[0]?.embedding) {
    throw new Error('No embedding returned from OpenAI');
  }

  return response.data[0].embedding;
}

/**
 * Batch generate embeddings with fallback
 * Useful for processing multiple texts efficiently
 */
export async function batchGenerateEmbeddings(
  texts: string[],
  taskType: 'RETRIEVAL_QUERY' | 'RETRIEVAL_DOCUMENT' = 'RETRIEVAL_DOCUMENT'
): Promise<Array<{
  text: string;
  embedding: number[];
  provider: 'google' | 'openai';
}>> {
  const results = await Promise.all(
    texts.map(async (text) => {
      const { embedding, provider } = await generateEmbeddingWithFallback(text, taskType);
      return { text, embedding, provider };
    })
  );

  // Log provider distribution
  const providerCounts = results.reduce((acc, r) => {
    acc[r.provider] = (acc[r.provider] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('[Embeddings] Batch results:', providerCounts);

  return results;
}
