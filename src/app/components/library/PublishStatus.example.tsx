/**
 * PublishStatus Component - Usage Examples
 *
 * This file demonstrates how to use the PublishStatus component in different contexts.
 */

'use client';

import { PublishStatus } from './PublishStatus';
import type { PublishedDocument } from '@/lib/types/publishing';

// =====================================================
// EXAMPLE 1: Compact View in Content Card
// =====================================================

export function ContentCardExample() {
  const contentId = 'content_123';

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">My Recording Title</h3>
          <p className="text-sm text-muted-foreground">Created 2 hours ago</p>
        </div>

        {/* Compact badge view */}
        <PublishStatus
          contentId={contentId}
          variant="compact"
          onPublish={() => console.log('Open publish modal')}
        />
      </div>
    </div>
  );
}

// =====================================================
// EXAMPLE 2: Full View in Content Sidebar
// =====================================================

export function ContentSidebarExample() {
  const contentId = 'content_123';

  return (
    <aside className="w-80 border-l p-4 space-y-6">
      {/* Other sidebar sections */}
      <div>
        <h3 className="font-medium mb-2">Details</h3>
        {/* ... */}
      </div>

      {/* Full publication status view */}
      <PublishStatus
        contentId={contentId}
        variant="full"
        onPublish={() => console.log('Open publish modal')}
        onRefresh={() => console.log('Refreshed publications')}
      />

      {/* Other sidebar sections */}
      <div>
        <h3 className="font-medium mb-2">Tags</h3>
        {/* ... */}
      </div>
    </aside>
  );
}

// =====================================================
// EXAMPLE 3: Pre-fetched Publications
// =====================================================

export function PreFetchedExample() {
  const contentId = 'content_123';

  // Simulate pre-fetched publications from server component or API
  const publications: PublishedDocument[] = [
    {
      id: 'pub_1',
      contentId: contentId,
      documentId: 'doc_1',
      connectorId: 'conn_1',
      orgId: 'org_1',
      publishedBy: 'user_1',
      destination: 'google_drive',
      externalId: 'gdrive_123',
      externalUrl: 'https://drive.google.com/file/d/123',
      folderPath: '/Projects/Documentation',
      format: 'native',
      brandingConfig: {
        includeVideoLink: true,
        includePoweredByFooter: true,
        includeEmbeddedPlayer: false,
      },
      status: 'published',
      lastPublishedAt: new Date('2025-11-25T10:00:00Z'),
      retryCount: 0,
      documentVersion: 1,
      createdAt: new Date('2025-11-25T10:00:00Z'),
      updatedAt: new Date('2025-11-25T10:00:00Z'),
    },
    {
      id: 'pub_2',
      contentId: contentId,
      documentId: 'doc_1',
      connectorId: 'conn_2',
      orgId: 'org_1',
      publishedBy: 'user_1',
      destination: 'sharepoint',
      externalId: 'sp_456',
      externalUrl: 'https://company.sharepoint.com/sites/team/doc',
      folderPath: '/Team/Knowledge Base',
      format: 'markdown',
      brandingConfig: {
        includeVideoLink: true,
        includePoweredByFooter: false,
        includeEmbeddedPlayer: false,
      },
      status: 'outdated',
      lastPublishedAt: new Date('2025-11-20T15:30:00Z'),
      retryCount: 0,
      documentVersion: 1,
      createdAt: new Date('2025-11-20T15:30:00Z'),
      updatedAt: new Date('2025-11-20T15:30:00Z'),
    },
  ];

  return (
    <div className="max-w-2xl mx-auto p-6">
      <PublishStatus
        contentId={contentId}
        publications={publications}
        variant="full"
        onPublish={() => console.log('Open publish modal')}
      />
    </div>
  );
}

// =====================================================
// EXAMPLE 4: In Data Table
// =====================================================

