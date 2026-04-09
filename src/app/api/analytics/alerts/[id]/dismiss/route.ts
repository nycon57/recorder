import { NextRequest } from 'next/server';

import { apiHandler, requireOrg, successResponse, errors } from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/analytics/alerts/[id]/dismiss
 *
 * Dismiss an alert (soft delete)
 *
 * Path Parameters:
 * - id: Alert ID (UUID)
 *
 * Returns:
 * - success: boolean
 * - message: string
 */
export const POST = apiHandler(async (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { orgId } = await requireOrg();
  const params = await context.params;
  const alertId = params.id;

  // Verify alert exists and belongs to the user's organization
  const { data: alert, error: fetchError } = await supabaseAdmin
    .from('alerts')
    .select('id, organization_id')
    .eq('id', alertId)
    .single();

  if (fetchError || !alert) {
    throw errors.notFound('Alert');
  }

  // Verify user has access to this alert
  if (alert.organization_id !== orgId) {
    throw errors.forbidden('You do not have permission to dismiss this alert');
  }

  // Delete the alert
  const { error: deleteError } = await supabaseAdmin.from('alerts').delete().eq('id', alertId);

  if (deleteError) {
    console.error('[POST /api/analytics/alerts/[id]/dismiss] Error:', deleteError);
    throw new Error('Failed to dismiss alert');
  }

  return successResponse({
    success: true,
    message: 'Alert dismissed successfully',
  });
});
