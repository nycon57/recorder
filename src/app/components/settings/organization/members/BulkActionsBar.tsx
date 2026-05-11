'use client';

import { Users, Trash2, Download, X } from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Alert, AlertDescription } from '@/app/components/ui/alert';

interface BulkActionsBarProps {
  selectedCount: number;
  onExport: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function BulkActionsBar({
  selectedCount,
  onExport,
  onDelete,
  onClear,
}: BulkActionsBarProps) {
  return (
    <div className="border rounded-lg bg-muted/50 p-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Alert className="flex-1 max-w-sm">
          <Users className="size-4" />
          <AlertDescription className="ml-2">
            {selectedCount} member{selectedCount !== 1 ? 's' : ''} selected
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
          >
            <Download className="size-4 mr-2" />
            Export
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
          >
            <Trash2 className="size-4 mr-2" />
            Remove
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
          >
            <X className="size-4 mr-2" />
            Clear Selection
          </Button>
        </div>
      </div>
    </div>
  );
}
