import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireAuth,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { Database } from '@/lib/types/database';

type AlertRow = Database['public']['Tables']['alerts']['Row'];

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
export const POST = apiHandler(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ) => {
    const [{ userId }, params] = await Promise.all([
      requireAuth(),
      context.params,
    ]);
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
      .select('id, acknowledged, acknowledged_at, acknowledged_by, updated_at')
      .single();

    if (updateError || !updatedAlert) {
      console.error(
        '[POST /api/analytics/alerts/[id]/acknowledge] Error:',
        updateError,
      );
      throw new Error('Failed to acknowledge alert');
    }

    const alertResult = updatedAlert as Pick<
      AlertRow,
      | 'id'
      | 'acknowledged'
      | 'acknowledged_at'
      | 'acknowledged_by'
      | 'updated_at'
    >;

    return successResponse({
      alert: {
        id: alertResult.id,
        acknowledged: alertResult.acknowledged,
        acknowledgedAt: alertResult.acknowledged_at,
        acknowledgedBy: alertResult.acknowledged_by,
        updatedAt: alertResult.updated_at,
      },
    });
  },
);
