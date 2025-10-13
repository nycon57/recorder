/**
 * Connector Registry
 *
 * Central registry for all available connectors. Factory pattern for
 * creating connector instances.
 */

import { Connector, ConnectorType, ConnectorCredentials } from './base';
import { GoogleDriveConnector } from './google-drive';
import { NotionConnector } from './notion';
import { ZoomConnector } from './zoom';
import { MicrosoftTeamsConnector } from './microsoft-teams';
import { FileUploadConnector } from './file-upload';
import { URLImportConnector } from './url-import';
import type { ConnectorInfo } from '@/lib/types/connectors';

export class ConnectorRegistry {
  private static connectors = new Map<ConnectorType, new (...args: any[]) => Connector>([
    [ConnectorType.GOOGLE_DRIVE, GoogleDriveConnector],
    [ConnectorType.NOTION, NotionConnector],
    [ConnectorType.ZOOM, ZoomConnector],
    [ConnectorType.MICROSOFT_TEAMS, MicrosoftTeamsConnector],
    [ConnectorType.FILE_UPLOAD, FileUploadConnector],
    [ConnectorType.URL_IMPORT, URLImportConnector],
  ]);

  /**
   * Create connector instance from type and credentials
   */
  static create(
    type: ConnectorType,
    credentials: ConnectorCredentials,
    config?: Record<string, any>
  ): Connector {
    const ConnectorClass = this.connectors.get(type);

    if (!ConnectorClass) {
      throw new Error(`Unknown connector type: ${type}`);
    }

    return new ConnectorClass(credentials, config);
  }

  /**
   * Get all available connector types
   */
  static getAvailableConnectors(): ConnectorInfo[] {
    return Array.from(this.connectors.keys()).map((type) => {
      const connector = this.create(type, {});

      return {
        type,
        name: connector.name,
        description: connector.description,
        requiresOAuth: this.requiresOAuth(type),
        supportsWebhooks: this.supportsWebhooks(type),
      };
    });
  }

  /**
   * Check if connector requires OAuth
   */
  static requiresOAuth(type: ConnectorType): boolean {
    return [
      ConnectorType.GOOGLE_DRIVE,
      ConnectorType.NOTION,
      ConnectorType.ZOOM,
      ConnectorType.MICROSOFT_TEAMS,
    ].includes(type);
  }

  /**
   * Check if connector supports webhooks
   */
  static supportsWebhooks(type: ConnectorType): boolean {
    return [
      ConnectorType.GOOGLE_DRIVE,
      ConnectorType.ZOOM,
      ConnectorType.MICROSOFT_TEAMS,
    ].includes(type);
  }

  /**
   * Register custom connector
   */
  static register(type: ConnectorType, connectorClass: new (...args: any[]) => Connector): void {
    this.connectors.set(type, connectorClass);
  }
}
