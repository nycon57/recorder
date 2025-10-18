/**
 * Anomaly Detection and Alert System
 *
 * Monitors storage metrics for anomalies and generates alerts for proactive issue resolution.
 * Uses statistical analysis and ML-based pattern recognition.
 */

import { createClient } from '@/lib/supabase/admin';
import { getStorageMetrics, getStorageTrends, detectAnomalies, type StorageAnomaly } from './storage-metrics';
import type { Database } from '@/lib/types/database';

type AlertType = Database['public']['Tables']['storage_alerts']['Row']['alert_type'];
type AlertSeverity = Database['public']['Tables']['storage_alerts']['Row']['alert_severity'];
type AlertStatus = Database['public']['Tables']['storage_alerts']['Row']['alert_status'];

/**
 * Alert configuration
 */
export interface AlertConfig {
  enabled: boolean;
  thresholds: {
    storageGrowth: number; // Percentage growth threshold
    costIncrease: number; // Percentage cost increase threshold
    failedJobs: number; // Number of failed jobs threshold
    processingDelay: number; // Hours of processing delay
    deduplicationRate: number; // Minimum deduplication rate percentage
    compressionRate: number; // Minimum compression rate percentage
  };
  notifications: {
    email: boolean;
    slack: boolean;
    webhook?: string;
  };
}

/**
 * Default alert configuration
 */
const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: true,
  thresholds: {
    storageGrowth: 50, // Alert if growth exceeds 50%
    costIncrease: 30, // Alert if cost increases by 30%
    failedJobs: 5, // Alert if 5+ jobs failed
    processingDelay: 24, // Alert if processing delayed > 24 hours
    deduplicationRate: 20, // Alert if dedup rate < 20%
    compressionRate: 30, // Alert if compression rate < 30%
  },
  notifications: {
    email: true,
    slack: false,
  },
};

/**
 * Alert with notification details
 */
export interface Alert {
  id: string;
  orgId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  recommendation?: string;
  metricName: string;
  currentValue: number;
  expectedValue?: number;
  thresholdValue?: number;
  deviationPercentage?: number;
  status: AlertStatus;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
}

/**
 * Run anomaly detection and create alerts
 */
export async function detectAndAlert(orgId: string, config: AlertConfig = DEFAULT_ALERT_CONFIG): Promise<{
  anomaliesDetected: number;
  alertsCreated: number;
  alerts: Alert[];
}> {
  if (!config.enabled) {
    return { anomaliesDetected: 0, alertsCreated: 0, alerts: [] };
  }

  const supabase = createClient();

  // Run anomaly detection
  const anomalies = await detectAnomalies(orgId);
  const metrics = await getStorageMetrics(orgId);

  const alertsToCreate: Omit<Alert, 'id' | 'createdAt'>[] = [];

  // Process detected anomalies
  for (const anomaly of anomalies) {
    const alert = convertAnomalyToAlert(orgId, anomaly);
    if (alert) {
      alertsToCreate.push(alert);
    }
  }

  // Check threshold-based alerts
  const thresholdAlerts = await checkThresholds(orgId, metrics, config);
  alertsToCreate.push(...thresholdAlerts);

  // Create alerts in database
  const createdAlerts: Alert[] = [];

  for (const alert of alertsToCreate) {
    // Check if similar alert already exists and is active
    const { data: existingAlert } = await supabase
      .from('storage_alerts')
      .select('*')
      .eq('org_id', orgId)
      .eq('alert_type', alert.type)
      .eq('status', 'active')
      .single();

    if (!existingAlert) {
      const { data, error } = await supabase
        .from('storage_alerts')
        .insert({
          org_id: orgId,
          alert_type: alert.type,
          severity: alert.severity,
          metric_name: alert.metricName,
          current_value: alert.currentValue,
          expected_value: alert.expectedValue,
          threshold_value: alert.thresholdValue,
          deviation_percentage: alert.deviationPercentage,
          title: alert.title,
          description: alert.description,
          recommendation: alert.recommendation,
          status: alert.status,
        })
        .select()
        .single();

      if (!error && data) {
        createdAlerts.push({
          id: data.id,
          orgId: data.org_id,
          type: data.alert_type,
          severity: data.severity,
          title: data.title,
          description: data.description,
          recommendation: data.recommendation || undefined,
          metricName: data.metric_name,
          currentValue: Number(data.current_value),
          expectedValue: data.expected_value ? Number(data.expected_value) : undefined,
          thresholdValue: data.threshold_value ? Number(data.threshold_value) : undefined,
          deviationPercentage: data.deviation_percentage ? Number(data.deviation_percentage) : undefined,
          status: data.status,
          createdAt: data.created_at,
          acknowledgedAt: data.acknowledged_at || undefined,
          acknowledgedBy: data.acknowledged_by || undefined,
          resolvedAt: data.resolved_at || undefined,
        });

        // Send notifications
        if (config.notifications.email || config.notifications.slack || config.notifications.webhook) {
          await sendAlertNotifications(data, config.notifications);
        }
      }
    }
  }

  return {
    anomaliesDetected: anomalies.length,
    alertsCreated: createdAlerts.length,
    alerts: createdAlerts,
  };
}

