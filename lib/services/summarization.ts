/**
 * Recording Summarization Service
 *
 * Generates high-quality summaries of recordings by combining transcript and document content.
 * Uses Google Gemini 2.5 Flash for summarization.
 */

import { getGoogleAI, GOOGLE_CONFIG } from '@/lib/google/client';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { withTimeout } from '@/lib/utils/timeout';

export interface SummarizationInput {
  recordingId: string;
  orgId: string;
}

export interface SummarizationResult {
  summaryText: string;
  wordCount: number;
  model: string;
}

/**
 * Generate a comprehensive summary of a recording
 * Combines transcript and document to create a 500-1000 word summary
 */
export async function generateRecordingSummary(
  recordingId: string,
  orgId: string
): Promise<SummarizationResult> {
  console.log(`[Summarization] Starting summary generation for recording ${recordingId}`);

  const supabase = createAdminClient();

  // Fetch recording metadata
  const { data: recording, error: recordingError } = await supabase
    .from('recordings')
    .select('title, description, duration_sec, metadata')
    .eq('id', recordingId)
    .eq('org_id', orgId)
    .single();

  if (recordingError || !recording) {
    throw new Error(`Failed to fetch recording: ${recordingError?.message || 'Not found'}`);
  }

  // Fetch transcript
  const { data: transcript, error: transcriptError } = await supabase
    .from('transcripts')
    .select('text, visual_events, video_metadata, provider')
    .eq('recording_id', recordingId)
    .single();

  if (transcriptError || !transcript) {
    throw new Error(`Failed to fetch transcript: ${transcriptError?.message || 'Not found'}`);
  }

  // Fetch document
  const { data: document, error: documentError } = await supabase
    .from('documents')
    .select('markdown')
    .eq('recording_id', recordingId)
    .eq('org_id', orgId)
    .single();

  if (documentError || !document) {
    throw new Error(`Failed to fetch document: ${documentError?.message || 'Not found'}`);
  }

  console.log(`[Summarization] Loaded transcript (${transcript.text.length} chars) and document (${document.markdown.length} chars)`);

  // Calculate target summary length based on content length
  const totalContentLength = transcript.text.length + document.markdown.length;
  const targetWords = Math.min(1000, Math.max(500, Math.floor(totalContentLength / 10)));

  // Build context for summary
  const title = recording.title || 'Untitled Recording';
  const duration = recording.duration_sec
    ? `${Math.floor(recording.duration_sec / 60)}:${String(Math.floor(recording.duration_sec % 60)).padStart(2, '0')}`
    : 'Unknown';

  const hasVisualEvents = transcript.visual_events && (transcript.visual_events as any[]).length > 0;
  const recordingType = hasVisualEvents ? 'screen recording with visual interactions' : 'audio recording';

  // Format visual context if available
  let visualContext = '';
  if (hasVisualEvents) {
    const visualEvents = transcript.visual_events as any[];
    const eventSummary = visualEvents.slice(0, 10).map((event: any) => {
      return `- [${event.timestamp}] ${event.type || 'action'}: ${event.description}`;
    }).join('\n');

    visualContext = `\n\nKey Visual Events (first 10):\n${eventSummary}${visualEvents.length > 10 ? `\n... and ${visualEvents.length - 10} more events` : ''}`;
  }

  // Build summarization prompt
  const prompt = `You are an expert at creating concise, informative summaries of recordings.

Your task is to create a comprehensive summary of this recording by analyzing both the transcript and the structured document.

## Recording Information
- **Title**: ${title}
- **Type**: ${recordingType}
- **Duration**: ${duration}
${recording.description ? `- **Description**: ${recording.description}` : ''}

## Instructions
Create a ${targetWords}-word summary that includes:

1. **Overview** (2-3 sentences): What is this recording about? What's the main purpose or topic?

2. **Key Topics & Themes**: List the 5-7 most important topics discussed or demonstrated

3. **Important Details**:
   - Technical terms, product names, or specific terminology used
   - Specific steps, procedures, or workflows explained
   - Key decisions, conclusions, or outcomes mentioned

4. **Timeline of Events** (if applicable):
   - Major sections or phases of the recording
   - What happened in what order
   - Key transitions or turning points

5. **Actionable Items** (if any):
   - Tasks mentioned
   - Next steps discussed
   - Recommendations made

## Content to Summarize

### Structured Document (AI-generated)
${document.markdown}

### Original Transcript
${transcript.text}
${visualContext}

## Output Requirements
- Write in clear, professional language
- Use bullet points and short paragraphs for readability
- Focus on substance over filler
- Capture the essence of the content, not just surface details
- Target length: approximately ${targetWords} words
- Use markdown formatting (headings, lists, bold for emphasis)

Generate the summary now:`;

  // Calculate output tokens with a more generous buffer
  const maxOutputTokens = Math.max(2048, Math.ceil(targetWords * 2)); // At least 2048 tokens

  console.log(`[Summarization] Calling Gemini 2.5 Flash for summary generation (target: ${targetWords} words, maxTokens: ${maxOutputTokens})`);

  // Call Gemini to generate summary
  const googleAI = getGoogleAI();
  const model = googleAI.getGenerativeModel({
    model: GOOGLE_CONFIG.DOCIFY_MODEL, // Use same model as document generation
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
    ],
  });

  try {
    // Wrap the API call with a 60-second timeout
    const result = await withTimeout(
      model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.5, // Lower temperature for more focused summaries
          maxOutputTokens,
        },
      }),
      60000, // 60 second timeout
      'Summary generation timed out after 60 seconds'
    );

    const response = await result.response;
    const summaryText = response.text();

    if (!summaryText || summaryText.length < 50) {
      console.error(`[Summarization] Gemini returned insufficient content. Response length: ${summaryText?.length || 0}`);
      console.error(`[Summarization] Full response:`, JSON.stringify(response, null, 2));
      throw new Error('Gemini returned empty or too short summary');
    }

    // Calculate word count
    const wordCount = summaryText.split(/\s+/).length;

    console.log(`[Summarization] Generated summary (${summaryText.length} chars, ~${wordCount} words)`);

    return {
      summaryText,
      wordCount,
      model: GOOGLE_CONFIG.DOCIFY_MODEL,
    };
  } catch (error: any) {
    console.error(`[Summarization] Error during generation:`, error);
    if (error.message?.includes('empty or too short')) {
      throw error;
    }
    throw new Error(`Gemini API error: ${error.message || 'Unknown error'}`);
  }
}
