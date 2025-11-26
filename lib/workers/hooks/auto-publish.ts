/**
 * Auto-Publish Hook
 *
 * Called after document generation completes to check if auto-publish
 * is enabled for the organization and enqueue a publish job if so.
 *
 * This hook integrates with the document generation pipeline to automatically
 * publish newly generated documents to external systems (Google Drive,
 * SharePoint, OneDrive, Notion) based on organization settings.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/utils/logger';
import type {
  PublishDestination,
  PublishFormat,
  BrandingConfig,
  OrgPublishSettingsRow,
  PublishDocumentJobPayload,
} from '@/lib/types/publishing';

const logger = createLogger({ service: 'auto-publish-hook' });

// =====================================================
// TYPES
// =====================================================

interface AutoPublishOptions {
  contentId: string;
  documentId: string;
  orgId: string;
  userId?: string;
}

interface AutoPublishResult {
  triggered: boolean;
  jobId?: string;
  reason?: string;
}

// =====================================================
// MAIN HOOK FUNCTION
// =====================================================

/**
 * Check if auto-publish is enabled for the organization and enqueue publish job.
 *
 * This function is called after document generation completes. It:
 * 1. Fetches org_publish_settings for the orgId
 * 2. Checks if auto_publish_enabled is true
 * 3. Validates auto_publish_connector_id is set
 * 4. Creates a publish_document job with settings from org config
 *
 * @param options - Auto-publish options including contentId, documentId, orgId
 * @returns Result indicating whether auto-publish was triggered
 *
 * @example
 * ```typescript
 * // After document generation completes:
 * await checkAutoPublish({
 *   contentId: recording.id,
 *   documentId: document.id,
 *   orgId: recording.org_id,
 *   userId: recording.user_id,
 * });
 * ```
 */
