'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, FileText as FileTextIcon, AlertCircle, RotateCcw, Trash2, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';

import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { ContentTabs, ContentTabsContent, ContentTabsList, ContentTabsTrigger } from '@/app/components/ui/content-tabs';
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

// New unified components
import UnifiedContentViewer from '../viewers/UnifiedContentViewer';
import ContentSidebar from '../viewers/ContentSidebar';
import ThumbnailHero from '../viewers/ThumbnailHero';

import KeyboardShortcutsDialog from '../shared/KeyboardShortcutsDialog';
import InlineEditableField from '../shared/InlineEditableField';
import { HighlightToolbar } from '../shared/HighlightToolbar';
import { HighlightableContent, type Highlight } from '../shared/HighlightableContent';

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

import type { ContentType, FileType, RecordingStatus } from '@/lib/types/database';
import type { Tag } from '@/lib/types/database';

interface Transcript {
  id: string;
  content_id: string;
  text: string;
  words_json?: any;
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
  deleted_at: string | null;
  content_type: ContentType | null;
  file_type: FileType | null;
  original_filename: string | null;
  file_size: number | null;
}

interface DocumentDetailViewProps {
  recording: Recording;
  transcript: Transcript | null; // For documents, transcript contains extracted text
  document: Document | null; // AI-generated summary
  initialTags: Tag[];
  sourceKey?: string; // Cache key for fetching highlight sources
  initialHighlightId?: string; // Initial chunk to scroll to
}

