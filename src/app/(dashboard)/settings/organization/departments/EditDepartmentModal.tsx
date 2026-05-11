'use client';

import { useReducer } from 'react';
import {
  Building2,
  ChevronRight,
  Check,
  AlertCircle,
  Info,
  Loader2,
} from 'lucide-react';
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

interface EditDepartmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department;
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

type DepartmentVisibility = Department['defaultVisibility'];

interface EditDepartmentDraft {
  name: string;
  description: string;
  selectedParentId: string | null;
  visibility: DepartmentVisibility;
}

interface EditDepartmentState {
  loading: boolean;
  draft: EditDepartmentDraft | null;
  parentSelectorOpen: boolean;
}

type EditDepartmentAction =
  | { type: 'reset' }
  | { type: 'set-loading'; loading: boolean }
  | { type: 'set-name'; value: string; fallback: EditDepartmentDraft }
  | { type: 'set-description'; value: string; fallback: EditDepartmentDraft }
  | {
      type: 'set-parent';
      value: string | null;
      fallback: EditDepartmentDraft;
    }
  | {
      type: 'set-visibility';
      value: DepartmentVisibility;
      fallback: EditDepartmentDraft;
    }
  | { type: 'set-parent-selector-open'; open: boolean };

function getDepartmentDraft(department: Department): EditDepartmentDraft {
  return {
    name: department.name,
    description: department.description || '',
    selectedParentId: department.parentId,
    visibility: department.defaultVisibility,
  };
}

function editDepartmentReducer(
  state: EditDepartmentState,
  action: EditDepartmentAction,
): EditDepartmentState {
  switch (action.type) {
    case 'reset':
      return {
        loading: false,
        draft: null,
        parentSelectorOpen: false,
      };
    case 'set-loading':
      return {
        ...state,
        loading: action.loading,
      };
    case 'set-name':
      return {
        ...state,
        draft: { ...(state.draft ?? action.fallback), name: action.value },
      };
    case 'set-description':
      return {
        ...state,
        draft: {
          ...(state.draft ?? action.fallback),
          description: action.value,
        },
      };
    case 'set-parent':
      return {
        ...state,
        draft: {
          ...(state.draft ?? action.fallback),
          selectedParentId: action.value,
        },
      };
    case 'set-visibility':
      return {
        ...state,
        draft: {
          ...(state.draft ?? action.fallback),
          visibility: action.value,
        },
      };
    case 'set-parent-selector-open':
      return {
        ...state,
        parentSelectorOpen: action.open,
      };
    default:
      return state;
  }
}

const INITIAL_EDIT_DEPARTMENT_STATE: EditDepartmentState = {
  loading: false,
  draft: null,
  parentSelectorOpen: false,
};

export function EditDepartmentModal(
  props: Parameters<typeof useEditDepartmentModalImplementation>[0],
) {
  return useEditDepartmentModalImplementation(props);
}

