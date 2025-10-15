'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Briefcase, Check } from 'lucide-react';
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
import { Checkbox } from '@/app/components/ui/checkbox';
import { ScrollArea } from '@/app/components/ui/scroll-area';

import type { OrganizationMember, Department } from '../types';

interface AssignDepartmentsModalProps {
  member: OrganizationMember;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignDepartmentsModal({
  member,
  open,
  onClose,
  onSuccess,
}: AssignDepartmentsModalProps) {
  const [selectedDepts, setSelectedDepts] = useState<string[]>(
    member.departments?.map((d) => d.id) || []
  );

  // Fetch available departments
  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await fetch('/api/organizations/departments');
      if (!response.ok) throw new Error('Failed to fetch departments');
      const data = await response.json();
      return data.data || [];
    },
    enabled: open,
  });

  // Update selected departments when modal opens
  useEffect(() => {
    if (open) {
      setSelectedDepts(member.departments?.map((d) => d.id) || []);
    }
  }, [open, member.departments]);

  const updateDepartmentsMutation = useMutation({
    mutationFn: async (departmentIds: string[]) => {
      const response = await fetch(`/api/organizations/members/${member.id}/departments`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_ids: departmentIds }),
      });
      if (!response.ok) throw new Error('Failed to update departments');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Member departments updated successfully');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update departments');
    },
  });

  const handleToggleDepartment = (deptId: string) => {
    setSelectedDepts((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateDepartmentsMutation.mutate(selectedDepts);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="h-5 w-5" />
            Assign Departments
          </DialogTitle>
          <DialogDescription>
            Assign <strong>{member.name || member.email}</strong> to departments
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Label className="mb-3 block">Departments</Label>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" />
              </div>
            ) : departments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No departments available. Create departments first.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[300px] rounded-md border p-4">
                <div className="space-y-3">
                  {departments.map((dept: Department) => (
                    <div key={dept.id} className="flex items-start space-x-3">
                      <Checkbox
                        id={dept.id}
                        checked={selectedDepts.includes(dept.id)}
                        onCheckedChange={() => handleToggleDepartment(dept.id)}
                      />
                      <label
                        htmlFor={dept.id}
                        className="flex-1 cursor-pointer text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {dept.name}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={updateDepartmentsMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateDepartmentsMutation.isPending || departments.length === 0}
            >
              {updateDepartmentsMutation.isPending ? 'Updating...' : 'Update Departments'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
