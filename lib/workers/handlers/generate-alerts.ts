/**
 * Generate Alerts Job Handler
 *
 * Generates alerts based on configured thresholds for storage quota,
 * cost limits, and failed jobs. Runs every 15 minutes.
 */

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'generate-alerts' });

type Job = Database['public']['Tables']['jobs']['Row'];

interface GenerateAlertsPayload {
  organizationId?: string;
}

export async function handleGenerateAlerts(job: Job): Promise<void> {
  const payload = job.payload as GenerateAlertsPayload;
  const supabase = createAdminClient();

  logger.info('Starting alert generation', {
    context: { jobId: job.id, organizationId: payload.organizationId },
  });

  try {
    // Get all alert configs
    let configQuery = supabase.from('alert_config' as any).select('*');
    if (payload.organizationId) {
      configQuery = configQuery.eq('organization_id', payload.organizationId);
    }

    let configs: any[] = [];
    try {
      const { data, error } = await configQuery;
      if (error) {
        logger.warn('alert_config table not found, using default thresholds', {
          error: error.message,
        });
        // Use default config for all organizations
        const { data: organizations } = await supabase
          .from('organizations')
          .select('id');
        if (organizations) {
          configs = organizations.map(org => ({
            organization_id: org.id,
            storage_threshold: 80, // 80% of quota
            cost_threshold: 100,   // $100
            enable_email_notifications: false,
            enable_slack_notifications: false,
          }));
        }
      } else {
        configs = data || [];
      }
    } catch (error) {
      // Table doesn't exist, use defaults
      logger.debug('Using default alert configuration');
      const { data: organizations } = await supabase
        .from('organizations')
        .select('id');
      if (organizations) {
        configs = organizations.map(org => ({
          organization_id: org.id,
          storage_threshold: 80,
          cost_threshold: 100,
          enable_email_notifications: false,
          enable_slack_notifications: false,
        }));
      }
    }

    if (configs.length === 0) {
      logger.warn('No alert configurations found');
      return;
    }

    logger.info(`Processing alerts for ${configs.length} organization(s)`);

    // Process each organization's alert config
    for (const config of configs) {
      try {
        await generateAlertsForOrganization(supabase, config);
      } catch (error) {
        logger.error('Failed to generate alerts for organization', {
          context: { organizationId: config.organization_id },
          error: error as Error,
        });
        // Continue processing other organizations
      }
    }

    logger.info('Alert generation completed successfully');
  } catch (error) {
    logger.error('Alert generation failed', { error: error as Error });
    throw error;
  }
}

async function generateAlertsForOrganization(
  supabase: ReturnType<typeof createAdminClient>,
  config: any
): Promise<void> {
  logger.debug('Generating alerts for organization', {
    context: { organizationId: config.organization_id },
  });

  // Get latest metrics for this org
  let latestMetric: any = null;
  try {
    const { data } = await supabase
      .from('storage_metrics' as any)
      .select('*')
      .eq('organization_id', config.organization_id)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    latestMetric = data;
  } catch (error) {
    logger.debug('storage_metrics table not found, skipping metric-based alerts');
  }

  // Check storage threshold (if metrics available)
  if (latestMetric) {
    const { data: org } = await supabase
      .from('organizations')
      .select('max_storage_gb')
      .eq('id', config.organization_id)
      .single();

    if (org && org.max_storage_gb) {
      const quotaLimit = org.max_storage_gb * 1e9; // Convert GB to bytes
      const storagePercent = (latestMetric.total_storage / quotaLimit) * 100;

      if (storagePercent >= config.storage_threshold) {
        await createOrUpdateAlert(supabase, {
          organization_id: config.organization_id,
          severity: storagePercent >= 100 ? 'critical' : 'warning',
          type: 'storage_quota',
          message: `Storage at ${storagePercent.toFixed(1)}% of quota`,
          details: `Using ${(latestMetric.total_storage / 1e9).toFixed(2)}GB of ${org.max_storage_gb}GB`,
        });

        logger.info('Created storage quota alert', {
          context: { organizationId: config.organization_id },
          data: { storagePercent: storagePercent.toFixed(1) },
        });
      }
    }

    // Check cost threshold
    if (latestMetric.total_cost >= config.cost_threshold) {
      await createOrUpdateAlert(supabase, {
        organization_id: config.organization_id,
        severity: 'warning',
        type: 'cost_threshold',
        message: 'Cost threshold exceeded',
        details: `Current cost: $${latestMetric.total_cost.toFixed(2)}`,
      });

      logger.info('Created cost threshold alert', {
        context: { organizationId: config.organization_id },
        data: { totalCost: latestMetric.total_cost.toFixed(2) },
      });
    }
  }

  // Check for failed jobs (last hour) for this organization
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { count: failedJobs } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', config.organization_id)
    .eq('status', 'failed')
    .gte('created_at', oneHourAgo);

  if (failedJobs && failedJobs > 10) {
    await createOrUpdateAlert(supabase, {
      organization_id: config.organization_id,
      severity: 'warning',
      type: 'failed_jobs',
      message: `${failedJobs} jobs failed in the last hour`,
      details: 'Review job logs and retry failed jobs',
    });

    logger.info('Created failed jobs alert', {
      context: { organizationId: config.organization_id },
      data: { failedJobs },
    });
  }

  // Send notifications if enabled
  if (config.enable_email_notifications) {
    // TODO: Implement email notification service
    logger.debug('Email notifications enabled but not yet implemented');
  }

  if (config.enable_slack_notifications && config.slack_webhook_url) {
    // TODO: Implement Slack webhook notification
    logger.debug('Slack notifications enabled but not yet implemented');
  }
}

interface AlertData {
  organization_id: string;
  severity: 'info' | 'warning' | 'critical';
  type: string;
  message: string;
  details: string;
}

async function createOrUpdateAlert(
  supabase: ReturnType<typeof createAdminClient>,
  alertData: AlertData
): Promise<void> {
  try {
    // Check if alert already exists and is not resolved
    const { data: existingAlert } = await supabase
      .from('alerts' as any)
      .select('id')
      .eq('organization_id', alertData.organization_id)
      .eq('type', alertData.type)
      .eq('resolved', false)
      .maybeSingle();

    if (!existingAlert) {
      // Create new alert
      const { error } = await supabase.from('alerts' as any).insert({
        organization_id: alertData.organization_id,
        severity: alertData.severity,
        type: alertData.type,
        message: alertData.message,
        details: alertData.details,
        resolved: false,
        created_at: new Date().toISOString(),
      });

      if (error) {
        throw new Error(`Failed to create alert: ${error.message}`);
      }
    } else {
      // Update existing alert
      const { error } = await supabase
        .from('alerts' as any)
        .update({
          severity: alertData.severity,
          message: alertData.message,
          details: alertData.details,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingAlert.id);

      if (error) {
        logger.warn('Failed to update existing alert', { error: error.message });
      }
    }
  } catch (error) {
    logger.error('Failed to create/update alert - table may not exist yet', {
      context: { organizationId: alertData.organization_id },
      error: error as Error,
    });
    // Don't throw - this is non-critical
  }
}
