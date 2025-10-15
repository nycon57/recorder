'use client';

import * as React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

/**
 * Column definition for DataTable
 */
export interface Column<T> {
  /**
   * Unique identifier for the column
   */
  key: string;
  /**
   * Column header label
   */
  header: string;
  /**
   * Accessor function to get cell value from row data
   */
  accessor: (item: T) => React.ReactNode;
  /**
   * Enable sorting for this column
   */
  sortable?: boolean;
  /**
   * Custom sort function (if not provided, uses string comparison)
   */
  sortFn?: (a: T, b: T) => number;
  /**
   * Enable filtering for this column
   */
  filterable?: boolean;
  /**
   * Custom filter function (if not provided, uses string includes)
   */
  filterFn?: (item: T, filterValue: string) => boolean;
  /**
   * Column width (CSS value)
   */
  width?: string;
  /**
   * Additional CSS classes for header
   */
  headerClassName?: string;
  /**
   * Additional CSS classes for cells
   */
  className?: string;
}

/**
 * Sort direction
 */
type SortDirection = 'asc' | 'desc' | null;

/**
 * Props for DataTable component
 */
export interface DataTableProps<T> {
  /**
   * Column definitions
   */
  columns: Column<T>[];
  /**
   * Table data
   */
  data: T[];
  /**
   * Unique key extractor for rows
   */
  getItemId?: (item: T) => string;
  /**
   * Enable row selection
   */
  selectable?: boolean;
  /**
   * Selected row IDs
   */
  selectedIds?: string[];
  /**
   * Callback when selection changes
   */
  onSelectionChange?: (ids: string[]) => void;
  /**
   * Enable pagination
   */
  paginated?: boolean;
  /**
   * Items per page (default: 10)
   */
  pageSize?: number;
  /**
   * Available page sizes
   */
  pageSizeOptions?: number[];
  /**
   * Enable global search
   */
  searchable?: boolean;
  /**
   * Search placeholder text
   */
  searchPlaceholder?: string;
  /**
   * Loading state
   */
  isLoading?: boolean;
  /**
   * Empty state component or message
   */
  emptyMessage?: string;
  /**
   * Empty state component
   */
  emptyState?: React.ReactNode;
  /**
   * Bulk action toolbar (shown when rows are selected)
   */
  bulkActions?: (selectedIds: string[]) => React.ReactNode;
  /**
   * Additional CSS classes for table container
   */
  className?: string;
  /**
   * Row click handler
   */
  onRowClick?: (item: T) => void;
  /**
   * External sort control
   */
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: string) => void;
}

/**
 * Default empty state
 */
function DefaultEmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="rounded-full bg-muted p-3 mb-4">
        <Search className="size-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">No data found</h3>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Loading skeleton
 */
