/**
 * Admin Alert Management API
 *
 * Manage system alerts and incidents:
 * - List active, acknowledged, and resolved alerts
 * - Acknowledge alerts
 * - Resolve alerts with notes
 * - Filter by severity (info, warning, critical)
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAdmin,
  successResponse,
  errors,
  parseBody,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import {
  adminAcknowledgeAlertSchema,
  adminResolveAlertSchema,
} from '@/lib/validations/api';

/**
 * GET /api/admin/alerts
 * List alert incidents with optional filtering
 */
export const GET = apiHandler(async (request: NextRequest) => {
  // Require admin privileges
  const { userId } = await requireAdmin();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || null;
  const severity = searchParams.get('severity') || null;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  // Build query with alert rule join
  let query = supabaseAdmin
    .from('alert_incidents')
    .select(
      `
      *,
      alert_rules (
        id,
        name,
        description,
        metric_name,
        condition,
        threshold,
        severity,
        notification_channels
      ),
      acknowledged_by_user:users!alert_incidents_acknowledged_by_fkey (
        id,
        name,
        email
      ),
      resolved_by_user:users!alert_incidents_resolved_by_fkey (
        id,
        name,
        email
      )
    `,
      { count: 'exact' }
    );

  // Apply filters
  if (status) {
    query = query.eq('status', status);
  }

  // Execute query
  const { data: incidents, error, count } = await query
    .order('triggered_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[AdminAlerts] Query error:', error);
    throw new Error('Failed to fetch alert incidents');
  }

  // Filter by severity (done in application since it's in joined table)
  let results = incidents || [];
  if (severity) {
    results = results.filter((i: any) => i.alert_rules?.severity === severity);
  }

  // Format results
  const formattedResults = results.map((incident: any) => ({
    id: incident.id,
    status: incident.status,
    triggeredAt: incident.triggered_at,
    acknowledgedAt: incident.acknowledged_at,
    resolvedAt: incident.resolved_at,
    metricValue: incident.metric_value,
    notes: incident.notes,
    metadata: incident.metadata,
    rule: incident.alert_rules
      ? {
          id: incident.alert_rules.id,
          name: incident.alert_rules.name,
          description: incident.alert_rules.description,
          metricName: incident.alert_rules.metric_name,
          condition: incident.alert_rules.condition,
          threshold: incident.alert_rules.threshold,
          severity: incident.alert_rules.severity,
          notificationChannels: incident.alert_rules.notification_channels,
        }
      : null,
    acknowledgedBy: incident.acknowledged_by_user
      ? {
          id: incident.acknowledged_by_user.id,
          name: incident.acknowledged_by_user.name,
          email: incident.acknowledged_by_user.email,
        }
      : null,
    resolvedBy: incident.resolved_by_user
      ? {
          id: incident.resolved_by_user.id,
          name: incident.resolved_by_user.name,
          email: incident.resolved_by_user.email,
        }
      : null,
  }));

  // Calculate summary stats
  const summary = {
    totalOpen: results.filter((i: any) => i.status === 'open').length,
    totalAcknowledged: results.filter((i: any) => i.status === 'acknowledged')
      .length,
    totalResolved: results.filter((i: any) => i.status === 'resolved').length,
    bySeverity: {
      critical: results.filter((i: any) => i.alert_rules?.severity === 'critical')
        .length,
      warning: results.filter((i: any) => i.alert_rules?.severity === 'warning')
        .length,
      info: results.filter((i: any) => i.alert_rules?.severity === 'info').length,
    },
  };

  return successResponse({
    incidents: formattedResults,
    summary,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
      hasMore: offset + limit < (count || 0),
    },
  });
});

/**
 * POST /api/admin/alerts/acknowledge
 * Acknowledge an alert incident
 */
export const POST = apiHandler(async (request: NextRequest) => {
  // Require admin privileges
  const { userId } = await requireAdmin();

  const body = await parseBody(request, adminAcknowledgeAlertSchema);
  const { incidentId, notes } = body;

  // Update incident
  const { data, error } = await supabaseAdmin
    .from('alert_incidents')
    .update({
      status: 'acknowledged',
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
      notes: notes || null,
    })
    .eq('id', incidentId)
    .select(
      `
      *,
      alert_rules (
        name,
        severity,
        metric_name
      )
    `
    )
    .single();

  if (error) {
    console.error('[AdminAlerts] Acknowledge error:', error);
    throw new Error('Failed to acknowledge alert');
  }

  return successResponse({
    message: 'Alert acknowledged successfully',
    incident: data,
  });
});

/**
 * PUT /api/admin/alerts/resolve
 * Resolve an alert incident
 */
export const PUT = apiHandler(async (request: NextRequest) => {
  // Require admin privileges
  const { userId } = await requireAdmin();

  const body = await parseBody(request, adminResolveAlertSchema);
  const { incidentId, notes } = body;

  // Update incident
  const { data, error } = await supabaseAdmin
    .from('alert_incidents')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      notes: notes || null,
    })
    .eq('id', incidentId)
    .select(
      `
      *,
      alert_rules (
        name,
        severity,
        metric_name
      )
    `
    )
    .single();

  if (error) {
    console.error('[AdminAlerts] Resolve error:', error);
    throw new Error('Failed to resolve alert');
  }

  return successResponse({
    message: 'Alert resolved successfully',
    incident: data,
  });
});
