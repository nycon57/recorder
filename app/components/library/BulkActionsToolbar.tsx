"use client"

import React, { useState } from 'react';
import { Trash2, Tag, Download, Share2, X, FolderInput, RotateCcw } from 'lucide-react';

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
import { KeyboardHint } from '@/app/components/keyboard/KeyboardShortcutsDialog';
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
  onMoveToCollection?: () => void;
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
  onMoveToCollection,
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
          'px-3 py-2.5 sm:px-4 sm:py-3 flex items-center gap-2 sm:gap-4',
          'max-w-[calc(100vw-2rem)] overflow-x-auto',
          'animate-in slide-in-from-bottom-2 duration-200',
          'pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:pb-3',
          className
        )}
      >
        {/* Selection indicator */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <Badge variant="secondary" className="text-xs sm:text-sm font-medium whitespace-nowrap">
            {selectedCount} {selectedCount === 1 ? 'item' : 'items'}
            <span className="hidden sm:inline"> selected</span>
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="h-7 px-1.5 sm:px-2 gap-1"
            aria-label="Clear selection (Escape)"
          >
            <X className="h-4 w-4" />
            <KeyboardHint keys={['Esc']} className="ml-0 hidden sm:flex" />
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
                  className="h-8 gap-1 sm:gap-2"
                  aria-label="Restore selected items"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span className="hidden sm:inline">{isRestoring ? 'Restoring...' : 'Restore'}</span>
                </Button>
              )}

              {/* Permanent Delete - REQUIRES CONFIRMATION */}
              {onPermanentDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPermanentDeleteDialog(true)}
                  className="h-8 gap-1 sm:gap-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                  aria-label="Permanently delete selected items"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete Forever</span>
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
                className="h-8 gap-1 sm:gap-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                aria-label="Move selected items to trash (Delete)"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Move to Trash</span>
                <KeyboardHint keys={['Del']} className="ml-0 hidden sm:flex" />
              </Button>

              {/* Add Tags */}
              {onAddTags && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onAddTags}
                  className="h-8 gap-1 sm:gap-2"
                  aria-label="Add tags to selected items (T)"
                >
                  <Tag className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Tags</span>
                  <KeyboardHint keys={['T']} className="ml-0 hidden sm:flex" />
                </Button>
              )}

              {/* Move to Collection */}
              {onMoveToCollection && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onMoveToCollection}
                  className="h-8 gap-1 sm:gap-2"
                  aria-label="Move selected items to folder (M)"
                >
                  <FolderInput className="h-4 w-4" />
                  <span className="hidden sm:inline">Move to Folder</span>
                  <KeyboardHint keys={['M']} className="ml-0 hidden sm:flex" />
                </Button>
              )}

              {/* Download */}
              {onDownload && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="h-8 gap-1 sm:gap-2"
                  aria-label="Download selected items"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">{isDownloading ? 'Downloading...' : 'Download'}</span>
                </Button>
              )}

              {/* Share */}
              {onShare && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onShare}
                  className="h-8 gap-1 sm:gap-2"
                  aria-label="Share selected items"
                >
                  <Share2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Share</span>
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