export async function checkAutoPublish(
  options: AutoPublishOptions
): Promise<AutoPublishResult> {
  const { contentId, documentId, orgId, userId } = options;

  logger.info('Checking auto-publish settings', {
    context: { contentId, documentId, orgId },
  });

  const supabase = createAdminClient();

  try {
    // Step 1: Fetch org_publish_settings for the orgId
    const { data: settings, error: settingsError } = await supabase
      .from('org_publish_settings')
      .select('*')
      .eq('org_id', orgId)
      .single();

    // If no settings exist, auto-publish is not configured
    if (settingsError) {
      if (settingsError.code === 'PGRST116') {
        // Not found - org hasn't configured publish settings yet
        logger.debug('No publish settings found for organization', {
          context: { orgId },
        });
        return {
          triggered: false,
          reason: 'No publish settings configured for organization',
        };
      }
      // Other error
      logger.error('Failed to fetch org publish settings', {
        context: { orgId },
        error: settingsError,
      });
      return {
        triggered: false,
        reason: `Failed to fetch settings: ${settingsError.message}`,
      };
    }

    const publishSettings = settings as OrgPublishSettingsRow;

    // Step 2: Check if auto_publish_enabled is true
    if (!publishSettings.auto_publish_enabled) {
      logger.debug('Auto-publish is disabled for organization', {
        context: { orgId },
      });
      return {
        triggered: false,
        reason: 'Auto-publish is disabled',
      };
    }

    // Step 3: Check if auto_publish_connector_id is set
    if (!publishSettings.auto_publish_connector_id) {
      logger.warn('Auto-publish enabled but no connector configured', {
        context: { orgId },
      });
      return {
        triggered: false,
        reason: 'Auto-publish enabled but no connector configured',
      };
    }

    // Step 4: Validate the destination is set
    if (!publishSettings.auto_publish_destination) {
      logger.warn('Auto-publish enabled but no destination configured', {
        context: { orgId },
      });
      return {
        triggered: false,
        reason: 'Auto-publish enabled but no destination configured',
      };
    }

    const destination = publishSettings.auto_publish_destination as PublishDestination;
    const connectorId = publishSettings.auto_publish_connector_id;
    const folderId = publishSettings.auto_publish_folder_id || undefined;
    const folderPath = publishSettings.auto_publish_folder_path || undefined;
    const format = (publishSettings.default_format || 'native') as PublishFormat;
    const branding = (publishSettings.default_branding || {}) as Partial<BrandingConfig>;

    // Step 5: Create dedupe key to prevent duplicate jobs
    const dedupeKey = `auto-publish:${contentId}:${destination}`;

    // Check if job already exists
    const { data: existingJob } = await supabase
      .from('jobs')
      .select('id')
      .eq('dedupe_key', dedupeKey)
      .in('status', ['pending', 'processing'])
      .maybeSingle();

    if (existingJob) {
      logger.debug('Auto-publish job already exists', {
        context: { contentId, destination, existingJobId: existingJob.id },
      });
      return {
        triggered: false,
        reason: 'Publish job already pending or processing',
        jobId: existingJob.id,
      };
    }

    // Step 6: Create publish_document job
    const payload: PublishDocumentJobPayload = {
      contentId,
      documentId,
      orgId,
      userId,
      connectorId,
      destination,
      folderId,
      folderPath,
      format,
      branding,
      triggerType: 'auto',
    };

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        type: 'publish_document',
        status: 'pending',
        payload: payload as unknown as Record<string, unknown>,
        dedupe_key: dedupeKey,
        org_id: orgId,
        // Use normal priority for auto-publish jobs
        priority: 2,
      })
      .select('id')
      .single();

    if (jobError) {
      logger.error('Failed to create auto-publish job', {
        context: { contentId, documentId, orgId, destination },
        error: jobError,
      });
      return {
        triggered: false,
        reason: `Failed to create job: ${jobError.message}`,
      };
    }

    // Step 7: Log success
    logger.info('Auto-publish job created successfully', {
      context: {
        jobId: job.id,
        contentId,
        documentId,
        orgId,
        destination,
        connectorId,
        folderId,
        format,
      },
    });

    return {
      triggered: true,
      jobId: job.id,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Auto-publish check failed', {
      context: { contentId, documentId, orgId },
      error: error as Error,
    });
    return {
      triggered: false,
      reason: `Unexpected error: ${errorMessage}`,
    };
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Check if auto-publish is enabled for an organization without triggering.
 *
 * Useful for UI to show auto-publish status.
 *
 * @param orgId - Organization ID
 * @returns True if auto-publish is enabled and properly configured
 */
export async function isAutoPublishEnabled(orgId: string): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: settings } = await supabase
    .from('org_publish_settings')
    .select('auto_publish_enabled, auto_publish_connector_id, auto_publish_destination')
    .eq('org_id', orgId)
    .single();

  if (!settings) {
    return false;
  }

  return (
    settings.auto_publish_enabled === true &&
    !!settings.auto_publish_connector_id &&
    !!settings.auto_publish_destination
  );
}

/**
 * Get auto-publish configuration for an organization.
 *
 * @param orgId - Organization ID
 * @returns Auto-publish configuration or null if not configured
 */
export async function getAutoPublishConfig(
  orgId: string
): Promise<{
  enabled: boolean;
  destination?: PublishDestination;
  connectorId?: string;
  folderId?: string;
  folderPath?: string;
  format: PublishFormat;
  branding: Partial<BrandingConfig>;
} | null> {
  const supabase = createAdminClient();

  const { data: settings } = await supabase
    .from('org_publish_settings')
    .select('*')
    .eq('org_id', orgId)
    .single();

  if (!settings) {
    return null;
  }

  const publishSettings = settings as OrgPublishSettingsRow;

  return {
    enabled: publishSettings.auto_publish_enabled,
    destination: publishSettings.auto_publish_destination as PublishDestination | undefined,
    connectorId: publishSettings.auto_publish_connector_id || undefined,
    folderId: publishSettings.auto_publish_folder_id || undefined,
    folderPath: publishSettings.auto_publish_folder_path || undefined,
    format: (publishSettings.default_format || 'native') as PublishFormat,
    branding: (publishSettings.default_branding || {}) as Partial<BrandingConfig>,
  };
}

export default checkAutoPublish;
