'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, FileText as FileTextIcon, AlertCircle, RotateCcw, Trash2 } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { ScrollArea } from '@/app/components/ui/scroll-area';
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
import PDFDocumentViewer from './PDFDocumentViewer';

import MetadataSidebar from '../shared/MetadataSidebar';
import AIDocumentPanel from '../shared/AIDocumentPanel';
import ShareControls from '../shared/ShareControls';
import KeyboardShortcutsDialog from '../shared/KeyboardShortcutsDialog';
import InlineEditableField from '../shared/InlineEditableField';
import { HighlightToolbar } from '../shared/HighlightToolbar';
import { HighlightableContent, type Highlight } from '../shared/HighlightableContent';

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSwipeableTabNavigation } from '@/hooks/useSwipeableTabNavigation';

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

  // Smart default: show first available content tab
  const getDefaultTab = () => {
    if (transcript) return 'text-content';
    if (document) return 'ai-insights';
    // All tabs disabled - prefer text-content as it will arrive first
    return 'text-content';
  };

  const [activeTab, setActiveTab] = React.useState(getDefaultTab());
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [tags, setTags] = React.useState<Tag[]>(initialTags);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = React.useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = React.useState(false);

  // Highlight state
  const [currentHighlightIndex, setCurrentHighlightIndex] = React.useState(0);
  const [highlightsEnabled, setHighlightsEnabled] = React.useState(true);
  const [showHighlightToolbar, setShowHighlightToolbar] = React.useState(false);
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
    if (highlights.length === 0 || !highlightsEnabled) {
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
  }, [currentHighlightIndex, highlights, highlightsEnabled]);

  // Highlight navigation handlers
  const handlePreviousHighlight = React.useCallback(() => {
    setCurrentHighlightIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextHighlight = React.useCallback(() => {
    setCurrentHighlightIndex((prev) => Math.min(highlights.length - 1, prev + 1));
  }, [highlights.length]);

  const handleToggleHighlights = React.useCallback(() => {
    setHighlightsEnabled((prev) => !prev);
  }, []);

  const handleCloseToolbar = React.useCallback(() => {
    setShowHighlightToolbar(false);
    setHighlightsEnabled(false);
  }, []);

  // Available tabs for swipe navigation
  const availableTabs = ['text-content', 'ai-insights'];

  // Mobile swipe gestures for tab navigation
  const swipeHandlers = useSwipeableTabNavigation({
    tabs: availableTabs,
    activeTab,
    onTabChange: setActiveTab,
    enabled: !isTrashed, // Disable swipe gestures when content is trashed
  });

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

  const isPDF = recording.file_type === 'pdf';

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
                </>
              )}
            </div>

            {!isTrashed && <ShareControls recordingId={recording.id} />}

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
            {/* Document Viewer - Always Visible */}
            {recording.downloadUrl ? (
              isPDF ? (
                <PDFDocumentViewer
                  documentUrl={recording.downloadUrl}
                  title={recording.title}
                  fileSize={recording.file_size}
                  originalFilename={recording.original_filename}
                />
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileTextIcon className="size-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Preview not available for this document type
                    </p>
                    <Button onClick={handleDownload}>
                      Download to View
                    </Button>
                  </CardContent>
                </Card>
              )
            ) : (
              <Card>
                <CardContent className="py-24 flex flex-col items-center justify-center">
                  <Loader2 className="size-8 animate-spin text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    Document is being processed...
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Tabs - Secondary Content Only */}
            <Tabs value={activeTab} onValueChange={setActiveTab} {...swipeHandlers}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="text-content" disabled={!transcript}>
                  Text Content
                </TabsTrigger>
                <TabsTrigger value="ai-insights" disabled={!document}>
                  AI Insights
                </TabsTrigger>
              </TabsList>

              {/* Text Content Tab */}
              <TabsContent value="text-content" className="mt-4">
                {transcript ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          Text Content
                          {highlights.length > 0 && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              ({highlights.length} citation{highlights.length > 1 ? 's' : ''})
                            </span>
                          )}
                        </CardTitle>
                        <div className="text-xs text-muted-foreground">
                          {transcript.text.split(/\s+/).length} words
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[700px] rounded-md border p-6">
                        {highlights.length > 0 ? (
                          <HighlightableContent
                            content={transcript.text}
                            highlights={highlights}
                            currentHighlightId={highlights[currentHighlightIndex]?.id}
                            highlightsEnabled={highlightsEnabled}
                            onHighlightRefs={(refs) => {
                              highlightRefsMapRef.current = refs;
                            }}
                          />
                        ) : (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                              {transcript.text}
                            </pre>
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                      <Loader2 className="size-8 animate-spin text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground mb-1">
                          Extracting text content
                        </p>
                        <p className="text-sm text-muted-foreground">
                          We're extracting text from your document using OCR and parsing.
                          This usually takes 1-2 minutes.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* AI Insights Tab */}
              <TabsContent value="ai-insights" className="mt-4">
                {document ? (
                  <AIDocumentPanel
                    document={document}
                    recordingId={recording.id}
                  />
                ) : (
                  <Card>
                    <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                      <Loader2 className="size-8 animate-spin text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground mb-1">
                          Generating AI insights
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Our AI is analyzing your document to create a structured summary.
                          This may take 2-3 minutes.
                        </p>
                      </div>
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
                createdAt={recording.created_at}
                updatedAt={recording.updated_at}
                completedAt={recording.completed_at}
                originalFilename={recording.original_filename}
                tags={tags}
                onEdit={() => setIsEditModalOpen(true)}
                onDownload={handleDownload}
              />

              {/* Processing Status Info */}
              {recording.status !== 'completed' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Processing Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">
                        {recording.status === 'transcribing'
                          ? 'Extracting text...'
                          : recording.status === 'doc_generating'
                            ? 'Generating AI summary...'
                            : 'Processing...'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}
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

      {/* Permanent Delete Confirmation Dialog */}
      <AlertDialog open={showPermanentDeleteDialog} onOpenChange={setShowPermanentDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to permanently delete &quot;{recording.title || 'this item'}&quot;?
              </p>
              <p className="font-semibold text-destructive">
                This action cannot be undone. All associated data will be permanently removed:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Original file</li>
                <li>Transcripts and documents</li>
                <li>Search embeddings</li>
                <li>All metadata</li>
              </ul>
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
      {showHighlightToolbar && highlights.length > 0 && (
        <HighlightToolbar
          totalHighlights={highlights.length}
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
