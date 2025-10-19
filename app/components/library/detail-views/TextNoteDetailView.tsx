'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import EditRecordingModal from '@/app/components/EditRecordingModal';
import TextNoteViewer from './TextNoteViewer';

import MetadataSidebar from '../shared/MetadataSidebar';
import AIDocumentPanel from '../shared/AIDocumentPanel';
import ShareControls from '../shared/ShareControls';

import type { ContentType, FileType, RecordingStatus } from '@/lib/types/database';
import type { Tag } from '@/lib/types/database';

interface Transcript {
  id: string;
  recording_id: string;
  text: string;
  words_json?: any;
  language?: string | null;
  confidence?: number | null;
  provider?: string | null;
}

interface Document {
  id: string;
  recording_id: string;
  markdown: string;
  html?: string | null;
  summary?: string | null;
  version: string;
  status: string;
  model?: string | null;
}

interface Recording {
  id: string;
  title: string | null;
  description: string | null;
  status: RecordingStatus;
  duration_sec: number | null;
  storage_path_raw: string | null;
  storage_path_processed: string | null;
  thumbnail_url: string | null;
  videoUrl: string | null;
  downloadUrl: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  content_type: ContentType | null;
  file_type: FileType | null;
  original_filename: string | null;
  file_size: number | null;
}

interface TextNoteDetailViewProps {
  recording: Recording;
  transcript: Transcript | null; // For text notes, the content is stored in transcript.text
  document: Document | null; // AI-enhanced summary/document
  initialTags: Tag[];
}

export default function TextNoteDetailView({
  recording,
  transcript,
  document,
  initialTags,
}: TextNoteDetailViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState('note');
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [tags, setTags] = React.useState<Tag[]>(initialTags);

  const handleContentUpdate = (newContent: string) => {
    // This will be handled by the TextNoteViewer component
    // which will update via API and trigger a page refresh
  };

  const handleDownload = () => {
    if (!transcript?.text) return;

    const blob = new Blob([transcript.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${recording.title || 'note'}.${recording.file_type || 'txt'}`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="size-5" />
            </Button>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">
                {recording.title || 'Untitled Note'}
              </h1>
              {recording.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {recording.description}
                </p>
              )}
            </div>

            <ShareControls recordingId={recording.id} />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            {transcript?.text ? (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="note">Note</TabsTrigger>
                  <TabsTrigger value="ai-summary" disabled={!document}>
                    AI Summary
                  </TabsTrigger>
                </TabsList>

                {/* Note Tab */}
                <TabsContent value="note" className="mt-4">
                  <TextNoteViewer
                    recordingId={recording.id}
                    content={transcript.text}
                    title={recording.title}
                    fileType={recording.file_type as 'txt' | 'md' | null}
                    onContentUpdate={handleContentUpdate}
                  />
                </TabsContent>

                {/* AI Summary Tab */}
                <TabsContent value="ai-summary" className="mt-4">
                  {document ? (
                    <AIDocumentPanel
                      document={document}
                      recordingId={recording.id}
                    />
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      No AI summary generated yet
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-24 text-muted-foreground">
                <p>No content available</p>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6 space-y-6">
              <MetadataSidebar
                recordingId={recording.id}
                contentType={recording.content_type}
                fileType={recording.file_type}
                status={recording.status}
                fileSize={recording.file_size}
                createdAt={recording.created_at}
                updatedAt={recording.updated_at}
                completedAt={recording.completed_at}
                originalFilename={recording.original_filename}
                tags={tags}
                onEdit={() => setIsEditModalOpen(true)}
                onDownload={handleDownload}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EditRecordingModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        recording={recording}
        initialTags={tags}
        onTagsChange={setTags}
      />
    </div>
  );
}
