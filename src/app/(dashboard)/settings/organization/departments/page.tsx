'use client';

import React, { useReducer, useEffect } from 'react';
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
  FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent } from '@/app/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu';
import { Badge } from '@/app/components/ui/badge';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/app/components/ui/breadcrumb';
import { Department } from '@/lib/validations/departments';
import { cn } from '@/lib/utils/cn';

import { CreateDepartmentModal } from './CreateDepartmentModal';
import { EditDepartmentModal } from './EditDepartmentModal';
import { DeleteDepartmentModal } from './DeleteDepartmentModal';
import { DepartmentMembersModal } from './DepartmentMembersModal';

// Visibility configuration
const visibilityIcons = {
  private: Lock,
  department: Building2,
  org: Shield,
  public: Globe,
};

const visibilityLabels = {
  private: 'Private',
  department: 'Department',
  org: 'Organization',
  public: 'Public',
};

function filterDepartmentTree(
  departments: Department[],
  query: string,
): Department[] {
  if (!query) return departments;

  const lowerQuery = query.toLowerCase();

  return departments.reduce((acc: Department[], dept) => {
    const matchesQuery =
      dept.name.toLowerCase().includes(lowerQuery) ||
      dept.description?.toLowerCase().includes(lowerQuery) ||
      dept.slug?.toLowerCase().includes(lowerQuery);

    const filteredChildren = dept.children
      ? filterDepartmentTree(dept.children, query)
      : [];

    if (matchesQuery || filteredChildren.length > 0) {
      acc.push({
        ...dept,
        children: filteredChildren,
      });
    }

    return acc;
  }, []);
}

function collectMatchingExpandableIds(
  departments: Department[],
  query: string,
): string[] {
  if (!query) return [];

  const lowerQuery = query.toLowerCase();

  return departments.flatMap((dept) => {
    const childIds = dept.children
      ? collectMatchingExpandableIds(dept.children, query)
      : [];
    const matchesQuery =
      dept.name.toLowerCase().includes(lowerQuery) ||
      dept.description?.toLowerCase().includes(lowerQuery) ||
      dept.slug?.toLowerCase().includes(lowerQuery);

    if (matchesQuery && dept.children && dept.children.length > 0) {
      return [dept.id, ...childIds];
    }

    return childIds;
  });
}

interface DepartmentsPageState {
  departments: Department[];
  loading: boolean;
  searchQuery: string;
  expandedIds: Set<string>;
  selectedPath: Department[];
  createModalOpen: boolean;
  editModalOpen: boolean;
  deleteModalOpen: boolean;
  membersModalOpen: boolean;
  selectedDepartment: Department | null;
  parentDepartment: Department | null;
}

type DepartmentsPageAction =
  | Partial<DepartmentsPageState>
  | ((state: DepartmentsPageState) => DepartmentsPageState);

const initialDepartmentsPageState: DepartmentsPageState = {
  departments: [],
  loading: true,
  searchQuery: '',
  expandedIds: new Set<string>(),
  selectedPath: [],
  createModalOpen: false,
  editModalOpen: false,
  deleteModalOpen: false,
  membersModalOpen: false,
  selectedDepartment: null,
  parentDepartment: null,
};

const departmentsPageReducer = (
  state: DepartmentsPageState,
  action: DepartmentsPageAction,
): DepartmentsPageState =>
  typeof action === 'function' ? action(state) : { ...state, ...action };

interface DepartmentTreeProps {
  departments: Department[];
  path: Department[];
  level?: number;
  expandedIds: Set<string>;
  onToggleExpanded: (id: string) => void;
  onDrillDown: (department: Department, path: Department[]) => void;
  onEditDepartment: (department: Department) => void;
  onViewMembers: (department: Department) => void;
  onCreateDepartment: (parent?: Department) => void;
  onDeleteDepartment: (department: Department) => void;
}

