'use client';

import * as React from 'react';
import { Check, ChevronRight, FolderTree, Plus, Search } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/app/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/components/ui/popover';
import { Badge } from '@/app/components/ui/badge';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/app/components/ui/breadcrumb';

/**
 * Department type definition
 */
export interface Department {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description?: string | null;
  org_id: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Props for DepartmentSelector component
 */
export interface DepartmentSelectorProps {
  /**
   * All available departments (flat array, will be converted to tree)
   */
  departments: Department[];
  /**
   * Currently selected department ID(s)
   */
  value?: string | string[];
  /**
   * Callback when selection changes
   */
  onValueChange?: (value: string | string[]) => void;
  /**
   * Allow selecting multiple departments
   */
  multiple?: boolean;
  /**
   * Placeholder text when nothing is selected
   */
  placeholder?: string;
  /**
   * Show "Create new" option
   */
  showCreateNew?: boolean;
  /**
   * Callback when "Create new" is clicked
   */
  onCreateNew?: () => void;
  /**
   * Disabled state
   */
  disabled?: boolean;
  /**
   * Additional CSS classes
   */
  className?: string;
  /**
   * Show breadcrumb for selected department
   */
  showBreadcrumb?: boolean;
}

/**
 * Build a tree structure from flat department array
 */
function buildDepartmentTree(departments: Department[]): DepartmentTreeNode[] {
  const map = new Map<string, DepartmentTreeNode>();
  const roots: DepartmentTreeNode[] = [];

  // Create all nodes
  departments.forEach((dept) => {
    map.set(dept.id, {
      ...dept,
      children: [],
    });
  });

  // Build tree relationships
  departments.forEach((dept) => {
    const node = map.get(dept.id);
    if (!node) return;

    if (dept.parent_id && map.has(dept.parent_id)) {
      const parent = map.get(dept.parent_id);
      parent?.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

/**
 * Department tree node with children
 */
interface DepartmentTreeNode extends Department {
  children: DepartmentTreeNode[];
}

/**
 * Get breadcrumb path for a department
 */
function getDepartmentPath(
  departmentId: string,
  departments: Department[]
): Department[] {
  const path: Department[] = [];
  const deptMap = new Map(departments.map((d) => [d.id, d]));

  let current = deptMap.get(departmentId);
  while (current) {
    path.unshift(current);
    current = current.parent_id ? deptMap.get(current.parent_id) : undefined;
  }

  return path;
}

/**
 * Render a single tree item
 */
function DepartmentTreeItem({
  node,
  isSelected,
  onSelect,
  depth = 0,
}: {
  node: DepartmentTreeNode;
  isSelected: boolean;
  onSelect: () => void;
  depth?: number;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <CommandItem
        onSelect={onSelect}
        className={cn(
          'cursor-pointer',
          depth > 0 && 'ml-4'
        )}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="mr-1 p-0.5 hover:bg-accent rounded"
          >
            <ChevronRight
              className={cn(
                'size-4 transition-transform',
                isExpanded && 'rotate-90'
              )}
            />
          </button>
        )}
        {!hasChildren && <span className="w-5" />}
        <FolderTree className="mr-2 size-4 text-muted-foreground" />
        <span className="flex-1">{node.name}</span>
        {isSelected && <Check className="size-4 text-primary" />}
      </CommandItem>
      {isExpanded &&
        hasChildren &&
        node.children.map((child) => (
          <DepartmentTreeItem
            key={child.id}
            node={child}
            isSelected={isSelected}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </div>
  );
}

/**
 * DepartmentSelector Component
 *
 * A hierarchical department selector with tree navigation, search, breadcrumb display,
 * and optional multi-select. Supports creating new departments inline.
 *
 * Features:
 * - Hierarchical tree view with expand/collapse
 * - Search/filter functionality
 * - Single or multi-select mode
 * - Breadcrumb display for selected department
 * - Optional "Create new" action
 * - Fully accessible with keyboard navigation
 *
 * @example
 * ```tsx
 * <DepartmentSelector
 *   departments={departments}
 *   value={selectedDeptId}
 *   onValueChange={setSelectedDeptId}
 *   showBreadcrumb
 *   showCreateNew
 *   onCreateNew={() => setCreateDialogOpen(true)}
 * />
 * ```
 */
export function DepartmentSelector({
  departments,
  value,
  onValueChange,
  multiple = false,
  placeholder = 'Select department...',
  showCreateNew = false,
  onCreateNew,
  disabled = false,
  className,
  showBreadcrumb = false,
}: DepartmentSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');

  // Convert value to array for consistent handling
  const selectedIds = React.useMemo(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  // Build tree structure
  const departmentTree = React.useMemo(
    () => buildDepartmentTree(departments),
    [departments]
  );

  // Filter departments based on search
  const filteredDepartments = React.useMemo(() => {
    if (!searchQuery) return departments;
    const query = searchQuery.toLowerCase();
    return departments.filter((dept) =>
      dept.name.toLowerCase().includes(query)
    );
  }, [departments, searchQuery]);

  const filteredTree = React.useMemo(
    () => buildDepartmentTree(filteredDepartments),
    [filteredDepartments]
  );

  // Handle selection
  const handleSelect = (departmentId: string) => {
    if (multiple) {
      const newValue = selectedIds.includes(departmentId)
        ? selectedIds.filter((id) => id !== departmentId)
        : [...selectedIds, departmentId];
      onValueChange?.(newValue);
    } else {
      onValueChange?.(departmentId);
      setOpen(false);
    }
  };

  // Get selected department names
  const selectedDepartments = React.useMemo(() => {
    return departments.filter((dept) => selectedIds.includes(dept.id));
  }, [departments, selectedIds]);

  // Get breadcrumb path for single selection
  const breadcrumbPath = React.useMemo(() => {
    if (multiple || selectedIds.length === 0) return [];
    return getDepartmentPath(selectedIds[0], departments);
  }, [selectedIds, departments, multiple]);

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              'w-full justify-between',
              !selectedIds.length && 'text-muted-foreground'
            )}
            disabled={disabled}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FolderTree className="size-4 shrink-0" />
              {selectedIds.length === 0 ? (
                <span className="truncate">{placeholder}</span>
              ) : multiple ? (
                <span className="truncate">
                  {selectedIds.length} selected
                </span>
              ) : (
                <span className="truncate">
                  {selectedDepartments[0]?.name}
                </span>
              )}
            </div>
            <ChevronRight className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search departments..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No departments found.</CommandEmpty>
              <CommandGroup>
                <ScrollArea className="h-[300px]">
                  {filteredTree.map((node) => (
                    <DepartmentTreeItem
                      key={node.id}
                      node={node}
                      isSelected={selectedIds.includes(node.id)}
                      onSelect={() => handleSelect(node.id)}
                    />
                  ))}
                </ScrollArea>
              </CommandGroup>
              {showCreateNew && onCreateNew && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        onCreateNew();
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Plus className="mr-2 size-4" />
                      <span className="font-medium">Create new department</span>
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Breadcrumb display for single selection */}
      {showBreadcrumb && !multiple && breadcrumbPath.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbPath.map((dept, index) => (
              <React.Fragment key={dept.id}>
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  <BreadcrumbLink
                    className={cn(
                      'text-xs',
                      index === breadcrumbPath.length - 1 &&
                        'font-semibold text-foreground'
                    )}
                  >
                    {dept.name}
                  </BreadcrumbLink>
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {/* Multi-select badges */}
      {multiple && selectedDepartments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedDepartments.map((dept) => (
            <Badge
              key={dept.id}
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80"
              onClick={() => handleSelect(dept.id)}
            >
              {dept.name}
              <button
                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSelect(dept.id);
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(dept.id);
                }}
              >
                <span className="sr-only">Remove {dept.name}</span>
                <span className="size-3 flex items-center justify-center">
                  ×
                </span>
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
