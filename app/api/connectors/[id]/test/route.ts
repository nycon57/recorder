/**
 * Connector Test Route
 *
 * POST /api/connectors/[id]/test - Test connector connection
 */

import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireOrg,
  successResponse,
  errors,
} from '@/lib/utils/api';
import { ConnectorManager } from '@/lib/services/connector-manager';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/connectors/[id]/test
 * Test connector connection
 */
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const { id } = await params;

    // Verify connector belongs to organization
    const { data: connector } = await supabaseAdmin
      .from('connector_configs')
      .select('org_id')
      .eq('id', id)
      .single();

    if (!connector || connector.org_id !== orgId) {
      return errors.notFound('Connector');
    }

    const result = await ConnectorManager.testConnector(id);

    if (!result.success) {
      return successResponse({
        success: false,
        message: result.error || 'Connection test failed',
        error: result.error,
      });
    }

    return successResponse({
      success: true,
      message: result.message || 'Connection successful',
    });
  }
);
