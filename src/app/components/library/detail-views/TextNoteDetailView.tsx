'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, RotateCcw, Trash2 } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
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
import EditRecordingModal from '@/app/components/EditRecordingModal';
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
import ThumbnailHero from '../viewers/ThumbnailHero';
import ShareControls from '../shared/ShareControls';
import KeyboardShortcutsDialog from '../shared/KeyboardShortcutsDialog';
import InlineEditableField from '../shared/InlineEditableField';
import InlineTagsEditor from '../shared/InlineTagsEditor';
import AIDocumentPanel from '../shared/AIDocumentPanel';

import TextNoteViewer from './TextNoteViewer';

interface Transcript {
  id: string;
  content_id: string;
  text: string;
  words_json?: unknown;
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

interface TextNoteDetailViewState {
  isEditModalOpen: boolean;
  tags: Tag[];
  showMoveToTrashDialog: boolean;
  showPermanentDeleteDialog: boolean;
  showKeyboardShortcuts: boolean;
}

const createInitialTextNoteDetailViewState = (
  initialTags: Array<InitialTag | null>,
): TextNoteDetailViewState => ({
  isEditModalOpen: false,
  tags: initialTags.flatMap((tag): Tag[] =>
    tag ? [{ ...tag, color: tag.color ?? '#64748b' }] : [],
  ),
  showMoveToTrashDialog: false,
  showPermanentDeleteDialog: false,
  showKeyboardShortcuts: false,
});

const textNoteDetailViewReducer = (
  state: TextNoteDetailViewState,
  patch: Partial<TextNoteDetailViewState>,
): TextNoteDetailViewState => ({
  ...state,
  ...patch,
});

export interface TextNoteDetailViewProps {
  recording: Recording;
  transcript: Transcript | null; // For text notes, the content is stored in transcript.text
  document: Document | null; // AI-enhanced summary/document
  knowledgeStatus: KnowledgeStatus;
  initialTags: Array<InitialTag | null>;
  /** Cache key for fetching highlight sources */
  sourceKey?: string;
  /** ID of transcript chunk to highlight (from search) */
  initialHighlightId?: string;
}

export default function TextNoteDetailView(
  props: Parameters<typeof useTextNoteDetailViewImplementation>[0],
) {
  return useTextNoteDetailViewImplementation(props);
}

function useTextNoteDetailViewImplementation({
  recording,
  transcript,
  document,
  knowledgeStatus,
  initialTags,
}: TextNoteDetailViewProps) {
  const { back, push, refresh } = useRouter();
  const [
    {
      isEditModalOpen,
      tags,
      showMoveToTrashDialog,
      showPermanentDeleteDialog,
      showKeyboardShortcuts,
    },
    updateViewState,
  ] = React.useReducer(
    textNoteDetailViewReducer,
    initialTags,
    createInitialTextNoteDetailViewState,
  );

  const isTrashed = !!recording.deleted_at;

  const handleContentUpdate = () => {
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

  // Keyboard shortcuts (no playback controls for text notes)
  useKeyboardShortcuts({
    onDownload: handleDownload,
    onEdit: () => updateViewState({ isEditModalOpen: true }),
    onShowShortcuts: () =>
      updateViewState({ showKeyboardShortcuts: !showKeyboardShortcuts }),
  });

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
        refresh(); // Refresh to show trashed state
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
      throw error;
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
      throw error;
    }
  };

  const handleAddTag = async (tagName: string): Promise<Tag> => {
    try {
      const createResponse = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tagName }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create tag');
      }

      const { tag: newTag } = await createResponse.json();

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
                    placeholder="Untitled Note"
                    displayAs="title"
                    maxLength={200}
                    required
                  />
                  <InlineEditableField
                    value={recording.description || ''}
                    onSave={handleUpdateDescription}
                    placeholder="Add a description..."
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
                    {recording.title || 'Untitled Note'}
                  </h1>
                  {recording.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {recording.description}
                    </p>
                  )}
                </>
              )}
            </div>

            {!isTrashed && <ShareControls recordingId={recording.id} />}

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
            {/* Thumbnail Hero - Only show when thumbnail exists */}
            {recording.thumbnail_url && (
              <ThumbnailHero
                thumbnailUrl={recording.thumbnail_url}
                title={recording.title}
                contentType={recording.content_type}
                editable={!isTrashed}
                recordingId={recording.id}
                onThumbnailChange={() => refresh()}
              />
            )}

            {/* Text Note Viewer - Always Visible */}
            {transcript?.text ? (
              <>
                <TextNoteViewer
                  recordingId={recording.id}
                  content={transcript.text}
                  title={recording.title}
                  fileType={recording.file_type as 'txt' | 'md' | null}
                  onContentUpdate={handleContentUpdate}
                />

                {/* AI Insights - Optional Enhancement (no tabs, just show below) */}
                {document && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      AI Insights
                    </h3>
                    <AIDocumentPanel
                      document={document}
                      recordingId={recording.id}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-24 text-muted-foreground">
                <p>No content available</p>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-6">
              <ContentSidebar
                recordingId={recording.id}
                contentType={recording.content_type as ContentType | null}
                fileType={recording.file_type as FileType | null}
                status={recording.status as RecordingStatus}
                knowledgeStatus={knowledgeStatus}
                fileSize={recording.file_size}
                duration={recording.duration_sec}
                createdAt={recording.created_at}
                completedAt={recording.completed_at}
                originalFilename={recording.original_filename}
                deletedAt={recording.deleted_at}
                tags={tags}
                document={document}
                textContent={transcript?.text}
                onEdit={() => updateViewState({ isEditModalOpen: true })}
                onDelete={() =>
                  isTrashed
                    ? updateViewState({ showPermanentDeleteDialog: true })
                    : updateViewState({ showMoveToTrashDialog: true })
                }
                onDownload={handleDownload}
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
            <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Are you sure you want to permanently delete &quot;
                  {recording.title || 'this item'}&quot;?
                </p>
                <p className="font-semibold text-destructive">
                  This action cannot be undone. All associated data will be
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
    </div>
  );
}
