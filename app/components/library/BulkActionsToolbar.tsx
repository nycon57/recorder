"use client"

import React, { useState } from 'react';
import { Trash2, Tag, Download, Share2, X, FolderPlus, RotateCcw } from 'lucide-react';

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
  onRestore?: () => Promise<void>;
  onPermanentDelete?: () => void;
  onAddTags?: () => void;
  onDownload?: () => Promise<void>;
  onShare?: () => void;
  onAddToCollection?: () => void;
  mode?: 'active' | 'trash';
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
  onRestore,
  onPermanentDelete,
  onAddTags,
  onDownload,
  onShare,
  onAddToCollection,
  mode = 'active',
  className,
}: BulkActionsToolbarProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPermanentDeleteDialog, setShowPermanentDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState(false);

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

  const handleRestore = async () => {
    if (!onRestore) return;
    try {
      setIsRestoring(true);
      await onRestore();
      onClearSelection();
    } catch (error) {
      console.error('Restore failed:', error);
    } finally {
      setIsRestoring(false);
    }
  };

  const handlePermanentDelete = async () => {
    console.log('[BulkActionsToolbar] handlePermanentDelete called');
    console.log('[BulkActionsToolbar] Selected count:', selectedCount);
    console.log('[BulkActionsToolbar] onPermanentDelete exists:', !!onPermanentDelete);

    if (!onPermanentDelete) {
      console.log('[BulkActionsToolbar] No onPermanentDelete callback provided');
      return;
    }

    try {
      setIsPermanentlyDeleting(true);
      console.log('[BulkActionsToolbar] Calling onPermanentDelete callback');
      await onPermanentDelete();
      console.log('[BulkActionsToolbar] Callback completed, closing dialog');
      setShowPermanentDeleteDialog(false);
      console.log('[BulkActionsToolbar] Clearing selection');
      onClearSelection();
    } catch (error) {
      console.error('[BulkActionsToolbar] Permanent delete failed:', error);
    } finally {
      setIsPermanentlyDeleting(false);
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
          {mode === 'trash' ? (
            <>
              {/* Restore */}
              {onRestore && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRestore}
                  disabled={isRestoring}
                  className="h-8 gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  {isRestoring ? 'Restoring...' : 'Restore'}
                </Button>
              )}

              {/* Permanent Delete - REQUIRES CONFIRMATION */}
              {onPermanentDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPermanentDeleteDialog(true)}
                  className="h-8 gap-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Forever
                </Button>
              )}
            </>
          ) : (
            <>
              {/* Move to Trash */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="h-8 gap-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4" />
                Move to Trash
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

              {/* Add to Collection */}
              {onAddToCollection && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onAddToCollection}
                  className="h-8 gap-2"
                >
                  <FolderPlus className="h-4 w-4" />
                  Add to Collection
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
            </>
          )}
        </div>
      </div>

      {/* Move to Trash Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {selectedCount} {selectedCount === 1 ? 'item' : 'items'} to Trash?</DialogTitle>
            <DialogDescription>
              These items will be moved to trash. You can restore them later from the trash page.
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
              {isDeleting ? 'Moving to Trash...' : 'Move to Trash'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent Delete Confirmation Dialog - DESTRUCTIVE ACTION */}
      <Dialog open={showPermanentDeleteDialog} onOpenChange={setShowPermanentDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500">
              Permanently Delete {selectedCount} {selectedCount === 1 ? 'item' : 'items'}?
            </DialogTitle>
            <DialogDescription className="text-red-500">
              ⚠️ This action cannot be undone. These items will be permanently deleted and cannot be restored.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPermanentDeleteDialog(false)}
              disabled={isPermanentlyDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handlePermanentDelete}
              disabled={isPermanentlyDeleting}
            >
              {isPermanentlyDeleting ? 'Deleting Forever...' : 'Delete Forever'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
