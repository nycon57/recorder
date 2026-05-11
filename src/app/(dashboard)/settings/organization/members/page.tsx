'use client';

import { useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Filter,
  UserPlus,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  Users2,
} from 'lucide-react';
import { toast } from 'sonner';

import { useDebounce } from '@/lib/hooks/use-debounce';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import {
  InviteMemberModal,
  MemberDetailDrawer,
  BulkActionsBar,
  MemberFilters,
} from '@/app/components/settings';
import { DocLink } from '@/app/components/docs/doc-link';
import { MemberDataTable } from '@/app/components/settings/organization/members/MemberDataTable';

import type { OrganizationMember, MemberFiltersState } from './types';

interface MembersPageState {
  searchQuery: string;
  filters: MemberFiltersState;
  selectedMemberIds: string[];
  showInviteModal: boolean;
  selectedMember: OrganizationMember | null;
  showFilters: boolean;
  page: number;
}

type MembersPageAction =
  | Partial<MembersPageState>
  | ((state: MembersPageState) => MembersPageState);

const initialMembersPageState: MembersPageState = {
  searchQuery: '',
  filters: { roles: [], departments: [], statuses: [] },
  selectedMemberIds: [],
  showInviteModal: false,
  selectedMember: null,
  showFilters: false,
  page: 1,
};

const membersPageReducer = (
  state: MembersPageState,
  action: MembersPageAction,
): MembersPageState =>
  typeof action === 'function' ? action(state) : { ...state, ...action };

export default function MembersPage() {
  return useMembersPageImplementation();
}

