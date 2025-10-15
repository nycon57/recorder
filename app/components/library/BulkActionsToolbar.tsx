"use client"

import React, { useState } from 'react';
import { Trash2, Tag, Download, Share2, X } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { cn } from '@/lib/utils';

interface BulkActionsToolbarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onDelete: () => Promise<void>;
  onAddTags?: () => void;
  onDownload?: () => Promise<void>;
  onShare?: () => void;
  className?: string;
}

/**
 * BulkActionsToolbar Component
 * Toolbar displayed when items are selected in the library
 *
 * Features:
 * - Shows selection count
 * - Clear selection button
 * - Bulk actions: Delete, Add Tags, Download, Share
 * - Confirmation dialogs for destructive actions
 * - Loading states during operations
 *
 * Usage:
 * <BulkActionsToolbar
 *   selectedCount={3}
 *   onClearSelection={() => setSelected([])}
 *   onDelete={handleBulkDelete}
 * />
 */
export function BulkActionsToolbar({
  selectedCount,
  onClearSelection,
  onDelete,
  onAddTags,
  onDownload,
  onShare,
  className,
}: BulkActionsToolbarProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onDelete();
      setShowDeleteDialog(false);
      onClearSelection();
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async () => {
    if (!onDownload) return;
    try {
      setIsDownloading(true);
      await onDownload();
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
          'bg-background border border-border shadow-lg rounded-lg',
          'px-4 py-3 flex items-center gap-4',
          'animate-in slide-in-from-bottom-2 duration-200',
          className
        )}
      >
        {/* Selection indicator */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm font-medium">
            {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-7 w-7 p-0"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-border" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Delete */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            className="h-8 gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>

          {/* Add Tags */}
          {onAddTags && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAddTags}
              className="h-8 gap-2"
            >
              <Tag className="h-4 w-4" />
              Add Tags
            </Button>
          )}

          {/* Download */}
          {onDownload && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
              className="h-8 gap-2"
            >
              <Download className="h-4 w-4" />
              {isDownloading ? 'Downloading...' : 'Download'}
            </Button>
          )}

          {/* Share */}
          {onShare && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onShare}
              className="h-8 gap-2"
            >
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedCount} {selectedCount === 1 ? 'item' : 'items'}?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the selected items
              and all associated data including transcripts, documents, and embeddings.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
