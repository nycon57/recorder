'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  AlertCircle,
  RotateCcw,
  Trash2,
} from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/app/components/ui/alert';
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
import { toast } from '@/app/components/ui/use-toast';
import RecordingPlayer from '@/app/components/RecordingPlayer';
import EditRecordingModal from '@/app/components/EditRecordingModal';
import ProcessingPipeline from '@/app/components/ProcessingPipeline';
import ReprocessStreamModal from '@/app/components/ReprocessStreamModal';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import type {
  ContentType,
  FileType,
  Json,
  RecordingStatus,
  Tag,
} from '@/lib/types/database';
import type { KnowledgeStatus } from '@/lib/types/knowledge-status';

import ContentSidebar from '../viewers/ContentSidebar';
import TranscriptPanel from '../shared/TranscriptPanel';
import ShareControls from '../shared/ShareControls';
import KeyboardShortcutsDialog from '../shared/KeyboardShortcutsDialog';
import InlineEditableField from '../shared/InlineEditableField';
import InlineTagsEditor from '../shared/InlineTagsEditor';
import PublishModal from '../PublishModal';

interface Word {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

interface Transcript {
  id: string;
  content_id: string;
  text: string;
  words_json?: Word[] | null;
  language?: string | null;
  confidence?: number | null;
  provider?: string | null;
}

interface Document {
  id: string;
  content_id: string;
  markdown: string;
  html?: string | null;
  summary?: string | null;
  version: string;
  status: string;
  model?: string | null;
}

type InitialTag = Omit<Tag, 'color'> & { color: string | null };

interface Recording {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  duration_sec: number | null;
  storage_path_raw: string | null;
  storage_path_processed: string | null;
  thumbnail_url: string | null;
  videoUrl: string | null;
  downloadUrl: string | null;
  metadata: Json | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  deleted_at: string | null;
  content_type: string | null;
  file_type: string | null;
  original_filename: string | null;
  file_size: number | null;
}

type ReprocessStep = 'transcribe' | 'document' | 'embeddings' | 'all';

interface VideoDetailViewState {
  isEditModalOpen: boolean;
  tags: Tag[];
  isReprocessModalOpen: boolean;
  reprocessStep: ReprocessStep;
  videoDurationOverride: number | null;
  showMoveToTrashDialog: boolean;
  showPermanentDeleteDialog: boolean;
  showKeyboardShortcuts: boolean;
  isPublishModalOpen: boolean;
}

const createInitialVideoDetailViewState = (
  initialTags: Array<InitialTag | null>,
): VideoDetailViewState => ({
  isEditModalOpen: false,
  tags: initialTags.flatMap((tag): Tag[] =>
    tag ? [{ ...tag, color: tag.color ?? '#64748b' }] : [],
  ),
  isReprocessModalOpen: false,
  reprocessStep: 'all',
  videoDurationOverride: null,
  showMoveToTrashDialog: false,
  showPermanentDeleteDialog: false,
  showKeyboardShortcuts: false,
  isPublishModalOpen: false,
});

const videoDetailViewReducer = (
  state: VideoDetailViewState,
  patch: Partial<VideoDetailViewState>,
): VideoDetailViewState => ({
  ...state,
  ...patch,
});

export interface VideoDetailViewProps {
  recording: Recording;
  transcript: Transcript | null;
  document: Document | null;
  knowledgeStatus: KnowledgeStatus;
  initialTags: Array<InitialTag | null>;
  /** Cache key for fetching highlight sources */
  sourceKey?: string;
  /** ID of transcript chunk to highlight (from search) */
  initialHighlightId?: string;
  /** Initial timestamp to seek to in seconds (from concept mention link) */
  initialTimestamp?: number;
}

export default function VideoDetailView(
  props: Parameters<typeof useVideoDetailViewImplementation>[0],
) {
  return useVideoDetailViewImplementation(props);
}

function useVideoDetailViewImplementation({
  recording,
  transcript,
  document,
  knowledgeStatus,
  initialTags,
  initialTimestamp,
}: VideoDetailViewProps) {
  const { back, push, refresh } = useRouter();

  const [
    {
      isEditModalOpen,
      tags,
      isReprocessModalOpen,
      reprocessStep,
      videoDurationOverride,
      showMoveToTrashDialog,
      showPermanentDeleteDialog,
      showKeyboardShortcuts,
      isPublishModalOpen,
    },
    updateViewState,
  ] = React.useReducer(
    videoDetailViewReducer,
    initialTags,
    createInitialVideoDetailViewState,
  );
  const videoDuration = videoDurationOverride ?? recording.duration_sec;
  const videoPlayerRef = React.useRef<React.ElementRef<'video'> | null>(null);

  const isTrashed = !!recording.deleted_at;

  // Handle initial timestamp seek from URL parameter (e.g., from concept mention link)
  React.useEffect(() => {
    if (initialTimestamp === undefined || initialTimestamp <= 0) return;

    const video = videoPlayerRef.current;
    if (!video) return;

    // If video is already loaded, seek immediately
    if (video.readyState >= 1) {
      video.currentTime = initialTimestamp;
      video.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    // Otherwise, wait for metadata to load
    const handleLoadedMetadata = () => {
      video.currentTime = initialTimestamp;
      video.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [initialTimestamp]);

  const handleVideoDurationChange = (duration: number) => {
    updateViewState({ videoDurationOverride: duration });
  };

  const handleTimestampClick = (timestamp: number) => {
    if (videoPlayerRef.current) {
      videoPlayerRef.current.currentTime = timestamp;
      videoPlayerRef.current.play();
      videoPlayerRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
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

      const blobUrl = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.download =
        recording.original_filename ||
        `${recording.title || 'recording'}.${recording.file_type || 'mp4'}`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  // Keyboard shortcuts
  useKeyboardShortcuts({
    onPlayPause: () => {
      if (videoPlayerRef.current) {
        if (videoPlayerRef.current.paused) {
          videoPlayerRef.current.play();
        } else {
          videoPlayerRef.current.pause();
        }
      }
    },
    onSeekBackward: () => {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.currentTime = Math.max(
          0,
          videoPlayerRef.current.currentTime - 5,
        );
      }
    },
    onSeekForward: () => {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.currentTime = Math.min(
          videoPlayerRef.current.duration || 0,
          videoPlayerRef.current.currentTime + 5,
        );
      }
    },
    onVolumeUp: () => {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.volume = Math.min(
          1,
          videoPlayerRef.current.volume + 0.1,
        );
      }
    },
    onVolumeDown: () => {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.volume = Math.max(
          0,
          videoPlayerRef.current.volume - 0.1,
        );
      }
    },
    onMute: () => {
      if (videoPlayerRef.current) {
        videoPlayerRef.current.muted = !videoPlayerRef.current.muted;
      }
    },
    onFullscreen: () => {
      if (videoPlayerRef.current) {
        if (
          document &&
          'fullscreenElement' in document &&
          document.fullscreenElement
        ) {
          if ('exitFullscreen' in document) {
            (
              document as Document & { exitFullscreen: () => Promise<void> }
            ).exitFullscreen();
          }
        } else {
          videoPlayerRef.current.requestFullscreen();
        }
      }
    },
    onDownload: handleDownload,
    onEdit: () => updateViewState({ isEditModalOpen: true }),
    onReprocess: () => handleReprocess('all'),
    onShowShortcuts: () =>
      updateViewState({ showKeyboardShortcuts: !showKeyboardShortcuts }),
  });

  const handleReprocess = (step: string) => {
    let apiStep: ReprocessStep = 'all';
    if (step === 'transcribe') {
      apiStep = 'transcribe';
    } else if (step === 'document') {
      apiStep = 'document';
    } else if (step === 'embeddings') {
      apiStep = 'embeddings';
    }

    updateViewState({
      reprocessStep: apiStep,
      isReprocessModalOpen: true,
    });
  };

  const handleReprocessModalClose = (wasSuccessful?: boolean) => {
    updateViewState({ isReprocessModalOpen: false });
    if (wasSuccessful) {
      refresh();
    }
  };

  const handleRestore = async () => {
    try {
      const response = await fetch(`/api/recordings/${recording.id}/restore`, {
        method: 'POST',
      });

      if (response.ok) {
        toast({ description: 'Item restored successfully' });
        refresh();
      } else {
        toast({
          variant: 'destructive',
          description: 'Failed to restore item',
        });
      }
    } catch (error) {
      console.error('Restore failed:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to restore item',
      });
    }
  };

  const handleMoveToTrash = async () => {
    try {
      const response = await fetch(`/api/recordings/${recording.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({ description: 'Item moved to trash' });
        push('/library');
      } else {
        toast({
          variant: 'destructive',
          description: 'Failed to move item to trash',
        });
      }
    } catch (error) {
      console.error('Move to trash failed:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to move item to trash',
      });
    }
  };

  const handlePermanentDelete = async () => {
    try {
      const response = await fetch(
        `/api/recordings/${recording.id}?permanent=true`,
        {
          method: 'DELETE',
        },
      );

      if (response.ok) {
        toast({ description: 'Item permanently deleted' });
        push('/library?status=trash');
      } else {
        toast({
          variant: 'destructive',
          description: 'Failed to delete item',
        });
      }
    } catch (error) {
      console.error('Delete failed:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to delete item',
      });
    }
  };

  const handleUpdateTitle = async (newTitle: string) => {
    try {
      const response = await fetch(`/api/recordings/${recording.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });

      if (!response.ok) {
        throw new Error('Failed to update title');
      }

      toast({ description: 'Title updated successfully' });
      refresh();
    } catch (error) {
      console.error('Update title failed:', error);
      throw error; // Re-throw to show error in component
    }
  };

  const handleUpdateDescription = async (newDescription: string) => {
    try {
      const response = await fetch(`/api/recordings/${recording.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: newDescription }),
      });

      if (!response.ok) {
        throw new Error('Failed to update description');
      }

      toast({ description: 'Description updated successfully' });
      refresh();
    } catch (error) {
      console.error('Update description failed:', error);
      throw error; // Re-throw to show error in component
    }
  };

  const handleAddTag = async (tagName: string): Promise<Tag> => {
    try {
      // Create the tag
      const createResponse = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tagName }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create tag');
      }

      const { tag: newTag } = await createResponse.json();

      // Apply the tag to this recording
      const applyResponse = await fetch(`/api/tags/${newTag.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recording_ids: [recording.id] }),
      });

      if (!applyResponse.ok) {
        throw new Error('Failed to apply tag');
      }

      toast({ description: 'Tag added successfully' });
      return newTag;
    } catch (error) {
      console.error('Add tag failed:', error);
      throw error;
    }
  };

  const handleRemoveTag = async (tagId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/tags/${tagId}/remove`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recording_ids: [recording.id] }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove tag');
      }

      toast({ description: 'Tag removed successfully' });
    } catch (error) {
      console.error('Remove tag failed:', error);
      throw error;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="ghost" size="icon" onClick={() => back()}>
              <ArrowLeft className="size-5" />
            </Button>

            <div className="flex-1 min-w-0 space-y-1">
              {!isTrashed ? (
                <>
                  <InlineEditableField
                    value={recording.title || ''}
                    onSave={handleUpdateTitle}
                    placeholder="Untitled Video"
                    displayAs="title"
                    maxLength={200}
                    required
                  />
                  <InlineEditableField
                    value={recording.description || ''}
                    onSave={handleUpdateDescription}
                    placeholder="Add a description…"
                    type="textarea"
                    displayAs="description"
                    maxLength={500}
                  />

                  {/* Inline Tags Editor */}
                  <div className="mt-3">
                    <InlineTagsEditor
                      tags={tags}
                      onTagsChange={(nextTags) =>
                        updateViewState({ tags: nextTags })
                      }
                      onAddTag={handleAddTag}
                      onRemoveTag={handleRemoveTag}
                    />
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-semibold truncate">
                    {recording.title || 'Untitled Video'}
                  </h1>
                  {recording.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {recording.description}
                    </p>
                  )}
                </>
              )}
            </div>

            {!isTrashed && (
              <div className="flex items-center gap-2">
                <ShareControls recordingId={recording.id} />
                <Button
                  onClick={() =>
                    updateViewState({ showMoveToTrashDialog: true })
                  }
                  variant="ghost"
                  size="icon"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            )}

            {isTrashed && (
              <div className="flex items-center gap-2">
                <Button onClick={handleRestore} variant="outline">
                  <RotateCcw className="size-4 mr-2" />
                  Restore Item
                </Button>
                <Button
                  onClick={() =>
                    updateViewState({ showPermanentDeleteDialog: true })
                  }
                  variant="destructive"
                >
                  <Trash2 className="size-4 mr-2" />
                  Delete Forever
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        {/* Trash Warning Banner */}
        {isTrashed && recording.deleted_at && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="size-4" />
            <AlertTitle>This item is in the trash</AlertTitle>
            <AlertDescription>
              This content was moved to trash on{' '}
              {formatDate(recording.deleted_at)}. You can restore it or
              permanently delete it.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div
            className="lg:col-span-2 space-y-6"
            style={isTrashed ? { opacity: 0.7 } : undefined}
          >
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
                    Video is being processed…
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Transcript Panel */}
            {transcript ? (
              <TranscriptPanel
                transcript={transcript}
                recordingId={recording.id}
                onTimestampClick={handleTimestampClick}
              />
            ) : (
              <Card>
                <CardContent className="py-12 flex flex-col items-center justify-center text-center gap-y-4">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  <div>
                    <p className="font-medium text-foreground mb-1">
                      Transcription in progress
                    </p>
                    <p className="text-sm text-muted-foreground">
                      We&apos;re transcribing your video using AI. This usually
                      takes 1-2 minutes.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6 space-y-6">
              <ContentSidebar
                recordingId={recording.id}
                contentType={recording.content_type as ContentType | null}
                fileType={recording.file_type as FileType | null}
                status={recording.status as RecordingStatus}
                knowledgeStatus={knowledgeStatus}
                fileSize={recording.file_size}
                duration={videoDuration}
                createdAt={recording.created_at}
                completedAt={recording.completed_at}
                originalFilename={recording.original_filename}
                deletedAt={recording.deleted_at}
                tags={tags}
                document={document}
                onEdit={() => updateViewState({ isEditModalOpen: true })}
                onDelete={() =>
                  isTrashed
                    ? updateViewState({ showPermanentDeleteDialog: true })
                    : updateViewState({ showMoveToTrashDialog: true })
                }
                onDownload={handleDownload}
                onPublish={() => updateViewState({ isPublishModalOpen: true })}
              />

              {/* Processing Pipeline */}
              <ProcessingPipeline
                recording={
                  recording as React.ComponentProps<
                    typeof ProcessingPipeline
                  >['recording']
                }
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
        onOpenChange={(isOpen) => updateViewState({ isEditModalOpen: isOpen })}
        recording={recording}
        initialTags={tags}
        onTagsChange={(nextTags) => updateViewState({ tags: nextTags })}
      />

      <ReprocessStreamModal
        open={isReprocessModalOpen}
        onOpenChange={handleReprocessModalClose}
        recordingId={recording.id}
        step={reprocessStep}
        recordingTitle={recording.title || undefined}
      />

      {/* Move to Trash Confirmation Dialog */}
      <AlertDialog
        open={showMoveToTrashDialog}
        onOpenChange={(isOpen) =>
          updateViewState({ showMoveToTrashDialog: isOpen })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to move &quot;
              {recording.title || 'this item'}&quot; to trash? You can restore
              it later from the trash page.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMoveToTrash}
              className="bg-destructive hover:bg-destructive/90"
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog
        open={showPermanentDeleteDialog}
        onOpenChange={(isOpen) =>
          updateViewState({ showPermanentDeleteDialog: isOpen })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">
              Permanently Delete?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Are you sure you want to permanently delete &quot;
                  {recording.title || 'this item'}&quot;?
                </p>
                <p className="font-semibold text-destructive">
                  ⚠️ This action cannot be undone. All associated data will be
                  permanently removed:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Original file</li>
                  <li>Transcripts and documents</li>
                  <li>Search embeddings</li>
                  <li>All metadata</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handlePermanentDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Keyboard Shortcuts Dialog */}
      <KeyboardShortcutsDialog
        open={showKeyboardShortcuts}
        onOpenChange={(isOpen) =>
          updateViewState({ showKeyboardShortcuts: isOpen })
        }
        contentType={recording.content_type as ContentType | null}
      />

      {/* Publish Modal */}
      <PublishModal
        contentId={recording.id}
        documentId={document?.id || ''}
        contentTitle={recording.title || 'Untitled'}
        isOpen={isPublishModalOpen}
        onClose={() => updateViewState({ isPublishModalOpen: false })}
        onPublishComplete={() => {
          toast({ description: 'Document published successfully!' });
          refresh();
        }}
      />
    </div>
  );
}
