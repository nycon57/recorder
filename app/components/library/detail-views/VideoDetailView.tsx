'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import { Card, CardContent } from '@/app/components/ui/card';
import RecordingPlayer from '@/app/components/RecordingPlayer';
import EditRecordingModal from '@/app/components/EditRecordingModal';
import ProcessingPipeline from '@/app/components/ProcessingPipeline';
import ReprocessStreamModal from '@/app/components/ReprocessStreamModal';

import MetadataSidebar from './shared/MetadataSidebar';
import TranscriptPanel from './shared/TranscriptPanel';
import AIDocumentPanel from './shared/AIDocumentPanel';
import ShareControls from './shared/ShareControls';

import type { ContentType, FileType, RecordingStatus } from '@/lib/types/database';
import type { Tag } from '@/lib/types/database';

interface Word {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

interface Transcript {
  id: string;
  recording_id: string;
  text: string;
  words_json?: Word[] | null;
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

interface VideoDetailViewProps {
  recording: Recording;
  transcript: Transcript | null;
  document: Document | null;
  initialTags: Tag[];
}

export default function VideoDetailView({
  recording,
  transcript,
  document,
  initialTags,
}: VideoDetailViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState('overview');
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [tags, setTags] = React.useState<Tag[]>(initialTags);
  const [isReprocessModalOpen, setIsReprocessModalOpen] = React.useState(false);
  const [reprocessStep, setReprocessStep] = React.useState<
    'transcribe' | 'document' | 'embeddings' | 'all'
  >('all');
  const [videoDuration, setVideoDuration] = React.useState<number | null>(
    recording.duration_sec
  );
  const videoPlayerRef = React.useRef<HTMLVideoElement | null>(null);

  const handleVideoDurationChange = (duration: number) => {
    setVideoDuration(duration);
  };

  const handleTimestampClick = (timestamp: number) => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = timestamp;
      videoPlayerRef.current.play();
      videoPlayerRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleDownload = async () => {
    if (!recording.downloadUrl && !recording.videoUrl) {
      return;
    }

    const urlToDownload = recording.downloadUrl || recording.videoUrl;
    if (!urlToDownload) return;

    try {
      const response = await fetch(urlToDownload);
      const blob = await response.blob();

      let extension = 'mp4';
      if (urlToDownload.includes('.webm') || recording.storage_path_raw) {
        const mimeType = blob.type;
        if (mimeType.includes('mp4')) {
          extension = 'mp4';
        } else if (mimeType.includes('webm')) {
          extension = 'webm';
        }
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.download = `${recording.title || 'video'}-${Date.now()}.${extension}`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleReprocess = (step: string) => {
    let apiStep: 'transcribe' | 'document' | 'embeddings' | 'all' = 'all';
    if (step === 'transcribe') {
      apiStep = 'transcribe';
    } else if (step === 'document') {
      apiStep = 'document';
    } else if (step === 'embeddings') {
      apiStep = 'embeddings';
    }

    setReprocessStep(apiStep);
    setIsReprocessModalOpen(true);
  };

  const handleReprocessModalClose = (wasSuccessful?: boolean) => {
    setIsReprocessModalOpen(false);
    if (wasSuccessful) {
      router.refresh();
    }
  };

  const handleRegenerateDocument = async () => {
    setReprocessStep('document');
    setIsReprocessModalOpen(true);
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
                {recording.title || 'Untitled Video'}
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
            {/* Video Player */}
            {recording.videoUrl ? (
              <RecordingPlayer
                ref={videoPlayerRef}
                videoUrl={recording.videoUrl}
                onDurationChange={handleVideoDurationChange}
              />
            ) : (
              <Card>
                <CardContent className="py-24 flex flex-col items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Video is being processed...
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="transcript" disabled={!transcript}>
                  Transcript
                </TabsTrigger>
                <TabsTrigger value="document" disabled={!document}>
                  AI Document
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4 mt-4">
                {transcript && (
                  <TranscriptPanel
                    transcript={transcript}
                    recordingId={recording.id}
                    onTimestampClick={handleTimestampClick}
                  />
                )}

                {document && (
                  <AIDocumentPanel
                    document={document}
                    recordingId={recording.id}
                    onRegenerate={handleRegenerateDocument}
                  />
                )}

                {!transcript && !document && recording.status !== 'uploaded' && (
                  <Card>
                    <CardContent className="py-12 flex flex-col items-center justify-center">
                      <Loader2 className="size-8 animate-spin text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Your video is being processed
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Transcript Tab */}
              <TabsContent value="transcript" className="mt-4">
                {transcript ? (
                  <TranscriptPanel
                    transcript={transcript}
                    recordingId={recording.id}
                    onTimestampClick={handleTimestampClick}
                  />
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">
                        Transcript not yet available
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Document Tab */}
              <TabsContent value="document" className="mt-4">
                {document ? (
                  <AIDocumentPanel
                    document={document}
                    recordingId={recording.id}
                    onRegenerate={handleRegenerateDocument}
                  />
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">
                        Document not yet generated
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
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
                duration={videoDuration}
                createdAt={recording.created_at}
                completedAt={recording.completed_at}
                originalFilename={recording.original_filename}
                tags={tags}
                onEdit={() => setIsEditModalOpen(true)}
                onDownload={handleDownload}
                onReprocess={() => handleReprocess('all')}
              />

              {/* Processing Pipeline */}
              <ProcessingPipeline
                recording={recording}
                hasTranscript={!!transcript}
                hasDocument={!!document}
                onReprocess={handleReprocess}
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

      <ReprocessStreamModal
        open={isReprocessModalOpen}
        onOpenChange={handleReprocessModalClose}
        recordingId={recording.id}
        step={reprocessStep}
        recordingTitle={recording.title || undefined}
      />
    </div>
  );
}
