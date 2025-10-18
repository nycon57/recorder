import { NextRequest } from 'next/server';

import { apiHandler, requireOrg, successResponse, parseBody } from '@/lib/utils/api';
import { alertConfigSchema } from '@/lib/validations/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/analytics/alerts/config
 *
 * Get alert configuration for the organization
 *
 * Returns:
 * - config: Alert configuration object
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();

  // Query alert config, use upsert to create default if doesn't exist
  const { data: config, error } = await supabaseAdmin
    .from('alert_config')
    .upsert(
      {
        organization_id: orgId,
        storage_threshold: 90,
        cost_threshold: 1000,
        enable_email_notifications: true,
        enable_slack_notifications: false,
        check_interval: 15,
      },
      { onConflict: 'organization_id', ignoreDuplicates: true }
    )
    .select()
    .single();

  if (error) {
    console.error('[GET /api/analytics/alerts/config] Error fetching/creating config:', error);

    // Fallback: try to select existing config if upsert failed due to race condition
    const { data: existingConfig, error: selectError } = await supabaseAdmin
      .from('alert_config')
      .select('*')
      .eq('organization_id', orgId)
      .single();

    if (selectError || !existingConfig) {
      console.error('[GET /api/analytics/alerts/config] Error in fallback select:', selectError);
      throw new Error('Failed to fetch or create alert configuration');
    }

    return successResponse({
      config: {
        id: existingConfig.id,
        organizationId: existingConfig.organization_id,
        storageThreshold: existingConfig.storage_threshold,
        costThreshold: existingConfig.cost_threshold,
        enableEmailNotifications: existingConfig.enable_email_notifications,
        enableSlackNotifications: existingConfig.enable_slack_notifications,
        slackWebhookUrl: existingConfig.slack_webhook_url,
        checkInterval: existingConfig.check_interval,
        createdAt: existingConfig.created_at,
        updatedAt: existingConfig.updated_at,
      },
    });
  }

  return successResponse({
    config: {
      id: config.id,
      organizationId: config.organization_id,
      storageThreshold: config.storage_threshold,
      costThreshold: config.cost_threshold,
      enableEmailNotifications: config.enable_email_notifications,
      enableSlackNotifications: config.enable_slack_notifications,
      slackWebhookUrl: config.slack_webhook_url,
      checkInterval: config.check_interval,
      createdAt: config.created_at,
      updatedAt: config.updated_at,
    },
  });
});

/**
 * PUT /api/analytics/alerts/config
 *
 * Update alert configuration
 *
 * Request Body:
 * - storageThreshold (number, optional): Storage usage threshold percentage (0-100)
 * - costThreshold (number, optional): Monthly cost threshold in USD
 * - enableEmailNotifications (boolean, optional): Enable email notifications
 * - enableSlackNotifications (boolean, optional): Enable Slack notifications
 * - slackWebhookUrl (string, optional): Slack webhook URL
 * - checkInterval (number, optional): Check interval in minutes (1-1440)
 *
 * Returns:
 * - config: Updated alert configuration object
 */
export const PUT = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const body = await parseBody(request, alertConfigSchema);

  // Build update object with only provided fields
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  if (body.storageThreshold !== undefined) {
    updateData.storage_threshold = body.storageThreshold;
  }

  if (body.costThreshold !== undefined) {
    updateData.cost_threshold = body.costThreshold;
  }

  if (body.enableEmailNotifications !== undefined) {
    updateData.enable_email_notifications = body.enableEmailNotifications;
  }

  if (body.enableSlackNotifications !== undefined) {
    updateData.enable_slack_notifications = body.enableSlackNotifications;
  }

  if (body.slackWebhookUrl !== undefined) {
    updateData.slack_webhook_url = body.slackWebhookUrl;
  }

  if (body.checkInterval !== undefined) {
    updateData.check_interval = body.checkInterval;
  }

  // Update config using upsert to handle missing config row
  const { data: config, error } = await supabaseAdmin
    .from('alert_config')
    .upsert(
      {
        ...updateData,
        organization_id: orgId,
      },
      { onConflict: 'organization_id' }
    )
    .select()
    .single();

  if (error) {
    console.error('[PUT /api/analytics/alerts/config] Error updating config:', error);
    throw new Error('Failed to update alert configuration');
  }

  return successResponse({
    config: {
      id: config.id,
      organizationId: config.organization_id,
      storageThreshold: config.storage_threshold,
      costThreshold: config.cost_threshold,
      enableEmailNotifications: config.enable_email_notifications,
      enableSlackNotifications: config.enable_slack_notifications,
      slackWebhookUrl: config.slack_webhook_url,
      checkInterval: config.check_interval,
      createdAt: config.created_at,
      updatedAt: config.updated_at,
    },
  });
});
