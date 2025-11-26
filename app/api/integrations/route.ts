/**
 * Integrations List API Route
 *
 * GET /api/integrations - List all connector configurations for the organization
 *
 * Returns all configured integrations with their connection status, capabilities,
 * and publish settings.
 */

import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { requireOrg } from '@/lib/utils/api';

/**
 * GET /api/integrations
 *
 * Fetch all connector configurations for the authenticated user's organization.
 *
 * Returns:
 * - Array of connector configurations with status and capabilities
 */
export async function GET() {
  try {
    // Authenticate user and get internal org ID
    const { orgId } = await requireOrg();

    // Fetch all connectors for this organization
    const supabase = createAdminClient();

    const { data: connectors, error: fetchError } = await supabase
      .from('connector_configs')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('[Integrations API] Failed to fetch connectors:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch integrations' },
        { status: 500 }
      );
    }

    // Map to frontend-friendly format
    const integrations = (connectors || []).map((connector) => ({
      id: connector.id,
      type: connector.connector_type,
      name: connector.name || getDefaultName(connector.connector_type),
      description: connector.description || getDefaultDescription(connector.connector_type),
      status: connector.is_active === false ? 'disconnected' : (connector.sync_status || 'connected'),
      supportsPublish: connector.supports_publish || false,
      supportsImport: true, // All connectors support import
      lastSync: connector.last_sync_at,
      lastPublish: connector.last_publish_at,
      externalUserName: connector.credentials?.externalUserName,
      publishSettings: connector.settings?.publish || {
        autoPublish: false,
        defaultFolderId: null,
        defaultFormat: 'markdown',
      },
      createdAt: connector.created_at,
      updatedAt: connector.updated_at,
    }));

    return NextResponse.json({ integrations }, { status: 200 });
  } catch (error) {
    console.error('[Integrations API] Unexpected error:', error);

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

/**
 * Get default display name for connector type
 */
function getDefaultName(type: string): string {
  const names: Record<string, string> = {
    google_drive: 'Google Drive',
    sharepoint: 'SharePoint',
    onedrive: 'OneDrive',
    notion: 'Notion',
    zoom: 'Zoom',
    microsoft_teams: 'Microsoft Teams',
  };

  return names[type] || type;
}

/**
 * Get default description for connector type
 */
function getDefaultDescription(type: string): string {
  const descriptions: Record<string, string> = {
    google_drive: 'Import and publish documents to Google Drive',
    sharepoint: 'Import and publish documents to SharePoint document libraries',
    onedrive: 'Import and publish documents to OneDrive personal or business',
    notion: 'Import pages and databases from Notion workspaces',
    zoom: 'Import meeting recordings from Zoom',
    microsoft_teams: 'Import meeting recordings from Microsoft Teams',
  };

  return descriptions[type] || 'External data source integration';
}
