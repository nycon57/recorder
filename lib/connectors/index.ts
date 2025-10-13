/**
 * Connector System Exports
 *
 * Centralized exports for all connector implementations
 */

export * from './base';
export { FileUploadConnector } from './file-upload';
export { URLImportConnector } from './url-import';
export { NotionConnector } from './notion';
export { ZoomConnector } from './zoom';
export { MicrosoftTeamsConnector } from './microsoft-teams';

// Connector factory
import { Connector, ConnectorType, ConnectorCredentials } from './base';
import { FileUploadConnector } from './file-upload';
import { URLImportConnector } from './url-import';
import { NotionConnector } from './notion';
import { ZoomConnector } from './zoom';
import { MicrosoftTeamsConnector } from './microsoft-teams';

export interface ConnectorFactoryOptions {
  type: ConnectorType;
  orgId: string;
  userId?: string;
  batchId?: string;
  connectorId?: string;
  credentials?: ConnectorCredentials;
}

/**
 * Create a connector instance based on type
 */
export function createConnector(options: ConnectorFactoryOptions): Connector {
  switch (options.type) {
    case ConnectorType.FILE_UPLOAD:
      return new FileUploadConnector({
        orgId: options.orgId,
        userId: options.userId,
        batchId: options.batchId,
      });

    case ConnectorType.URL_IMPORT:
      return new URLImportConnector({
        orgId: options.orgId,
        userId: options.userId,
        batchId: options.batchId,
      });

    case ConnectorType.NOTION:
      if (!options.credentials) {
        throw new Error('Notion connector requires credentials');
      }
      return new NotionConnector(options.credentials, {
        orgId: options.orgId,
      });

    case ConnectorType.ZOOM:
      if (!options.credentials) {
        throw new Error('Zoom connector requires credentials');
      }
      return new ZoomConnector(
        options.credentials as any,
        {
          orgId: options.orgId,
          connectorId: options.connectorId,
        }
      );

    case ConnectorType.MICROSOFT_TEAMS:
      if (!options.credentials) {
        throw new Error('Microsoft Teams connector requires credentials');
      }
      return new MicrosoftTeamsConnector(
        options.credentials as any,
        {
          orgId: options.orgId,
          connectorId: options.connectorId,
        }
      );

    case ConnectorType.GOOGLE_DRIVE:
      throw new Error(`Connector type ${options.type} not yet implemented`);

    default:
      throw new Error(`Unknown connector type: ${options.type}`);
  }
}

/**
 * Get connector metadata
 */
export function getConnectorInfo(type: ConnectorType) {
  const connectorInfo = {
    [ConnectorType.FILE_UPLOAD]: {
      name: 'File Upload',
      description:
        'Direct file upload connector supporting PDFs, documents, images, and more',
      requiresOAuth: false,
      supportsWebhooks: false,
      supportedTypes: FileUploadConnector.getSupportedTypes(),
      maxFileSize: 50 * 1024 * 1024, // 50MB
      status: 'active',
    },
    [ConnectorType.URL_IMPORT]: {
      name: 'URL Import',
      description:
        'Import content from web URLs with HTML to markdown conversion',
      requiresOAuth: false,
      supportsWebhooks: false,
      timeout: 30000, // 30s
      status: 'active',
    },
    [ConnectorType.NOTION]: {
      name: 'Notion',
      description: 'Sync pages and databases from Notion with rich content preservation',
      requiresOAuth: true,
      supportsWebhooks: false,
      status: 'active',
      features: [
        'Page and database sync',
        'Nested block structure',
        'Markdown conversion',
        'Embedded media support',
        'Incremental sync',
      ],
    },
    [ConnectorType.ZOOM]: {
      name: 'Zoom',
      description: 'Sync meeting recordings and transcripts from Zoom',
      requiresOAuth: true,
      supportsWebhooks: true,
      status: 'active',
      features: [
        'Meeting recordings (MP4)',
        'Audio files (M4A)',
        'Transcripts (VTT)',
        'Chat logs',
        'Real-time webhook sync',
      ],
    },
    [ConnectorType.MICROSOFT_TEAMS]: {
      name: 'Microsoft Teams',
      description: 'Sync meeting recordings and transcripts from Microsoft Teams',
      requiresOAuth: true,
      supportsWebhooks: true,
      status: 'active',
      features: [
        'Meeting recordings',
        'Transcripts (VTT)',
        'Meeting metadata',
        'Calendar integration',
        'Real-time webhook sync',
      ],
    },
    [ConnectorType.GOOGLE_DRIVE]: {
      name: 'Google Drive',
      description: 'Sync files from Google Drive',
      requiresOAuth: true,
      supportsWebhooks: true,
      status: 'planned',
    },
  };

  return connectorInfo[type];
}

/**
 * List all available connectors
 */
export function listConnectors() {
  return Object.values(ConnectorType).map((type) => ({
    type,
    ...getConnectorInfo(type),
  }));
}
