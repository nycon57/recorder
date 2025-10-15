'use client';

import React, { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

import type { OrganizationMember } from '../types';

interface EditRoleModalProps {
  member: OrganizationMember;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const ROLES = [
  { value: 'owner', label: 'Owner', description: 'Full access to everything' },
  { value: 'admin', label: 'Admin', description: 'Can manage members and settings' },
  { value: 'contributor', label: 'Contributor', description: 'Can create and edit content' },
  { value: 'reader', label: 'Reader', description: 'Can only view content' },
] as const;

export function EditRoleModal({ member, open, onClose, onSuccess }: EditRoleModalProps) {
  const [selectedRole, setSelectedRole] = useState<string>(member.role);

  useEffect(() => {
    if (open) {
      setSelectedRole(member.role);
    }
  }, [open, member.role]);

  const updateRoleMutation = useMutation({
    mutationFn: async (role: string) => {
      const response = await fetch(`/api/organizations/members/${member.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error('Failed to update role');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Member role updated successfully');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update role');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRole === member.role) {
      onClose();
      return;
    }
    updateRoleMutation.mutate(selectedRole);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Edit Member Role
          </DialogTitle>
          <DialogDescription>
            Change the role for <strong>{member.name || member.email}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{role.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {role.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRole === 'owner' && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm text-amber-800">
                  <strong>Warning:</strong> Changing this member to Owner will give them full
                  administrative access to the organization.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateRoleMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateRoleMutation.isPending}>
              {updateRoleMutation.isPending ? 'Updating...' : 'Update Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
