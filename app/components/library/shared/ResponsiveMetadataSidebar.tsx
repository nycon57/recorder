'use client';

import * as React from 'react';
import { Info, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/app/components/ui/sheet';
import MetadataSidebar from './MetadataSidebar';
import type { ContentType, FileType, RecordingStatus, Tag } from '@/lib/types/database';

interface ResponsiveMetadataSidebarProps {
  recordingId: string;
  contentType: ContentType | null;
  fileType: FileType | null;
  status: RecordingStatus;
  fileSize?: number | null;
  duration?: number | null;
  createdAt: string;
  completedAt?: string | null;
  originalFilename?: string | null;
  tags?: Tag[];
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  onReprocess?: () => void;
  onDownload?: () => void;
}

/**
 * Responsive wrapper for MetadataSidebar
 * - Mobile: Sheet drawer that can be opened with FAB
 * - Desktop: Sticky sidebar in right column
 */
export default function ResponsiveMetadataSidebar(props: ResponsiveMetadataSidebarProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  // Detect mobile screen size
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mobile: Sheet with FAB trigger
  if (isMobile) {
    return (
      <>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button
              size="icon"
              className="fixed bottom-6 right-6 size-14 rounded-full shadow-lg z-40"
              aria-label="Open details"
            >
              <Info className="size-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
            <SheetHeader className="mb-4">
              <SheetTitle>Content Details</SheetTitle>
            </SheetHeader>
            <MetadataSidebar {...props} />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // Desktop: Regular sticky sidebar
  return (
    <div className="lg:col-span-1">
      <div className="lg:sticky lg:top-6 space-y-6">
        <MetadataSidebar {...props} />
      </div>
    </div>
  );
}
