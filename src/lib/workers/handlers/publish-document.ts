/**
 * Publish Document Job Handler
 *
 * Background worker handler for async document publishing to external systems
 * (Google Drive, SharePoint, OneDrive, Notion).
 *
 * This handler validates the job payload, invokes the DocumentPublisher service,
 * and handles success/failure states with proper logging and event tracking.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { DocumentPublisher } from '@/lib/services/document-publisher';
import { validatePublishJobPayload } from '@/lib/validations/publishing';
import { createLogger } from '@/lib/utils/logger';
import type { Database } from '@/lib/types/database';
import type { PublishDocumentJobPayload, PublishOptions } from '@/lib/types/publishing';

type Job = Database['public']['Tables']['jobs']['Row'];

const logger = createLogger({ service: 'publish-document' });

/**
 * Handle publish_document job
 *
 * Publishes a document to an external system (Google Drive, SharePoint, etc.)
 * via the configured connector.
 *
 * @param job - The job record from the jobs table
 * @throws Error if publishing fails (will trigger job retry)
 */
export async function handlePublishDocument(job: Job): Promise<void> {
  const startTime = Date.now();

  // Validate payload
  let payload: PublishDocumentJobPayload;
  try {
    payload = validatePublishJobPayload(job.payload);
  } catch (validationError) {
    logger.error('Invalid job payload', {
      context: { jobId: job.id },
      error: validationError as Error,
    });
    throw new Error(
      `Invalid publish job payload: ${validationError instanceof Error ? validationError.message : 'Validation failed'}`
    );
  }

  const { contentId, documentId, orgId, userId, connectorId, destination } = payload;

  logger.info(`Starting publish for content ${contentId}`, {
    context: {
      jobId: job.id,
      contentId,
      documentId,
      orgId,
      connectorId,
      destination,
    },
  });

  const supabase = createAdminClient();

  try {
    // Update job progress
    await supabase
      .from('jobs')
      .update({
        progress_message: 'Initializing publish...',
        progress_percent: 5,
      })
      .eq('id', job.id);

    // Build publish options from job payload
    const publishOptions: PublishOptions = {
      contentId: payload.contentId,
      documentId: payload.documentId,
      orgId: payload.orgId,
      userId: payload.userId,
      connectorId: payload.connectorId,
      destination: payload.destination,
      folderId: payload.folderId,
      folderPath: payload.folderPath,
      format: payload.format,
      branding: payload.branding,
      customTitle: payload.customTitle,
      triggerType: payload.triggerType ?? 'manual',
    };

    // Create publisher instance and execute publish
    const publisher = new DocumentPublisher();

    logger.info('Invoking DocumentPublisher', {
      context: { jobId: job.id, contentId },
    });

    await supabase
      .from('jobs')
      .update({
        progress_message: 'Publishing to external system...',
        progress_percent: 30,
      })
      .eq('id', job.id);

    const result = await publisher.publish(publishOptions);

    const durationMs = Date.now() - startTime;

    if (result.success) {
      logger.info('Document published successfully', {
        context: { jobId: job.id, contentId },
        data: {
          publicationId: result.publication?.id,
          externalUrl: result.externalUrl,
          durationMs,
        },
      });

      // Update job result with success info
      await supabase
        .from('jobs')
        .update({
          progress_message: 'Document published successfully',
          progress_percent: 100,
          result: {
            publicationId: result.publication?.id,
            externalUrl: result.externalUrl,
            durationMs,
          },
        })
        .eq('id', job.id);

      // Create event for notifications
      await supabase.from('events').insert({
        type: 'document.published',
        payload: {
          contentId,
          documentId,
          orgId,
          userId,
          connectorId,
          destination,
          publicationId: result.publication?.id,
          externalUrl: result.externalUrl,
          durationMs,
        },
      });

      logger.info(`Publish job completed for content ${contentId}`, {
        context: { jobId: job.id },
      });
    } else {
      // Publish returned success: false with error
      const errorMessage = result.error || 'Unknown publish error';
      const errorCode = result.errorCode || 'UNKNOWN_ERROR';

      logger.error(`Publish failed for content ${contentId}`, {
        context: { jobId: job.id, contentId },
        data: {
          errorMessage,
          errorCode,
          durationMs,
        },
      });

      // Update job with error info (throw will trigger retry)
      await supabase
        .from('jobs')
        .update({
          progress_message: `Publish failed: ${errorMessage}`,
          progress_percent: null,
          result: {
            errorCode,
            errorMessage,
            durationMs,
          },
        })
        .eq('id', job.id);

      // Throw to trigger job retry mechanism
      throw new Error(`Publish failed: ${errorMessage} (${errorCode})`);
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;

    logger.error('Publish job error', {
      context: {
        jobId: job.id,
        contentId,
        orgId,
      },
      error: error as Error,
      data: { durationMs },
    });

    // Update job with error info
    await supabase
      .from('jobs')
      .update({
        progress_message: error instanceof Error ? error.message : 'Unknown error',
        progress_percent: null,
        result: {
          durationMs,
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      })
      .eq('id', job.id);

    // Create failure event for notifications
    await supabase.from('events').insert({
      type: 'document.publish_failed',
      payload: {
        contentId,
        documentId,
        orgId,
        userId,
        connectorId,
        destination,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs,
      },
    });

    // Re-throw to trigger job retry
    throw error;
  }
}
