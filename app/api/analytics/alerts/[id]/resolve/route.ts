import { NextRequest } from 'next/server';

import { apiHandler, requireAuth, successResponse, errors } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/analytics/alerts/[id]/resolve
 *
 * Resolve an alert
 *
 * Path Parameters:
 * - id: Alert ID (UUID)
 *
 * Returns:
 * - alert: Updated alert object
 */
export const POST = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { userId } = await requireAuth();
  const params = await context.params;
  const alertId = params.id;

  // Verify alert exists
  const { data: alert, error: fetchError } = await supabaseAdmin
    .from('alerts')
    .select('id, organization_id, resolved')
    .eq('id', alertId)
    .single();

  if (fetchError || !alert) {
    throw errors.notFound('Alert');
  }

  // Check if already resolved
  if (alert.resolved) {
    throw errors.badRequest('Alert is already resolved');
  }

  // Update alert with resolution info
  const { data: updatedAlert, error: updateError } = await supabaseAdmin
    .from('alerts')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', alertId)
    .select()
    .single();

  if (updateError || !updatedAlert) {
    console.error('[POST /api/analytics/alerts/[id]/resolve] Error:', updateError);
    throw new Error('Failed to resolve alert');
  }

  return successResponse({
    alert: {
      id: updatedAlert.id,
      resolved: updatedAlert.resolved,
      resolvedAt: updatedAlert.resolved_at,
      resolvedBy: updatedAlert.resolved_by,
      updatedAt: updatedAlert.updated_at,
    },
  });
});
