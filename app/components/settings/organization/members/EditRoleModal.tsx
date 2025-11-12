'use client';

import React from 'react';
import { toast } from 'sonner';

import { editRoleFormSchema } from '@/lib/validations/api';

import { FormDialog } from '@/app/components/ui/form-dialog';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/app/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

interface OrganizationMember {
  id: string;
  name?: string;
  email: string;
  role: 'owner' | 'admin' | 'contributor' | 'reader';
}

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
  const handleSubmit = async (data: { role: string }) => {
    // Skip if role hasn't changed
    if (data.role === member.role) {
      onClose();
      return;
    }

    const response = await fetch(`/api/organizations/members/${member.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: data.role }),
    });

    if (!response.ok) {
      throw new Error('Failed to update role');
    }

    return response.json();
  };

  return (
    <FormDialog
      key={member.id}
      open={open}
      onOpenChange={(newOpen) => !newOpen && onClose()}
      title="Edit Member Role"
      description={`Change the role for ${member.name || member.email}`}
      size="md"
      schema={editRoleFormSchema as any}
      defaultValues={{
        role: member.role,
      }}
      mutationFn={handleSubmit}
      successMessage="Member role updated successfully"
      errorMessage="Failed to update role"
      submitLabel="Update Role"
      loadingLabel="Updating..."
      onSuccess={() => {
        toast.success('Member role updated successfully');
        onSuccess();
      }}
      onError={(error: Error) => {
        toast.error(error.message || 'Failed to update role');
      }}
      className="sm:max-w-[500px]"
    >
      {(form) => (
        <>
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
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
              </FormItem>
            )}
          />

          {form.watch('role') === 'owner' && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-sm text-amber-800">
                <strong>Warning:</strong> Changing this member to Owner will give them full
                administrative access to the organization.
              </p>
            </div>
          )}
        </>
      )}
    </FormDialog>
  );
}