function useMembersPageImplementation() {
  const queryClient = useQueryClient();

  const [
    {
      searchQuery,
      filters,
      selectedMemberIds,
      showInviteModal,
      selectedMember,
      showFilters,
      page,
    },
    updateMembersState,
  ] = useReducer(membersPageReducer, initialMembersPageState);
  const pageSize = 50;

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch members
  const { data: membersData, isLoading } = useQuery({
    queryKey: [
      'organization-members',
      debouncedSearch,
      filters,
      page,
      pageSize,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(filters.roles.length > 0 && { role: filters.roles[0] }), // API expects single role
        ...(filters.departments.length > 0 && {
          department_id: filters.departments[0],
        }), // API expects single department_id
        ...(filters.statuses.length > 0 && { status: filters.statuses[0] }), // API expects single status
      });

      const response = await fetch(`/api/organizations/members?${params}`);
      if (!response.ok) throw new Error('Failed to fetch members');
      return response.json();
    },
  });

  const members: OrganizationMember[] = membersData?.data?.members || [];
  const pagination = membersData?.data?.pagination;
  const totalCount = pagination?.total || 0;
  const totalPages = pagination?.total_pages || 1;

  // Delete members mutation
  const deleteMembersMutation = useMutation({
    mutationFn: async (memberIds: string[]) => {
      const response = await fetch('/api/organizations/members/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberIds }),
      });
      if (!response.ok) throw new Error('Failed to delete members');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      updateMembersState({ selectedMemberIds: [] });
      toast.success('Members removed successfully');
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Failed to remove members';
      toast.error(message);
    },
  });

  // Export to CSV
  const handleExportCSV = () => {
    const selectedMembers =
      selectedMemberIds.length > 0
        ? members.filter((m) => selectedMemberIds.includes(m.id))
        : members;

    const csvContent = [
      ['Name', 'Email', 'Role', 'Department', 'Status', 'Last Active'].join(
        ',',
      ),
      ...selectedMembers.map((m) =>
        [
          m.name || '',
          m.email,
          m.role,
          m.department_name || '',
          m.status,
          m.last_active_at ? new Date(m.last_active_at).toISOString() : '',
        ].join(','),
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `members-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success(`Exported ${selectedMembers.length} members`);
  };

  // Clear all filters
  const handleClearFilters = () => {
    updateMembersState({
      searchQuery: '',
      filters: { roles: [], departments: [], statuses: [] },
      page: 1,
    });
  };

  const hasActiveFilters =
    searchQuery ||
    filters.roles.length > 0 ||
    filters.departments.length > 0 ||
    filters.statuses.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="trbd-page-title flex items-center gap-3">
            <Users2 className="size-8 text-primary" />
            Team Members
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your organization&apos;s team members, roles, and access
          </p>
          <DocLink href="/docs/org-admin/members-and-roles" className="mt-1">
            Members &amp; roles guide
          </DocLink>
        </div>
        <Button
          onClick={() => updateMembersState({ showInviteModal: true })}
          className="gap-2"
        >
          <UserPlus className="size-4" />
          Invite Member
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Total Members</div>
          <div className="text-2xl font-bold mt-1">{totalCount}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Active</div>
          <div className="text-2xl font-bold mt-1 text-green-600">
            {members.filter((m) => m.status === 'active').length}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold mt-1 text-yellow-600">
            {members.filter((m) => m.status === 'pending').length}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Suspended</div>
          <div className="text-2xl font-bold mt-1 text-red-600">
            {members.filter((m) => m.status === 'suspended').length}
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) =>
              updateMembersState({ searchQuery: e.target.value })
            }
            className="pl-10"
          />
        </div>

        <Button
          variant={showFilters ? 'default' : 'outline'}
          onClick={() => updateMembersState({ showFilters: !showFilters })}
          className="gap-2"
        >
          <Filter className="size-4" />
          Filters
          {hasActiveFilters && (
            <Badge variant="secondary" className="ml-1 px-1 min-w-5 h-5">
              {[
                filters.roles.length,
                filters.departments.length,
                filters.statuses.length,
                searchQuery ? 1 : 0,
              ].reduce((a, b) => a + b, 0)}
            </Badge>
          )}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            onClick={handleClearFilters}
            className="gap-2"
          >
            <X className="size-4" />
            Clear
          </Button>
        )}

        <Button variant="outline" onClick={handleExportCSV} className="gap-2">
          <Download className="size-4" />
          Export
        </Button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <MemberFilters
          filters={filters}
          onFiltersChange={(nextFilters: MemberFiltersState) =>
            updateMembersState({ filters: nextFilters })
          }
          onClose={() => updateMembersState({ showFilters: false })}
        />
      )}

      {/* Bulk Actions Bar */}
      {selectedMemberIds.length > 0 && (
        <BulkActionsBar
          selectedCount={selectedMemberIds.length}
          onExport={handleExportCSV}
          onDelete={() => {
            if (
              confirm(
                `Are you sure you want to remove ${selectedMemberIds.length} member(s)?`,
              )
            ) {
              deleteMembersMutation.mutate(selectedMemberIds);
            }
          }}
          onClear={() => updateMembersState({ selectedMemberIds: [] })}
        />
      )}

      {/* Members Table */}
      <div className="border rounded-lg">
        <MemberDataTable
          members={members}
          isLoading={isLoading}
          selectedIds={selectedMemberIds}
          onSelectionChange={(ids) =>
            updateMembersState({ selectedMemberIds: ids })
          }
          onMemberClick={(member) =>
            updateMembersState({ selectedMember: member })
          }
        />
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} to{' '}
            {Math.min(page * pageSize, totalCount)} of {totalCount} members
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateMembersState((state) => ({
                  ...state,
                  page: Math.max(1, state.page - 1),
                }))
              }
              disabled={page === 1}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="text-sm">
              Page {page} of {totalPages}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateMembersState((state) => ({
                  ...state,
                  page: Math.min(totalPages, state.page + 1),
                }))
              }
              disabled={page === totalPages}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modals and Drawers */}
      <InviteMemberModal
        open={showInviteModal}
        onClose={() => updateMembersState({ showInviteModal: false })}
        departments={[]} // You would fetch these departments
      />

      <MemberDetailDrawer
        member={
          selectedMember
            ? {
                ...selectedMember,
                status: selectedMember.status ?? 'active',
                departments: selectedMember.departments ?? [],
              }
            : null
        }
        open={!!selectedMember}
        onClose={() => updateMembersState({ selectedMember: null })}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ['organization-members'] });
        }}
      />
    </div>
  );
}
