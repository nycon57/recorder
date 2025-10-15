"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { AlertCircle, AlertTriangle, Users, Building2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Department } from "@/lib/validations/departments";


interface DeleteDepartmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department;
  departments: Department[];
  onSuccess: () => void;
}

export function DeleteDepartmentModal({
  open,
  onOpenChange,
  department,
  departments,
  onSuccess,
}: DeleteDepartmentModalProps) {
  const { getToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [reassignTo, setReassignTo] = useState<string | null>(null);

  // Check if department has children
  const hasChildren = department.children && department.children.length > 0;
  const hasMembers = department.memberCount && department.memberCount > 0;

  // Build flat list of departments excluding the one being deleted and its descendants
  const getDescendantIds = (dept: Department): string[] => {
    let ids = [dept.id];
    if (dept.children) {
      dept.children.forEach((child) => {
        ids = ids.concat(getDescendantIds(child));
      });
    }
    return ids;
  };

  const excludedIds = getDescendantIds(department);

  const buildFlatList = (
    deps: Department[],
    level = 0
  ): Array<Department & { level: number }> => {
    let result: Array<Department & { level: number }> = [];

    deps.forEach((dept) => {
      if (!excludedIds.includes(dept.id)) {
        result.push({ ...dept, level });

        if (dept.children && dept.children.length > 0) {
          result = result.concat(buildFlatList(dept.children, level + 1));
        }
      }
    });

    return result;
  };

  const availableDepartments = buildFlatList(departments);

  const handleDelete = async () => {
    if (hasChildren) {
      toast.error("Cannot delete department with sub-departments. Delete or move them first.");
      return;
    }

    if (hasMembers && !reassignTo) {
      toast.error("Please select a department to reassign members to.");
      return;
    }

    setLoading(true);

    try {
      const token = await getToken();

      const url = new URL(`/api/organizations/departments/${department.id}`, window.location.origin);
      if (reassignTo) {
        url.searchParams.set("reassignUsersTo", reassignTo);
      }

      const response = await fetch(url.toString(), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete department");
      }

      toast.success("Department deleted successfully");
      onSuccess();
    } catch (error) {
      console.error("Error deleting department:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete department");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setReassignTo(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Delete Department</DialogTitle>
          <DialogDescription>
            This action cannot be undone. Please review carefully before proceeding.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Department being deleted */}
          <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">
                  You are about to delete:
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  <span className="font-semibold">{department.name}</span>
                </div>
                {department.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {department.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Warning for children */}
          {hasChildren && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This department has {department.children?.length} sub-department(s).
                You must delete or reassign them before deleting this department.
              </AlertDescription>
            </Alert>
          )}

          {/* Member reassignment */}
          {hasMembers && !hasChildren && (
            <div className="space-y-2">
              <Label>
                <Users className="w-4 h-4 inline mr-2" />
                Reassign {department.memberCount} member(s) to:
              </Label>
              <Select
                value={reassignTo || ""}
                onValueChange={(value) => setReassignTo(value || null)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No department (remove from all)</SelectItem>
                  {availableDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      <div
                        className="flex items-center gap-1"
                        style={{ marginLeft: `${dept.level * 12}px` }}
                      >
                        <Building2 className="w-3 h-3" />
                        <span>{dept.name}</span>
                        {dept.memberCount !== undefined && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({dept.memberCount} members)
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                All members of this department will be moved to the selected department.
              </p>
            </div>
          )}

          {/* Additional warnings */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>All content associated with this department will be affected</li>
                <li>Department-specific permissions will be removed</li>
                <li>This action cannot be reversed</li>
              </ul>
            </AlertDescription>
          </Alert>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading || hasChildren || (hasMembers && !reassignTo)}
          >
            {loading ? "Deleting..." : "Delete Department"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}