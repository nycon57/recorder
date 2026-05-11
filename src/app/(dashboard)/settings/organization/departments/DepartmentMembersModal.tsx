'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  UserMinus,
  MoreVertical,
  Search,
  Mail,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/app/components/ui/avatar';
import { Badge } from '@/app/components/ui/badge';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/app/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { Department, DepartmentMember } from '@/lib/validations/departments';
import { cn } from '@/lib/utils/cn';
import { formatStableDate } from '@/lib/utils/formatting';

interface DepartmentMembersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department;
}

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  avatarUrl?: string;
}

const roleColors = {
  owner: 'bg-primary/20 text-primary',
  admin: 'bg-accent/20 text-accent',
  contributor: 'bg-secondary/20 text-secondary',
  reader: 'bg-muted text-muted-foreground',
};

export function DepartmentMembersModal(
  props: Parameters<typeof useDepartmentMembersModalImplementation>[0],
) {
  return useDepartmentMembersModalImplementation(props);
}

function useDepartmentMembersModalImplementation({
  open,
  onOpenChange,
  department,
}: DepartmentMembersModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const {
    data: members = [],
    isLoading: loading,
    refetch: refetchMembers,
  } = useQuery<DepartmentMember[]>({
    queryKey: ['department-members', department.id],
    enabled: open,
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/organizations/departments/${department.id}/members?includeDetails=true`,
        { signal },
      );

      if (!response.ok) {
        throw new Error('Failed to fetch members');
      }

      const data = await response.json();
      return data.data || [];
    },
  });

  const { data: organizationUsers = [] } = useQuery<User[]>({
    queryKey: ['organization-members'],
    enabled: open,
    queryFn: async ({ signal }) => {
      const response = await fetch('/api/organizations/members', { signal });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      return data.data || [];
    },
  });

  const availableUsers = useMemo(() => {
    const memberIds = new Set(members.map((member) => member.userId));
    return organizationUsers.filter((user) => !memberIds.has(user.id));
  }, [members, organizationUsers]);

  // Add user to department
  const handleAddUser = async (userId: string) => {
    setAddingUser(true);

    try {
      const response = await fetch(
        `/api/organizations/departments/${department.id}/members`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add user');
      }

      toast.success('User added to department');
      setAddUserOpen(false);
      void refetchMembers();
    } catch (error) {
      console.error('Error adding user:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to add user',
      );
    } finally {
      setAddingUser(false);
    }
  };

  // Remove user from department
  const handleRemoveUser = async (userId: string) => {
    setRemovingUserId(userId);

    try {
      const response = await fetch(
        `/api/organizations/departments/${department.id}/members/${userId}`,
        {
          method: 'DELETE',
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove user');
      }

      toast.success('User removed from department');
      void refetchMembers();
    } catch (error) {
      console.error('Error removing user:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove user',
      );
    } finally {
      setRemovingUserId(null);
    }
  };

  // Filter members based on search
  const filteredMembers = members.filter((member) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      member.user?.name?.toLowerCase().includes(query) ||
      member.user?.email.toLowerCase().includes(query)
    );
  });

  // Get user initials for avatar
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Department Members</DialogTitle>
          <DialogDescription>
            Manage members of {department.name} department
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Actions Bar */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search members…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Popover open={addUserOpen} onOpenChange={setAddUserOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" disabled={addingUser}>
                  {addingUser ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Adding…
                    </>
                  ) : (
                    <>
                      <UserPlus className="size-4 mr-2" />
                      Add Member
                    </>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="end">
                <Command>
                  <CommandInput placeholder="Search users…" />
                  <CommandEmpty>No users found.</CommandEmpty>
                  <CommandGroup>
                    {availableUsers.map((user) => (
                      <CommandItem
                        key={user.id}
                        onSelect={() => void handleAddUser(user.id)}
                      >
                        <UserPlus className="mr-2 size-4 text-muted-foreground" />
                        <div className="flex items-center gap-2 flex-1">
                          <Avatar className="size-6">
                            <AvatarImage src={user.avatarUrl} />
                            <AvatarFallback className="text-xs">
                              {getInitials(user.name, user.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {user.name || user.email}
                            </p>
                            {user.name && (
                              <p className="text-xs text-muted-foreground truncate">
                                {user.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Members List */}
          <ScrollArea className="h-[400px]">
            {loading ? (
              <div className="space-y-3">
                {['member-row-1', 'member-row-2', 'member-row-3'].map(
                  (skeletonId) => (
                    <div
                      key={skeletonId}
                      className="flex items-center gap-3 p-3"
                    >
                      <Skeleton className="size-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="size-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  {searchQuery
                    ? 'No members found matching your search'
                    : 'No members in this department yet'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredMembers.map((member) => (
                  <div
                    key={member.userId}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <Avatar>
                      <AvatarImage src={(member.user as any)?.avatarUrl} />
                      <AvatarFallback>
                        {getInitials(
                          member.user?.name || null,
                          member.user?.email || '',
                        )}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">
                          {member.user?.name || member.user?.email}
                        </p>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'text-xs',
                            member.user?.role &&
                              roleColors[
                                member.user.role as keyof typeof roleColors
                              ],
                          )}
                        >
                          {member.user?.role}
                        </Badge>
                      </div>
                      {member.user?.name && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="size-3" />
                          <span className="truncate">{member.user.email}</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Added {formatStableDate(member.createdAt)}
                      </p>
                    </div>

                    {removingUserId === member.userId ? (
                      <div className="size-8 flex items-center justify-center">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-8 p-0"
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleRemoveUser(member.userId)}
                            className="text-destructive"
                          >
                            <UserMinus className="size-4 mr-2" />
                            Remove from Department
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Summary */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {members.length} {members.length === 1 ? 'member' : 'members'}{' '}
                total
              </span>
              <span>{availableUsers.length} available to add</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
