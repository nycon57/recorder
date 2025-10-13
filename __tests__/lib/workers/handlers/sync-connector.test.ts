/**
 * Sync Connector Handler Tests
 *
 * Tests connector sync job processing and result logging.
 */

import { syncConnector } from '@/lib/workers/handlers/sync-connector';
import type { Database } from '@/lib/types/database';
import { ConnectorRegistry } from '@/lib/connectors/registry';

// Mock Supabase
jest.mock('@/lib/supabase/admin');
import { createClient } from '@/lib/supabase/admin';

// Mock ConnectorRegistry
jest.mock('@/lib/connectors/registry');

type Job = Database['public']['Tables']['jobs']['Row'];

describe('syncConnector', () => {
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
      eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn(),
    };

    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock connector
    mockConnector = {
      testConnection: jest.fn().mockResolvedValue({ success: true }),
      sync: jest.fn().mockResolvedValue({
        success: true,
        filesProcessed: 10,
        filesUpdated: 8,
        filesFailed: 0,
        filesDeleted: 0,
        errors: [],
      }),
    };

    (ConnectorRegistry.create as jest.Mock).mockReturnValue(mockConnector);
  });

  it('should sync connector successfully', async () => {
    const job: Job = {
      id: 'job-1',
      type: 'sync_connector',
      status: 'pending',
      payload: {
        connectorId: 'connector-1',
        orgId: 'org-123',
        syncType: 'scheduled',
      },
      attempt_count: 0,
      run_after: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      error: null,
      dedupe_key: null,
    };

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

    mockSupabase.select.mockResolvedValue({
      data: [
        { id: 'doc-1' },
        { id: 'doc-2' },
      ],
      error: null,
    });

    mockSupabase.insert.mockResolvedValue({ error: null });
    mockSupabase.update.mockResolvedValue({ error: null });

    await syncConnector(job);

    expect(mockConnector.sync).toHaveBeenCalled();
    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        sync_status: 'idle',
        last_sync_at: expect.any(String),
      })
    );
  });

  it('should skip inactive connectors', async () => {
    const job: Job = {
      id: 'job-2',
      type: 'sync_connector',
      status: 'pending',
      payload: {
        connectorId: 'connector-2',
        orgId: 'org-123',
      },
      attempt_count: 0,
      run_after: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      error: null,
      dedupe_key: null,
    };

    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'connector-2',
        is_active: false,
      },
      error: null,
    });

    await syncConnector(job);

    expect(mockConnector.sync).not.toHaveBeenCalled();
  });

  it('should update connector status on error', async () => {
    const job: Job = {
      id: 'job-3',
      type: 'sync_connector',
      status: 'pending',
      payload: {
        connectorId: 'connector-3',
        orgId: 'org-123',
      },
      attempt_count: 0,
      run_after: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      error: null,
      dedupe_key: null,
    };

    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'connector-3',
        is_active: true,
        connector_type: 'google_drive',
        credentials: {},
        settings: {},
      },
      error: null,
    });

    mockConnector.sync.mockRejectedValue(new Error('Sync failed'));
    mockSupabase.update.mockResolvedValue({ error: null });

    await expect(syncConnector(job)).rejects.toThrow('Sync failed');

    expect(mockSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        sync_status: 'error',
        sync_error: 'Sync failed',
      })
    );
  });

  it('should enqueue processing jobs for pending documents', async () => {
    const job: Job = {
      id: 'job-4',
      type: 'sync_connector',
      status: 'pending',
      payload: {
        connectorId: 'connector-4',
        orgId: 'org-123',
      },
      attempt_count: 0,
      run_after: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      error: null,
      dedupe_key: null,
    };

    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'connector-4',
        is_active: true,
        connector_type: 'google_drive',
        credentials: {},
        settings: {},
      },
      error: null,
    });

    mockSupabase.select.mockResolvedValue({
      data: [{ id: 'doc-1' }, { id: 'doc-2' }, { id: 'doc-3' }],
      error: null,
    });

    mockSupabase.insert.mockResolvedValue({ error: null });
    mockSupabase.update.mockResolvedValue({ error: null });

    await syncConnector(job);

    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'process_imported_doc',
          payload: expect.objectContaining({
            documentId: 'doc-1',
          }),
        }),
      ])
    );
  });

  it('should pass sync options to connector', async () => {
    const job: Job = {
      id: 'job-5',
      type: 'sync_connector',
      status: 'pending',
      payload: {
        connectorId: 'connector-5',
        orgId: 'org-123',
        fullSync: true,
        since: '2024-01-01T00:00:00Z',
        limit: 50,
      },
      attempt_count: 0,
      run_after: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      error: null,
      dedupe_key: null,
    };

    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'connector-5',
        is_active: true,
        connector_type: 'google_drive',
        credentials: {},
        settings: { fileTypes: ['pdf'] },
      },
      error: null,
    });

    mockSupabase.select.mockResolvedValue({ data: [], error: null });
    mockSupabase.update.mockResolvedValue({ error: null });
    mockSupabase.insert.mockResolvedValue({ error: null });

    await syncConnector(job);

    expect(mockConnector.sync).toHaveBeenCalledWith(
      expect.objectContaining({
        fullSync: true,
        since: expect.any(Date),
        limit: 50,
        fileTypes: ['pdf'],
      })
    );
  });

  it('should handle connector not found', async () => {
    const job: Job = {
      id: 'job-6',
      type: 'sync_connector',
      status: 'pending',
      payload: {
        connectorId: 'invalid-connector',
        orgId: 'org-123',
      },
      attempt_count: 0,
      run_after: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      error: null,
      dedupe_key: null,
    };

    mockSupabase.single.mockResolvedValue({
      data: null,
      error: { message: 'Not found' },
    });

    mockSupabase.update.mockResolvedValue({ error: null });

    await expect(syncConnector(job)).rejects.toThrow('Connector config not found');
  });

  it('should create event on successful sync', async () => {
    const job: Job = {
      id: 'job-7',
      type: 'sync_connector',
      status: 'pending',
      payload: {
        connectorId: 'connector-7',
        orgId: 'org-123',
        syncType: 'manual',
      },
      attempt_count: 0,
      run_after: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      error: null,
      dedupe_key: null,
    };

    mockSupabase.single.mockResolvedValue({
      data: {
        id: 'connector-7',
        is_active: true,
        connector_type: 'notion',
        credentials: {},
        settings: {},
      },
      error: null,
    });

    mockSupabase.select.mockResolvedValue({ data: [], error: null });
    mockSupabase.update.mockResolvedValue({ error: null });
    mockSupabase.insert.mockResolvedValue({ error: null });

    await syncConnector(job);

    expect(mockSupabase.from).toHaveBeenCalledWith('events');
    expect(mockSupabase.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'connector.synced',
        payload: expect.objectContaining({
          connectorId: 'connector-7',
          syncType: 'manual',
          filesProcessed: 10,
        }),
      })
    );
  });
});
