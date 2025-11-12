'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MoreVertical,
  Edit,
  Eye,
  Mail,
  Shield,
  Ban,
  Trash2,
  UserX,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/app/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { ConfirmationDialog } from '@/app/components/ui/confirmation-dialog';

import type { OrganizationMember } from '../types';

import { EditRoleModal } from './EditRoleModal';
import { AssignDepartmentsModal } from './AssignDepartmentsModal';

interface MemberRowActionsProps {
  member: OrganizationMember;
}

export function MemberRowActions({ member }: MemberRowActionsProps) {
  const queryClient = useQueryClient();
  const [showEditRole, setShowEditRole] = useState(false);
  const [showAssignDepts, setShowAssignDepts] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Suspend/unsuspend mutation
  const suspendMutation = useMutation({
    mutationFn: async (suspend: boolean) => {
      const response = await fetch(`/api/organizations/members/${member.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: suspend ? 'suspended' : 'active' }),
      });
      if (!response.ok) throw new Error('Failed to update member status');
      const data = await response.json();
      return { ...data, suspend };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      toast.success(
        data.suspend
          ? 'Member suspended successfully'
          : 'Member reactivated successfully'
      );
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update member status');
    },
  });

  // Send password reset mutation
  const passwordResetMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/organizations/members/${member.id}/password-reset`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to send password reset');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Password reset email sent');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send password reset');
    },
  });

  // Delete member mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/organizations/members/${member.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove member');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization-members'] });
      toast.success('Member removed successfully');
      setShowDeleteConfirm(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove member');
    },
  });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setShowEditRole(true)}>
            <Shield className="mr-2 h-4 w-4" />
            Edit Role
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowAssignDepts(true)}>
            <Edit className="mr-2 h-4 w-4" />
            Assign Departments
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => passwordResetMutation.mutate()}>
            <Mail className="mr-2 h-4 w-4" />
            Send Password Reset
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {member.status === 'suspended' ? (
            <DropdownMenuItem onClick={() => suspendMutation.mutate(false)}>
              <ShieldAlert className="mr-2 h-4 w-4" />
              Reactivate Account
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={() => suspendMutation.mutate(true)}
              className="text-yellow-600"
            >
              <Ban className="mr-2 h-4 w-4" />
              Suspend Account
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove from Organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Role Modal */}
      <EditRoleModal
        member={member}
        open={showEditRole}
        onClose={() => setShowEditRole(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['organization-members'] });
          setShowEditRole(false);
        }}
      />

      {/* Assign Departments Modal */}
      <AssignDepartmentsModal
        member={member}
        open={showAssignDepts}
        onClose={() => setShowAssignDepts(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['organization-members'] });
          setShowAssignDepts(false);
        }}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Remove Member"
        description={`Are you sure you want to remove ${member.name || member.email} from the organization? This action cannot be undone.`}
        confirmText="Remove Member"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
        useAlertDialog
      />
    </>
  );
}
