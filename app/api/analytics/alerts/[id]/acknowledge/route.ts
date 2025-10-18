import { NextRequest } from 'next/server';

import { apiHandler, requireAuth, successResponse, errors } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/analytics/alerts/[id]/acknowledge
 *
 * Acknowledge an alert
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

  // Verify alert exists and get organization_id
  const { data: alert, error: fetchError } = await supabaseAdmin
    .from('alerts')
    .select('id, organization_id, acknowledged')
    .eq('id', alertId)
    .single();

  if (fetchError || !alert) {
    throw errors.notFound('Alert');
  }

  // Check if already acknowledged
  if (alert.acknowledged) {
    throw errors.badRequest('Alert is already acknowledged');
  }

  // Update alert with acknowledgment info
  const { data: updatedAlert, error: updateError } = await supabaseAdmin
    .from('alerts')
    .update({
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', alertId)
    .select()
    .single();

  if (updateError || !updatedAlert) {
    console.error('[POST /api/analytics/alerts/[id]/acknowledge] Error:', updateError);
    throw new Error('Failed to acknowledge alert');
  }

  return successResponse({
    alert: {
      id: updatedAlert.id,
      acknowledged: updatedAlert.acknowledged,
      acknowledgedAt: updatedAlert.acknowledged_at,
      acknowledgedBy: updatedAlert.acknowledged_by,
      updatedAt: updatedAlert.updated_at,
    },
  });
});
