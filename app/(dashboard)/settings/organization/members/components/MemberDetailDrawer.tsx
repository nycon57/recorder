'use client';

import React from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import {
  X,
  User,
  Mail,
  Shield,
  Calendar,
  Activity,
  Building2,
  Edit,
  Trash2,
  MoreVertical,
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Separator } from '@/app/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';

import { UserAvatar } from '@/app/components/shared/UserAvatar';
import { RoleBadge } from '@/app/components/shared/RoleBadge';

interface Department {
  id: string;
  name: string;
  slug: string;
}

interface OrganizationMember {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
  role: 'owner' | 'admin' | 'contributor' | 'reader';
  departments?: Department[];
  status: string;
  last_active_at?: string | null;
  created_at: string;
  updated_at: string;
  title?: string | null;
  phone?: string | null;
  location?: string | null;
}

interface MemberDetailDrawerProps {
  member: OrganizationMember | null;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

function StatusBadge({ status }: { status: string }) {
  const variants = {
    active: { variant: 'default' as const, label: 'Active', color: 'text-green-600' },
    pending: { variant: 'secondary' as const, label: 'Pending', color: 'text-yellow-600' },
    suspended: { variant: 'destructive' as const, label: 'Suspended', color: 'text-red-600' },
    deleted: { variant: 'outline' as const, label: 'Deleted', color: 'text-gray-600' },
  };

  const config = variants[status as keyof typeof variants] || variants.active;

  return (
    <Badge variant={config.variant}>
      <span className={config.color}>●</span>
      <span className="ml-1">{config.label}</span>
    </Badge>
  );
}

export function MemberDetailDrawer({
  member,
  open,
  onClose,
  onUpdate,
}: MemberDetailDrawerProps) {
  if (!member) return null;

  const handleEdit = () => {
    // This would typically open an edit modal or navigate to edit page
    console.log('Edit member:', member.id);
    onUpdate();
  };

  const handleDelete = () => {
    if (confirm(`Are you sure you want to remove ${member.name || member.email}?`)) {
      // Delete logic here
      console.log('Delete member:', member.id);
      onUpdate();
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle>Member Details</SheetTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Details
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive"
                  disabled={member.role === 'owner'}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove Member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <SheetDescription>
            View and manage member information
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Profile Section */}
          <div className="flex items-start gap-4">
            <UserAvatar
              user={{
                name: member.name,
                email: member.email,
                avatar_url: member.avatar_url,
              }}
              size="lg"
            />
            <div className="flex-1 space-y-1">
              <h3 className="text-lg font-semibold">
                {member.name || 'Unknown'}
              </h3>
              {member.title && (
                <p className="text-sm text-muted-foreground">{member.title}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <RoleBadge role={member.role} />
                <StatusBadge status={member.status} />
              </div>
            </div>
          </div>

          <Separator />

          {/* Contact Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Contact Information</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{member.email}</span>
              </div>
              {member.phone && (
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{member.phone}</span>
                </div>
              )}
              {member.location && (
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{member.location}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Departments */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Departments</h4>
            {member.departments && member.departments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {member.departments.map((dept) => (
                  <Badge key={dept.id} variant="outline">
                    <Building2 className="h-3 w-3 mr-1" />
                    {dept.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No departments assigned
              </p>
            )}
          </div>

          <Separator />

          {/* Activity Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Activity</h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Active</span>
                <span className="text-sm">
                  {member.last_active_at
                    ? formatDistanceToNow(new Date(member.last_active_at), {
                        addSuffix: true,
                      })
                    : 'Never'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Member Since</span>
                <span className="text-sm">
                  {format(new Date(member.created_at), 'MMM d, yyyy')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Last Updated</span>
                <span className="text-sm">
                  {format(new Date(member.updated_at), 'MMM d, yyyy')}
                </span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-3">
            <Button className="w-full" onClick={handleEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit Member
            </Button>
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={member.role === 'owner'}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Member
            </Button>
            {member.role === 'owner' && (
              <p className="text-xs text-muted-foreground text-center">
                Owner accounts cannot be removed. Transfer ownership in organization settings.
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}