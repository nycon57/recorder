'use client';

import { useState, useMemo } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ChevronDown,
  ChevronUp,
  GitCompareArrows,
  Clock,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent } from '@/app/components/ui/card';

import { PointInTimeFilter } from './point-in-time-filter';
import { VersionContentPanel } from './version-content-panel';
import { VersionDiffViewer } from './version-diff-viewer';
import type { WikiPageVersion } from './page';

interface VersionTimelineProps {
  versions: WikiPageVersion[];
  headId: string;
}

function confidenceBadgeVariant(confidence: number) {
  if (confidence > 0.7) return 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30';
  if (confidence > 0.4) return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30';
  return 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30';
}

export function VersionTimeline({ versions, headId }: VersionTimelineProps) {
  const [expandedVersionId, setExpandedVersionId] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareLeft, setCompareLeft] = useState<number | null>(null);
  const [compareRight, setCompareRight] = useState<number | null>(null);
  const [pointInTimeDate, setPointInTimeDate] = useState<Date | null>(null);

  // Find earliest version date for the filter
  const earliestDate = useMemo(() => {
    const dates = versions.map((v) => new Date(v.valid_from).getTime());
    return new Date(Math.min(...dates)).toISOString();
  }, [versions]);

  // Determine which version was active at the selected point-in-time
  const activeAtDate = useMemo(() => {
    if (!pointInTimeDate) return null;
    return (
      versions.find((v) => {
        const from = new Date(v.valid_from);
        const until = v.valid_until ? new Date(v.valid_until) : null;
        return pointInTimeDate >= from && (until === null || pointInTimeDate < until);
      }) ?? null
    );
  }, [versions, pointInTimeDate]);

  function handleCompareClick(index: number) {
    if (compareLeft === null) {
      setCompareLeft(index);
      // Auto-select adjacent version
      const adjacent = index + 1 < versions.length ? index + 1 : index - 1;
      if (adjacent >= 0 && adjacent < versions.length) {
        setCompareRight(adjacent);
      }
    } else if (compareRight === null) {
      setCompareRight(index);
    } else {
      // Reset and start new comparison
      setCompareLeft(index);
      setCompareRight(null);
    }
  }

  function toggleCompareMode() {
    setCompareMode(!compareMode);
    if (compareMode) {
      setCompareLeft(null);
      setCompareRight(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3">
        <PointInTimeFilter
          earliestDate={earliestDate}
          selectedDate={pointInTimeDate}
          onDateChange={setPointInTimeDate}
        />
        <Button
          variant={compareMode ? 'default' : 'outline'}
          size="sm"
          onClick={toggleCompareMode}
        >
          <GitCompareArrows className="mr-2 h-4 w-4" />
          Compare
        </Button>
      </div>

      {/* Diff viewer */}
      <AnimatePresence>
        {compareMode &&
          compareLeft !== null &&
          compareRight !== null &&
          versions[compareLeft] &&
          versions[compareRight] && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <VersionDiffViewer
                leftVersion={versions[compareLeft]}
                rightVersion={versions[compareRight]}
                leftIndex={compareLeft}
                rightIndex={compareRight}
                onClose={() => {
                  setCompareLeft(null);
                  setCompareRight(null);
                }}
              />
            </motion.div>
          )}
      </AnimatePresence>

      {/* Timeline */}
      <div className="relative space-y-0">
        {versions.map((version, index) => {
          const isHead = version.id === headId;
          const isCurrent = version.valid_until === null;
          const isExpanded = expandedVersionId === version.id;
          const isActiveAtDate = activeAtDate?.id === version.id;
          const isDimmed = pointInTimeDate !== null && !isActiveAtDate;

          return (
            <motion.div
              key={version.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: isDimmed ? 0.4 : 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative pl-8"
            >
              {/* Vertical line */}
              {index < versions.length - 1 && (
                <div className="absolute left-[11px] top-8 h-full w-px border-l-2 border-border" />
              )}

              {/* Dot */}
              <div
                className={`absolute left-1 top-5 h-3 w-3 rounded-full border-2 ${
                  isHead
                    ? 'border-primary bg-primary'
                    : 'border-border bg-background'
                }`}
              />

              <Card
                className={`mb-4 transition-colors ${
                  isHead ? 'border-l-primary border-l-2' : ''
                } ${isActiveAtDate ? 'ring-2 ring-primary/50' : ''}`}
              >
                <CardContent className="pt-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          v{index + 1}
                        </span>
                        <span className="text-sm">{version.topic}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className={confidenceBadgeVariant(version.confidence)}
                        >
                          {Math.round(version.confidence * 100)}%
                        </Badge>
                        {isCurrent && (
                          <Badge className="bg-primary/10 text-primary">
                            Current
                          </Badge>
                        )}
                        {version.app && (
                          <Badge variant="secondary" className="text-xs">
                            {version.app}
                          </Badge>
                        )}
                        {version.screen && (
                          <Badge variant="secondary" className="text-xs">
                            {version.screen}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {format(new Date(version.valid_from), 'MMM d, yyyy HH:mm')}
                          {version.valid_until
                            ? ` - ${format(new Date(version.valid_until), 'MMM d, yyyy HH:mm')}`
                            : ' - Present'}
                        </span>
                        <span className="ml-1">
                          ({formatDistanceToNow(new Date(version.valid_from), { addSuffix: true })})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {compareMode && (
                        <Button
                          variant={
                            compareLeft === index || compareRight === index
                              ? 'default'
                              : 'outline'
                          }
                          size="sm"
                          onClick={() => handleCompareClick(index)}
                        >
                          <GitCompareArrows className="mr-1 h-3 w-3" />
                          {compareLeft === index
                            ? 'Left'
                            : compareRight === index
                              ? 'Right'
                              : 'Select'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedVersionId(isExpanded ? null : version.id)
                        }
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && <VersionContentPanel version={version} />}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
