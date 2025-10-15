'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Users, Shield } from 'lucide-react';
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { DepartmentSelector } from '@/app/components/shared/DepartmentSelector';
import { updateMemberSchema } from '@/lib/validations/organizations';

interface Department {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
}

interface Member {
  id: string;
  name: string | null;
  email: string;
  role: 'owner' | 'admin' | 'contributor' | 'reader';
  departments?: Department[];
  status: string;
}

interface EditMemberModalProps {
  open: boolean;
  onClose: () => void;
  member: Member | null;
  departments: Department[];
}

type FormValues = z.infer<typeof updateMemberSchema>;

async function updateMember(id: string, data: FormValues): Promise<void> {
  const res = await fetch(`/api/organizations/members/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to update member');
  }
}

export function EditMemberModal({
  open,
  onClose,
  member,
  departments,
}: EditMemberModalProps) {
  const queryClient = useQueryClient();
  const [currentUserRole, setCurrentUserRole] = useState<string>('admin'); // This would come from auth context

  const form = useForm<FormValues>({
    resolver: zodResolver(updateMemberSchema),
    defaultValues: {
      role: member?.role || 'reader',
      department_ids: member?.departments?.map((d) => d.id) || [],
      status: (member?.status as 'active' | 'suspended') || 'active',
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FormValues) => updateMember(member!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Member updated successfully');
      onClose();
      form.reset();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update member');
    },
  });

  const handleSubmit = (values: FormValues) => {
    if (!member) return;
    updateMutation.mutate(values);
  };

  if (!member) return null;

  // Check if current user can modify this member
  const canEditRole = currentUserRole === 'owner' ||
    (currentUserRole === 'admin' && member.role !== 'owner' && member.role !== 'admin');

  const canEditStatus = currentUserRole === 'owner' || currentUserRole === 'admin';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Member</DialogTitle>
          <DialogDescription>
            Update role and department assignments for {member.name || member.email}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Role */}
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Role
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={!canEditRole}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {currentUserRole === 'owner' && (
                        <>
                          <SelectItem value="owner">Owner</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </>
                      )}
                      {currentUserRole === 'admin' && member.role !== 'owner' && (
                        <SelectItem value="admin">Admin</SelectItem>
                      )}
                      <SelectItem value="contributor">Contributor</SelectItem>
                      <SelectItem value="reader">Reader</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {!canEditRole
                      ? "You don't have permission to change this member's role."
                      : 'Set the access level for this member.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Departments */}
            <FormField
              control={form.control}
              name="department_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Departments
                  </FormLabel>
                  <FormControl>
                    <DepartmentSelector
                      departments={departments}
                      value={field.value || []}
                      onChange={field.onChange}
                      placeholder="Select departments..."
                      multiple={true}
                    />
                  </FormControl>
                  <FormDescription>
                    Assign this member to one or more departments.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status */}
            {canEditStatus && member.role !== 'owner' && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Suspended members cannot access the organization.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {member.role === 'owner' && (
              <Alert>
                <AlertDescription>
                  Owner accounts have full access and their role cannot be changed.
                  To transfer ownership, please use the organization settings.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update Member
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}