function LoadingSkeleton({ columns, selectable }: { columns: Column<unknown>[]; selectable: boolean }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {selectable && (
            <TableCell>
              <Skeleton className="h-4 w-4" />
            </TableCell>
          )}
          {columns.map((column) => (
            <TableCell key={column.key}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/**
 * DataTable Component
 *
 * A fully-featured, generic data table component with built-in sorting, filtering,
 * pagination, row selection, and bulk actions. Built on shadcn/ui Table components
 * with extensive customization options.
 *
 * Features:
 * - Column-based sorting (clickable headers)
 * - Global search and column-specific filtering
 * - Pagination with configurable page sizes
 * - Row selection with select all
 * - Bulk action toolbar
 * - Loading skeleton state
 * - Customizable empty state
 * - Fully typed with TypeScript generics
 * - Responsive design
 * - Accessible keyboard navigation
 *
 * @example
 * ```tsx
 * interface User {
 *   id: string;
 *   name: string;
 *   email: string;
 *   role: string;
 * }
 *
 * const columns: Column<User>[] = [
 *   {
 *     key: 'name',
 *     header: 'Name',
 *     accessor: (row) => row.name,
 *     sortable: true,
 *     filterable: true,
 *   },
 *   {
 *     key: 'email',
 *     header: 'Email',
 *     accessor: (row) => row.email,
 *     sortable: true,
 *   },
 *   {
 *     key: 'role',
 *     header: 'Role',
 *     accessor: (row) => <RoleBadge role={row.role} />,
 *     sortable: true,
 *   },
 * ];
 *
 * <DataTable
 *   columns={columns}
 *   data={users}
 *   getItemId={(user) => user.id}
 *   selectable
 *   searchable
 *   paginated
 *   onSelectionChange={handleSelectionChange}
 *   bulkActions={(selectedIds) => (
 *     <Button onClick={() => handleBulkDelete(selectedIds)}>
 *       Delete {selectedIds.length} users
 *     </Button>
 *   )}
 * />
 * ```
 */
export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  getItemId = (item) => (item.id as string),
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  paginated = false,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  searchable = false,
  searchPlaceholder = 'Search...',
  isLoading = false,
  emptyMessage = 'There are no items to display at this time.',
  emptyState,
  bulkActions,
  className,
  onRowClick,
  sortField: externalSortField,
  sortDirection: externalSortDirection,
  onSort: externalOnSort,
}: DataTableProps<T>) {
  // Internal sorting state (only used if external sort not provided)
  const [internalSortField, setInternalSortField] = React.useState<string | null>(null);
  const [internalSortDirection, setInternalSortDirection] = React.useState<SortDirection>(null);

  // Search state
  const [searchQuery, setSearchQuery] = React.useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(initialPageSize);

  // Use external sort if provided, otherwise internal
  const sortField = externalSortField !== undefined ? externalSortField : internalSortField;
  const sortDirection = externalSortDirection !== undefined ? externalSortDirection : internalSortDirection;

  // Handle sort
  const handleSort = (columnKey: string) => {
    const column = columns.find((col) => col.key === columnKey);
    if (!column?.sortable) return;

    // If external sort handler, use it
    if (externalOnSort) {
      externalOnSort(columnKey);
      return;
    }

    // Internal sort logic
    if (internalSortField === columnKey) {
      // Cycle through: asc -> desc -> null
      if (internalSortDirection === 'asc') {
        setInternalSortDirection('desc');
      } else if (internalSortDirection === 'desc') {
        setInternalSortDirection(null);
        setInternalSortField(null);
      }
    } else {
      setInternalSortField(columnKey);
      setInternalSortDirection('asc');
    }
  };

  // Filter data by search
  const filteredData = React.useMemo(() => {
    if (!searchQuery) return data;

    const query = searchQuery.toLowerCase();
    return data.filter((row) => {
      // Check all filterable columns
      return columns.some((column) => {
        if (!column.filterable) return false;

        if (column.filterFn) {
          return column.filterFn(row, searchQuery);
        }

        // Default: convert accessor result to string and search
        const value = column.accessor(row);
        const stringValue = String(value).toLowerCase();
        return stringValue.includes(query);
      });
    });
  }, [data, searchQuery, columns]);

  // Sort data (only if not externally controlled)
  const sortedData = React.useMemo(() => {
    if (externalOnSort) return filteredData; // External sorting
    if (!internalSortField || !internalSortDirection) return filteredData;

    const column = columns.find((col) => col.key === internalSortField);
    if (!column) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      if (column.sortFn) {
        return column.sortFn(a, b);
      }

      // Default: string comparison
      const aValue = String(column.accessor(a));
      const bValue = String(column.accessor(b));
      return aValue.localeCompare(bValue);
    });

    return internalSortDirection === 'desc' ? sorted.reverse() : sorted;
  }, [filteredData, internalSortField, internalSortDirection, columns, externalOnSort]);

  // Paginate data
  const paginatedData = React.useMemo(() => {
    if (!paginated) return sortedData;

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedData.slice(start, end);
  }, [sortedData, currentPage, pageSize, paginated]);

  // Calculate pagination info
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  // Reset to page 1 when search or sort changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortDirection]);

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange(paginatedData.map(getItemId));
    } else {
      onSelectionChange([]);
    }
  };

  // Handle row selection
  const handleRowSelect = (rowId: string, checked: boolean) => {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedIds, rowId]);
    } else {
      onSelectionChange(selectedIds.filter((id) => id !== rowId));
    }
  };

  const allSelected =
    paginatedData.length > 0 &&
    paginatedData.every((row) => selectedIds.includes(getItemId(row)));
  const someSelected =
    paginatedData.some((row) => selectedIds.includes(getItemId(row))) && !allSelected;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Search and bulk actions */}
      {(searchable || (selectable && selectedIds.length > 0 && bulkActions)) && (
        <div className="flex items-center gap-4">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}
          {selectable && selectedIds.length > 0 && bulkActions && (
            <div className="flex items-center gap-2 flex-1">
              {bulkActions(selectedIds)}
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all rows"
                    className={someSelected ? 'data-[state=checked]:bg-primary/50' : ''}
                  />
                </TableHead>
              )}
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  style={{ width: column.width }}
                  className={cn(column.headerClassName)}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => handleSort(column.key)}
                      className="flex items-center gap-2 hover:text-foreground transition-colors font-medium"
                    >
                      <span>{column.header}</span>
                      {sortField === column.key ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="size-4" />
                        ) : (
                          <ArrowDown className="size-4" />
                        )
                      ) : (
                        <ArrowUpDown className="size-4 opacity-50" />
                      )}
                    </button>
                  ) : (
                    <span className="font-medium">{column.header}</span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <LoadingSkeleton columns={columns} selectable={selectable} />
            ) : paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="h-64"
                >
                  {emptyState || <DefaultEmptyState message={emptyMessage} />}
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row) => {
                const rowId = getItemId(row);
                const isSelected = selectedIds.includes(rowId);

                return (
                  <TableRow
                    key={rowId}
                    data-state={isSelected ? 'selected' : undefined}
                    className={onRowClick ? 'cursor-pointer' : ''}
                    onClick={() => onRowClick?.(row)}
                  >
                    {selectable && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) =>
                            handleRowSelect(rowId, checked as boolean)
                          }
                          aria-label={`Select row ${rowId}`}
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(column.className)}
                      >
                        {column.accessor(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {paginated && !isLoading && paginatedData.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Showing {(currentPage - 1) * pageSize + 1} to{' '}
              {Math.min(currentPage * pageSize, sortedData.length)} of{' '}
              {sortedData.length} results
            </span>
            {selectedIds.length > 0 && (
              <span className="ml-2 font-medium text-foreground">
                ({selectedIds.length} selected)
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Rows per page</span>
              <Select
                value={String(pageSize)}
                onValueChange={(value) => {
                  setPageSize(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p - 1)}
                disabled={!hasPreviousPage}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <div className="text-sm font-medium">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={!hasNextPage}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}