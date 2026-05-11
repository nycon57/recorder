'use client';

import { useReducer } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import type { ContentType } from '@/lib/types/database';
import CreateNoteModal from '@/app/components/create-note/CreateNoteModal';
import UploadModal from '@/app/components/upload/UploadModal';
import {
  KnowledgeInsightsCard,
  ConceptPanel,
} from '@/app/components/knowledge';

import { EmptyState } from './EmptyState';
import { QuickActions } from './QuickActions';
import { RecentItems } from './RecentItems';
import { StatsRow } from './StatsRow';

interface DashboardStats {
  totalItems: number;
  storageUsedBytes: number;
  itemsThisWeek: number;
  processingCount: number;
}

interface DashboardRecentItem {
  id: string;
  title: string | null;
  description: string | null;
  content_type: ContentType | null;
  thumbnail_url: string | null;
  status: string;
  created_at: string;
  duration_sec: number | null;
  file_size: number | null;
}

export function DashboardContent() {
  const { push } = useRouter();
  const queryClient = useQueryClient();
  const [uiState, dispatchUiState] = useReducer(
    (
      current: {
        isUploadModalOpen: boolean;
        isCreateNoteModalOpen: boolean;
        selectedConceptId: string | null;
      },
      patch: Partial<{
        isUploadModalOpen: boolean;
        isCreateNoteModalOpen: boolean;
        selectedConceptId: string | null;
      }>,
    ) => ({ ...current, ...patch }),
    {
      isUploadModalOpen: false,
      isCreateNoteModalOpen: false,
      selectedConceptId: null,
    },
  );
  const { isUploadModalOpen, isCreateNoteModalOpen, selectedConceptId } =
    uiState;

  const { data: stats = null, isLoading: isLoadingStats } =
    useQuery<DashboardStats | null>({
      queryKey: ['dashboard', 'stats'],
      queryFn: async ({ signal }) => {
        const res = await fetch('/api/dashboard/stats', { signal });
        const data = await res.json();
        return data.data ?? null;
      },
    });

  const { data: recentItems = [], isLoading: isLoadingItems } = useQuery<
    DashboardRecentItem[]
  >({
    queryKey: ['dashboard', 'recent'],
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/dashboard/recent', { signal });
      const data = await res.json();
      return data.data && Array.isArray(data.data.data) ? data.data.data : [];
    },
  });

  const refreshDashboardData = () => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  /**
   * Handle upload button click
   */
  const handleUploadClick = () => {
    dispatchUiState({ isUploadModalOpen: true });
  };

  /**
   * Handle create note button click
   */
  const handleCreateNoteClick = () => {
    dispatchUiState({ isCreateNoteModalOpen: true });
  };

  /**
   * Handle record button click
   */
  const handleRecordClick = () => {
    push('/record');
  };

  /**
   * Handle successful upload completion
   */
  const handleUploadComplete = (recordingIds: string[]) => {
    if (recordingIds.length > 0) {
      toast.success(`${recordingIds.length} file(s) uploaded successfully!`, {
        description: 'Your files are being processed.',
      });
    }
    // Refresh dashboard data to show new items
    refreshDashboardData();
  };

  /**
   * Handle successful note creation
   */
  const handleNoteCreated = () => {
    // Refresh dashboard data to show new note
    refreshDashboardData();
  };

  const isEmpty = !isLoadingItems && recentItems.length === 0;

  return (
    <>
      <div className="trbd-stack">
        {/* Hero Section with Quick Actions */}
        <section className="trbd-stack">
          <div className="trbd-page-heading">
            <p className="trbd-kicker">Workspace</p>
            <h1 className="trbd-page-title">Welcome to your Knowledge Hub</h1>
            <p className="trbd-page-description">
              Record, upload, search, and manage all your content in one place
            </p>
          </div>
          <QuickActions
            onUploadClick={handleUploadClick}
            onCreateNoteClick={handleCreateNoteClick}
          />
        </section>

        {/* Stats Row */}
        <section>
          <StatsRow stats={stats} isLoading={isLoadingStats} />
        </section>

        {/* Knowledge Insights */}
        <section>
          <KnowledgeInsightsCard
            onConceptClick={(conceptId) =>
              dispatchUiState({ selectedConceptId: conceptId })
            }
            className="max-w-2xl"
          />
        </section>

        {/* Recent Items or Empty State */}
        <section>
          {isEmpty ? (
            <EmptyState
              onRecordClick={handleRecordClick}
              onUploadClick={handleUploadClick}
            />
          ) : (
            <RecentItems items={recentItems} isLoading={isLoadingItems} />
          )}
        </section>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => dispatchUiState({ isUploadModalOpen: false })}
        onUploadComplete={handleUploadComplete}
      />

      {/* Create Note Modal */}
      <CreateNoteModal
        isOpen={isCreateNoteModalOpen}
        onClose={() => dispatchUiState({ isCreateNoteModalOpen: false })}
        onNoteCreated={handleNoteCreated}
      />

      {/* Concept Panel (Knowledge Graph) */}
      <ConceptPanel
        conceptId={selectedConceptId}
        onClose={() => dispatchUiState({ selectedConceptId: null })}
        onConceptClick={(conceptId) =>
          dispatchUiState({ selectedConceptId: conceptId })
        }
      />
    </>
  );
}
