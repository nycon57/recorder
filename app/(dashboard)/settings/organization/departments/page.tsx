"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Building2,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Users,
  ChevronRight,
  ChevronDown,
  Lock,
  Globe,
  Shield,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu";
import { Badge } from "@/app/components/ui/badge";
import { ScrollArea } from "@/app/components/ui/scroll-area";
import { Skeleton } from "@/app/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/app/components/ui/breadcrumb";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Department } from "@/lib/validations/departments";
import { cn } from "@/lib/utils/cn";

import { CreateDepartmentModal } from "./CreateDepartmentModal";
import { EditDepartmentModal } from "./EditDepartmentModal";
import { DeleteDepartmentModal } from "./DeleteDepartmentModal";
import { DepartmentMembersModal } from "./DepartmentMembersModal";

// Visibility configuration
const visibilityIcons = {
  private: Lock,
  department: Building2,
  org: Shield,
  public: Globe,
};

const visibilityLabels = {
  private: "Private",
  department: "Department",
  org: "Organization",
  public: "Public",
};

export default function DepartmentsPage() {
  const { getToken } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<Department[]>([]);

  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [parentDepartment, setParentDepartment] = useState<Department | null>(null);

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      const token = await getToken();
      const response = await fetch("/api/organizations/departments?includeTree=true&includeMembers=true", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch departments");
      }

      const data = await response.json();
      setDepartments(data.data?.departments || []);

      // Auto-expand first level
      const departments = data.data?.departments || [];
      const firstLevelIds = departments.map((d: Department) => d.id);
      setExpandedIds(new Set(firstLevelIds));
    } catch (error) {
      console.error("Error fetching departments:", error);
      toast.error("Failed to load departments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  // Toggle node expansion
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Handle create department
  const handleCreateDepartment = (parent?: Department) => {
    setParentDepartment(parent || null);
    setCreateModalOpen(true);
  };

  // Handle edit department
  const handleEditDepartment = (department: Department) => {
    setSelectedDepartment(department);
    setEditModalOpen(true);
  };

  // Handle delete department
  const handleDeleteDepartment = (department: Department) => {
    setSelectedDepartment(department);
    setDeleteModalOpen(true);
  };

  // Handle view members
  const handleViewMembers = (department: Department) => {
    setSelectedDepartment(department);
    setMembersModalOpen(true);
  };

  // Handle drill down
  const handleDrillDown = (department: Department, path: Department[]) => {
    setSelectedPath([...path, department]);
    if (department.children && department.children.length > 0) {
      setExpandedIds(new Set([department.id]));
    }
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      setSelectedPath([]);
      const firstLevelIds = departments.map((d) => d.id);
      setExpandedIds(new Set(firstLevelIds));
    } else {
      setSelectedPath(selectedPath.slice(0, index + 1));
    }
  };

  // Filter departments recursively
  const filterDepartments = (deps: Department[], query: string): Department[] => {
    if (!query) return deps;

    const lowerQuery = query.toLowerCase();

    return deps.reduce((acc: Department[], dept) => {
      const matchesQuery =
        dept.name.toLowerCase().includes(lowerQuery) ||
        dept.description?.toLowerCase().includes(lowerQuery) ||
        dept.slug?.toLowerCase().includes(lowerQuery);

      const filteredChildren = dept.children ? filterDepartments(dept.children, query) : [];

      if (matchesQuery || filteredChildren.length > 0) {
        // Auto-expand when searching
        if (matchesQuery && dept.children && dept.children.length > 0) {
          setExpandedIds(prev => new Set([...prev, dept.id]));
        }

        acc.push({
          ...dept,
          children: filteredChildren,
        });
      }

      return acc;
    }, []);
  };

  // Render department tree
  const renderDepartmentTree = (deps: Department[], path: Department[] = [], level = 0) => {
    const filteredDeps = filterDepartments(deps, searchQuery);

    return filteredDeps.map((dept) => {
      const isExpanded = expandedIds.has(dept.id);
      const hasChildren = dept.children && dept.children.length > 0;
      const VisibilityIcon = visibilityIcons[dept.defaultVisibility];

      return (
        <div key={dept.id} className={cn("select-none", level > 0 && "ml-6")}>
          <div className="group flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors">
            <button
              onClick={() => hasChildren && toggleExpanded(dept.id)}
              className={cn(
                "p-0.5 hover:bg-accent rounded transition-colors",
                !hasChildren && "invisible"
              )}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />

            <button
              onClick={() => handleDrillDown(dept, path)}
              className="flex-1 flex items-center gap-2 text-left min-w-0"
            >
              <span className="font-medium truncate">{dept.name}</span>
              {dept.memberCount !== undefined && dept.memberCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Users className="w-3 h-3 mr-1" />
                  {dept.memberCount}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                <VisibilityIcon className="w-3 h-3 mr-1" />
                {visibilityLabels[dept.defaultVisibility]}
              </Badge>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 p-0"
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => handleEditDepartment(dept)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Department
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleViewMembers(dept)}>
                  <Users className="w-4 h-4 mr-2" />
                  View Members
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCreateDepartment(dept)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Child Department
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleDeleteDepartment(dept)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Department
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {isExpanded && hasChildren && (
            <div className="border-l-2 border-accent ml-3">
              {renderDepartmentTree(dept.children!, [...path, dept], level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  // Get display departments based on navigation
  const displayDepartments = selectedPath.length > 0
    ? selectedPath[selectedPath.length - 1].children || []
    : departments;

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold">Departments</h2>
            <p className="text-muted-foreground mt-1">
              Organize your team into departments and manage access permissions
            </p>
          </div>
          <Button onClick={() => handleCreateDepartment()}>
            <Plus className="w-4 h-4 mr-2" />
            Create Department
          </Button>
        </div>

        {/* Breadcrumbs */}
        {selectedPath.length > 0 && (
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    handleBreadcrumbClick(-1);
                  }}
                  className="flex items-center gap-1"
                >
                  <FolderOpen className="w-4 h-4" />
                  All Departments
                </BreadcrumbLink>
              </BreadcrumbItem>
              {selectedPath.map((dept, index) => (
                <React.Fragment key={dept.id}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {index === selectedPath.length - 1 ? (
                      <BreadcrumbPage className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {dept.name}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          handleBreadcrumbClick(index);
                        }}
                        className="flex items-center gap-1"
                      >
                        <Building2 className="w-4 h-4" />
                        {dept.name}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              ))}
            </BreadcrumbList>
          </Breadcrumb>
        )}

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search departments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Content */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : displayDepartments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                {searchQuery ? (
                  <>
                    <div className="rounded-full bg-muted p-3 mb-4">
                      <Search className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No departments found</h3>
                    <p className="text-muted-foreground text-center max-w-sm mb-6">
                      No departments match your search &quot;{searchQuery}&quot;. Try adjusting your search terms.
                    </p>
                    <Button variant="outline" onClick={() => setSearchQuery("")}>
                      Clear Search
                    </Button>
                  </>
                ) : selectedPath.length > 0 ? (
                  <>
                    <div className="rounded-full bg-muted p-3 mb-4">
                      <Building2 className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No sub-departments</h3>
                    <p className="text-muted-foreground text-center max-w-sm mb-6">
                      This department doesn&apos;t have any sub-departments yet. Create one to organize your team further.
                    </p>
                    <Button onClick={() => handleCreateDepartment(selectedPath[selectedPath.length - 1])}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Sub-Department
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="rounded-full bg-primary/10 p-3 mb-4">
                      <Building2 className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">No departments yet</h3>
                    <p className="text-muted-foreground text-center max-w-sm mb-6">
                      Get started by creating your first department. Organize your team and manage access permissions effectively.
                    </p>
                    <Button onClick={() => handleCreateDepartment()} size="lg">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Department
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                {renderDepartmentTree(displayDepartments, selectedPath)}
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Help Text */}
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground space-y-2">
              <p className="font-medium mb-2">Quick Tips:</p>
              <ul className="space-y-1 ml-4">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Click on a department name to view its sub-departments</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Use the dropdown menu to edit, delete, or manage members</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Departments can be nested to create organizational hierarchies</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Set default visibility to control content access levels</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <CreateDepartmentModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        parentDepartment={parentDepartment}
        allDepartments={departments}
        onSuccess={() => {
          fetchDepartments();
          setCreateModalOpen(false);
          setParentDepartment(null);
        }}
      />

      {selectedDepartment && (
        <>
          <EditDepartmentModal
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            department={selectedDepartment}
            allDepartments={departments}
            onSuccess={() => {
              fetchDepartments();
              setEditModalOpen(false);
              setSelectedDepartment(null);
            }}
          />

          <DeleteDepartmentModal
            open={deleteModalOpen}
            onOpenChange={setDeleteModalOpen}
            department={selectedDepartment}
            departments={departments}
            onSuccess={() => {
              fetchDepartments();
              setDeleteModalOpen(false);
              setSelectedDepartment(null);
              // Reset path if deleted department was in path
              if (selectedPath.some(d => d.id === selectedDepartment.id)) {
                setSelectedPath([]);
              }
            }}
          />

          <DepartmentMembersModal
            open={membersModalOpen}
            onOpenChange={setMembersModalOpen}
            department={selectedDepartment}
          />
        </>
      )}
    </>
  );
}