/**
 * Convert anomaly to alert
 */
function convertAnomalyToAlert(
  orgId: string,
  anomaly: StorageAnomaly
): Omit<Alert, 'id' | 'createdAt'> | null {
  const severityMap: Record<StorageAnomaly['severity'], AlertSeverity> = {
    low: 'low',
    medium: 'medium',
    high: 'high',
  };

  const typeMap: Record<StorageAnomaly['type'], AlertType> = {
    spike: 'spike',
    drop: 'drop',
    unusual_growth: 'unusual_growth',
    unusual_shrinkage: 'unusual_shrinkage',
    cost_spike: 'cost_spike',
  };

  return {
    orgId,
    type: typeMap[anomaly.type],
    severity: severityMap[anomaly.severity],
    title: `Storage ${anomaly.type} detected`,
    description: anomaly.description,
    recommendation: anomaly.recommendation,
    metricName: anomaly.metric,
    currentValue: anomaly.currentValue,
    expectedValue: anomaly.expectedValue,
    deviationPercentage: anomaly.deviation,
    status: 'active',
  };
}

/**
 * Check threshold-based alerts
 */
async function checkThresholds(
  orgId: string,
  metrics: any,
  config: AlertConfig
): Promise<Omit<Alert, 'id' | 'createdAt'>[]> {
  const alerts: Omit<Alert, 'id' | 'createdAt'>[] = [];

  // Check failed jobs threshold
  if (metrics.processingStatus.failed >= config.thresholds.failedJobs) {
    alerts.push({
      orgId,
      type: 'processing_failure',
      severity: 'high',
      title: 'Multiple job processing failures detected',
      description: `${metrics.processingStatus.failed} jobs have failed. This may indicate an issue with the processing pipeline.`,
      recommendation: 'Review job logs and retry failed jobs. Check for API rate limits or quota issues.',
      metricName: 'failed_jobs',
      currentValue: metrics.processingStatus.failed,
      thresholdValue: config.thresholds.failedJobs,
      status: 'active',
    });
  }

  // Check deduplication rate
  if (
    metrics.optimization.deduplicationRatio < config.thresholds.deduplicationRate &&
    metrics.totalFiles > 100
  ) {
    alerts.push({
      orgId,
      type: 'optimization_needed',
      severity: 'medium',
      title: 'Low deduplication rate detected',
      description: `Only ${metrics.optimization.deduplicationRatio.toFixed(1)}% of files have been deduplicated. Running deduplication could save storage costs.`,
      recommendation: 'Schedule a batch deduplication job to identify and eliminate duplicate files.',
      metricName: 'deduplication_rate',
      currentValue: metrics.optimization.deduplicationRatio,
      thresholdValue: config.thresholds.deduplicationRate,
      status: 'active',
    });
  }

  // Check compression rate
  if (
    metrics.optimization.compressionRatio < config.thresholds.compressionRate &&
    metrics.totalFiles > 100
  ) {
    alerts.push({
      orgId,
      type: 'optimization_needed',
      severity: 'medium',
      title: 'Low compression rate detected',
      description: `Only ${metrics.optimization.compressionRatio.toFixed(1)}% compression achieved. Enabling progressive compression could reduce storage costs.`,
      recommendation: 'Enable compression for new uploads and run batch compression on existing files.',
      metricName: 'compression_rate',
      currentValue: metrics.optimization.compressionRatio,
      thresholdValue: config.thresholds.compressionRate,
      status: 'active',
    });
  }

  return alerts;
}

/**
 * Send alert notifications
 */
