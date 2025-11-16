'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

import type { ContentType, FileType } from '@/lib/types/database';

// Dynamically import viewers to reduce initial bundle
const PDFDocumentViewer = dynamic(
  () => import('@/app/components/library/detail-views/PDFDocumentViewer'),
  {
    loading: () => (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

const TextNoteViewer = dynamic(
  () => import('@/app/components/library/detail-views/TextNoteViewer')
);

const AudioPlayer = dynamic(
  () => import('@/app/components/library/detail-views/AudioPlayer')
);

const RichTextViewer = dynamic(
  () => import('@/app/components/library/viewers/RichTextViewer')
);

// RecordingPlayer will be imported for video playback
// const RecordingPlayer = dynamic(
//   () => import('@/app/components/library/detail-views/RecordingPlayer')
// );

interface Transcript {
  id: string;
  recording_id: string;
  text: string;
  words_json?: any;
  language?: string | null;
  confidence?: number | null;
}

interface UnifiedContentViewerProps {
  contentType: ContentType | null;
  fileType: FileType | null;
  recordingId: string;

  // URLs for media content
  videoUrl?: string | null;
  audioUrl?: string | null;
  downloadUrl?: string | null;

  // Document/text content
  documentUrl?: string | null;
  textContent?: string | null;

  // Metadata
  title?: string | null;
  duration?: number | null;
  fileSize?: number | null;
  originalFilename?: string | null;

  // Transcript (for video/audio/documents)
  transcript?: Transcript | null;

  // Callbacks
  onContentUpdate?: (content: string) => void;
}

export default function UnifiedContentViewer({
  contentType,
  fileType,
  recordingId,
  videoUrl,
  audioUrl,
  downloadUrl,
  documentUrl,
  textContent,
  title,
  duration,
  fileSize,
  originalFilename,
  transcript,
  onContentUpdate,
}: UnifiedContentViewerProps) {
  // Determine which viewer to render based on content type
  const renderViewer = () => {
    switch (contentType) {
      case 'video':
        // TODO: Import and use RecordingPlayer component
        return (
          <div className="aspect-video bg-black rounded-lg flex items-center justify-center">
            <p className="text-white">Video Player (to be integrated)</p>
          </div>
        );

      case 'audio':
        if (!audioUrl) {
          return (
            <div className="p-12 text-center text-muted-foreground">
              Audio file not available
            </div>
          );
        }
        return (
          <AudioPlayer
            audioUrl={audioUrl}
            downloadUrl={downloadUrl}
            transcript={transcript}
            title={title}
            duration={duration}
          />
        );

      case 'document':
        // Handle PDF vs DOCX differently
        if (fileType === 'pdf') {
          if (!documentUrl) {
            return (
              <div className="p-12 text-center text-muted-foreground">
                PDF document not available
              </div>
            );
          }
          return (
            <PDFDocumentViewer
              documentUrl={documentUrl}
              title={title}
              fileSize={fileSize}
              originalFilename={originalFilename}
            />
          );
        } else if (fileType === 'docx' || fileType === 'doc') {
          // For DOCX, use RichTextViewer to display extracted text
          if (!textContent) {
            return (
              <div className="p-12 text-center text-muted-foreground">
                Text extraction in progress...
              </div>
            );
          }
          return (
            <RichTextViewer
              content={textContent}
              title={title}
            />
          );
        }
        break;

      case 'text':
        if (!textContent) {
          return (
            <div className="p-12 text-center text-muted-foreground">
              Text content not available
            </div>
          );
        }
        return (
          <TextNoteViewer
            recordingId={recordingId}
            content={textContent}
            title={title}
            fileType={fileType as 'txt' | 'md' | null}
            onContentUpdate={onContentUpdate}
          />
        );

      default:
        return (
          <div className="p-12 text-center text-muted-foreground">
            Unsupported content type: {contentType}
          </div>
        );
    }
  };

  return (
    <div className="unified-content-viewer">
      {renderViewer()}
    </div>
  );
}
