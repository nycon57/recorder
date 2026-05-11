'use client';

import * as React from 'react';
import { Crop, Upload, Trash2 } from 'lucide-react';

import {
  ContentModal,
  ContentModalHeader,
  ContentModalTitle,
  ContentModalDescription,
  ContentModalBody,
} from '@/app/components/ui/content-modal';
import {
  ContentTabs,
  ContentTabsList,
  ContentTabsTrigger,
  ContentTabsContent,
} from '@/app/components/ui/content-tabs';

import { ThumbnailCropPane } from './ThumbnailCropPane';
import { ThumbnailReplacePane } from './ThumbnailReplacePane';
import { ThumbnailDeletePane } from './ThumbnailDeletePane';

type TabValue = 'crop' | 'replace' | 'delete';

interface ThumbnailEditModalProps {
  /** Controls the open/closed state */
  open: boolean;
  /** Callback when the modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** URL of the current thumbnail (null if none) */
  thumbnailUrl: string | null;
  /** ID of the content/recording */
  recordingId: string;
  /** Callback after any thumbnail change (update, replace, delete) */
  onThumbnailChange?: () => void;
  /** Initial tab to open (defaults to 'crop' if thumbnail exists, 'replace' otherwise) */
  initialTab?: TabValue;
}

/**
 * ThumbnailEditModal - Modal for editing thumbnails
 *
 * Features:
 * - Three tabs: Crop, Replace, Delete
 * - Crop and Delete tabs disabled when no thumbnail exists
 * - Uses ContentModal for consistent brand styling
 * - Closes on successful action
 */
export function ThumbnailEditModal({
  open,
  onOpenChange,
  thumbnailUrl,
  recordingId,
  onThumbnailChange,
  initialTab,
}: ThumbnailEditModalProps) {
  const hasThumbnail = !!thumbnailUrl;
  const defaultTab: TabValue = hasThumbnail ? 'crop' : 'replace';
  const initialActiveTab = initialTab ?? defaultTab;

  const [activeTabOverride, setActiveTabOverride] =
    React.useState<TabValue | null>(null);
  const activeTab = activeTabOverride ?? initialActiveTab;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setActiveTabOverride(null);
    }
    onOpenChange(nextOpen);
  };

  const handleClose = () => handleOpenChange(false);

  const handleChange = () => {
    onThumbnailChange?.();
    // Modal will be closed by the individual pane components
  };

  return (
    <ContentModal
      open={open}
      onOpenChange={handleOpenChange}
      size="2xl"
      glass={true}
      glow={true}
    >
      <ContentModalHeader>
        <ContentModalTitle>Edit Thumbnail</ContentModalTitle>
        <ContentModalDescription>
          Crop, replace, or remove your thumbnail image
        </ContentModalDescription>
      </ContentModalHeader>

      <ContentModalBody className="p-0 max-h-[70vh]">
        <ContentTabs
          value={activeTab}
          onValueChange={(v) => setActiveTabOverride(v as TabValue)}
          className="w-full"
        >
          <div className="px-6 pt-2">
            <ContentTabsList>
              <ContentTabsTrigger
                value="crop"
                disabled={!hasThumbnail}
                icon={<Crop className="size-4" />}
              >
                Crop
              </ContentTabsTrigger>
              <ContentTabsTrigger
                value="replace"
                icon={<Upload className="size-4" />}
              >
                Replace
              </ContentTabsTrigger>
              <ContentTabsTrigger
                value="delete"
                disabled={!hasThumbnail}
                icon={<Trash2 className="size-4" />}
              >
                Delete
              </ContentTabsTrigger>
            </ContentTabsList>
          </div>

          <ContentTabsContent
            value="crop"
            className="mt-0 animate-none data-[state=inactive]:hidden"
          >
            {hasThumbnail && (
              <ThumbnailCropPane
                thumbnailUrl={thumbnailUrl}
                recordingId={recordingId}
                onClose={handleClose}
                onCropped={handleChange}
              />
            )}
          </ContentTabsContent>

          <ContentTabsContent
            value="replace"
            className="mt-0 animate-none data-[state=inactive]:hidden"
          >
            <ThumbnailReplacePane
              recordingId={recordingId}
              onClose={handleClose}
              onUploaded={handleChange}
            />
          </ContentTabsContent>

          <ContentTabsContent
            value="delete"
            className="mt-0 animate-none data-[state=inactive]:hidden"
          >
            {hasThumbnail && (
              <ThumbnailDeletePane
                recordingId={recordingId}
                onClose={handleClose}
                onDeleted={handleChange}
              />
            )}
          </ContentTabsContent>
        </ContentTabs>
      </ContentModalBody>
    </ContentModal>
  );
}
