/**
 * Folder Management API Routes
 *
 * Handles folder operations for bidirectional sync connectors:
 * - GET: List folders in external system (Google Drive, SharePoint, OneDrive)
 * - POST: Create new folder in external system
 *
 * Used by folder picker component in publish workflow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { requireOrg } from '@/lib/utils/api';
import { ConnectorRegistry } from '@/lib/connectors/registry';
import { ConnectorType } from '@/lib/connectors/base';
import {
  validateFolderListQuery,
  validateCreateFolderRequest,
  type FolderListQueryInput,
  type CreateFolderInput,
} from '@/lib/validations/publishing';
import type {
  PublishableConnector,
  FolderListResponse,
  CreateFolderResponse,
} from '@/lib/types/publishing';

// =====================================================
// TYPE HELPERS
// =====================================================

/** Verify connector type is valid and supports publishing */
function validateConnectorType(type: string): ConnectorType {
  const validTypes: string[] = [
    ConnectorType.GOOGLE_DRIVE,
    ConnectorType.SHAREPOINT,
    ConnectorType.ONEDRIVE,
  ];

  if (!validTypes.includes(type)) {
    throw new Error(
      `Invalid connector type: ${type}. Must be one of: ${validTypes.join(', ')}`
    );
  }

  return type as ConnectorType;
}

/** Type guard to check if connector supports publishing */
function isPublishableConnector(
  connector: unknown
): connector is PublishableConnector {
  return (
    typeof connector === 'object' &&
    connector !== null &&
    'supportsPublish' in connector &&
    typeof (connector as PublishableConnector).supportsPublish === 'function'
  );
}

// =====================================================
// GET HANDLER - List Folders
// =====================================================

