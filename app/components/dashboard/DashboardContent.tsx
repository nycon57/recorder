'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

import CreateNoteModal from '@/app/components/create-note/CreateNoteModal';
import UploadModal from '@/app/components/upload/UploadModal';
import { KnowledgeInsightsCard, ConceptPanel } from '@/app/components/knowledge';

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
  content_type: 'recording' | 'video' | 'audio' | 'document' | 'text' | 'imported' | null;
  thumbnail_url: string | null;
  status: string;
  created_at: string;
  duration_sec: number | null;
  file_size: number | null;
}

export function DashboardContent() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentItems, setRecentItems] = useState<DashboardRecentItem[]>([]);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isCreateNoteModalOpen, setIsCreateNoteModalOpen] = useState(false);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);

  /**
   * Fetch dashboard data
   */
  const fetchDashboardData = () => {
    // Fetch stats
    setIsLoadingStats(true);
    fetch('/api/dashboard/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setStats(data.data);
        }
        setIsLoadingStats(false);
      })
      .catch((err) => {
        console.error('Error fetching stats:', err);
        setIsLoadingStats(false);
      });

    // Fetch recent items
    setIsLoadingItems(true);
    fetch('/api/dashboard/recent')
      .then((res) => res.json())
      .then((data) => {
        if (data.data && Array.isArray(data.data.data)) {
          setRecentItems(data.data.data);
        }
        setIsLoadingItems(false);
      })
      .catch((err) => {
        console.error('Error fetching recent items:', err);
        setIsLoadingItems(false);
      });
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  /**
   * Handle upload button click
   */
  const handleUploadClick = () => {
    setIsUploadModalOpen(true);
  };

  /**
   * Handle create note button click
   */
  const handleCreateNoteClick = () => {
    setIsCreateNoteModalOpen(true);
  };

  /**
   * Handle record button click
   */
  const handleRecordClick = () => {
    router.push('/record');
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
    fetchDashboardData();
  };

  /**
   * Handle successful note creation
   */
  const handleNoteCreated = (noteId: string) => {
    // Refresh dashboard data to show new note
    fetchDashboardData();
  };

  const isEmpty = !isLoadingItems && recentItems.length === 0;

  return (
    <>
      <div className="space-y-8">
        {/* Hero Section with Quick Actions */}
        <section>
          <div className="mb-6">
            <h1 className="text-3xl font-normal mb-2">
              Welcome to your Knowledge Hub
            </h1>
            <p className="text-muted-foreground">
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
            onConceptClick={(conceptId) => setSelectedConceptId(conceptId)}
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
            <RecentItems items={recentItems as any} isLoading={isLoadingItems} />
          )}
        </section>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={handleUploadComplete}
      />

      {/* Create Note Modal */}
      <CreateNoteModal
        isOpen={isCreateNoteModalOpen}
        onClose={() => setIsCreateNoteModalOpen(false)}
        onNoteCreated={handleNoteCreated}
      />

      {/* Concept Panel (Knowledge Graph) */}
      <ConceptPanel
        conceptId={selectedConceptId}
        onClose={() => setSelectedConceptId(null)}
        onConceptClick={(conceptId) => setSelectedConceptId(conceptId)}
      />
    </>
  );
}
