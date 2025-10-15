'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2 } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';

interface Department {
  id: string;
  name: string;
  memberCount?: number;
  children?: Department[];
}

interface DeleteDepartmentModalProps {
  open: boolean;
  onClose: () => void;
  department: Department | null;
  departments: Department[];
}

async function deleteDepartment(id: string): Promise<void> {
  const res = await fetch(`/api/organizations/departments/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Failed to delete department');
  }
}

export function DeleteDepartmentModal({
  open,
  onClose,
  department,
  departments,
}: DeleteDepartmentModalProps) {
  const queryClient = useQueryClient();
  const [confirmText, setConfirmText] = useState('');

  const deleteMutation = useMutation({
    mutationFn: deleteDepartment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department deleted successfully');
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete department');
    },
  });

  if (!department) return null;

  // Check if department has children or members
  const hasChildren = department.children && department.children.length > 0;
  const hasMembersOnly = department.memberCount && department.memberCount > 0 && !hasChildren;
  const hasContent = hasChildren || hasMembersOnly;

  const handleDelete = () => {
    if (hasContent && confirmText !== department.name) {
      toast.error('Please type the department name to confirm');
      return;
    }
    deleteMutation.mutate(department.id);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Delete Department</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{department.name}</strong>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {hasContent && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>
              {hasChildren && (
                <div className="mb-2">
                  This department has {department.children?.length} child department(s).
                  All child departments will also be deleted.
                </div>
              )}
              {hasMembersOnly && (
                <div>
                  This department has {department.memberCount} member(s).
                  Members will be removed from this department.
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {hasContent && (
          <div className="space-y-2">
            <label htmlFor="confirm-delete" className="text-sm font-medium">
              Type <strong>{department.name}</strong> to confirm deletion:
            </label>
            <input
              id="confirm-delete"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              placeholder={department.name}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={
              deleteMutation.isPending || (hasContent && confirmText !== department.name)
            }
          >
            {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete Department
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}