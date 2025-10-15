/**
 * Process Imported Document Handler
 *
 * Handles processing of imported documents from connectors:
 * 1. Chunks the document content (semantic chunking)
 * 2. Generates embeddings for chunks
 * 3. Stores in vector database for semantic search
 */

import { GoogleGenAI } from '@google/genai';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { GOOGLE_CONFIG } from '@/lib/google/client';
import { createSemanticChunker } from '@/lib/services/semantic-chunker';
import { classifyContent } from '@/lib/services/content-classifier';
import { getAdaptiveChunkConfig } from '@/lib/services/adaptive-sizing';
import { sanitizeMetadata } from '@/lib/utils/config-validation';

type Job = Database['public']['Tables']['jobs']['Row'];

interface ProcessImportedDocPayload {
  documentId: string;
  connectorId: string;
  orgId: string;
}

const BATCH_SIZE = 20; // Process embeddings in batches
const DB_INSERT_BATCH_SIZE = 100; // Insert to database in batches

/**
 * Process an imported document: chunk and generate embeddings
 */
export async function processImportedDocument(job: Job): Promise<void> {
  const payload = job.payload as unknown as ProcessImportedDocPayload;
  const { documentId, connectorId, orgId } = payload;

  console.log(`[Process-Imported-Doc] Starting processing for document ${documentId}`);

  const supabase = createAdminClient();

  try {
    // Fetch imported document
    const { data: importedDoc, error: docError } = await supabase
      .from('imported_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !importedDoc) {
      throw new Error(`Document not found: ${docError?.message || 'Not found'}`);
    }

    // Check if already processed (idempotency)
    if (importedDoc.sync_status === 'completed') {
      console.log(`[Process-Imported-Doc] Document ${documentId} already processed`);
      return;
    }

    // Update status to processing
    await supabase
      .from('imported_documents')
      .update({
        sync_status: 'processing',
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    // Validate content
    if (!importedDoc.content || importedDoc.content.trim().length === 0) {
      throw new Error('Document has no content');
    }

    const content = importedDoc.content;
    console.log(
      `[Process-Imported-Doc] Processing document: ${importedDoc.title || 'Untitled'} (${content.length} chars)`
    );

    // Check if embeddings already exist in transcript_chunks table
    // Note: Using transcript_chunks table until imported_doc_chunks is created
    const { count: existingChunks } = await supabase
      .from('transcript_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('metadata->>imported_document_id', documentId);

    if (existingChunks && existingChunks > 0) {
      console.log(
        `[Process-Imported-Doc] Embeddings already exist (${existingChunks} chunks), updating status`
      );

      await supabase
        .from('imported_documents')
        .update({
          sync_status: 'completed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', documentId);

      return;
    }

    // Classify content type for adaptive chunking
    const contentClassification = classifyContent(content);
    console.log(
      `[Process-Imported-Doc] Content type: ${contentClassification.type} (confidence: ${contentClassification.confidence.toFixed(2)})`
    );

    // Get adaptive chunk config based on content type
    const chunkConfig = getAdaptiveChunkConfig(contentClassification.type);

    // Create semantic chunker
    const chunker = createSemanticChunker(chunkConfig);

    // Generate semantic chunks
    console.log(`[Process-Imported-Doc] Generating semantic chunks...`);
    const chunks = await chunker.chunk(content, {
      documentId,
      contentType: contentClassification.type,
    });

    console.log(`[Process-Imported-Doc] Created ${chunks.length} semantic chunks`);

    // Generate embeddings for chunks
    console.log(`[Process-Imported-Doc] Generating embeddings...`);

    const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
    const embeddingRecords = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);

      console.log(
        `[Process-Imported-Doc] Embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunks.length / BATCH_SIZE)}`
      );

      // Process chunks in parallel
      const batchResults = await Promise.all(
        batch.map(async (chunk, batchIndex) => {
          const result = await genai.models.embedContent({
            model: GOOGLE_CONFIG.EMBEDDING_MODEL,
            contents: chunk.text,
            config: {
              taskType: GOOGLE_CONFIG.EMBEDDING_TASK_TYPE,
              outputDimensionality: GOOGLE_CONFIG.EMBEDDING_DIMENSIONS,
            },
          });

          const embedding = result.embeddings?.[0]?.values;

          if (!embedding) {
            throw new Error(`No embedding returned for chunk ${i + batchIndex}`);
          }

          // Sanitize metadata
          const metadata = sanitizeMetadata({
            chunkIndex: i + batchIndex,
            startPosition: chunk.startPosition,
            endPosition: chunk.endPosition,
            semanticScore: chunk.semanticScore,
            structureType: chunk.structureType,
            boundaryType: chunk.boundaryType,
            tokenCount: chunk.tokenCount,
            sentenceCount: chunk.sentences.length,
            contentType: contentClassification.type,
            externalId: importedDoc.external_id,
            sourceUrl: importedDoc.source_url,
            fileType: importedDoc.file_type,
          });

          return {
            org_id: orgId,
            chunk_index: i + batchIndex,
            chunk_text: chunk.text,
            embedding: JSON.stringify(embedding),
            // Semantic chunking metadata
            chunking_strategy: 'semantic',
            semantic_score: chunk.semanticScore,
            structure_type: chunk.structureType,
            boundary_type: chunk.boundaryType,
            metadata: {
              ...metadata,
              connector_id: connectorId,
              imported_document_id: documentId,
            },
          };
        })
      );

      embeddingRecords.push(...batchResults);

      // Small delay to avoid rate limits
      if (i + BATCH_SIZE < chunks.length) {
        await sleep(100);
      }
    }

    console.log(
      `[Process-Imported-Doc] Generated ${embeddingRecords.length} embeddings, saving to database`
    );

    // Save embeddings to database in batches
    // Note: Using transcript_chunks table until imported_doc_chunks is created in Phase 5 migration
    for (let i = 0; i < embeddingRecords.length; i += DB_INSERT_BATCH_SIZE) {
      const batch = embeddingRecords.slice(
        i,
        Math.min(i + DB_INSERT_BATCH_SIZE, embeddingRecords.length)
      );

      console.log(
        `[Process-Imported-Doc] Saving batch ${Math.floor(i / DB_INSERT_BATCH_SIZE) + 1}/${Math.ceil(embeddingRecords.length / DB_INSERT_BATCH_SIZE)}`
      );

      // Transform to transcript_chunks format
      const transcriptChunksBatch = batch.map(record => ({
        recording_id: documentId, // Use documentId as recording_id temporarily
        org_id: record.org_id,
        chunk_index: record.chunk_index,
        chunk_text: record.chunk_text,
        embedding: record.embedding,
        chunking_strategy: record.chunking_strategy,
        semantic_score: record.semantic_score,
        structure_type: record.structure_type,
        boundary_type: record.boundary_type,
        metadata: {
          ...record.metadata,
          imported_document_id: documentId,
          connector_id: connectorId,
          source_type: 'imported_document',
        },
      }));

      const { error: insertError } = await supabase
        .from('transcript_chunks')
        .insert(transcriptChunksBatch);

      if (insertError) {
        throw new Error(
          `Failed to save embeddings batch: ${insertError.message}`
        );
      }

      // Small delay between batches
      if (i + DB_INSERT_BATCH_SIZE < embeddingRecords.length) {
        await sleep(50);
      }
    }

    console.log(
      `[Process-Imported-Doc] Successfully saved ${embeddingRecords.length} embeddings`
    );

    // Update imported document status
    await supabase
      .from('imported_documents')
      .update({
        sync_status: 'completed',
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    // Create event for notifications
    await supabase.from('events').insert({
      type: 'imported_document.processed',
      payload: {
        documentId,
        connectorId,
        orgId,
        chunkCount: embeddingRecords.length,
        contentType: contentClassification.type,
      },
    });

    console.log(
      `[Process-Imported-Doc] Processing complete for document ${documentId}`
    );
  } catch (error) {
    console.error(`[Process-Imported-Doc] Error:`, error);

    // Update document status to error
    await supabase
      .from('imported_documents')
      .update({
        sync_status: 'error',
        sync_error:
          error instanceof Error ? error.message : 'Processing failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', documentId);

    throw error;
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
