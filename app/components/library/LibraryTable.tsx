'use client';

import * as React from 'react';
import { RowSelectionState } from '@tanstack/react-table';

import { DataTable } from '@/app/components/ui/data-table';
import { createLibraryColumns } from './library-columns';
import { cn } from '@/lib/utils';

import type { ContentItem } from '@/app/components/content/ContentCard';

interface LibraryTableProps {
  items: ContentItem[];
  selectedIds: string[];
  onSelect: (id: string, selected: boolean) => void;
  onSelectAll: (checked: boolean) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onDownload?: (id: string) => void;
}

/**
 * LibraryTable Component
 * Displays library items in a table format with selection, sorting, and actions
 *
 * Now powered by TanStack Table via the DataTable component for:
 * - Improved sorting performance
 * - Built-in filtering
 * - Better accessibility
 * - Consistent patterns across the app
 *
 * Features:
 * - Row selection with checkboxes
 * - Column sorting
 * - Inline actions menu
 * - Status badges
 * - Thumbnail previews
 * - Tags display
 * - Favorites toggle
 * - Responsive design
 */
export function LibraryTable({
  items,
  selectedIds,
  onSelect,
  onSelectAll,
  onDelete,
  onShare,
  onDownload,
}: LibraryTableProps) {
  // Create columns with action handlers
  const columns = React.useMemo(
    () =>
      createLibraryColumns({
        onDelete,
        onShare,
        onDownload,
      }),
    [onDelete, onShare, onDownload]
  );

  // Convert selectedIds array to TanStack row selection state
  const rowSelection = React.useMemo<RowSelectionState>(() => {
    const selection: RowSelectionState = {};
    selectedIds.forEach((id) => {
      selection[id] = true;
    });
    return selection;
  }, [selectedIds]);

  // Handle row selection changes from TanStack Table
  const handleRowSelectionChange = React.useCallback(
    (updater: React.SetStateAction<RowSelectionState>) => {
      const newSelection = typeof updater === 'function' ? updater(rowSelection) : updater;

      // Find which IDs changed
      const currentSelectedIds = new Set(selectedIds);
      const newSelectedIds = new Set(Object.keys(newSelection).filter((id) => newSelection[id]));

      // Handle select all / deselect all
      const allIds = new Set(items.map((item) => item.id));

      if (newSelectedIds.size === 0 && currentSelectedIds.size > 0) {
        // Deselect all
        onSelectAll(false);
      } else if (newSelectedIds.size === items.length && currentSelectedIds.size < items.length) {
        // Select all
        onSelectAll(true);
      } else {
        // Individual selection changes
        // Find newly selected items
        newSelectedIds.forEach((id) => {
          if (!currentSelectedIds.has(id)) {
            onSelect(id, true);
          }
        });

        // Find newly deselected items
        currentSelectedIds.forEach((id) => {
          if (!newSelectedIds.has(id)) {
            onSelect(id, false);
          }
        });
      }
    },
    [selectedIds, items, onSelect, onSelectAll, rowSelection]
  );

  return (
    <DataTable
      columns={columns}
      data={items}
      searchKey="title"
      searchPlaceholder="Search by title..."
      showColumnToggle
      showPagination
      pageSize={20}
      rowSelection={rowSelection}
      setRowSelection={handleRowSelectionChange}
      getRowId={(row) => row.id}
      emptyMessage="No items found"
    />
  );
}
