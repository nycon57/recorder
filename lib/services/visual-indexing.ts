/**
 * Visual Indexing Service
 *
 * Uses Gemini Vision to generate descriptions of video frames.
 */

import { getGoogleAI } from '@/lib/google/client';
import { createClient } from '@/lib/supabase/admin';
import { promises as fs } from 'fs';
import { GoogleGenAI } from '@google/genai';
import { GOOGLE_CONFIG } from '@/lib/google/client';
import { sanitizeVisualDescription, detectPII, logPIIDetection } from '@/lib/utils/security';

export interface VisualDescription {
  frameId: string;
  description: string;
  sceneType: 'ui' | 'code' | 'terminal' | 'browser' | 'editor' | 'other';
  detectedElements: string[];
  confidence: number;
}

/**
 * Generate visual description for a frame
 */
export async function describeFrame(
  imagePath: string,
  frameContext?: string
): Promise<VisualDescription> {
  const genAI = getGoogleAI();
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
  });

  // Read image
  const imageBuffer = await fs.readFile(imagePath);
  const imageBase64 = imageBuffer.toString('base64');

  const prompt = `You are a video frame analyzer. Describe what you see in this screenshot in detail.

${frameContext ? `Context: ${frameContext}` : ''}

Provide:
1. **Description**: Detailed description of what's visible (2-3 sentences)
2. **Scene Type**: Classify as one of: ui, code, terminal, browser, editor, other
3. **Detected Elements**: List visible UI elements, buttons, text, etc. (up to 10 items)
4. **Confidence**: Your confidence in this analysis (0.0-1.0)

Focus on:
- Text on screen (headings, labels, error messages)
- UI components (buttons, inputs, modals)
- Code if visible (language, purpose)
- User actions or state
- Technical details that would help with search

Respond in JSON format:
{
  "description": "detailed description here",
  "sceneType": "ui|code|terminal|browser|editor|other",
  "detectedElements": ["element 1", "element 2", ...],
  "confidence": 0.95
}`;

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'image/jpeg',
        data: imageBase64,
      },
    },
    { text: prompt },
  ]);

  const responseText = result.response.text();

  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // SECURITY: Sanitize description for PII
    const rawDescription = parsed.description || '';
    const sanitizedDescription = sanitizeVisualDescription(rawDescription);

    // Log if PII detected
    const piiDetection = detectPII(rawDescription);
    if (piiDetection.hasPII) {
      logPIIDetection('Visual description', piiDetection.types);
    }

    return {
      frameId: '',
      description: sanitizedDescription,
      sceneType: parsed.sceneType || 'other',
      detectedElements: parsed.detectedElements || [],
      confidence: parsed.confidence || 0.7,
    };
  } catch (error) {
    console.error('[Visual Indexing] Parse error:', error);

    return {
      frameId: '',
      description: 'Unable to analyze frame',
      sceneType: 'other',
      detectedElements: [],
      confidence: 0.3,
    };
  }
}

/**
 * Generate embedding for text using Google AI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });

  const result = await genai.models.embedContent({
    model: GOOGLE_CONFIG.EMBEDDING_MODEL,
    contents: text,
    config: {
      taskType: GOOGLE_CONFIG.EMBEDDING_TASK_TYPE,
      outputDimensionality: GOOGLE_CONFIG.EMBEDDING_DIMENSIONS,
    },
  });

  const embedding = result.embeddings?.[0]?.values;

  if (!embedding) {
    throw new Error('No embedding returned from Google API');
  }

  return embedding;
}

/**
 * Batch process frames for a recording
 */
export async function indexRecordingFrames(
  recordingId: string,
  orgId: string
): Promise<void> {
  const supabase = createClient();

  // Get unprocessed frames
  const { data: frames, error } = await supabase
    .from('video_frames')
    .select('id, frame_url, frame_time_sec')
    .eq('recording_id', recordingId)
    .is('visual_description', null)
    .order('frame_number');

  if (error || !frames || frames.length === 0) {
    console.log('[Visual Indexing] No frames to process');
    return;
  }

  console.log('[Visual Indexing] Processing frames:', frames.length);

  // Process in parallel batches
  const batchSize = 5;

  for (let i = 0; i < frames.length; i += batchSize) {
    const batch = frames.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (frame) => {
        try {
          // Download frame from storage
          const { data: imageData } = await supabase.storage
            .from(process.env.FRAMES_STORAGE_BUCKET || 'video-frames')
            .download(frame.frame_url);

          if (!imageData) {
            console.warn('[Visual Indexing] Frame not found:', frame.id);
            return;
          }

          // Create temp file
          const tempPath = `/tmp/frame_${frame.id}.jpg`;
          const buffer = Buffer.from(await imageData.arrayBuffer());
          await fs.writeFile(tempPath, buffer);

          // Generate description
          const description = await describeFrame(tempPath);

          // Generate embedding for the description
          const embedding = await generateEmbedding(description.description);

          // Update frame
          await supabase
            .from('video_frames')
            .update({
              visual_description: description.description,
              visual_embedding: JSON.stringify(embedding), // Supabase expects string for vector
              scene_type: description.sceneType,
              detected_elements: description.detectedElements,
              metadata: {
                confidence: description.confidence,
              },
            })
            .eq('id', frame.id);

          // Cleanup
          await fs.unlink(tempPath).catch(() => {});

          console.log(`[Visual Indexing] Processed frame ${frame.id}`);
        } catch (error) {
          console.error(`[Visual Indexing] Error processing frame ${frame.id}:`, error);
        }
      })
    );
  }

  console.log('[Visual Indexing] Complete for recording:', recordingId);
}