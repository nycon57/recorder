'use client';

import React from 'react';
import {
  Building2,
  X,
  Edit,
  Trash2,
  Users,
  Calendar,
  Shield,
  Lock,
  Globe,
  FolderOpen,
} from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Separator } from '@/app/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Skeleton } from '@/app/components/ui/skeleton';
import { UserAvatar } from '@/app/components/shared/UserAvatar';
import { RoleBadge } from '@/app/components/shared/RoleBadge';

interface Member {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
  role: 'owner' | 'admin' | 'contributor' | 'reader';
  title: string | null;
}

interface Department {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  default_visibility: 'private' | 'department' | 'org' | 'public';
  created_at: string;
  updated_at: string;
  memberCount?: number;
  members?: Member[];
  parent?: Department;
  children?: Department[];
}

interface DepartmentDetailPanelProps {
  department?: Department & { members?: Member[] };
  onEdit: (department: Department) => void;
  onDelete: (department: Department) => void;
  onClose: () => void;
}

function VisibilityIcon({ visibility }: { visibility: string }) {
  switch (visibility) {
    case 'private':
      return <Lock className="h-4 w-4" />;
    case 'department':
      return <Users className="h-4 w-4" />;
    case 'org':
      return <Building2 className="h-4 w-4" />;
    case 'public':
      return <Globe className="h-4 w-4" />;
    default:
      return <Shield className="h-4 w-4" />;
  }
}

function getVisibilityLabel(visibility: string): { label: string; description: string } {
  switch (visibility) {
    case 'private':
      return { label: 'Private', description: 'Only specific members' };
    case 'department':
      return { label: 'Department', description: 'Department members only' };
    case 'org':
      return { label: 'Organization', description: 'All organization members' };
    case 'public':
      return { label: 'Public', description: 'Anyone with the link' };
    default:
      return { label: visibility, description: '' };
  }
}

export function DepartmentDetailPanel({
  department,
  onEdit,
  onDelete,
  onClose,
}: DepartmentDetailPanelProps) {
  if (!department) {
    return (
      <Card className="w-96 flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-96 flex flex-col max-h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {department.name}
          </CardTitle>
          <CardDescription className="text-xs">
            Department Details
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-6 overflow-y-auto">
        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(department)}
            className="flex-1"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(department)}
            className="flex-1 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>

        <Separator />

        {/* Basic Info */}
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Description</p>
            <p className="text-sm">
              {department.description || 'No description provided'}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Slug</p>
            <code className="text-xs bg-muted px-2 py-1 rounded">{department.slug}</code>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">Default Visibility</p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <VisibilityIcon visibility={department.default_visibility} />
                <span>{getVisibilityLabel(department.default_visibility).label}</span>
              </Badge>
            </div>
            {getVisibilityLabel(department.default_visibility).description && (
              <p className="text-xs text-muted-foreground mt-1">
                {getVisibilityLabel(department.default_visibility).description}
              </p>
            )}
          </div>

          {department.parent && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Parent Department</p>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{department.parent.name}</span>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Members */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              Members ({department.members?.length || 0})
            </p>
          </div>

          {department.members && department.members.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {department.members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 py-2">
                  <UserAvatar
                    user={{
                      name: member.name,
                      email: member.email,
                      avatar_url: member.avatar_url,
                    }}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {member.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {member.title || member.email}
                    </p>
                  </div>
                  <RoleBadge role={member.role} size="sm" />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <Users className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No members in this department</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Metadata */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Created {(() => {
              try {
                const date = new Date(department.created_at);
                return !isNaN(date.getTime()) ? format(date, 'MMM d, yyyy') : 'Unknown';
              } catch {
                return 'Unknown';
              }
            })()}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Updated {(() => {
              try {
                const date = new Date(department.updated_at);
                return !isNaN(date.getTime()) ? format(date, 'MMM d, yyyy') : 'Unknown';
              } catch {
                return 'Unknown';
              }
            })()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}