function DepartmentTree({
  departments,
  path,
  level = 0,
  expandedIds,
  onToggleExpanded,
  onDrillDown,
  onEditDepartment,
  onViewMembers,
  onCreateDepartment,
  onDeleteDepartment,
}: DepartmentTreeProps) {
  return (
    <>
      {departments.map((dept) => {
        const isExpanded = expandedIds.has(dept.id);
        const hasChildren = dept.children && dept.children.length > 0;
        const VisibilityIcon = visibilityIcons[dept.defaultVisibility];

        return (
          <div key={dept.id} className={cn('select-none', level > 0 && 'ml-6')}>
            <div className="group flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors">
              <button
                onClick={() => hasChildren && onToggleExpanded(dept.id)}
                className={cn(
                  'p-0.5 hover:bg-accent rounded transition-colors',
                  !hasChildren && 'invisible',
                )}
              >
                {isExpanded ? (
                  <ChevronDown className="size-4" />
                ) : (
                  <ChevronRight className="size-4" />
                )}
              </button>

              <Building2 className="size-4 text-muted-foreground flex-shrink-0" />

              <button
                onClick={() => onDrillDown(dept, path)}
                className="flex-1 flex items-center gap-2 text-left min-w-0"
              >
                <span className="font-medium truncate">{dept.name}</span>
                {dept.memberCount !== undefined && dept.memberCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    <Users className="size-3 mr-1" />
                    {dept.memberCount}
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  <VisibilityIcon className="size-3 mr-1" />
                  {visibilityLabels[dept.defaultVisibility]}
                </Badge>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity size-8 p-0"
                  >
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => onEditDepartment(dept)}>
                    <Edit className="size-4 mr-2" />
                    Edit Department
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onViewMembers(dept)}>
                    <Users className="size-4 mr-2" />
                    View Members
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onCreateDepartment(dept)}>
                    <Plus className="size-4 mr-2" />
                    Add Child Department
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteDepartment(dept)}
                    className="text-destructive"
                  >
                    <Trash2 className="size-4 mr-2" />
                    Delete Department
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {isExpanded && hasChildren && (
              <div className="border-l border-border ml-3">
                <DepartmentTree
                  departments={dept.children!}
                  path={[...path, dept]}
                  level={level + 1}
                  expandedIds={expandedIds}
                  onToggleExpanded={onToggleExpanded}
                  onDrillDown={onDrillDown}
                  onEditDepartment={onEditDepartment}
                  onViewMembers={onViewMembers}
                  onCreateDepartment={onCreateDepartment}
                  onDeleteDepartment={onDeleteDepartment}
                />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export default function DepartmentsPage() {
  return useDepartmentsPageImplementation();
}

function useDepartmentsPageImplementation() {
  const [
    {
      departments,
      loading,
      searchQuery,
      expandedIds,
      selectedPath,
      createModalOpen,
      editModalOpen,
      deleteModalOpen,
      membersModalOpen,
      selectedDepartment,
      parentDepartment,
    },
    updatePageState,
  ] = useReducer(departmentsPageReducer, initialDepartmentsPageState);

  // Fetch departments
  const fetchDepartments = async () => {
    try {
      const response = await fetch(
        '/api/organizations/departments?includeTree=true&includeMembers=true',
      );

      if (!response.ok) {
        throw new Error('Failed to fetch departments');
      }

      const data = await response.json();
      const nextDepartments = data.data?.departments || [];

      // Auto-expand first level
      const firstLevelIds = nextDepartments.map((d: Department) => d.id);
      updatePageState({
        departments: nextDepartments,
        expandedIds: new Set(firstLevelIds),
      });
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
    } finally {
      updatePageState({ loading: false });
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  // Toggle node expansion
  const toggleExpanded = (id: string) => {
    updatePageState((state) => {
      const next = new Set(state.expandedIds);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...state, expandedIds: next };
    });
  };

  // Handle create department
  const handleCreateDepartment = (parent?: Department) => {
    updatePageState({
      parentDepartment: parent || null,
      createModalOpen: true,
    });
  };

  // Handle edit department
  const handleEditDepartment = (department: Department) => {
    updatePageState({
      selectedDepartment: department,
      editModalOpen: true,
    });
  };

  // Handle delete department
  const handleDeleteDepartment = (department: Department) => {
    updatePageState({
      selectedDepartment: department,
      deleteModalOpen: true,
    });
  };

  // Handle view members
  const handleViewMembers = (department: Department) => {
    updatePageState({
      selectedDepartment: department,
      membersModalOpen: true,
    });
  };

  // Handle drill down
  const handleDrillDown = (department: Department, path: Department[]) => {
    const nextState: Partial<{
      selectedPath: Department[];
      expandedIds: Set<string>;
    }> = {
      selectedPath: [...path, department],
    };
    if (department.children && department.children.length > 0) {
      nextState.expandedIds = new Set([department.id]);
    }
    updatePageState(nextState);
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      const firstLevelIds = departments.map((d) => d.id);
      updatePageState({
        selectedPath: [],
        expandedIds: new Set(firstLevelIds),
      });
    } else {
      updatePageState({ selectedPath: selectedPath.slice(0, index + 1) });
    }
  };

  // Get display departments based on navigation
  const displayDepartments =
    selectedPath.length > 0
      ? selectedPath[selectedPath.length - 1].children || []
      : departments;
  const filteredDisplayDepartments = React.useMemo(
    () => filterDepartmentTree(displayDepartments, searchQuery),
    [displayDepartments, searchQuery],
  );

  useEffect(() => {
    const matchingIds = collectMatchingExpandableIds(
      displayDepartments,
      searchQuery,
    );
    if (matchingIds.length === 0) return;
    updatePageState((state) => ({
      ...state,
      expandedIds: new Set([...state.expandedIds, ...matchingIds]),
    }));
  }, [displayDepartments, searchQuery]);

  return (
    <>
      <div className="trbd-stack">
        <div className="trbd-page-header">
          <div className="trbd-page-heading">
            <h1 className="trbd-page-title">Departments</h1>
            <p className="trbd-page-description">
              Organize your team into departments and manage access permissions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="trbd-icon-chip" aria-hidden="true">
              <Building2 className="size-5" />
            </div>
            <Button onClick={() => handleCreateDepartment()}>
              <Plus className="size-4 mr-2" />
              Create Department
            </Button>
          </div>
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
                  <FolderOpen className="size-4" />
                  All Departments
                </BreadcrumbLink>
              </BreadcrumbItem>
              {selectedPath.map((dept, index) => (
                <React.Fragment key={dept.id}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {index === selectedPath.length - 1 ? (
                      <BreadcrumbPage className="flex items-center gap-1">
                        <Building2 className="size-4" />
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
                        <Building2 className="size-4" />
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search departments..."
            value={searchQuery}
            onChange={(e) => updatePageState({ searchQuery: e.target.value })}
            className="pl-9"
          />
        </div>

        {/* Content */}
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-3">
                {[
                  'department-row-1',
                  'department-row-2',
                  'department-row-3',
                  'department-row-4',
                  'department-row-5',
                ].map((skeletonId) => (
                  <Skeleton key={skeletonId} className="h-12 w-full" />
                ))}
              </div>
            ) : displayDepartments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                {searchQuery ? (
                  <>
                    <div className="rounded-full bg-muted p-3 mb-4">
                      <Search className="size-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      No departments found
                    </h3>
                    <p className="text-muted-foreground text-center max-w-sm mb-6">
                      No departments match your search &quot;{searchQuery}
                      &quot;. Try adjusting your search terms.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => updatePageState({ searchQuery: '' })}
                    >
                      Clear Search
                    </Button>
                  </>
                ) : selectedPath.length > 0 ? (
                  <>
                    <div className="rounded-full bg-muted p-3 mb-4">
                      <Building2 className="size-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      No sub-departments
                    </h3>
                    <p className="text-muted-foreground text-center max-w-sm mb-6">
                      This department doesn&apos;t have any sub-departments yet.
                      Create one to organize your team further.
                    </p>
                    <Button
                      onClick={() =>
                        handleCreateDepartment(
                          selectedPath[selectedPath.length - 1],
                        )
                      }
                    >
                      <Plus className="size-4 mr-2" />
                      Add Sub-Department
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="rounded-full bg-primary/10 p-3 mb-4">
                      <Building2 className="size-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">
                      No departments yet
                    </h3>
                    <p className="text-muted-foreground text-center max-w-sm mb-6">
                      Get started by creating your first department. Organize
                      your team and manage access permissions effectively.
                    </p>
                    <Button onClick={() => handleCreateDepartment()} size="lg">
                      <Plus className="size-4 mr-2" />
                      Create Your First Department
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <DepartmentTree
                  departments={filteredDisplayDepartments}
                  path={selectedPath}
                  expandedIds={expandedIds}
                  onToggleExpanded={toggleExpanded}
                  onDrillDown={handleDrillDown}
                  onEditDepartment={handleEditDepartment}
                  onViewMembers={handleViewMembers}
                  onCreateDepartment={handleCreateDepartment}
                  onDeleteDepartment={handleDeleteDepartment}
                />
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
                  <span>
                    Click on a department name to view its sub-departments
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>
                    Use the dropdown menu to edit, delete, or manage members
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>
                    Departments can be nested to create organizational
                    hierarchies
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>
                    Set default visibility to control content access levels
                  </span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modals */}
      <CreateDepartmentModal
        open={createModalOpen}
        onOpenChange={(isOpen) => updatePageState({ createModalOpen: isOpen })}
        parentDepartment={parentDepartment}
        allDepartments={departments}
        onSuccess={() => {
          fetchDepartments();
          updatePageState({
            createModalOpen: false,
            parentDepartment: null,
          });
        }}
      />

      {selectedDepartment && (
        <>
          <EditDepartmentModal
            open={editModalOpen}
            onOpenChange={(isOpen) =>
              updatePageState({ editModalOpen: isOpen })
            }
            department={selectedDepartment}
            allDepartments={departments}
            onSuccess={() => {
              fetchDepartments();
              updatePageState({
                editModalOpen: false,
                selectedDepartment: null,
              });
            }}
          />

          <DeleteDepartmentModal
            open={deleteModalOpen}
            onOpenChange={(isOpen) =>
              updatePageState({ deleteModalOpen: isOpen })
            }
            department={selectedDepartment}
            departments={departments}
            onSuccess={() => {
              fetchDepartments();
              const nextState: Partial<{
                deleteModalOpen: boolean;
                selectedDepartment: Department | null;
                selectedPath: Department[];
              }> = {
                deleteModalOpen: false,
                selectedDepartment: null,
              };
              // Reset path if deleted department was in path
              if (selectedPath.some((d) => d.id === selectedDepartment.id)) {
                nextState.selectedPath = [];
              }
              updatePageState(nextState);
            }}
          />

          <DepartmentMembersModal
            open={membersModalOpen}
            onOpenChange={(isOpen) =>
              updatePageState({ membersModalOpen: isOpen })
            }
            department={selectedDepartment}
          />
        </>
      )}
    </>
  );
}
