/**
 * Connector Management Routes
 *
 * GET /api/connectors - List all connectors for organization
 * POST /api/connectors - Create new connector
 */

import { NextRequest } from 'next/server';

import {
  apiHandler,
  requireOrg,
  successResponse,
  parseBody,
  errors,
} from '@/lib/utils/api';
import { createConnectorSchema } from '@/lib/validations/api';
import { ConnectorManager } from '@/lib/services/connector-manager';
import { ConnectorType } from '@/lib/connectors/base';

/**
 * GET /api/connectors
 * List all connectors for the organization
 */
export const GET = apiHandler(async (request: NextRequest) => {
  const { orgId } = await requireOrg();
  const { searchParams } = new URL(request.url);

  // Parse query parameters
  const connectorType = searchParams.get('type') as ConnectorType | null;
  const isActive = searchParams.get('isActive');
  const limit = searchParams.get('limit');
  const offset = searchParams.get('offset');

  const result = await ConnectorManager.listConnectors(orgId, {
    connectorType: connectorType || undefined,
    isActive: isActive ? isActive === 'true' : undefined,
    limit: limit ? parseInt(limit) : undefined,
    offset: offset ? parseInt(offset) : undefined,
  });

  if (!result.success) {
    return errors.internalError();
  }

  return successResponse({
    connectors: result.connectors || [],
    total: result.connectors?.length || 0,
  });
});

/**
 * POST /api/connectors
 * Create a new connector
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const { orgId, userId } = await requireOrg();

  // Validate request body
  const body = await parseBody(request, createConnectorSchema);

  const result = await ConnectorManager.createConnector({
    orgId,
    connectorType: body.connectorType as ConnectorType,
    name: body.name,
    credentials: body.credentials,
    settings: body.settings,
    syncFrequency: body.syncFrequency,
    createdBy: userId,
  });

  if (!result.success) {
    return errors.badRequest(
      result.error || 'Failed to create connector',
      { error: result.error }
    );
  }

  // Fetch the newly created connector
  const connectorResult = await ConnectorManager.getConnector(result.connectorId!);

  return successResponse(
    {
      connector: connectorResult.connector,
      message: 'Connector created successfully',
    },
    undefined,
    201
  );
});
