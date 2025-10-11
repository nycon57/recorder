/**
 * Document Generation Handler (Docify)
 *
 * Uses GPT-5 Nano to convert transcripts into well-structured, readable documents.
 */

import { openai, PROMPTS } from '@/lib/openai/client';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';

type Job = Database['public']['Tables']['jobs']['Row'];

interface DocifyPayload {
  recordingId: string;
  transcriptId: string;
  orgId: string;
}

/**
 * Generate document from transcript using GPT-5 Nano
 */
export async function generateDocument(job: Job): Promise<void> {
  const payload = job.payload as unknown as DocifyPayload;
  const { recordingId, transcriptId, orgId } = payload;

  console.log(`[Docify] Starting document generation for recording ${recordingId}`);

  const supabase = createAdminClient();

  // Update recording status
  await supabase
    .from('recordings')
    .update({ status: 'doc_generating' })
    .eq('id', recordingId);

  try {
    // Fetch transcript
    const { data: transcript, error: transcriptError } = await supabase
      .from('transcripts')
      .select('text, language, words_json')
      .eq('id', transcriptId)
      .single();

    if (transcriptError || !transcript) {
      throw new Error(`Failed to fetch transcript: ${transcriptError?.message || 'Not found'}`);
    }

    console.log(`[Docify] Loaded transcript (${transcript.text.length} chars)`);

    // Fetch recording metadata for context
    const { data: recording } = await supabase
      .from('recordings')
      .select('title, metadata')
      .eq('id', recordingId)
      .single();

    const title = recording?.title || 'Untitled Recording';
    const metadata = (recording?.metadata || {}) as Record<string, any>;

    // Extract duration from words_json
    const wordsData = (transcript.words_json || {}) as Record<string, any>;
    const durationSeconds = wordsData.duration || 0;

    // Build context for GPT-5 Nano
    const contextInfo = [
      `Title: ${title}`,
      `Duration: ${Math.round(durationSeconds / 60)} minutes`,
      metadata.description ? `Description: ${metadata.description}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    // Call GPT-5 Nano to generate document
    console.log(`[Docify] Calling GPT-5 Nano for document generation`);
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-nano-2025-08-07',
      messages: [
        {
          role: 'system',
          content: PROMPTS.DOCIFY,
        },
        {
          role: 'user',
          content: `${contextInfo}\n\nTranscript:\n${transcript.text}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 4000,
    });

    const generatedContent = completion.choices[0]?.message?.content;
    if (!generatedContent) {
      throw new Error('GPT-5 Nano returned empty response');
    }

    console.log(`[Docify] Generated document (${generatedContent.length} chars)`);

    // Extract metadata from GPT-5 Nano response (if structured)
    const documentMetadata = {
      model: completion.model,
      usage: completion.usage,
      generatedAt: new Date().toISOString(),
    };

    // Save document to database
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .insert({
        recording_id: recordingId,
        org_id: orgId,
        markdown: generatedContent,
        version: 'v1',
        model: completion.model,
        status: 'generated',
      })
      .select()
      .single();

    if (documentError) {
      throw new Error(`Failed to save document: ${documentError.message}`);
    }

    console.log(`[Docify] Saved document ${document.id}`);

    // Update recording status
    await supabase
      .from('recordings')
      .update({ status: 'completed' })
      .eq('id', recordingId);

    // Enqueue embedding generation job
    await supabase.from('jobs').insert({
      type: 'generate_embeddings',
      status: 'pending',
      payload: {
        recordingId,
        transcriptId,
        documentId: document.id,
        orgId,
      },
      dedupe_key: `generate_embeddings:${recordingId}`,
    });

    console.log(`[Docify] Enqueued embedding generation for recording ${recordingId}`);

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'document.generated',
      payload: {
        recordingId,
        documentId: document.id,
        orgId,
      },
    });

  } catch (error) {
    console.error(`[Docify] Error:`, error);

    // Update recording status to error
    await supabase
      .from('recordings')
      .update({
        status: 'error',
        metadata: {
          error: error instanceof Error ? error.message : 'Document generation failed',
        },
      })
      .eq('id', recordingId);

    throw error;
  }
}
