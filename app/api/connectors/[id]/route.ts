/**
 * Individual Connector Routes
 *
 * GET /api/connectors/[id] - Get connector details
 * PUT /api/connectors/[id] - Update connector
 * DELETE /api/connectors/[id] - Delete connector
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  parseBody,
  errors,
} from '@/lib/utils/api';
import { updateConnectorSchema } from '@/lib/validations/api';
import { ConnectorManager } from '@/lib/services/connector-manager';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/connectors/[id]
 * Get connector details
 */
export const GET = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const { id } = await params;

    // Verify connector belongs to organization
    const { data: connector, error } = await supabaseAdmin
      .from('connector_configs')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !connector) {
      return errors.notFound('Connector');
    }

    // Get connector stats
    const { data: documents } = await supabaseAdmin
      .from('imported_documents')
      .select('id, processing_status', { count: 'exact' })
      .eq('connector_id', id);

    const stats = {
      totalDocuments: documents?.length || 0,
      pendingDocuments: documents?.filter(d => d.processing_status === 'pending').length || 0,
      completedDocuments: documents?.filter(d => d.processing_status === 'completed').length || 0,
      failedDocuments: documents?.filter(d => d.processing_status === 'failed').length || 0,
    };

    return successResponse({
      ...connector,
      stats,
    });
  }
);

/**
 * PUT /api/connectors/[id]
 * Update connector configuration
 */
export const PUT = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const { id } = await params;

    // Verify connector belongs to organization
    const { data: existingConnector } = await supabaseAdmin
      .from('connector_configs')
      .select('org_id')
      .eq('id', id)
      .single();

    if (!existingConnector || existingConnector.org_id !== orgId) {
      return errors.notFound('Connector');
    }

    // Validate request body
    const body = await parseBody(request, updateConnectorSchema);

    const result = await ConnectorManager.updateConnector(id, body);

    if (!result.success) {
      return errors.badRequest(
        result.error || 'Failed to update connector',
        { error: result.error }
      );
    }

    // Fetch updated connector
    const connectorResult = await ConnectorManager.getConnector(id);

    return successResponse({
      connector: connectorResult.connector,
      message: 'Connector updated successfully',
    });
  }
);

/**
 * DELETE /api/connectors/[id]
 * Delete connector
 */
export const DELETE = apiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { orgId } = await requireOrg();
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    // Verify connector belongs to organization
    const { data: existingConnector } = await supabaseAdmin
      .from('connector_configs')
      .select('org_id')
      .eq('id', id)
      .single();

    if (!existingConnector || existingConnector.org_id !== orgId) {
      return errors.notFound('Connector');
    }

    // Check if documents should be deleted
    const deleteDocuments = searchParams.get('deleteDocuments') === 'true';

    const result = await ConnectorManager.deleteConnector(id, deleteDocuments);

    if (!result.success) {
      return errors.internalError();
    }

    return successResponse({
      success: true,
      message: 'Connector deleted successfully',
      documentsDeleted: deleteDocuments,
    });
  }
);
