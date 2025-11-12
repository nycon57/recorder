'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  FolderOpen,
  Video,
  Upload,
  FileEdit,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from '@/app/components/ui/empty';
import UploadModal from '@/app/components/upload/UploadModal';

/**
 * LibraryEmptyState Component
 *
 * Comprehensive empty state for library page when user has no content
 *
 * Features:
 * - Friendly illustration and messaging
 * - Clear call-to-action buttons
 * - Multiple entry points (Record, Upload, Create Note)
 * - Helpful tips and supported formats
 *
 * @refactored - Now uses @shadcn/empty as foundation
 */
interface LibraryEmptyStateProps {
  onUploadComplete?: () => void;
}

export function LibraryEmptyState({ onUploadComplete }: LibraryEmptyStateProps) {
  const router = useRouter();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const handleRecordClick = () => {
    router.push('/record');
  };

  const handleUploadClick = () => {
    setIsUploadModalOpen(true);
  };

  const handleCreateNoteClick = () => {
    router.push('/library?action=create-note');
  };

  const handleUploadComplete = () => {
    setIsUploadModalOpen(false);
    onUploadComplete?.();
  };

  return (
    <>
      <Empty className="border-2 py-16">
        <EmptyHeader>
          {/* Icon with sparkle decoration */}
          <EmptyMedia className="relative mb-2">
            <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-6">
              <FolderOpen className="size-16 text-primary" />
            </div>
            <div className="absolute -top-2 -right-2">
              <Sparkles className="size-8 text-yellow-500 fill-yellow-500" />
            </div>
          </EmptyMedia>

          <EmptyTitle className="text-3xl mb-3">
            Your Knowledge Library Awaits
          </EmptyTitle>

          <EmptyDescription className="text-lg mb-2 max-w-md">
            Start building your personal knowledge base with recordings, videos, audio, documents, and notes.
          </EmptyDescription>

          <EmptyDescription className="text-sm mb-6 max-w-lg">
            Everything you create is automatically transcribed, searchable, and organized in one place.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent className="max-w-3xl">
          {/* Primary Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              onClick={handleRecordClick}
              className="gap-2 shadow-lg shadow-primary/20"
            >
              <Video className="size-5" />
              Start Recording
              <ArrowRight className="size-4 ml-1" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleUploadClick}
              className="gap-2"
            >
              <Upload className="size-5" />
              Upload Files
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={handleCreateNoteClick}
              className="gap-2"
            >
              <FileEdit className="size-5" />
              Create Note
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t w-full">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 p-3 mb-2">
                <Video className="size-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h4 className="font-semibold text-sm">Record & Upload</h4>
              <p className="text-xs text-muted-foreground">
                Screen recordings, videos (MP4, MOV, WEBM), and audio files (MP3, WAV)
              </p>
            </div>

            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 p-3 mb-2">
                <FileEdit className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h4 className="font-semibold text-sm">Documents & Notes</h4>
              <p className="text-xs text-muted-foreground">
                PDFs, DOCX files, and markdown notes with full-text search
              </p>
            </div>

            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 p-3 mb-2">
                <Sparkles className="size-6 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="font-semibold text-sm">AI-Powered</h4>
              <p className="text-xs text-muted-foreground">
                Automatic transcription, summaries, and semantic search
              </p>
            </div>
          </div>

          {/* File Limits */}
          <div className="mt-8 text-xs text-muted-foreground">
            <p>
              <strong>File size limits:</strong> Video (500MB), Audio (100MB), Documents (50MB), Text (1MB)
            </p>
          </div>
        </EmptyContent>
      </Empty>

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={handleUploadComplete}
      />
    </>
  );
}
