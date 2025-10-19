'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, FileText as FileTextIcon } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/app/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import EditRecordingModal from '@/app/components/EditRecordingModal';
import PDFDocumentViewer from './PDFDocumentViewer';

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

interface DocumentDetailViewProps {
  recording: Recording;
  transcript: Transcript | null; // For documents, transcript contains extracted text
  document: Document | null; // AI-generated summary
  initialTags: Tag[];
}

export default function DocumentDetailView({
  recording,
  transcript,
  document,
  initialTags,
}: DocumentDetailViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState('viewer');
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
  const [tags, setTags] = React.useState<Tag[]>(initialTags);

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

  const isPDF = recording.file_type === 'pdf';

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
                {recording.title || 'Untitled Document'}
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
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="viewer">
                  {isPDF ? 'PDF Viewer' : 'Document'}
                </TabsTrigger>
                <TabsTrigger value="text" disabled={!transcript}>
                  Extracted Text
                </TabsTrigger>
                <TabsTrigger value="summary" disabled={!document}>
                  AI Summary
                </TabsTrigger>
              </TabsList>

              {/* Viewer Tab */}
              <TabsContent value="viewer" className="mt-4">
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
              </TabsContent>

              {/* Extracted Text Tab */}
              <TabsContent value="text" className="mt-4">
                {transcript ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">
                          Extracted Text
                        </CardTitle>
                        <div className="text-xs text-muted-foreground">
                          {transcript.text.split(/\s+/).length} words
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[700px] rounded-md border p-6">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <pre className="whitespace-pre-wrap font-sans leading-relaxed">
                            {transcript.text}
                          </pre>
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">
                        {recording.status === 'completed'
                          ? 'No text extracted from this document'
                          : 'Text extraction in progress...'}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* AI Summary Tab */}
              <TabsContent value="summary" className="mt-4">
                {document ? (
                  <AIDocumentPanel
                    document={document}
                    recordingId={recording.id}
                  />
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <p className="text-muted-foreground">
                        {recording.status === 'completed'
                          ? 'No AI summary generated yet'
                          : 'AI summary generation in progress...'}
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