/**
 * GET /api/integrations/[type]/folders
 *
 * List folders in external system with pagination and search.
 *
 * Query params:
 * - connectorId (required): UUID of connector config
 * - parentId (optional): Parent folder ID (omit for root)
 * - search (optional): Search query
 * - pageToken (optional): Pagination token
 * - pageSize (optional): Results per page (default 50, max 100)
 *
 * Returns: FolderListResponse
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    // 1. Authenticate and get internal org ID
    const { orgId } = await requireOrg();

    // 2. Validate connector type
    const { type } = await params;
    let connectorType: ConnectorType;

    try {
      connectorType = validateConnectorType(type);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : 'Invalid connector type',
        },
        { status: 400 }
      );
    }

    // 3. Validate query parameters
    const searchParams = req.nextUrl.searchParams;
    const queryParams = {
      connectorId: searchParams.get('connectorId'),
      parentId: searchParams.get('parentId') ?? undefined,
      search: searchParams.get('search') ?? undefined,
      pageToken: searchParams.get('pageToken') ?? undefined,
      pageSize: searchParams.get('pageSize') ?? undefined,
    };

    let validatedQuery: FolderListQueryInput;

    try {
      validatedQuery = validateFolderListQuery(queryParams);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid query parameters',
            details: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to validate query parameters' },
        { status: 400 }
      );
    }

    // 4. Fetch connector config from database
    const supabase = createAdminClient();

    const { data: connectorConfig, error: fetchError } = await supabase
      .from('connector_configs')
      .select('*')
      .eq('id', validatedQuery.connectorId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !connectorConfig) {
      return NextResponse.json(
        { error: 'Connector not found or access denied' },
        { status: 404 }
      );
    }

    // 5. Verify connector type matches URL parameter
    if (connectorConfig.connector_type !== connectorType) {
      return NextResponse.json(
        {
          error: `Connector type mismatch: expected ${connectorType}, got ${connectorConfig.connector_type}`,
        },
        { status: 400 }
      );
    }

    // 6. Create connector instance with credentials
    let connector;

    try {
      connector = ConnectorRegistry.create(
        connectorType,
        connectorConfig.credentials as Record<string, unknown>,
        connectorConfig.config as Record<string, unknown>
      );
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to initialize connector',
          details:
            error instanceof Error ? error.message : 'Unknown error occurred',
        },
        { status: 500 }
      );
    }

    // 7. Verify connector supports publishing
    if (!isPublishableConnector(connector)) {
      return NextResponse.json(
        { error: 'Connector does not support publishing operations' },
        { status: 400 }
      );
    }

    if (!connector.supportsPublish()) {
      return NextResponse.json(
        {
          error:
            'Connector does not have write permissions. Please re-authorize with publish scope.',
        },
        { status: 403 }
      );
    }

    // 8. List folders via connector
    let folderListResponse: FolderListResponse;

    try {
      folderListResponse = await connector.listFolders({
        connectorId: validatedQuery.connectorId,
        parentId: validatedQuery.parentId,
        search: validatedQuery.search,
        pageToken: validatedQuery.pageToken,
        pageSize: validatedQuery.pageSize,
      });
    } catch (error) {
      console.error('[Folder API] Failed to list folders:', error);

      return NextResponse.json(
        {
          error: 'Failed to list folders from external system',
          details:
            error instanceof Error ? error.message : 'Unknown error occurred',
        },
        { status: 500 }
      );
    }

    // 9. Return successful response
    return NextResponse.json(folderListResponse, { status: 200 });
  } catch (error) {
    console.error('[Folder API] Unexpected error in GET:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.message
            : undefined,
      },
      { status: 500 }
    );
  }
}

// =====================================================
// POST HANDLER - Create Folder
// =====================================================

/**
 * POST /api/integrations/[type]/folders
 *
 * Create a new folder in external system.
 *
 * Request body:
 * - connectorId (required): UUID of connector config
 * - name (required): Folder name (1-255 chars, no invalid chars)
 * - parentId (optional): Parent folder ID (omit for root)
 *
 * Returns: CreateFolderResponse
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    // 1. Authenticate and get internal org ID
    const { orgId } = await requireOrg();

    // 2. Validate connector type
    const { type } = await params;
    let connectorType: ConnectorType;

    try {
      connectorType = validateConnectorType(type);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : 'Invalid connector type',
        },
        { status: 400 }
      );
    }

    // 3. Parse and validate request body
    let body: unknown;

    try {
      body = await req.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    let validatedRequest: CreateFolderInput;

    try {
      validatedRequest = validateCreateFolderRequest(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Invalid request body',
            details: error.errors.map((e) => ({
              field: e.path.join('.'),
              message: e.message,
            })),
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to validate request body' },
        { status: 400 }
      );
    }

    // 4. Fetch connector config from database
    const supabase = createAdminClient();

    const { data: connectorConfig, error: fetchError } = await supabase
      .from('connector_configs')
      .select('*')
      .eq('id', validatedRequest.connectorId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !connectorConfig) {
      return NextResponse.json(
        { error: 'Connector not found or access denied' },
        { status: 404 }
      );
    }

    // 5. Verify connector type matches URL parameter
    if (connectorConfig.connector_type !== connectorType) {
      return NextResponse.json(
        {
          error: `Connector type mismatch: expected ${connectorType}, got ${connectorConfig.connector_type}`,
        },
        { status: 400 }
      );
    }

    // 6. Create connector instance with credentials
    let connector;

    try {
      connector = ConnectorRegistry.create(
        connectorType,
        connectorConfig.credentials as Record<string, unknown>,
        connectorConfig.config as Record<string, unknown>
      );
    } catch (error) {
      return NextResponse.json(
        {
          error: 'Failed to initialize connector',
          details:
            error instanceof Error ? error.message : 'Unknown error occurred',
        },
        { status: 500 }
      );
    }

    // 7. Verify connector supports publishing
    if (!isPublishableConnector(connector)) {
      return NextResponse.json(
        { error: 'Connector does not support publishing operations' },
        { status: 400 }
      );
    }

    if (!connector.supportsPublish()) {
      return NextResponse.json(
        {
          error:
            'Connector does not have write permissions. Please re-authorize with publish scope.',
        },
        { status: 403 }
      );
    }

    // 8. Create folder via connector
    let createFolderResponse: CreateFolderResponse;

    try {
      createFolderResponse = await connector.createFolder({
        connectorId: validatedRequest.connectorId,
        name: validatedRequest.name,
        parentId: validatedRequest.parentId,
      });
    } catch (error) {
      console.error('[Folder API] Failed to create folder:', error);

      // Check for common errors
      if (error instanceof Error) {
        if (
          error.message.includes('already exists') ||
          error.message.includes('duplicate')
        ) {
          return NextResponse.json(
            {
              error: 'Folder with this name already exists in this location',
              details: error.message,
            },
            { status: 409 }
          );
        }

        if (
          error.message.includes('permission') ||
          error.message.includes('access')
        ) {
          return NextResponse.json(
            {
              error: 'Permission denied - insufficient access to create folder',
              details: error.message,
            },
            { status: 403 }
          );
        }
      }

      return NextResponse.json(
        {
          error: 'Failed to create folder in external system',
          details:
            error instanceof Error ? error.message : 'Unknown error occurred',
        },
        { status: 500 }
      );
    }

    // 9. Return successful response
    return NextResponse.json(createFolderResponse, { status: 201 });
  } catch (error) {
    console.error('[Folder API] Unexpected error in POST:', error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        details:
          process.env.NODE_ENV === 'development' && error instanceof Error
            ? error.message
            : undefined,
      },
      { status: 500 }
    );
  }
}
