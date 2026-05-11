'use client';

import { useReducer } from 'react';
import { Building2, ChevronRight, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/app/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { Department } from '@/lib/validations/departments';
import { cn } from '@/lib/utils/cn';

interface CreateDepartmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentDepartment?: Department | null;
  allDepartments: Department[];
  onSuccess: () => void;
}

const visibilityOptions = [
  {
    value: 'private',
    label: 'Private',
    description: 'Only department members can access',
  },
  {
    value: 'department',
    label: 'Department',
    description: 'Department and sub-departments can access',
  },
  {
    value: 'org',
    label: 'Organization',
    description: 'All organization members can access',
  },
  {
    value: 'public',
    label: 'Public',
    description: 'Anyone with the link can access',
  },
];

type FlatDepartment = Department & { level: number; path: string[] };

type CreateDepartmentFormState = {
  loading: boolean;
  name: string;
  slugOverride: string | null;
  description: string;
  selectedParentIdOverride: string | null | undefined;
  visibility: string;
  parentSelectorOpen: boolean;
};

type CreateDepartmentFormAction =
  | { type: 'patch'; patch: Partial<CreateDepartmentFormState> }
  | { type: 'reset' };

const initialCreateDepartmentFormState: CreateDepartmentFormState = {
  loading: false,
  name: '',
  slugOverride: null,
  description: '',
  selectedParentIdOverride: undefined,
  visibility: 'department',
  parentSelectorOpen: false,
};

function createDepartmentFormReducer(
  state: CreateDepartmentFormState,
  action: CreateDepartmentFormAction,
): CreateDepartmentFormState {
  if (action.type === 'reset') {
    return initialCreateDepartmentFormState;
  }

  return { ...state, ...action.patch };
}

function generateDepartmentSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildFlatDepartmentList(
  deps: Department[],
  level = 0,
  parentPath: string[] = [],
): FlatDepartment[] {
  return deps.flatMap((dept) => {
    const currentPath = [...parentPath, dept.name];
    const current = { ...dept, level, path: currentPath };
    const children =
      dept.children && dept.children.length > 0
        ? buildFlatDepartmentList(dept.children, level + 1, currentPath)
        : [];
    return [current, ...children];
  });
}

export function CreateDepartmentModal(
  props: Parameters<typeof useCreateDepartmentModalImplementation>[0],
) {
  return useCreateDepartmentModalImplementation(props);
}

function useCreateDepartmentModalImplementation({
  open,
  onOpenChange,
  parentDepartment,
  allDepartments,
  onSuccess,
}: CreateDepartmentModalProps) {
  const [formState, dispatchForm] = useReducer(
    createDepartmentFormReducer,
    initialCreateDepartmentFormState,
  );
  const {
    loading,
    name,
    slugOverride,
    description,
    selectedParentIdOverride,
    visibility,
    parentSelectorOpen,
  } = formState;
  const slug = slugOverride ?? generateDepartmentSlug(name);
  const selectedParentId =
    selectedParentIdOverride === undefined
      ? (parentDepartment?.id ?? null)
      : selectedParentIdOverride;
  const flatDepartments = buildFlatDepartmentList(allDepartments);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Department name is required');
      return;
    }

    if (!slug.trim()) {
      toast.error('Department slug is required');
      return;
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast.error(
        'Slug can only contain lowercase letters, numbers, and hyphens',
      );
      return;
    }

    dispatchForm({ type: 'patch', patch: { loading: true } });

    try {
      const response = await fetch('/api/organizations/departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          parentId: selectedParentId,
          defaultVisibility: visibility,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create department');
      }

      toast.success('Department created successfully');
      onSuccess();
      resetForm();
    } catch (error) {
      console.error('Error creating department:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to create department',
      );
    } finally {
      dispatchForm({ type: 'patch', patch: { loading: false } });
    }
  };

  const resetForm = () => {
    dispatchForm({ type: 'reset' });
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onOpenChange(false);
    }
  };

  const selectedParent = flatDepartments.find((d) => d.id === selectedParentId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Department</DialogTitle>
          <DialogDescription>
            Create a new department to organize your team and content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Department Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Department Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Engineering, Marketing"
              value={name}
              onChange={(e) =>
                dispatchForm({
                  type: 'patch',
                  patch: { name: e.target.value, slugOverride: null },
                })
              }
              disabled={loading}
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug *</Label>
            <Input
              id="slug"
              placeholder="e.g., engineering, marketing"
              value={slug}
              onChange={(e) =>
                dispatchForm({
                  type: 'patch',
                  patch: { slugOverride: e.target.value },
                })
              }
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Used in URLs and must be unique. Only lowercase letters, numbers,
              and hyphens.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the purpose of this department..."
              value={description}
              onChange={(e) =>
                dispatchForm({
                  type: 'patch',
                  patch: { description: e.target.value },
                })
              }
              disabled={loading}
              rows={3}
            />
          </div>

          {/* Parent Department */}
          <div className="space-y-2">
            <Label>Parent Department</Label>
            <Popover
              open={parentSelectorOpen}
              onOpenChange={(nextOpen) =>
                dispatchForm({
                  type: 'patch',
                  patch: { parentSelectorOpen: nextOpen },
                })
              }
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={parentSelectorOpen}
                  aria-controls="create-department-parent-list"
                  className="w-full justify-between"
                  disabled={loading}
                >
                  {selectedParent ? (
                    <div className="flex items-center gap-1 truncate">
                      {selectedParent.path.map((p, i) => (
                        <span
                          key={JSON.stringify(p)}
                          className="flex items-center gap-1"
                        >
                          {i > 0 && <ChevronRight className="size-3" />}
                          <span>{p}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span>No parent (top-level department)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command id="create-department-parent-list">
                  <CommandInput placeholder="Search departments..." />
                  <CommandEmpty>No department found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        dispatchForm({
                          type: 'patch',
                          patch: {
                            selectedParentIdOverride: null,
                            parentSelectorOpen: false,
                          },
                        });
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 size-4',
                          selectedParentId === null
                            ? 'opacity-100'
                            : 'opacity-0',
                        )}
                      />
                      <span>No parent (top-level)</span>
                    </CommandItem>
                    {flatDepartments.map((dept) => (
                      <CommandItem
                        key={dept.id}
                        onSelect={() => {
                          dispatchForm({
                            type: 'patch',
                            patch: {
                              selectedParentIdOverride: dept.id,
                              parentSelectorOpen: false,
                            },
                          });
                        }}
                      >
                        <Check
                          className={cn(
                            'mr-2 size-4',
                            selectedParentId === dept.id
                              ? 'opacity-100'
                              : 'opacity-0',
                          )}
                        />
                        <div
                          className="flex items-center gap-1"
                          style={{ marginLeft: `${dept.level * 12}px` }}
                        >
                          <Building2 className="size-3" />
                          <span>{dept.name}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Default Visibility */}
          <div className="space-y-2">
            <Label htmlFor="visibility">Default Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(nextVisibility) =>
                dispatchForm({
                  type: 'patch',
                  patch: { visibility: nextVisibility },
                })
              }
              disabled={loading}
            >
              <SelectTrigger id="visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visibilityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {option.description}
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Warning for public visibility */}
          {visibility === 'public' && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertDescription>
                Public departments can be accessed by anyone with the link. Make
                sure this is intended before proceeding.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Department'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
