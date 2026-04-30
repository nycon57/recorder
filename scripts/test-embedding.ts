import { resolve } from 'path';

import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

import { GOOGLE_CONFIG } from '@/lib/google/client';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

type DocumentMarkdown = { markdown?: string | null };

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  const recordingId = '80e70735-9b25-4c8a-8345-c7d41545ccc7';

  // Get transcript and document
  const { data: transcript } = await supabase
    .from('transcripts')
    .select('text, words_json, visual_events')
    .eq('recording_id', recordingId)
    .single();

  const { data: document } = await supabase
    .from('documents')
    .select('markdown')
    .eq('recording_id', recordingId)
    .single();

  console.log('Transcript length:', transcript?.text?.length);
  console.log('Document length:', (document as DocumentMarkdown | null)?.markdown?.length);
  console.log('');

  // Now test with empty string (which might be the issue)
  try {
    console.log('Test 1: Embedding empty string...');
    const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

    await genai.models.embedContent({
      model: GOOGLE_CONFIG.EMBEDDING_MODEL,
      contents: '',  // Empty string!
      config: {
        taskType: GOOGLE_CONFIG.EMBEDDING_TASK_TYPE,
        outputDimensionality: GOOGLE_CONFIG.EMBEDDING_DIMENSIONS,
      },
    });

    console.log('✅ Empty string succeeded!');

  } catch (error: unknown) {
    console.error('❌ Empty string failed:', error instanceof Error ? error.message : error);
  }

  console.log('');

  // Test with null/undefined
  try {
    console.log('Test 2: Embedding null...');
    const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

    await genai.models.embedContent({
      model: GOOGLE_CONFIG.EMBEDDING_MODEL,
      contents: null as unknown as string,
      config: {
        taskType: GOOGLE_CONFIG.EMBEDDING_TASK_TYPE,
        outputDimensionality: GOOGLE_CONFIG.EMBEDDING_DIMENSIONS,
      },
    });

    console.log('✅ Null succeeded!');

  } catch (error: unknown) {
    console.error('❌ Null failed:', error instanceof Error ? error.message : error);
  }

  console.log('');

  // Test with proper text
  try {
    console.log('Test 3: Embedding actual transcript...');
    const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

    const result = await genai.models.embedContent({
      model: GOOGLE_CONFIG.EMBEDDING_MODEL,
      contents: transcript?.text || '',
      config: {
        taskType: GOOGLE_CONFIG.EMBEDDING_TASK_TYPE,
        outputDimensionality: GOOGLE_CONFIG.EMBEDDING_DIMENSIONS,
      },
    });

    console.log('✅ Transcript succeeded!');
    console.log('Embedding length:', result.embeddings?.[0]?.values?.length);

  } catch (error: unknown) {
    console.error('❌ Transcript failed:', error instanceof Error ? error.message : error);
  }
}

main().catch(console.error);
