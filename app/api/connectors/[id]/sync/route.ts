/**
 * Connector Sync Route
 *
 * POST /api/connectors/[id]/sync - Trigger manual sync
 */

import { NextRequest } from 'next/server';
import {
  apiHandler,
  requireOrg,
  successResponse,
  parseBody,
  errors,
} from '@/lib/utils/api';
import { syncConnectorSchema } from '@/lib/validations/api';
import { ConnectorManager } from '@/lib/services/connector-manager';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/connectors/[id]/sync
 * Trigger manual synchronization
 */
export const POST = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const { id } = await params;

    // Verify connector belongs to organization
    const { data: connector } = await supabaseAdmin
      .from('connector_configs')
      .select('org_id, is_active, sync_status')
      .eq('id', id)
      .single();

    if (!connector || connector.org_id !== orgId) {
      return errors.notFound('Connector');
    }

    if (!connector.is_active) {
      return errors.badRequest('Connector is not active');
    }

    if (connector.sync_status === 'syncing') {
      return errors.badRequest('Sync already in progress');
    }

    // Validate request body
    const body = await parseBody(request, syncConnectorSchema);

    // Trigger sync
    const result = await ConnectorManager.syncConnector({
      connectorId: id,
      syncType: 'manual',
      fullSync: body.fullSync,
      since: body.since ? new Date(body.since) : undefined,
      limit: body.limit,
      fileTypes: body.fileTypes,
      paths: body.paths,
      filters: body.filters,
    });

    if (!result.success) {
      return errors.badRequest(
        result.error || 'Sync failed',
        { error: result.error }
      );
    }

    return successResponse({
      success: true,
      message: 'Sync completed',
      result: {
        filesProcessed: result.result?.filesProcessed || 0,
        filesUpdated: result.result?.filesUpdated || 0,
        filesFailed: result.result?.filesFailed || 0,
        filesDeleted: result.result?.filesDeleted || 0,
        errors: result.result?.errors || [],
      },
    });
  }
);