export function DataTableExample() {
  const contentItems = [
    { id: 'content_1', title: 'Getting Started Guide', publicationCount: 2 },
    { id: 'content_2', title: 'Advanced Features', publicationCount: 0 },
    { id: 'content_3', title: 'API Documentation', publicationCount: 1 },
  ];

  return (
    <table className="w-full">
      <thead>
        <tr className="border-b">
          <th className="text-left p-4">Title</th>
          <th className="text-right p-4">Published</th>
          <th className="w-20"></th>
        </tr>
      </thead>
      <tbody>
        {contentItems.map((item) => (
          <tr key={item.id} className="border-b">
            <td className="p-4">{item.title}</td>
            <td className="p-4 text-right text-sm text-muted-foreground">
              {item.publicationCount > 0
                ? `${item.publicationCount} location${item.publicationCount === 1 ? '' : 's'}`
                : 'Not published'}
            </td>
            <td className="p-4">
              <div className="flex justify-end">
                <PublishStatus
                  contentId={item.id}
                  variant="compact"
                  onPublish={() => console.log(`Publish ${item.id}`)}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// =====================================================
// EXAMPLE 5: Loading State
// =====================================================

export function LoadingStateExample() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h3 className="font-medium mb-2">Compact View Loading</h3>
        <PublishStatus contentId="loading_1" variant="compact" />
      </div>

      <div>
        <h3 className="font-medium mb-2">Full View Loading</h3>
        <PublishStatus contentId="loading_2" variant="full" />
      </div>
    </div>
  );
}

// =====================================================
// EXAMPLE 6: Empty State
// =====================================================

export function EmptyStateExample() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h3 className="font-medium mb-2">No Publications - Compact</h3>
        <PublishStatus
          contentId="empty_1"
          publications={[]}
          variant="compact"
          onPublish={() => console.log('Open publish modal')}
        />
      </div>

      <div>
        <h3 className="font-medium mb-2">No Publications - Full</h3>
        <PublishStatus
          contentId="empty_2"
          publications={[]}
          variant="full"
          onPublish={() => console.log('Open publish modal')}
        />
      </div>
    </div>
  );
}

// =====================================================
// EXAMPLE 7: Different Status States
// =====================================================

export function StatusStatesExample() {
  const contentId = 'status_example';

  const createPublication = (
    id: string,
    destination: PublishedDocument['destination'],
    status: PublishedDocument['status']
  ): PublishedDocument => ({
    id,
    contentId,
    documentId: 'doc_1',
    connectorId: 'conn_1',
    orgId: 'org_1',
    publishedBy: 'user_1',
    destination,
    externalId: `ext_${id}`,
    externalUrl: `https://example.com/${id}`,
    format: 'native',
    brandingConfig: {
      includeVideoLink: true,
      includePoweredByFooter: true,
      includeEmbeddedPlayer: false,
    },
    status,
    lastPublishedAt: new Date(),
    retryCount: 0,
    documentVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const publications: PublishedDocument[] = [
    createPublication('pub_synced', 'google_drive', 'published'),
    createPublication('pub_syncing', 'sharepoint', 'syncing'),
    createPublication('pub_pending', 'onedrive', 'pending'),
    createPublication('pub_outdated', 'notion', 'outdated'),
    createPublication('pub_failed', 'google_drive', 'failed'),
  ];

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h3 className="font-medium mb-4">All Status States</h3>
      <PublishStatus
        contentId={contentId}
        publications={publications}
        variant="full"
      />
    </div>
  );
}

// =====================================================
// EXAMPLE 8: Integration with Modal
// =====================================================

export function ModalIntegrationExample() {
  const [isPublishModalOpen, setIsPublishModalOpen] =
    React.useState(false);
  const [selectedContentId, setSelectedContentId] =
    React.useState<string | null>(null);

  const handleOpenPublishModal = (contentId: string) => {
    setSelectedContentId(contentId);
    setIsPublishModalOpen(true);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <PublishStatus
        contentId="content_123"
        variant="full"
        onPublish={() => handleOpenPublishModal('content_123')}
        onRefresh={() => console.log('Refreshed')}
      />

      {/* Your PublishModal component */}
      {isPublishModalOpen && selectedContentId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-background rounded-lg p-6 max-w-lg">
            <h2 className="text-lg font-semibold mb-4">Publish Document</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Publishing content: {selectedContentId}
            </p>
            <button
              onClick={() => setIsPublishModalOpen(false)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
