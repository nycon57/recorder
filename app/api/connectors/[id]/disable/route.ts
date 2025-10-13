/**
 * Connector Disable Route
 *
 * POST /api/connectors/[id]/disable - Disable connector
 */

import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/connectors/[id]/disable
 * Disable connector (soft delete - keeps data but stops syncing)
 */
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const { id } = await params;

    // Verify connector belongs to organization
    const { data: connector } = await supabaseAdmin
      .from('connector_configs')
      .select('org_id, is_active')
      .eq('id', id)
      .single();

    if (!connector || connector.org_id !== orgId) {
      return errors.notFound('Connector');
    }

    if (!connector.is_active) {
      return errors.badRequest('Connector is already disabled');
    }

    // Disable connector
    const { error } = await supabaseAdmin
      .from('connector_configs')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return errors.internalError();
    }

    return successResponse({
      success: true,
      message: 'Connector disabled successfully',
    });
  }
);
