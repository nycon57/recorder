/**
 * Google Drive Files List API
 *
 * GET /api/integrations/google-drive/files
 *
 * Lists files from connected Google Drive account.
 * Supports pagination and folder navigation.
 *
 * Query params:
 * - folderId: Parent folder ID (optional, defaults to root)
 * - pageToken: Pagination token for next page
 * - pageSize: Number of files to return (default 50, max 100)
 * - search: Search query to filter files by name
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { requireOrg } from '@/lib/utils/api';
import { GoogleDriveConnector } from '@/lib/connectors/google-drive';
import { ConnectorType } from '@/lib/connectors/base';

export async function GET(req: NextRequest) {
  try {
    const { orgId } = await requireOrg();
    const supabase = createAdminClient();

    // Parse query params
    const searchParams = req.nextUrl.searchParams;
    const folderId = searchParams.get('folderId') || undefined;
    const pageToken = searchParams.get('pageToken') || undefined;
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '100'), 100);
    const search = searchParams.get('search') || undefined;

    // Get Google Drive connector config
    const { data: connectorConfig, error: configError } = await supabase
      .from('connector_configs')
      .select('*')
      .eq('org_id', orgId)
      .eq('connector_type', ConnectorType.GOOGLE_DRIVE)
      .eq('is_active', true)
      .single();

    if (configError || !connectorConfig) {
      return NextResponse.json(
        { error: 'Google Drive not connected' },
        { status: 404 }
      );
    }

    // Create connector instance with credentials
    const credentials = connectorConfig.credentials as any;
    const connector = new GoogleDriveConnector(
      {
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        expiresAt: credentials.expiresAt ? new Date(credentials.expiresAt) : undefined,
        scopes: credentials.scopes,
      },
      {
        connectorId: connectorConfig.id,
        pageSize,
      }
    );

    // Test connection first
    const testResult = await connector.testConnection();
    if (!testResult.success) {
      console.error('[Google Drive Files] Connection test failed:', testResult.message);
      return NextResponse.json(
        { error: 'Failed to connect to Google Drive. Please reconnect.' },
        { status: 401 }
      );
    }

    // List ALL files for browser UI (includes folders, videos, zips, etc.)
    const result = await connector.listFilesForBrowser({
      limit: pageSize,
      folderId,
      search,
      pageToken,
    });

    const files = result.files;

    // Get already imported files to mark them (using unified content table)
    const fileIds = files.filter(f => f.type !== 'folder').map(f => f.id);
    const { data: importedContent } = fileIds.length > 0
      ? await supabase
          .from('content')
          .select('source_external_id')
          .eq('org_id', orgId)
          .eq('source_connector_id', connectorConfig.id)
          .eq('source_type', 'google_drive')
          .in('source_external_id', fileIds)
      : { data: [] };

    const importedFileIds = new Set((importedContent || []).map(d => d.source_external_id));

    // Transform files for response with support status
    const transformedFiles = files.map(file => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      type: file.type,
      size: file.size,
      modifiedAt: file.modifiedAt?.toISOString(),
      createdAt: file.createdAt?.toISOString(),
      url: file.url,
      parentId: file.parentId,
      isFolder: file.type === 'folder',
      isGoogleWorkspace: file.metadata?.isGoogleWorkspace || false,
      isImported: importedFileIds.has(file.id),
      isSupported: file.type === 'folder' || connector.isFileTypeSupported(file.mimeType),
    }));

    // Sort: folders first, then by name (already sorted by API but ensure consistency)
    transformedFiles.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({
      files: transformedFiles,
      connectorId: connectorConfig.id,
      nextPageToken: result.nextPageToken,
      hasMore: !!result.nextPageToken,
    });
  } catch (error: any) {
    console.error('[Google Drive Files] Error:', error);

    // Handle Google API errors specifically
    if (error?.code === 403) {
      return NextResponse.json(
        { error: 'Access denied to this folder. You may not have permission to view its contents.' },
        { status: 403 }
      );
    }

    if (error?.code === 404) {
      return NextResponse.json(
        { error: 'Folder not found. It may have been deleted or moved.' },
        { status: 404 }
      );
    }

    // Extract error message from various error formats
    const errorMessage = error?.message
      || error?.errors?.[0]?.message
      || error?.response?.data?.error?.message
      || 'Failed to list files';

    return NextResponse.json(
      { error: errorMessage },
      { status: error?.code || 500 }
    );
  }
}
