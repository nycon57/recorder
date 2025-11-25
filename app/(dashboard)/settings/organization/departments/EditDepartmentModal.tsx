"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { Building2, ChevronRight, Check, AlertCircle, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/app/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import { Department } from "@/lib/validations/departments";
import { cn } from "@/lib/utils/cn";

interface EditDepartmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department;
  allDepartments: Department[];
  onSuccess: () => void;
}

const visibilityOptions = [
  {
    value: "private",
    label: "Private",
    description: "Only department members can access",
  },
  {
    value: "department",
    label: "Department",
    description: "Department and sub-departments can access",
  },
  {
    value: "org",
    label: "Organization",
    description: "All organization members can access",
  },
  {
    value: "public",
    label: "Public",
    description: "Anyone with the link can access",
  },
];

export function EditDepartmentModal({
  open,
  onOpenChange,
  department,
  allDepartments,
  onSuccess,
}: EditDepartmentModalProps) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description || "");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(
    department.parentId
  );
  const [visibility, setVisibility] = useState(department.defaultVisibility);
  const [parentSelectorOpen, setParentSelectorOpen] = useState(false);

  // Update form when department changes
  useEffect(() => {
    if (department) {
      setName(department.name);
      setDescription(department.description || "");
      setSelectedParentId(department.parentId);
      setVisibility(department.defaultVisibility);
    }
  }, [department]);

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
    parentPath: string[] = []
  ): Array<Department & { level: number; path: string[]; disabled: boolean }> => {
    let result: Array<Department & { level: number; path: string[]; disabled: boolean }> = [];

    deps.forEach((dept) => {
      const currentPath = [...parentPath, dept.name];
      // Disable if it's the current department or a descendant
      const disabled = descendantIds.includes(dept.id);
      result.push({ ...dept, level, path: currentPath, disabled });

      if (dept.children && dept.children.length > 0) {
        result = result.concat(buildFlatList(dept.children, level + 1, currentPath));
      }
    });

    return result;
  };

  const flatDepartments = buildFlatList(allDepartments);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Department name is required");
      return;
    }

    // Check for circular reference
    if (selectedParentId && descendantIds.includes(selectedParentId)) {
      toast.error("Cannot set a child department as parent (circular reference)");
      return;
    }

    setLoading(true);

    try {
      const token = await getToken();

      // Only send changed fields
      const updates: any = {};
      if (name !== department.name) updates.name = name.trim();
      if (description !== (department.description || "")) {
        updates.description = description.trim() || null;
      }
      if (selectedParentId !== department.parentId) {
        updates.parentId = selectedParentId;
      }
      if (visibility !== department.defaultVisibility) {
        updates.defaultVisibility = visibility;
      }

      // Only make request if there are changes
      if (Object.keys(updates).length === 0) {
        toast.info("No changes made");
        onOpenChange(false);
        return;
      }

      const response = await fetch(`/api/organizations/departments/${department.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update department");
      }

      toast.success("Department updated successfully");
      onSuccess();
    } catch (error) {
      console.error("Error updating department:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update department");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onOpenChange(false);
    }
  };

  const selectedParent = flatDepartments.find((d) => d.id === selectedParentId);

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
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              <Info className="w-4 h-4 text-muted-foreground" />
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
              placeholder="Describe the purpose of this department..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={3}
            />
          </div>

          {/* Parent Department */}
          <div className="space-y-2">
            <Label>Parent Department</Label>
            <Popover open={parentSelectorOpen} onOpenChange={setParentSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={parentSelectorOpen}
                  className="w-full justify-between"
                  disabled={loading}
                >
                  {selectedParent ? (
                    <div className="flex items-center gap-1 truncate">
                      {selectedParent.path.map((p, i) => (
                        <span key={i} className="flex items-center gap-1">
                          {i > 0 && <ChevronRight className="w-3 h-3" />}
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
                <Command>
                  <CommandInput placeholder="Search departments..." />
                  <CommandEmpty>No department found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setSelectedParentId(null);
                        setParentSelectorOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedParentId === null ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <span>No parent (top-level)</span>
                    </CommandItem>
                    {flatDepartments.map((dept) => (
                      <CommandItem
                        key={dept.id}
                        onSelect={() => {
                          if (!dept.disabled) {
                            setSelectedParentId(dept.id);
                            setParentSelectorOpen(false);
                          }
                        }}
                        disabled={dept.disabled}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedParentId === dept.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div
                          className={cn(
                            "flex items-center gap-1",
                            dept.disabled && "opacity-50"
                          )}
                          style={{ marginLeft: `${dept.level * 12}px` }}
                        >
                          <Building2 className="w-3 h-3" />
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
            <Select value={visibility} onValueChange={(value: any) => setVisibility(value)} disabled={loading}>
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
          {visibility === "public" && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Public departments can be accessed by anyone with the link. Make sure this is
                intended before proceeding.
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
            className={cn(loading && "opacity-50 cursor-not-allowed")}
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
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Department"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}