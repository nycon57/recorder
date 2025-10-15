'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/app/components/ui/radio-group';

// Form schema
const formSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  parentId: z.string().nullable().optional(),
  defaultVisibility: z.enum(['private', 'department', 'org', 'public']),
});

type FormData = z.infer<typeof formSchema>;

interface Department {
  id: string;
  name: string;
  parent_id: string | null;
  default_visibility: string;
  description?: string | null;
  children?: Department[];
}

interface DepartmentFormModalProps {
  open: boolean;
  onClose: () => void;
  department?: Department | null;
  departments: Department[];
}

export function DepartmentFormModal({
  open,
  onClose,
  department,
  departments,
}: DepartmentFormModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!department?.id;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      parentId: null,
      defaultVisibility: 'department',
    },
  });

  // Update slug preview
  const name = watch('name');
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  // Populate form when editing
  useEffect(() => {
    if (department) {
      reset({
        name: department.name || '',
        description: department.description || '',
        parentId: department.parent_id || null,
        defaultVisibility: (department.default_visibility as any) || 'department',
      });
    } else {
      reset({
        name: '',
        description: '',
        parentId: null,
        defaultVisibility: 'department',
      });
    }
  }, [department, reset]);

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const url = isEditing
        ? `/api/organizations/departments/${department.id}`
        : '/api/organizations/departments';

      const res = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description || null,
          parentId: data.parentId || null,
          defaultVisibility: data.defaultVisibility,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || 'Failed to save department');
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success(isEditing ? 'Department updated successfully' : 'Department created successfully');
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  // Filter out current department and its descendants for parent selection
  const getAvailableParents = () => {
    if (!isEditing) return departments;

    const getAllDescendants = (deptId: string): string[] => {
      const dept = departments.find((d) => d.id === deptId);
      if (!dept) return [];

      const descendants = [deptId];
      departments
        .filter((d) => d.parent_id === deptId)
        .forEach((child) => {
          descendants.push(...getAllDescendants(child.id));
        });

      return descendants;
    };

    const excludedIds = getAllDescendants(department!.id);
    return departments.filter((d) => !excludedIds.includes(d.id));
  };

  const availableParents = getAvailableParents();

  // Build parent options with indentation
  const buildParentOptions = (parents: Department[], parentId: string | null = null, level = 0): JSX.Element[] => {
    return parents
      .filter((d) => d.parent_id === parentId)
      .flatMap((dept) => [
        <SelectItem key={dept.id} value={dept.id}>
          {'  '.repeat(level) + dept.name}
        </SelectItem>,
        ...buildParentOptions(parents, dept.id, level + 1),
      ]);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Department' : 'Create Department'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the department information below.'
              : 'Add a new department to your organization hierarchy.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Engineering, Marketing, Sales..."
              autoFocus
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            {slug && (
              <p className="text-sm text-muted-foreground">
                Slug: <code className="bg-muted px-1.5 py-0.5 rounded">{slug}</code>
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="A brief description of this department..."
              rows={3}
            />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>

          {/* Parent Department */}
          <div className="space-y-2">
            <Label htmlFor="parentId">Parent Department</Label>
            <Select
              value={watch('parentId') || 'none'}
              onValueChange={(value) => setValue('parentId', value === 'none' ? null : value)}
            >
              <SelectTrigger id="parentId">
                <SelectValue placeholder="None (Root Department)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Root Department)</SelectItem>
                {buildParentOptions(availableParents)}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Optional: Set a parent to create a nested department structure
            </p>
          </div>

          {/* Default Visibility */}
          <div className="space-y-3">
            <Label>Default Content Visibility</Label>
            <RadioGroup
              value={watch('defaultVisibility')}
              onValueChange={(value) => setValue('defaultVisibility', value as any)}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="private" id="private" className="mt-1" />
                <Label htmlFor="private" className="cursor-pointer font-normal flex-1">
                  <div className="font-medium">Private</div>
                  <div className="text-sm text-muted-foreground">
                    Only visible to the creator
                  </div>
                </Label>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="department" id="department" className="mt-1" />
                <Label htmlFor="department" className="cursor-pointer font-normal flex-1">
                  <div className="font-medium">Department</div>
                  <div className="text-sm text-muted-foreground">
                    Visible to members of this department
                  </div>
                </Label>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="org" id="org" className="mt-1" />
                <Label htmlFor="org" className="cursor-pointer font-normal flex-1">
                  <div className="font-medium">Organization</div>
                  <div className="text-sm text-muted-foreground">
                    Visible to all organization members
                  </div>
                </Label>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="public" id="public" className="mt-1" />
                <Label htmlFor="public" className="cursor-pointer font-normal flex-1">
                  <div className="font-medium">Public</div>
                  <div className="text-sm text-muted-foreground">
                    Visible to anyone with the link
                  </div>
                </Label>
              </div>
            </RadioGroup>
            <p className="text-sm text-muted-foreground">
              This will be the default visibility for content created in this department
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Department'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
