'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  Download,
  Edit,
  Trash2,
  Share2,
  RefreshCw,
  FileText,
  Clock,
  Calendar,
  HardDrive,
  FileType as FileTypeIcon,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Separator } from '@/app/components/ui/separator';
import { cn } from '@/lib/utils';
import { formatFileSize } from '@/lib/types/content';
import type { ContentType, FileType, RecordingStatus } from '@/lib/types/database';
import type { Tag } from '@/lib/types/database';
import TagBadge from '@/app/components/TagBadge';
import ContentTypeBadge from '../shared/ContentTypeBadge';
import { ConceptSection } from '@/app/components/knowledge';

interface Document {
  id: string;
  markdown: string;
  summary?: string | null;
  status: string;
}

interface ContentConcept {
  id: string;
  name: string;
  conceptType: 'tool' | 'process' | 'person' | 'organization' | 'technical_term' | 'general';
  mentionCount?: number;
}

interface ContentSidebarProps {
  // Metadata
  recordingId: string;
  contentType: ContentType | null;
  fileType: FileType | null;
  status: RecordingStatus;
  fileSize?: number | null;
  duration?: number | null;
  createdAt: string;
  completedAt?: string | null;
  originalFilename?: string | null;
  deletedAt?: string | null;

  // Tags
  tags?: Tag[];

  // Concepts (Knowledge Graph)
  concepts?: ContentConcept[];
  onConceptClick?: (conceptId: string) => void;

  // AI Insights (optional)
  document?: Document | null;

  // Content for copy functionality
  textContent?: string | null;

  // Actions
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onReprocess?: () => void;
  onDownload?: () => void;
}

export default function ContentSidebar({
  recordingId,
  contentType,
  fileType,
  status,
  fileSize,
  duration,
  createdAt,
  completedAt,
  originalFilename,
  deletedAt,
  tags = [],
  concepts = [],
  onConceptClick,
  document,
  textContent,
  onEdit,
  onDelete,
  onShare,
  onReprocess,
  onDownload,
}: ContentSidebarProps) {
  const isTrashed = !!deletedAt;

  const handleCopy = async () => {
    if (!textContent) return;
    try {
      await navigator.clipboard.writeText(textContent);
      toast.success('Content copied to clipboard');
    } catch {
      toast.error('Failed to copy content');
    }
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (seconds == null) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

  const getStatusColor = (status: RecordingStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'transcribing':
      case 'doc_generating':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <aside className="space-y-6">
      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Content Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Type */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Type</span>
            <ContentTypeBadge contentType={contentType} />
          </div>

          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <Badge className={cn('capitalize', getStatusColor(status))}>
              {status}
            </Badge>
          </div>

          {/* File Type */}
          {fileType && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Format</span>
              <Badge variant="outline" className="uppercase font-mono">
                {fileType}
              </Badge>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm text-muted-foreground">Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <TagBadge key={tag.id} name={tag.name} color={tag.color} size="sm" />
                ))}
              </div>
            </div>
          )}

          {/* Duration (for video/audio) */}
          {duration != null && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Duration</span>
              <span className="text-sm font-medium">{formatDuration(duration)}</span>
            </div>
          )}

          {/* File Size */}
          {fileSize != null && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">File Size</span>
              <span className="text-sm font-medium">{formatFileSize(fileSize)}</span>
            </div>
          )}

          {/* Original Filename */}
          {originalFilename && (
            <div className="space-y-1">
              <span className="text-sm text-muted-foreground">Original File</span>
              <p className="text-xs font-mono text-foreground/80 break-all">
                {originalFilename}
              </p>
            </div>
          )}

          <Separator />

          {/* Created Date */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Created</span>
            <span className="text-xs text-foreground/70">{formatDate(createdAt)}</span>
          </div>

          {/* Completed Date */}
          {completedAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Completed</span>
              <span className="text-xs text-foreground/70">{formatDate(completedAt)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Concepts Card (Knowledge Graph) */}
      {concepts.length > 0 && (
        <ConceptSection
          concepts={concepts}
          onConceptClick={onConceptClick}
          title="Concepts"
          showGrouping={true}
          collapsible={true}
          defaultExpanded={true}
          maxVisible={10}
        />
      )}

      {/* Quick Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {onDownload && (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}

          {textContent && (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleCopy}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          )}

          {onEdit && !isTrashed && (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onEdit}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Details
            </Button>
          )}

          {onShare && !isTrashed && (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onShare}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          )}

          {onReprocess && !isTrashed && (
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={onReprocess}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reprocess
            </Button>
          )}

          {onDelete && (
            <Button
              variant="outline"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isTrashed ? 'Delete Forever' : 'Move to Trash'}
            </Button>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}
