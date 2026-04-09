import { NextRequest } from 'next/server';

import { apiHandler, requireOrg, successResponse, parseSearchParams } from '@/lib/utils/api';
import { alertsQuerySchema } from '@/lib/validations/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/analytics/alerts
 *
 * List alerts with filtering and statistics
 *
 * Query Parameters:
 * - resolved (boolean, optional): Filter by resolved status
 * - severity (string, optional): Filter by severity level (critical, warning, info)
 * - limit (number, default: 50): Limit results
 *
 * Returns:
 * - alerts: Array of alert objects with user details
 * - statistics: Alert counts by severity and status
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();

  // Parse and validate query parameters
  const params = parseSearchParams(request, alertsQuerySchema);
  const { resolved, severity, limit } = params as { resolved?: boolean; severity?: string; limit?: number };

  // Build query with filters
  let query = supabaseAdmin
    .from('alerts')
    .select(
      `
      *,
      acknowledged_by_user:users!acknowledged_by(id, name, email),
      resolved_by_user:users!resolved_by(id, name, email)
    `
    )
    .eq('organization_id', orgId)
    .order('severity', { ascending: false }) // critical first
    .order('created_at', { ascending: false })
    .limit(limit ?? 50); // Default to 50 if undefined

  // Apply filters
  if (resolved !== undefined) {
    query = query.eq('resolved', resolved);
  }

  if (severity) {
    query = query.eq('severity', severity);
  }

  const { data: alerts, error: alertsError } = await query;

  if (alertsError) {
    console.error('[GET /api/analytics/alerts] Error fetching alerts:', alertsError);
    throw new Error('Failed to fetch alerts');
  }

  // Calculate statistics
  const { data: stats, error: statsError } = await supabaseAdmin
    .from('alerts')
    .select('severity, resolved')
    .eq('organization_id', orgId);

  if (statsError) {
    console.error('[GET /api/analytics/alerts] Error fetching stats:', statsError);
    throw new Error('Failed to fetch alert statistics');
  }

  const statistics = {
    critical: stats?.filter((a) => a.severity === 'critical' && !a.resolved).length || 0,
    warning: stats?.filter((a) => a.severity === 'warning' && !a.resolved).length || 0,
    info: stats?.filter((a) => a.severity === 'info' && !a.resolved).length || 0,
    resolved: stats?.filter((a) => a.resolved).length || 0,
    total: stats?.length || 0,
    active: stats?.filter((a) => !a.resolved).length || 0,
  };

  // Transform alerts to match response format
  const transformedAlerts = (alerts || []).map((alert) => ({
    id: alert.id,
    organizationId: alert.organization_id,
    severity: alert.severity as 'critical' | 'warning' | 'info',
    type: alert.type,
    message: alert.message,
    details: alert.details,
    acknowledged: alert.acknowledged,
    acknowledgedAt: alert.acknowledged_at,
    acknowledgedBy: alert.acknowledged_by_user
      ? {
          id: alert.acknowledged_by_user.id,
          name: alert.acknowledged_by_user.name,
          email: alert.acknowledged_by_user.email,
        }
      : null,
    resolved: alert.resolved,
    resolvedAt: alert.resolved_at,
    resolvedBy: alert.resolved_by_user
      ? {
          id: alert.resolved_by_user.id,
          name: alert.resolved_by_user.name,
          email: alert.resolved_by_user.email,
        }
      : null,
    createdAt: alert.created_at,
    updatedAt: alert.updated_at,
  }));

  return successResponse({
    alerts: transformedAlerts,
    statistics,
  });
});
