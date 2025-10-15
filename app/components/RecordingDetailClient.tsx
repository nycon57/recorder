'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Edit,
  Trash2,
  MoreVertical,
  Play,
  FileText,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button, buttonVariants } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/app/components/ui/card';
import { Separator } from '@/app/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';
import RecordingPlayer from './RecordingPlayer';
import ProcessingPipeline from './ProcessingPipeline';
import TranscriptViewer from './TranscriptViewer';
import DocumentViewer from './DocumentViewer';
import EditRecordingModal from './EditRecordingModal';
import ReprocessStreamModal from './ReprocessStreamModal';
import TagBadge from './TagBadge';
import type { Tag } from '@/lib/types/database';

interface Recording {
  id: string;
  title: string | null;
  description: string | null;
  status: 'uploading' | 'uploaded' | 'transcribing' | 'transcribed' | 'doc_generating' | 'completed' | 'error';
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
}

interface Transcript {
  id: string;
  recording_id: string;
  text: string;
  language: string | null;
  words_json: any;
  confidence: number | null;
  provider: string | null;
}

interface Document {
  id: string;
  recording_id: string;
  markdown: string;
  html: string | null;
  summary: string | null;
  version: string;
  status: string;
}

interface RecordingDetailClientProps {
  recording: Recording;
  transcript: Transcript | null;
  document: Document | null;
  initialTags: Tag[];
}

