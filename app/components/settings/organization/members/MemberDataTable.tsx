'use client';

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
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

import type { OrganizationMember } from '../types';
import { MemberRowActions } from './MemberRowActions';

interface MemberDataTableProps {
  members: OrganizationMember[];
  isLoading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onMemberClick: (member: OrganizationMember) => void;
}

// Helper components
function RoleBadge({ role }: { role: string }) {
  const variants: Record<string, { color: string; label: string }> = {
    owner: { color: 'bg-purple-100 text-purple-700 border-purple-200', label: 'Owner' },
    admin: { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Admin' },
    contributor: { color: 'bg-green-100 text-green-700 border-green-200', label: 'Contributor' },
    reader: { color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Reader' },
  };

  const variant = variants[role] || variants.reader;

  return (
    <Badge className={`${variant.color} border`} variant="outline">
      {variant.label}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { color: string; label: string }> = {
    active: { color: 'bg-green-100 text-green-700 border-green-200', label: 'Active' },
    pending: { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Pending' },
    suspended: { color: 'bg-red-100 text-red-700 border-red-200', label: 'Suspended' },
    inactive: { color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Inactive' },
  };

  const variant = variants[status] || variants.inactive;

  return (
    <Badge className={`${variant.color} border`} variant="outline">
      {variant.label}
    </Badge>
  );
}

export function MemberDataTable({
  members,
  isLoading,
  selectedIds,
  onSelectionChange,
  onMemberClick,
}: MemberDataTableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([]);

  // Create column definitions
  const columns: ColumnDef<OrganizationMember>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => {
            if (value) {
              onSelectionChange(members.map((m) => m.id));
            } else {
              onSelectionChange([]);
            }
          }}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selectedIds.includes(row.original.id)}
          onCheckedChange={(checked) => {
            if (checked) {
              onSelectionChange([...selectedIds, row.original.id]);
            } else {
              onSelectionChange(selectedIds.filter((id) => id !== row.original.id));
            }
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${row.original.name || 'member'}`}
        />
      ),
      enableSorting: false,
    },
    {
      id: 'member',
      accessorKey: 'name',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="gap-1 hover:bg-transparent"
          >
            Member
            <ArrowUpDown className="h-3 w-3" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={row.original.avatar_url || undefined} />
            <AvatarFallback>
              {row.original.name
                ?.split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase() || (row.original.email?.[0] || '?').toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="font-medium">{row.original.name || 'Unnamed User'}</div>
            <div className="text-sm text-muted-foreground">{row.original.email}</div>
            {row.original.title && (
              <div className="text-xs text-muted-foreground">{row.original.title}</div>
            )}
          </div>
        </div>
      ),
      enableSorting: true,
    },
    {
      id: 'role',
      accessorKey: 'role',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="gap-1 hover:bg-transparent"
          >
            Role
            <ArrowUpDown className="h-3 w-3" />
          </Button>
        );
      },
      cell: ({ row }) => <RoleBadge role={row.original.role} />,
      enableSorting: true,
    },
    {
      id: 'department',
      header: 'Department',
      cell: ({ row }) => {
        if (row.original.departments && row.original.departments.length > 0) {
          return (
            <div className="flex flex-wrap gap-1">
              {row.original.departments.slice(0, 2).map((dept) => (
                <Badge key={dept.id} variant="outline" className="text-xs">
                  {dept.name}
                </Badge>
              ))}
              {row.original.departments.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{row.original.departments.length - 2}
                </Badge>
              )}
            </div>
          );
        }
        return <span className="text-sm text-muted-foreground">-</span>;
      },
      enableSorting: false,
    },
    {
      id: 'last_active',
      accessorKey: 'last_active_at',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="gap-1 hover:bg-transparent"
          >
            Last Active
            <ArrowUpDown className="h-3 w-3" />
          </Button>
        );
      },
      cell: ({ row }) => {
        if (row.original.last_active_at) {
          return (
            <span className="text-sm">
              {formatDistanceToNow(new Date(row.original.last_active_at), {
                addSuffix: true,
              })}
            </span>
          );
        }
        return <span className="text-sm text-muted-foreground">Never</span>;
      },
      enableSorting: true,
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="gap-1 hover:bg-transparent"
          >
            Status
            <ArrowUpDown className="h-3 w-3" />
          </Button>
        );
      },
      cell: ({ row }) => <StatusBadge status={row.original.status || 'pending'} />,
      enableSorting: true,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <MemberRowActions member={row.original} />
        </div>
      ),
      enableSorting: false,
    },
  ];

  const table = useReactTable({
    data: members,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting,
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 mb-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (members.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-muted-foreground">No members found</div>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead
                key={header.id}
                className={header.column.id === 'select' ? 'w-12' : header.column.id === 'actions' ? 'w-12' : undefined}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onMemberClick(row.original)}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
