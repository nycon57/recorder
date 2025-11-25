"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Users,
  UserPlus,
  UserMinus,
  MoreVertical,
  Search,
  AlertCircle,
  Mail,
  Shield,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/components/ui/avatar";
import { Badge } from "@/app/components/ui/badge";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Skeleton } from "@/app/components/ui/skeleton";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/app/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { Department, DepartmentMember } from "@/lib/validations/departments";
import { cn } from "@/lib/utils/cn";

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
  owner: "bg-purple-100 text-purple-800",
  admin: "bg-blue-100 text-blue-800",
  contributor: "bg-green-100 text-green-800",
  reader: "bg-gray-100 text-gray-800",
};

export function DepartmentMembersModal({
  open,
  onOpenChange,
  department,
}: DepartmentMembersModalProps) {
  const { getToken } = useAuth();
  const [members, setMembers] = useState<DepartmentMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [addingUser, setAddingUser] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  // Fetch department members
  const fetchMembers = async () => {
    try {
      const token = await getToken();
      const response = await fetch(
        `/api/organizations/departments/${department.id}/members?includeDetails=true`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch members");
      }

      const data = await response.json();
      setMembers(data.data || []);
    } catch (error) {
      console.error("Error fetching members:", error);
      toast.error("Failed to load department members");
    } finally {
      setLoading(false);
    }
  };

  // Fetch available users (org members not in this department)
  const fetchAvailableUsers = async () => {
    try {
      const token = await getToken();
      const response = await fetch("/api/organizations/members", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      const allUsers = data.data || [];

      // Filter out users already in the department
      const memberIds = members.map((m) => m.userId);
      const available = allUsers.filter((u: User) => !memberIds.includes(u.id));
      setAvailableUsers(available);
    } catch (error) {
      console.error("Error fetching available users:", error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchMembers();
    }
  }, [open, department.id]);

  useEffect(() => {
    if (open && members.length >= 0) {
      fetchAvailableUsers();
    }
  }, [open, members]);

  // Add user to department
  const handleAddUser = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user to add");
      return;
    }

    setAddingUser(true);

    try {
      const token = await getToken();
      const response = await fetch(
        `/api/organizations/departments/${department.id}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId: selectedUserId }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add user");
      }

      toast.success("User added to department");
      setSelectedUserId(null);
      setAddUserOpen(false);
      fetchMembers();
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to add user");
    } finally {
      setAddingUser(false);
    }
  };

  // Remove user from department
  const handleRemoveUser = async (userId: string) => {
    setRemovingUserId(userId);

    try {
      const token = await getToken();
      const response = await fetch(
        `/api/organizations/departments/${department.id}/members/${userId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove user");
      }

      toast.success("User removed from department");
      fetchMembers();
    } catch (error) {
      console.error("Error removing user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to remove user");
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
        .split(" ")
        .map((n) => n[0])
        .join("")
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
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
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add Member
                    </>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="end">
                <Command>
                  <CommandInput placeholder="Search users..." />
                  <CommandEmpty>No users found.</CommandEmpty>
                  <CommandGroup>
                    {availableUsers.map((user) => (
                      <CommandItem
                        key={user.id}
                        onSelect={() => {
                          setSelectedUserId(user.id);
                          handleAddUser();
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedUserId === user.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <Avatar className="w-6 h-6">
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
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  {searchQuery
                    ? "No members found matching your search"
                    : "No members in this department yet"}
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
                        {getInitials(member.user?.name || null, member.user?.email || "")}
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
                            "text-xs",
                            member.user?.role && roleColors[member.user.role as keyof typeof roleColors]
                          )}
                        >
                          {member.user?.role}
                        </Badge>
                      </div>
                      {member.user?.name && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="w-3 h-3" />
                          <span className="truncate">{member.user.email}</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Added {new Date(member.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    {removingUserId === member.userId ? (
                      <div className="h-8 w-8 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleRemoveUser(member.userId)}
                            className="text-destructive"
                          >
                            <UserMinus className="w-4 h-4 mr-2" />
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
                {members.length} {members.length === 1 ? "member" : "members"} total
              </span>
              <span>
                {availableUsers.length} available to add
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}