async function sendAlertNotifications(
  alert: any,
  notifications: AlertConfig['notifications']
): Promise<void> {
  try {
    // Email notification
    if (notifications.email) {
      // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
      console.log('[Alert] Email notification:', {
        to: 'admin@example.com', // Get from org settings
        subject: alert.title,
        body: alert.description,
      });
    }

    // Slack notification
    if (notifications.slack) {
      // TODO: Integrate with Slack webhook
      console.log('[Alert] Slack notification:', {
        channel: '#alerts',
        text: `🚨 ${alert.title}\n${alert.description}`,
      });
    }

    // Custom webhook
    if (notifications.webhook) {
      await fetch(notifications.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert: {
            type: alert.alert_type,
            severity: alert.severity,
            title: alert.title,
            description: alert.description,
            recommendation: alert.recommendation,
            timestamp: alert.created_at,
          },
        }),
      });
    }
  } catch (error) {
    console.error('[Alert] Failed to send notifications:', error);
  }
}

/**
 * Get active alerts for organization
 */
export async function getActiveAlerts(orgId: string): Promise<Alert[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('storage_alerts')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch alerts: ${error.message}`);
  }

  return (data || []).map((d) => ({
    id: d.id,
    orgId: d.org_id,
    type: d.alert_type,
    severity: d.severity,
    title: d.title,
    description: d.description,
    recommendation: d.recommendation || undefined,
    metricName: d.metric_name,
    currentValue: Number(d.current_value),
    expectedValue: d.expected_value ? Number(d.expected_value) : undefined,
    thresholdValue: d.threshold_value ? Number(d.threshold_value) : undefined,
    deviationPercentage: d.deviation_percentage ? Number(d.deviation_percentage) : undefined,
    status: d.status,
    createdAt: d.created_at,
    acknowledgedAt: d.acknowledged_at || undefined,
    acknowledgedBy: d.acknowledged_by || undefined,
    resolvedAt: d.resolved_at || undefined,
  }));
}

/**
 * Acknowledge alert
 */
export async function acknowledgeAlert(
  alertId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('storage_alerts')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', alertId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Resolve alert
 */
export async function resolveAlert(
  alertId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('storage_alerts')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', alertId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Dismiss alert
 */
export async function dismissAlert(
  alertId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from('storage_alerts')
    .update({
      status: 'dismissed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', alertId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get alert summary statistics
 */
export async function getAlertSummary(orgId: string): Promise<{
  total: number;
  active: number;
  acknowledged: number;
  resolved: number;
  dismissed: number;
  bySeverity: Record<AlertSeverity, number>;
  byType: Record<string, number>;
}> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('storage_alerts')
    .select('*')
    .eq('org_id', orgId);

  if (error) {
    throw new Error(`Failed to fetch alert summary: ${error.message}`);
  }

  const alerts = data || [];

  const bySeverity: Record<AlertSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };

  const byType: Record<string, number> = {};

  alerts.forEach((alert) => {
    bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
    byType[alert.alert_type] = (byType[alert.alert_type] || 0) + 1;
  });

  return {
    total: alerts.length,
    active: alerts.filter((a) => a.status === 'active').length,
    acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
    resolved: alerts.filter((a) => a.status === 'resolved').length,
    dismissed: alerts.filter((a) => a.status === 'dismissed').length,
    bySeverity,
    byType,
  };
}

/**
 * Schedule automated anomaly detection for all organizations
 */
export async function scheduleAnomalyDetectionForAll(): Promise<{
  success: boolean;
  organizationsProcessed: number;
  totalAlerts: number;
  errors: string[];
}> {
  const supabase = createClient();

  const { data: organizations, error } = await supabase
    .from('organizations')
    .select('id, name')
    .is('deleted_at', null);

  if (error) {
    return {
      success: false,
      organizationsProcessed: 0,
      totalAlerts: 0,
      errors: [error.message],
    };
  }

  let totalAlerts = 0;
  const errors: string[] = [];

  for (const org of organizations || []) {
    try {
      const result = await detectAndAlert(org.id);
      totalAlerts += result.alertsCreated;

      if (result.alertsCreated > 0) {
        console.log(
          `[Anomaly Detection] ${org.name}: ${result.anomaliesDetected} anomalies, ${result.alertsCreated} alerts created`
        );
      }
    } catch (error) {
      const errorMsg = `${org.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      errors.push(errorMsg);
      console.error('[Anomaly Detection] Error:', errorMsg);
    }
  }

  return {
    success: true,
    organizationsProcessed: organizations?.length || 0,
    totalAlerts,
    errors,
  };
}
