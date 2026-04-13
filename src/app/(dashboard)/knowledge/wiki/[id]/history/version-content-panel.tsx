'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { motion } from 'motion/react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Progress } from '@/app/components/ui/progress';

import type { WikiPageVersion } from './page';

const CONTENT_PREVIEW_LENGTH = 500;

interface VersionContentPanelProps {
  version: WikiPageVersion;
}

export function VersionContentPanel({ version }: VersionContentPanelProps) {
  const [showFull, setShowFull] = useState(false);

  const isLong = version.content.length > CONTENT_PREVIEW_LENGTH;
  const displayContent =
    isLong && !showFull
      ? version.content.slice(0, CONTENT_PREVIEW_LENGTH) + '...'
      : version.content;

  const confidencePercent = Math.round(version.confidence * 100);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="space-y-4 border-t pt-4">
        {/* Metadata */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Valid from</p>
            <p className="text-sm font-medium">
              {format(new Date(version.valid_from), 'MMM d, yyyy HH:mm')}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Valid until</p>
            <p className="text-sm font-medium">
              {version.valid_until
                ? format(new Date(version.valid_until), 'MMM d, yyyy HH:mm')
                : 'Current'}
            </p>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Confidence</p>
            <div className="flex items-center gap-2">
              <Progress value={confidencePercent} className="h-2 flex-1" />
              <span className="text-xs font-medium tabular-nums">
                {confidencePercent}%
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {version.app && <Badge variant="secondary">{version.app}</Badge>}
            {version.screen && (
              <Badge variant="secondary">{version.screen}</Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Content</p>
          <pre className="whitespace-pre-wrap rounded-md border bg-muted/20 p-3 text-sm">
            {displayContent}
          </pre>
          {isLong && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFull(!showFull)}
              className="mt-1"
            >
              {showFull ? 'Show less' : 'Show more'}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
