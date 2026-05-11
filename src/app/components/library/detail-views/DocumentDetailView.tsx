'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import {
  ArrowLeft,
  FileText as FileTextIcon,
  AlertCircle,
  RotateCcw,
  Trash2,
  Sparkles,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import domPurify from 'dompurify';
import parse from 'html-react-parser';

import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  ContentTabs,
  ContentTabsContent,
  ContentTabsList,
  ContentTabsTrigger,
} from '@/app/components/ui/content-tabs';
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

// New unified components
import UnifiedContentViewer from '../viewers/UnifiedContentViewer';
import ContentSidebar from '../viewers/ContentSidebar';
import ThumbnailHero from '../viewers/ThumbnailHero';
import KeyboardShortcutsDialog from '../shared/KeyboardShortcutsDialog';
import InlineEditableField from '../shared/InlineEditableField';
import { HighlightToolbar } from '../shared/HighlightToolbar';
import type { Highlight } from '../shared/HighlightableContent';

interface HighlightSource {
  id: string;
  recordingId: string;
  snippet?: string | null;
  relevanceScore?: number | null;
  metadata?: {
    chunkId?: string | null;
  } | null;
}

interface Transcript {
  id: string;
  content_id: string;
  text: string;
  words_json?: Json;
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

interface DocumentDetailViewState {
  isEditModalOpen: boolean;
  tags: Tag[];
  showMoveToTrashDialog: boolean;
  showPermanentDeleteDialog: boolean;
  showKeyboardShortcuts: boolean;
  currentHighlightIndex: number;
  highlightsEnabled: boolean;
  showHighlightToolbar: boolean;
}

const createInitialDocumentDetailViewState = (
  initialTags: Array<InitialTag | null>,
): DocumentDetailViewState => ({
  isEditModalOpen: false,
  tags: initialTags.flatMap((tag): Tag[] =>
    tag ? [{ ...tag, color: tag.color ?? '#64748b' }] : [],
  ),
  showMoveToTrashDialog: false,
  showPermanentDeleteDialog: false,
  showKeyboardShortcuts: false,
  currentHighlightIndex: 0,
  highlightsEnabled: true,
  showHighlightToolbar: false,
});

const documentDetailViewReducer = (
  state: DocumentDetailViewState,
  patch: Partial<DocumentDetailViewState>,
): DocumentDetailViewState => ({
  ...state,
  ...patch,
});

interface DocumentDetailViewProps {
  recording: Recording;
  transcript: Transcript | null; // For documents, transcript contains extracted text
  document: Document | null; // AI-generated summary
  knowledgeStatus: KnowledgeStatus;
  initialTags: Array<InitialTag | null>;
  sourceKey?: string; // Cache key for fetching highlight sources
  initialHighlightId?: string; // Initial chunk to scroll to
}

const highlightSourcesFetcher = async (
  url: string,
): Promise<HighlightSource[] | null> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch sources: ${response.status}`);
  }

  const { sources } = await response.json();
  return sources || null;
};

export default function DocumentDetailView(
  props: Parameters<typeof useDocumentDetailViewImplementation>[0],
) {
  return useDocumentDetailViewImplementation(props);
}

function useDocumentDetailViewImplementation({
  recording,
  transcript,
  document,
  knowledgeStatus,
  initialTags,
  sourceKey,
  initialHighlightId,
}: DocumentDetailViewProps) {
  const { back, push, refresh } = useRouter();

  const { data: highlightSources } = useSWR(
    sourceKey ? `/api/chat?sourcesKey=${sourceKey}` : null,
    highlightSourcesFetcher,
  );

  const [
    {
      isEditModalOpen,
      tags,
      showMoveToTrashDialog,
      showPermanentDeleteDialog,
      showKeyboardShortcuts,
      currentHighlightIndex,
      highlightsEnabled,
      showHighlightToolbar,
    },
    updateViewState,
  ] = React.useReducer(
    documentDetailViewReducer,
    initialTags,
    createInitialDocumentDetailViewState,
  );
  const highlightRefsMapRef = React.useRef<Map<string, HTMLElement>>(new Map());

  const isTrashed = !!recording.deleted_at;

  // Process highlight sources - filter for this recording and convert to Highlight format
  const highlights: Highlight[] = React.useMemo(() => {
    console.log('[DocumentDetailView] Processing highlights:', {
      hasHighlightSources: !!highlightSources,
      isArray: Array.isArray(highlightSources),
      sourcesCount: highlightSources?.length || 0,
      recordingId: recording.id,
      initialHighlightId,
    });

    if (!highlightSources || !Array.isArray(highlightSources)) {
      console.log('[DocumentDetailView] No highlight sources available');
      return [];
    }

    console.log('[DocumentDetailView] All sources before filtering:', {
      sources: highlightSources.map((s) => ({
        recordingId: s.recordingId,
        chunkId: s.metadata?.chunkId,
        snippetPreview: s.snippet?.substring(0, 100),
      })),
    });

    const filtered = highlightSources.flatMap((source) => {
      const matches = source.recordingId === recording.id;
      console.log('[DocumentDetailView] Filtering source:', {
        sourceRecordingId: source.recordingId,
        targetRecordingId: recording.id,
        matches,
      });
      if (!matches) return [];
      return [
        {
          id: source.metadata?.chunkId || source.id,
          text: source.snippet || '',
          similarity: source.relevanceScore ?? undefined,
        },
      ];
    });

    console.log('[DocumentDetailView] Processed highlights:', {
      filteredCount: filtered.length,
      highlights: filtered.map((h) => ({
        id: h.id,
        textPreview: h.text.substring(0, 100),
        similarity: h.similarity,
      })),
    });

    return filtered;
  }, [highlightSources, recording.id, initialHighlightId]);
  const matchedHighlightsCount = highlights.length;

  // Find initial highlight index based on initialHighlightId
  const initialIndex = React.useMemo(() => {
    if (!initialHighlightId || highlights.length === 0) {
      return 0;
    }
    const index = highlights.findIndex((h) => h.id === initialHighlightId);
    return index >= 0 ? index : 0;
  }, [initialHighlightId, highlights]);

  const scrollToHighlight = React.useCallback(
    (index: number) => {
      if (matchedHighlightsCount === 0 || !highlightsEnabled) {
        return;
      }

      const currentHighlight = highlights[index];
      if (!currentHighlight) {
        return;
      }

      const element = highlightRefsMapRef.current.get(currentHighlight.id);
      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    },
    [highlights, highlightsEnabled, matchedHighlightsCount],
  );

  // Set initial highlight index and show toolbar if highlights exist
  React.useEffect(() => {
    if (highlights.length > 0) {
      updateViewState({
        currentHighlightIndex: initialIndex,
        showHighlightToolbar: true,
      });
      requestAnimationFrame(() => scrollToHighlight(initialIndex));
    }
  }, [highlights.length, initialIndex, scrollToHighlight]);

  // Highlight navigation handlers
  const handlePreviousHighlight = React.useCallback(() => {
    const next = Math.max(0, currentHighlightIndex - 1);
    updateViewState({ currentHighlightIndex: next });
    requestAnimationFrame(() => scrollToHighlight(next));
  }, [currentHighlightIndex, scrollToHighlight]);

  const handleNextHighlight = React.useCallback(() => {
    const next = Math.min(
      matchedHighlightsCount - 1,
      currentHighlightIndex + 1,
    );
    updateViewState({ currentHighlightIndex: next });
    requestAnimationFrame(() => scrollToHighlight(next));
  }, [currentHighlightIndex, matchedHighlightsCount, scrollToHighlight]);

  const handleToggleHighlights = React.useCallback(() => {
    updateViewState({ highlightsEnabled: !highlightsEnabled });
  }, [highlightsEnabled]);

  const handleCloseToolbar = React.useCallback(() => {
    updateViewState({
      showHighlightToolbar: false,
      highlightsEnabled: false,
    });
  }, []);

  const handleDownload = async () => {
    if (!recording.downloadUrl) return;

    try {
      const response = await fetch(recording.downloadUrl);
      const blob = await response.blob();

      const blobUrl = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.download =
        recording.original_filename ||
        `${recording.title || 'document'}.${recording.file_type || 'pdf'}`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  // Keyboard shortcuts (no playback controls for documents)
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
        push('/library');
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
                    placeholder="Untitled Document"
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

                  {/* Document Stats */}
                  {transcript?.text && (
                    <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        <strong className="text-content-docx font-medium">
                          {transcript.text
                            .split(/\s+/)
                            .filter(Boolean)
                            .length.toLocaleString()}
                        </strong>{' '}
                        words
                      </span>
                      <span>
                        <strong className="text-content-docx font-medium">
                          {transcript.text.length.toLocaleString()}
                        </strong>{' '}
                        characters
                      </span>
                      <span className="hidden sm:inline">
                        <strong className="text-content-docx font-medium">
                          ~
                          {Math.ceil(
                            transcript.text.split(/\s+/).filter(Boolean)
                              .length / 200,
                          )}
                        </strong>{' '}
                        min read
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-semibold truncate">
                    {recording.title || 'Untitled Document'}
                  </h1>
                  {recording.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {recording.description}
                    </p>
                  )}
                  {/* Document Stats (Read-only view) */}
                  {transcript?.text && (
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        <strong className="text-content-docx font-medium">
                          {transcript.text
                            .split(/\s+/)
                            .filter(Boolean)
                            .length.toLocaleString()}
                        </strong>{' '}
                        words
                      </span>
                      <span>
                        <strong className="text-content-docx font-medium">
                          {transcript.text.length.toLocaleString()}
                        </strong>{' '}
                        characters
                      </span>
                      <span className="hidden sm:inline">
                        <strong className="text-content-docx font-medium">
                          ~
                          {Math.ceil(
                            transcript.text.split(/\s+/).filter(Boolean)
                              .length / 200,
                          )}
                        </strong>{' '}
                        min read
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

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

            {document ? (
              <ContentTabs defaultValue="content" className="w-full">
                <ContentTabsList>
                  <ContentTabsTrigger
                    value="content"
                    icon={<FileTextIcon className="size-4" />}
                  >
                    Original Content
                  </ContentTabsTrigger>
                  <ContentTabsTrigger
                    value="insights"
                    icon={<Sparkles className="size-4" />}
                  >
                    AI Insights
                  </ContentTabsTrigger>
                </ContentTabsList>

                <ContentTabsContent value="content">
                  <UnifiedContentViewer
                    contentType={recording.content_type as ContentType | null}
                    fileType={recording.file_type as FileType | null}
                    recordingId={recording.id}
                    documentUrl={recording.downloadUrl}
                    textContent={transcript?.text}
                    title={recording.title}
                    fileSize={recording.file_size}
                    originalFilename={recording.original_filename}
                    transcript={transcript}
                  />
                </ContentTabsContent>

                <ContentTabsContent value="insights">
                  <Card className="border-0 shadow-none bg-transparent">
                    <CardContent className="p-0">
                      <div className="min-h-[400px] max-h-[800px] overflow-y-auto px-6 py-8 sm:px-8 sm:py-10">
                        <div className="ai-insights-prose max-w-3xl mx-auto">
                          {document.html ? (
                            <div>
                              {parse(domPurify.sanitize(document.html))}
                            </div>
                          ) : document.markdown ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {document.markdown}
                            </ReactMarkdown>
                          ) : (
                            <p className="text-muted-foreground italic">
                              AI insights are being generated…
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </ContentTabsContent>
              </ContentTabs>
            ) : (
              <UnifiedContentViewer
                contentType={recording.content_type as ContentType | null}
                fileType={recording.file_type as FileType | null}
                recordingId={recording.id}
                documentUrl={recording.downloadUrl}
                textContent={transcript?.text}
                title={recording.title}
                fileSize={recording.file_size}
                originalFilename={recording.original_filename}
                transcript={transcript}
              />
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

      {/* Modals - Only render when open to avoid QueryClient errors */}
      {isEditModalOpen && (
        <EditRecordingModal
          open={isEditModalOpen}
          onOpenChange={(isOpen) =>
            updateViewState({ isEditModalOpen: isOpen })
          }
          recording={recording}
          initialTags={tags}
          onTagsChange={(nextTags) => updateViewState({ tags: nextTags })}
        />
      )}

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

      {/* Highlight Toolbar */}
      {showHighlightToolbar && matchedHighlightsCount > 0 && (
        <HighlightToolbar
          totalHighlights={matchedHighlightsCount}
          currentIndex={currentHighlightIndex}
          highlightsEnabled={highlightsEnabled}
          onPrevious={handlePreviousHighlight}
          onNext={handleNextHighlight}
          onToggle={handleToggleHighlights}
          onClose={handleCloseToolbar}
        />
      )}
    </div>
  );
}
