'use client';

import { diffLines } from 'diff';
import { X } from 'lucide-react';

import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { ScrollArea } from '@/app/components/ui/scroll-area';

import type { WikiPageVersion } from './page';

interface VersionDiffViewerProps {
  leftVersion: WikiPageVersion;
  rightVersion: WikiPageVersion;
  leftIndex: number;
  rightIndex: number;
  onClose: () => void;
}

export function VersionDiffViewer({
  leftVersion,
  rightVersion,
  leftIndex,
  rightIndex,
  onClose,
}: VersionDiffViewerProps) {
  const changes = diffLines(leftVersion.content, rightVersion.content);

  let additions = 0;
  let deletions = 0;
  for (const change of changes) {
    const lineCount = change.count ?? 0;
    if (change.added) additions += lineCount;
    if (change.removed) deletions += lineCount;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">
          Comparing v{leftIndex + 1} &rarr; v{rightIndex + 1}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 px-2">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400"
          >
            +{additions} added
          </Badge>
          <Badge
            variant="outline"
            className="border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
          >
            -{deletions} removed
          </Badge>
        </div>

        <ScrollArea className="max-h-96 rounded-md border">
          <div className="p-3 font-mono text-sm">
            {changes.map((change, i) => {
              const lines = change.value.replace(/\n$/, '').split('\n');
              return lines.map((line, j) => {
                const key = `${i}-${j}`;
                if (change.added) {
                  return (
                    <div
                      key={key}
                      className="border-l-2 border-green-500 bg-green-500/10 px-3 py-0.5"
                    >
                      + {line}
                    </div>
                  );
                }
                if (change.removed) {
                  return (
                    <div
                      key={key}
                      className="border-l-2 border-red-500 bg-red-500/10 px-3 py-0.5 line-through"
                    >
                      - {line}
                    </div>
                  );
                }
                return (
                  <div key={key} className="px-3 py-0.5 text-muted-foreground">
                    &nbsp; {line}
                  </div>
                );
              });
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
