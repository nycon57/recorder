'use client';

import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { ConfirmationDialog, type ConfirmationWarning } from '@/app/components/ui/confirmation-dialog';

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
    try {
      const error = await res.json();
      throw new Error(error.message || 'Failed to delete department');
    } catch (parseError) {
      const textError = await res.text();
      throw new Error(textError || 'Failed to delete department');
    }
  }
}

export function DeleteDepartmentModal({
  open,
  onClose,
  department,
  departments,
}: DeleteDepartmentModalProps) {
  const queryClient = useQueryClient();

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
  const hasMembers = department.memberCount && department.memberCount > 0;
  const hasContent = hasChildren || hasMembers;

  // Build warnings array
  const warnings: ConfirmationWarning[] = [];
  if (hasChildren) {
    warnings.push({
      title: 'Warning',
      message: `This department has ${department.children?.length} child department(s). All child departments will also be deleted.`,
      variant: 'destructive',
    });
  }
  if (hasMembers) {
    warnings.push({
      title: 'Warning',
      message: `This department has ${department.memberCount} member(s). Members will be removed from this department.`,
      variant: 'destructive',
    });
  }

  const handleConfirm = () => {
    deleteMutation.mutate(department.id);
  };

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onClose}
      title="Delete Department"
      description={`Are you sure you want to delete ${department.name}? This action cannot be undone.`}
      confirmText="Delete Department"
      cancelText="Cancel"
      variant="destructive"
      requireTypedConfirmation={hasContent ? department.name : false}
      warnings={warnings}
      isLoading={deleteMutation.isPending}
      onConfirm={handleConfirm}
    />
  );
}