export default function RecordingDetailClient({
  recording,
  transcript,
  document,
  initialTags,
}: RecordingDetailClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState('overview');
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [tags, setTags] = React.useState<Tag[]>(initialTags);
  const [isReprocessModalOpen, setIsReprocessModalOpen] = React.useState(false);
  const [reprocessStep, setReprocessStep] = React.useState<'transcribe' | 'document' | 'embeddings' | 'all'>('all');
  const [videoDuration, setVideoDuration] = React.useState<number | null>(recording.duration_sec);

  const getStatusBadgeVariant = (status: Recording['status']) => {
    switch (status) {
      case 'uploading':
        return 'secondary';
      case 'uploaded':
      case 'transcribing':
      case 'transcribed':
      case 'doc_generating':
        return 'outline';
      case 'completed':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusLabel = (status: Recording['status']) => {
    switch (status) {
      case 'uploading':
        return 'Uploading';
      case 'uploaded':
        return 'Uploaded';
      case 'transcribing':
        return 'Transcribing';
      case 'transcribed':
        return 'Transcribed';
      case 'doc_generating':
        return 'Generating Document';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return status;
    }
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds || seconds === 0) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVideoDurationChange = (duration: number) => {
    setVideoDuration(duration);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const handleDownload = async () => {
    // Prefer processed (MP4) version for download
    const urlToDownload = recording.downloadUrl || recording.videoUrl;
    if (!urlToDownload) {
      toast.error('Video URL not available');
      return;
    }

    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      toast.error('Download not available');
      return;
    }

    try {
      // Fetch the video blob
      const response = await fetch(urlToDownload);
      const blob = await response.blob();

      // Determine file extension
      // Prefer checking the URL path, then MIME type, then default based on whether we have processed version
      let extension = 'mp4'; // Default to mp4

      // Check URL for extension
      if (urlToDownload.includes('.mp4') || recording.storage_path_processed) {
        extension = 'mp4';
      } else if (urlToDownload.includes('.webm') || recording.storage_path_raw) {
        // Only use webm if we definitely have raw version and no processed
        const mimeType = blob.type;
        if (mimeType.includes('mp4')) {
          extension = 'mp4';
        } else if (mimeType.includes('webm')) {
          extension = 'webm';
        }
      }

      // Create a blob URL
      const blobUrl = window.URL.createObjectURL(blob);

      // Create a temporary link and trigger download
      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.download = `${recording.title || 'recording'}-${Date.now()}.${extension}`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);

      // Clean up the blob URL
      window.URL.revokeObjectURL(blobUrl);

      toast.success(`Download started (${extension.toUpperCase()})`);
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed');
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setIsDeleteDialogOpen(false);

    try {
      const response = await fetch(`/api/recordings/${recording.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete recording');
      }

      toast.success('Recording deleted successfully');
      router.push('/dashboard');
    } catch (error) {
      toast.error('Failed to delete recording');
      setIsDeleting(false);
    }
  };

  const handleReprocess = (step: string) => {
    // Map ProcessingPipeline step IDs to API step names
    let apiStep: 'transcribe' | 'document' | 'embeddings' | 'all' = 'all';
    if (step === 'transcribe') {
      apiStep = 'transcribe';
    } else if (step === 'document') {
      apiStep = 'document';
    } else if (step === 'embeddings') {
      apiStep = 'embeddings';
    }

    // Set the step and open the streaming modal
    setReprocessStep(apiStep);
    setIsReprocessModalOpen(true);
  };

  // Handle modal close - refresh the page to show updated recording data
  const handleReprocessModalClose = (wasSuccessful?: boolean) => {
    setIsReprocessModalOpen(false);
    if (wasSuccessful) {
      // Refresh to show updated recording status
      router.refresh();
    }
  };

  // Determine which tab to show based on available data
  React.useEffect(() => {
    if (transcript && activeTab === 'overview') {
      // Don't auto-switch if user is already on overview
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
            >
              <ArrowLeft className="size-5" />
            </Button>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold truncate">
                {recording.title || 'Untitled Recording'}
              </h1>
            </div>

            <Badge variant={getStatusBadgeVariant(recording.status)}>
              {getStatusLabel(recording.status)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Player */}
            {recording.videoUrl && (
              <RecordingPlayer
                videoUrl={recording.videoUrl}
                onDurationChange={handleVideoDurationChange}
              />
            )}

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="overview">
                  <Play className="size-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="transcript" disabled={!transcript}>
                  <MessageSquare className="size-4" />
                  Transcript
                </TabsTrigger>
                <TabsTrigger value="document" disabled={!document}>
                  <FileText className="size-4" />
                  Document
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4 mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recording.description && (
                      <div>
                        <p className="text-sm font-medium mb-1">Description</p>
                        <p className="text-sm text-muted-foreground">
                          {recording.description}
                        </p>
                      </div>
                    )}
                    {tags.length > 0 && (
                      <div>
                        <p className="text-sm font-medium mb-2">Tags</p>
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((tag) => (
                            <TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium mb-1">Duration</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDuration(videoDuration)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Created</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(recording.created_at)}
                        </p>
                      </div>
                      {recording.metadata?.fileSize && (
                        <div>
                          <p className="text-sm font-medium mb-1">File Size</p>
                          <p className="text-sm text-muted-foreground">
                            {formatFileSize(recording.metadata.fileSize)}
                          </p>
                        </div>
                      )}
                      {recording.completed_at && (
                        <div>
                          <p className="text-sm font-medium mb-1">Completed</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(recording.completed_at)}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {!transcript && !document && recording.status !== 'uploaded' && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Processing Status</CardTitle>
                      <CardDescription>
                        Your recording is being processed
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="size-8 animate-spin text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Transcript Tab */}
              <TabsContent value="transcript" className="mt-4">
                {transcript ? (
                  <TranscriptViewer
                    transcript={transcript}
                    recordingId={recording.id}
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
                  <DocumentViewer
                    document={document}
                    recordingId={recording.id}
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
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={handleDownload}
                    disabled={!recording.videoUrl}
                  >
                    <Download className="size-4" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => setIsEditModalOpen(true)}
                  >
                    <Edit className="size-4" />
                    Edit Details
                  </Button>
                  <Separator />
                  <Button
                    variant="outline"
                    className="w-full justify-start text-destructive hover:text-destructive"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    Delete Recording
                  </Button>
                </CardContent>
              </Card>

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
        onOpenChange={setIsReprocessModalOpen}
        recordingId={recording.id}
        step={reprocessStep}
        recordingTitle={recording.title || undefined}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recording?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{recording.title || 'this recording'}"?
              This action cannot be undone and will permanently delete the recording,
              transcript, and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={cn(
                buttonVariants({ variant: 'destructive' })
              )}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
