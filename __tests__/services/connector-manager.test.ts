/**
 * Connector Manager Service Tests
 *
 * Tests connector orchestration, sync operations, and credential management.
 */

import { ConnectorManager } from '@/lib/services/connector-manager';
import { ConnectorType } from '@/lib/connectors/base';
import { ConnectorRegistry } from '@/lib/connectors/registry';

// Mock Supabase
jest.mock('@/lib/supabase/admin');
import { supabaseAdmin } from '@/lib/supabase/admin';

// Mock ConnectorRegistry
jest.mock('@/lib/connectors/registry');

describe('ConnectorManager', () => {
  let mockSupabase: any;
  let mockConnector: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (supabaseAdmin as any) = mockSupabase;

    // Mock connector instance
    mockConnector = {
      type: 'google_drive',
      name: 'Google Drive',
      authenticate: jest.fn().mockResolvedValue({ success: true }),
      testConnection: jest.fn().mockResolvedValue({ success: true, message: 'Connected' }),
      sync: jest.fn().mockResolvedValue({
        success: true,
        filesProcessed: 10,
        filesUpdated: 8,
        filesFailed: 0,
        filesDeleted: 0,
        errors: [],
      }),
      listFiles: jest.fn().mockResolvedValue([]),
    };

    (ConnectorRegistry.create as jest.Mock).mockReturnValue(mockConnector);
  });

  describe('createConnector()', () => {
    it('should create connector successfully', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: 'connector-1', org_id: 'org-123' },
        error: null,
      });

      const result = await ConnectorManager.createConnector({
        orgId: 'org-123',
        connectorType: ConnectorType.GOOGLE_DRIVE,
        credentials: { accessToken: 'token' },
      });

      expect(result.success).toBe(true);
      expect(result.connectorId).toBe('connector-1');
      expect(mockConnector.authenticate).toHaveBeenCalled();
      expect(mockConnector.testConnection).toHaveBeenCalled();
    });

    it('should handle authentication failure', async () => {
      mockConnector.authenticate.mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
      });

      const result = await ConnectorManager.createConnector({
        orgId: 'org-123',
        connectorType: ConnectorType.GOOGLE_DRIVE,
        credentials: { accessToken: 'invalid' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should handle connection test failure', async () => {
      mockConnector.testConnection.mockResolvedValue({
        success: false,
        message: 'Connection failed',
      });

      const result = await ConnectorManager.createConnector({
        orgId: 'org-123',
        connectorType: ConnectorType.GOOGLE_DRIVE,
        credentials: { accessToken: 'token' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
    });

    it('should create connector with custom name and settings', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { id: 'connector-1' },
        error: null,
      });

      const result = await ConnectorManager.createConnector({
        orgId: 'org-123',
        connectorType: ConnectorType.GOOGLE_DRIVE,
        name: 'My Drive',
        credentials: { accessToken: 'token' },
        settings: { folderIds: ['folder-1'] },
        syncFrequency: 'daily',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('updateConnector()', () => {
    it('should update connector name and settings', async () => {
      mockSupabase.update.mockResolvedValue({ error: null });

      const result = await ConnectorManager.updateConnector('connector-1', {
        name: 'Updated Name',
        settings: { folderIds: ['folder-2'] },
      });

      expect(result.success).toBe(true);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Updated Name',
          settings: { folderIds: ['folder-2'] },
        })
      );
    });

    it('should validate new credentials', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { connector_type: 'google_drive' },
        error: null,
      });

      mockSupabase.update.mockResolvedValue({ error: null });

      const result = await ConnectorManager.updateConnector('connector-1', {
        credentials: { accessToken: 'new-token' },
      });

      expect(result.success).toBe(true);
      expect(mockConnector.authenticate).toHaveBeenCalled();
    });

    it('should handle credential validation failure', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { connector_type: 'google_drive' },
        error: null,
      });

      mockConnector.authenticate.mockResolvedValue({
        success: false,
        error: 'Invalid token',
      });

      const result = await ConnectorManager.updateConnector('connector-1', {
        credentials: { accessToken: 'invalid' },
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid token');
    });
  });

  describe('deleteConnector()', () => {
    it('should delete connector', async () => {
      mockSupabase.delete.mockResolvedValue({ error: null });

      const result = await ConnectorManager.deleteConnector('connector-1');

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('connector_configs');
    });

    it('should delete documents when requested', async () => {
      mockSupabase.delete.mockResolvedValue({ error: null });

      await ConnectorManager.deleteConnector('connector-1', true);

      expect(mockSupabase.from).toHaveBeenCalledWith('imported_documents');
      expect(mockSupabase.delete).toHaveBeenCalledTimes(2);
    });
  });

  describe('listConnectors()', () => {
    it('should list all connectors for org', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [
          { id: 'connector-1', connector_type: 'google_drive' },
          { id: 'connector-2', connector_type: 'notion' },
        ],
        error: null,
      });

      const result = await ConnectorManager.listConnectors('org-123');

      expect(result.success).toBe(true);
      expect(result.connectors).toHaveLength(2);
    });

    it('should filter by connector type', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [{ id: 'connector-1', connector_type: 'google_drive' }],
        error: null,
      });

      await ConnectorManager.listConnectors('org-123', {
        connectorType: ConnectorType.GOOGLE_DRIVE,
      });

      expect(mockSupabase.eq).toHaveBeenCalledWith('connector_type', 'google_drive');
    });

    it('should filter by active status', async () => {
      mockSupabase.order.mockResolvedValue({
        data: [],
        error: null,
      });

      await ConnectorManager.listConnectors('org-123', { isActive: true });

      expect(mockSupabase.eq).toHaveBeenCalledWith('is_active', true);
    });
  });

  describe('syncConnector()', () => {
    beforeEach(() => {
      mockSupabase.single.mockResolvedValue({
        data: {
          id: 'connector-1',
          org_id: 'org-123',
          connector_type: 'google_drive',
          credentials: { accessToken: 'token' },
          settings: {},
          is_active: true,
        },
        error: null,
      });

      mockSupabase.update.mockResolvedValue({ error: null });
      mockSupabase.select.mockResolvedValue({ data: [], error: null });
      mockSupabase.insert.mockResolvedValue({ error: null });
    });

    it('should sync connector successfully', async () => {
      const result = await ConnectorManager.syncConnector({
        connectorId: 'connector-1',
      });

      expect(result.success).toBe(true);
      expect(result.result?.filesProcessed).toBe(10);
      expect(mockConnector.sync).toHaveBeenCalled();
    });

    it('should handle inactive connector', async () => {
      mockSupabase.single.mockResolvedValue({
        data: { ...mockSupabase.single().data, is_active: false },
        error: null,
      });

      const result = await ConnectorManager.syncConnector({
        connectorId: 'connector-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not active');
    });

    it('should update connector status during sync', async () => {
      await ConnectorManager.syncConnector({
        connectorId: 'connector-1',
      });

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ sync_status: 'syncing' })
      );

      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ sync_status: 'idle' })
      );
    });

    it('should handle sync errors', async () => {
      mockConnector.sync.mockRejectedValue(new Error('Sync failed'));

      const result = await ConnectorManager.syncConnector({
        connectorId: 'connector-1',
      });

      expect(result.success).toBe(false);
      expect(mockSupabase.update).toHaveBeenCalledWith(
        expect.objectContaining({ sync_status: 'error' })
      );
    });
  });

  describe('testConnector()', () => {
    it('should test connector connection', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          connector_type: 'google_drive',
          credentials: { accessToken: 'token' },
          settings: {},
        },
        error: null,
      });

      const result = await ConnectorManager.testConnector('connector-1');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connected');
    });
  });

  describe('getStats()', () => {
    it('should return connector statistics', async () => {
      mockSupabase.select
        .mockResolvedValueOnce({
          data: [
            { sync_status: 'idle', last_sync_at: '2024-01-01' },
            { sync_status: 'syncing', last_sync_at: '2024-01-02' },
            { sync_status: 'error', last_sync_at: null },
          ],
          error: null,
        })
        .mockResolvedValueOnce({
          data: new Array(25),
          error: null,
        });

      const stats = await ConnectorManager.getStats('org-123');

      expect(stats.totalConnectors).toBe(3);
      expect(stats.activeConnectors).toBe(2);
      expect(stats.syncingConnectors).toBe(1);
      expect(stats.errorConnectors).toBe(1);
      expect(stats.documentCount).toBe(25);
    });
  });

  describe('refreshCredentials()', () => {
    it('should refresh connector credentials', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          connector_type: 'zoom',
          credentials: { refreshToken: 'refresh-token' },
        },
        error: null,
      });

      mockConnector.refreshCredentials = jest.fn().mockResolvedValue({
        accessToken: 'new-token',
        refreshToken: 'new-refresh-token',
      });

      mockSupabase.update.mockResolvedValue({ error: null });

      const result = await ConnectorManager.refreshCredentials('connector-1');

      expect(result.success).toBe(true);
      expect(mockConnector.refreshCredentials).toHaveBeenCalled();
    });

    it('should handle unsupported refresh', async () => {
      mockSupabase.single.mockResolvedValue({
        data: {
          connector_type: 'file_upload',
          credentials: {},
        },
        error: null,
      });

      mockConnector.refreshCredentials = undefined;

      const result = await ConnectorManager.refreshCredentials('connector-1');

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support');
    });
  });
});