function useEditDepartmentModalImplementation({
  open,
  onOpenChange,
  department,
  allDepartments,
  onSuccess,
}: EditDepartmentModalProps) {
  const [state, dispatch] = useReducer(
    editDepartmentReducer,
    INITIAL_EDIT_DEPARTMENT_STATE,
  );
  const fallbackDraft = getDepartmentDraft(department);
  const draft = state.draft ?? fallbackDraft;
  const { loading, parentSelectorOpen } = state;

  // Get all descendant IDs to prevent circular references
  const getDescendantIds = (dept: Department): string[] => {
    let ids = [dept.id];
    if (dept.children) {
      dept.children.forEach((child) => {
        ids = ids.concat(getDescendantIds(child));
      });
    }
    return ids;
  };

  const descendantIds = getDescendantIds(department);

  // Build flat list of departments with hierarchy indication
  const buildFlatList = (
    deps: Department[],
    level = 0,
    parentPath: string[] = [],
  ): Array<
    Department & { level: number; path: string[]; disabled: boolean }
  > => {
    let result: Array<
      Department & { level: number; path: string[]; disabled: boolean }
    > = [];

    deps.forEach((dept) => {
      const currentPath = [...parentPath, dept.name];
      // Disable if it's the current department or a descendant
      const disabled = descendantIds.includes(dept.id);
      result.push({ ...dept, level, path: currentPath, disabled });

      if (dept.children && dept.children.length > 0) {
        result = result.concat(
          buildFlatList(dept.children, level + 1, currentPath),
        );
      }
    });

    return result;
  };

  const flatDepartments = buildFlatList(allDepartments);

  const handleSubmit = async () => {
    if (!draft.name.trim()) {
      toast.error('Department name is required');
      return;
    }

    // Check for circular reference
    if (
      draft.selectedParentId &&
      descendantIds.includes(draft.selectedParentId)
    ) {
      toast.error(
        'Cannot set a child department as parent (circular reference)',
      );
      return;
    }

    dispatch({ type: 'set-loading', loading: true });

    try {
      // Only send changed fields
      const updates: any = {};
      if (draft.name !== department.name) updates.name = draft.name.trim();
      if (draft.description !== (department.description || '')) {
        updates.description = draft.description.trim() || null;
      }
      if (draft.selectedParentId !== department.parentId) {
        updates.parentId = draft.selectedParentId;
      }
      if (draft.visibility !== department.defaultVisibility) {
        updates.defaultVisibility = draft.visibility;
      }

      // Only make request if there are changes
      if (Object.keys(updates).length === 0) {
        toast.info('No changes made');
        dispatch({ type: 'reset' });
        onOpenChange(false);
        return;
      }

      const response = await fetch(
        `/api/organizations/departments/${department.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updates),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update department');
      }

      toast.success('Department updated successfully');
      dispatch({ type: 'reset' });
      onSuccess();
    } catch (error) {
      console.error('Error updating department:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to update department',
      );
    } finally {
      dispatch({ type: 'set-loading', loading: false });
    }
  };

  const handleClose = () => {
    if (!loading) {
      dispatch({ type: 'reset' });
      onOpenChange(false);
    }
  };

  const selectedParent = flatDepartments.find(
    (d) => d.id === draft.selectedParentId,
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Department</DialogTitle>
          <DialogDescription>
            Update the department information and settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Department Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Department Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Engineering, Marketing"
              value={draft.name}
              onChange={(e) =>
                dispatch({
                  type: 'set-name',
                  value: e.target.value,
                  fallback: fallbackDraft,
                })
              }
              disabled={loading}
            />
          </div>

          {/* Slug (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug</Label>
            <div className="flex items-center gap-2">
              <Input
                id="slug"
                value={department.slug}
                disabled
                className="bg-muted"
              />
              <Info className="size-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              Slug cannot be changed after creation to maintain URL consistency.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the purpose of this department…"
              value={draft.description}
              onChange={(e) =>
                dispatch({
                  type: 'set-description',
                  value: e.target.value,
                  fallback: fallbackDraft,
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
                dispatch({
                  type: 'set-parent-selector-open',
                  open: nextOpen,
                })
              }
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={parentSelectorOpen}
                  aria-controls="edit-department-parent-list"
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
                <Command id="edit-department-parent-list">
                  <CommandInput placeholder="Search departments…" />
                  <CommandEmpty>No department found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        dispatch({
                          type: 'set-parent',
                          value: null,
                          fallback: fallbackDraft,
                        });
                        dispatch({
                          type: 'set-parent-selector-open',
                          open: false,
                        });
                      }}
                    >
                      <Check
                        className={cn(
                          'mr-2 size-4',
                          draft.selectedParentId === null
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
                          if (!dept.disabled) {
                            dispatch({
                              type: 'set-parent',
                              value: dept.id,
                              fallback: fallbackDraft,
                            });
                            dispatch({
                              type: 'set-parent-selector-open',
                              open: false,
                            });
                          }
                        }}
                        disabled={dept.disabled}
                      >
                        <Check
                          className={cn(
                            'mr-2 size-4',
                            draft.selectedParentId === dept.id
                              ? 'opacity-100'
                              : 'opacity-0',
                          )}
                        />
                        <div
                          className={cn(
                            'flex items-center gap-1',
                            dept.disabled && 'opacity-50',
                          )}
                          style={{ marginLeft: `${dept.level * 12}px` }}
                        >
                          <Building2 className="size-3" />
                          <span>{dept.name}</span>
                          {dept.disabled && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (current or child)
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Cannot select the current department or its children as parent.
            </p>
          </div>

          {/* Default Visibility */}
          <div className="space-y-2">
            <Label htmlFor="visibility">Default Visibility</Label>
            <Select
              value={draft.visibility}
              onValueChange={(value) =>
                dispatch({
                  type: 'set-visibility',
                  value: value as DepartmentVisibility,
                  fallback: fallbackDraft,
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
          {draft.visibility === 'public' && (
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
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
            className={cn(loading && 'opacity-50 cursor-not-allowed')}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading}
            className="min-w-[140px]"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Updating…
              </>
            ) : (
              'Update Department'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