export default function DocumentDetailView({
  recording,
  transcript,
  document,
  initialTags,
  sourceKey,
  initialHighlightId,
}: DocumentDetailViewProps) {
  const router = useRouter();

  // Client-side highlight sources fetching
  const [highlightSources, setHighlightSources] = React.useState<any[] | null>(null);
  const [isFetchingSources, setIsFetchingSources] = React.useState(false);

  // Fetch highlight sources from cache when sourceKey is provided
  React.useEffect(() => {
    if (!sourceKey) return;

    const fetchSources = async () => {
      setIsFetchingSources(true);
      console.log('[DocumentDetailView] Fetching sources client-side:', sourceKey);

      try {
        const response = await fetch(`/api/chat?sourcesKey=${sourceKey}`);
        console.log('[DocumentDetailView] Fetch response:', {
          status: response.status,
          ok: response.ok,
        });

        if (response.ok) {
          const { sources } = await response.json();
          console.log('[DocumentDetailView] Sources fetched:', {
            count: sources?.length || 0,
            sources: sources,
            firstSource: sources?.[0],
          });
          setHighlightSources(sources || null);
          console.log('[DocumentDetailView] State updated with sources');
        } else {
          console.error('[DocumentDetailView] Failed to fetch sources:', response.status);
        }
      } catch (error) {
        console.error('[DocumentDetailView] Error fetching sources:', error);
      } finally {
        setIsFetchingSources(false);
      }
    };

    fetchSources();
  }, [sourceKey]);

  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [tags, setTags] = React.useState<Tag[]>(initialTags);
  const [showMoveToTrashDialog, setShowMoveToTrashDialog] = React.useState(false);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = React.useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = React.useState(false);

  // Highlight state
  const [currentHighlightIndex, setCurrentHighlightIndex] = React.useState(0);
  const [highlightsEnabled, setHighlightsEnabled] = React.useState(true);
  const [showHighlightToolbar, setShowHighlightToolbar] = React.useState(false);
  const [matchedHighlightsCount, setMatchedHighlightsCount] = React.useState(0);
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

    const filtered = highlightSources
      .filter((source) => {
        const matches = source.recordingId === recording.id;
        console.log('[DocumentDetailView] Filtering source:', {
          sourceRecordingId: source.recordingId,
          targetRecordingId: recording.id,
          matches,
        });
        return matches;
      })
      .map((source) => ({
        id: source.metadata?.chunkId || source.id,
        text: source.snippet || '',
        similarity: source.relevanceScore,
      }));

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

  // Find initial highlight index based on initialHighlightId
  const initialIndex = React.useMemo(() => {
    if (!initialHighlightId || highlights.length === 0) {
      return 0;
    }
    const index = highlights.findIndex(h => h.id === initialHighlightId);
    return index >= 0 ? index : 0;
  }, [initialHighlightId, highlights]);

  // Set initial highlight index and show toolbar if highlights exist
  React.useEffect(() => {
    if (highlights.length > 0) {
      setCurrentHighlightIndex(initialIndex);
      setShowHighlightToolbar(true);
    }
  }, [highlights.length, initialIndex]);

  // Scroll to current highlight when it changes
  React.useEffect(() => {
    if (matchedHighlightsCount === 0 || !highlightsEnabled) {
      return;
    }

    const currentHighlight = highlights[currentHighlightIndex];
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
  }, [currentHighlightIndex, highlights, highlightsEnabled, matchedHighlightsCount]);

  // Highlight navigation handlers
  const handlePreviousHighlight = React.useCallback(() => {
    setCurrentHighlightIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextHighlight = React.useCallback(() => {
    setCurrentHighlightIndex((prev) => Math.min(matchedHighlightsCount - 1, prev + 1));
  }, [matchedHighlightsCount]);

  const handleToggleHighlights = React.useCallback(() => {
    setHighlightsEnabled((prev) => !prev);
  }, []);

  const handleCloseToolbar = React.useCallback(() => {
    setShowHighlightToolbar(false);
    setHighlightsEnabled(false);
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
    onEdit: () => setIsEditModalOpen(true),
    onShowShortcuts: () => setShowKeyboardShortcuts((prev) => !prev),
  });

  const handleRestore = async () => {
    try {
      const response = await fetch(`/api/recordings/${recording.id}/restore`, {
        method: 'POST',
      });

      if (response.ok) {
        toast({ description: 'Item restored successfully' });
        router.refresh();
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
        router.refresh(); // Refresh to show trashed state
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
      const response = await fetch(`/api/recordings/${recording.id}?permanent=true`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({ description: 'Item permanently deleted' });
        router.push('/library');
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
      router.refresh();
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
      router.refresh();
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
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
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
                    placeholder="Add a description..."
                    type="textarea"
                    displayAs="description"
                    maxLength={500}
                  />

                  {/* Document Stats */}
                  {transcript?.text && (
                    <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        <strong className="text-content-docx font-medium">
                          {transcript.text.split(/\s+/).filter(Boolean).length.toLocaleString()}
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
                          ~{Math.ceil(transcript.text.split(/\s+/).filter(Boolean).length / 200)}
                        </strong>{' '}
                        min read
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <h1 className="text-2xl font-bold truncate">
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
                          {transcript.text.split(/\s+/).filter(Boolean).length.toLocaleString()}
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
                          ~{Math.ceil(transcript.text.split(/\s+/).filter(Boolean).length / 200)}
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
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore Item
                </Button>
                <Button
                  onClick={() => setShowPermanentDeleteDialog(true)}
                  variant="destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
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
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>This item is in the trash</AlertTitle>
            <AlertDescription>
              This content was moved to trash on {formatDate(recording.deleted_at)}.
              You can restore it or permanently delete it.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6" style={isTrashed ? { opacity: 0.7 } : undefined}>
            {/* Thumbnail Hero - Shows thumbnail or elegant fallback for documents */}
            <ThumbnailHero
              thumbnailUrl={recording.thumbnail_url}
              title={recording.title}
              contentType={recording.content_type}
            />

            {document ? (
              <ContentTabs defaultValue="content" className="w-full">
                <ContentTabsList>
                  <ContentTabsTrigger value="content" icon={<FileTextIcon className="size-4" />}>
                    Original Content
                  </ContentTabsTrigger>
                  <ContentTabsTrigger value="insights" icon={<Sparkles className="size-4" />}>
                    AI Insights
                  </ContentTabsTrigger>
                </ContentTabsList>

                <ContentTabsContent value="content">
                  <UnifiedContentViewer
                    contentType={recording.content_type}
                    fileType={recording.file_type}
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
                            <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(document.html) }} />
                          ) : document.markdown ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {document.markdown}
                            </ReactMarkdown>
                          ) : (
                            <p className="text-muted-foreground italic">
                              AI insights are being generated...
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
                contentType={recording.content_type}
                fileType={recording.file_type}
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
                contentType={recording.content_type}
                fileType={recording.file_type}
                status={recording.status}
                fileSize={recording.file_size}
                duration={recording.duration_sec}
                createdAt={recording.created_at}
                completedAt={recording.completed_at}
                originalFilename={recording.original_filename}
                deletedAt={recording.deleted_at}
                tags={tags}
                document={document}
                textContent={transcript?.text}
                onEdit={() => setIsEditModalOpen(true)}
                onDelete={() => isTrashed ? setShowPermanentDeleteDialog(true) : setShowMoveToTrashDialog(true)}
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
          onOpenChange={setIsEditModalOpen}
          recording={recording}
          initialTags={tags}
          onTagsChange={setTags}
        />
      )}

      {/* Move to Trash Confirmation Dialog */}
      <AlertDialog open={showMoveToTrashDialog} onOpenChange={setShowMoveToTrashDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to move &quot;{recording.title || 'this item'}&quot; to trash?
              You can restore it later from the trash page.
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
      <AlertDialog open={showPermanentDeleteDialog} onOpenChange={setShowPermanentDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Permanently Delete?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Are you sure you want to permanently delete &quot;{recording.title || 'this item'}&quot;?
                </p>
                <p className="font-semibold text-destructive">
                  ⚠️ This action cannot be undone. All associated data will be permanently removed:
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
        onOpenChange={setShowKeyboardShortcuts}
        contentType={recording.content_type}
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
