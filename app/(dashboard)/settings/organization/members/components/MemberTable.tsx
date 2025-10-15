'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  MoreVertical,
  Edit,
  Eye,
  Mail,
  Shield,
  Ban,
  Trash2,
  UserX,
  ArrowUpDown,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import { Skeleton } from '@/app/components/ui/skeleton';

import type { OrganizationMember } from '../types';
import { MemberRowActions } from './MemberRowActions';

interface MemberTableProps {
  members: OrganizationMember[];
  isLoading: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onMemberClick: (member: OrganizationMember) => void;
}

type SortField = 'name' | 'email' | 'role' | 'status' | 'last_active_at';
type SortDirection = 'asc' | 'desc';

export function MemberTable({
  members,
  isLoading,
  selectedIds,
  onSelectionChange,
  onMemberClick,
}: MemberTableProps) {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedMembers = React.useMemo(() => {
    return [...members].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'name') {
        aValue = a.name?.toLowerCase() || '';
        bValue = b.name?.toLowerCase() || '';
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [members, sortField, sortDirection]);

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(members.map(m => m.id));
    } else {
      onSelectionChange([]);
    }
  };

  // Handle individual selection
  const handleSelectMember = (memberId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, memberId]);
    } else {
      onSelectionChange(selectedIds.filter(id => id !== memberId));
    }
  };

  const allSelected = members.length > 0 && selectedIds.length === members.length;
  const someSelected = selectedIds.length > 0 && !allSelected;

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
        <TableRow>
          <TableHead className="w-12">
            <input
              type="checkbox"
              checked={allSelected}
              ref={(input) => {
                if (input) input.indeterminate = someSelected;
              }}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="rounded border-gray-300"
            />
          </TableHead>
          <TableHead>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSort('name')}
              className="gap-1 hover:bg-transparent"
            >
              Member
              <ArrowUpDown className="h-3 w-3" />
            </Button>
          </TableHead>
          <TableHead>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSort('role')}
              className="gap-1 hover:bg-transparent"
            >
              Role
              <ArrowUpDown className="h-3 w-3" />
            </Button>
          </TableHead>
          <TableHead>Department</TableHead>
          <TableHead>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSort('last_active_at')}
              className="gap-1 hover:bg-transparent"
            >
              Last Active
              <ArrowUpDown className="h-3 w-3" />
            </Button>
          </TableHead>
          <TableHead>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleSort('status')}
              className="gap-1 hover:bg-transparent"
            >
              Status
              <ArrowUpDown className="h-3 w-3" />
            </Button>
          </TableHead>
          <TableHead className="w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedMembers.map((member) => (
          <TableRow
            key={member.id}
            className="cursor-pointer hover:bg-muted/50"
            onClick={() => onMemberClick(member)}
          >
            <TableCell onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selectedIds.includes(member.id)}
                onChange={(e) => handleSelectMember(member.id, e.target.checked)}
                className="rounded border-gray-300"
              />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.avatar_url || undefined} />
                  <AvatarFallback>
                    {member.name
                      ?.split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase() || member.email[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <div className="font-medium">
                    {member.name || 'Unnamed User'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {member.email}
                  </div>
                  {member.title && (
                    <div className="text-xs text-muted-foreground">
                      {member.title}
                    </div>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <RoleBadge role={member.role} />
            </TableCell>
            <TableCell>
              {member.departments && member.departments.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {member.departments.slice(0, 2).map((dept) => (
                    <Badge key={dept.id} variant="outline" className="text-xs">
                      {dept.name}
                    </Badge>
                  ))}
                  {member.departments.length > 2 && (
                    <Badge variant="outline" className="text-xs">
                      +{member.departments.length - 2}
                    </Badge>
                  )}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>
              {member.last_active_at ? (
                <span className="text-sm">
                  {formatDistanceToNow(new Date(member.last_active_at), {
                    addSuffix: true,
                  })}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Never</span>
              )}
            </TableCell>
            <TableCell>
              <StatusBadge status={member.status || 'pending'} />
            </TableCell>
            <TableCell onClick={(e) => e.stopPropagation()}>
              <MemberRowActions member={member} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

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
