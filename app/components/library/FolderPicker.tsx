'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Search,
  X,
  Plus,
  Check,
  Loader2,
  Home,
} from 'lucide-react';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Skeleton } from '@/app/components/ui/skeleton';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from '@/app/components/ui/breadcrumb';
import { cn } from '@/lib/utils/cn';

export interface FolderInfo {
  id: string;
  name: string;
  path?: string;
  parentId?: string;
  hasChildren: boolean;
  isRoot?: boolean;
}

interface FolderPickerProps {
  connectorType: 'google_drive' | 'sharepoint' | 'onedrive';
  connectorId: string;
  selectedFolderId?: string;
  onFolderSelect: (folder: FolderInfo | null) => void;
  onCreateFolder?: (parentId: string | undefined, name: string) => Promise<FolderInfo>;
  disabled?: boolean;
}

interface FolderTreeNode extends FolderInfo {
  children?: FolderTreeNode[];
  isLoading?: boolean;
  isExpanded?: boolean;
}

/**
 * FolderPicker Component
 * Hierarchical folder browser for external storage systems (Google Drive, SharePoint, OneDrive)
 *
 * Features:
 * - Tree navigation with expand/collapse
 * - Breadcrumb navigation
 * - Search with debouncing
 * - Inline folder creation
 * - Loading states and error handling
 * - Keyboard navigation support
 */
export default function FolderPicker({
  connectorType,
  connectorId,
  selectedFolderId,
  onFolderSelect,
  onCreateFolder,
  disabled = false,
}: FolderPickerProps) {
  // State
  const [folders, setFolders] = useState<FolderTreeNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [currentPath, setCurrentPath] = useState<FolderInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Refs
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const createInputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Focus create input when shown
  useEffect(() => {
    if (showCreateInput && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [showCreateInput]);

  // Fetch folders from API
  const fetchFolders = useCallback(
    async (parentId?: string, search?: string) => {
      try {
        const params = new URLSearchParams({ connectorId });
        if (parentId) params.set('parentId', parentId);
        if (search) params.set('search', search);

        const response = await fetch(
          `/api/integrations/${connectorType}/folders?${params}`
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch folders');
        }

        const data = await response.json();
        return data.data?.folders || [];
      } catch (err: any) {
        console.error('Failed to fetch folders:', err);
        throw err;
      }
    },
    [connectorType, connectorId]
  );

  // Load root folders on mount
  useEffect(() => {
    const loadRootFolders = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const rootFolders = await fetchFolders();
        setFolders(
          rootFolders.map((folder: FolderInfo) => ({
            ...folder,
            children: [],
            isExpanded: false,
          }))
        );
      } catch (err: any) {
        setError(err.message || 'Failed to load folders');
      } finally {
        setIsLoading(false);
      }
    };

    loadRootFolders();
  }, [fetchFolders]);

  // Handle search
  useEffect(() => {
    if (!debouncedSearch) {
      return;
    }

    const performSearch = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const results = await fetchFolders(undefined, debouncedSearch);
        setFolders(
          results.map((folder: FolderInfo) => ({
            ...folder,
            children: [],
            isExpanded: false,
          }))
        );
      } catch (err: any) {
        setError(err.message || 'Search failed');
      } finally {
        setIsLoading(false);
      }
    };

    performSearch();
  }, [debouncedSearch, fetchFolders]);

  // Toggle folder expansion
  const toggleFolder = async (folderId: string) => {
    if (disabled) return;

    const newExpanded = new Set(expandedFolders);
    const isExpanding = !newExpanded.has(folderId);

    if (isExpanding) {
      newExpanded.add(folderId);

      // Load children if expanding
      setFolders((prevFolders) => {
        const updateNode = (nodes: FolderTreeNode[]): FolderTreeNode[] => {
          return nodes.map((node) => {
            if (node.id === folderId) {
              return { ...node, isLoading: true, isExpanded: true };
            }
            if (node.children) {
              return { ...node, children: updateNode(node.children) };
            }
            return node;
          });
        };
        return updateNode(prevFolders);
      });

      try {
        const children = await fetchFolders(folderId);

        setFolders((prevFolders) => {
          const updateNode = (nodes: FolderTreeNode[]): FolderTreeNode[] => {
            return nodes.map((node) => {
              if (node.id === folderId) {
                return {
                  ...node,
                  children: children.map((child: FolderInfo) => ({
                    ...child,
                    children: [],
                    isExpanded: false,
                  })),
                  isLoading: false,
                  isExpanded: true,
                };
              }
              if (node.children) {
                return { ...node, children: updateNode(node.children) };
              }
              return node;
            });
          };
          return updateNode(prevFolders);
        });
      } catch (err: any) {
        console.error('Failed to load folder children:', err);
        newExpanded.delete(folderId);

        setFolders((prevFolders) => {
          const updateNode = (nodes: FolderTreeNode[]): FolderTreeNode[] => {
            return nodes.map((node) => {
              if (node.id === folderId) {
                return { ...node, isLoading: false, isExpanded: false };
              }
              if (node.children) {
                return { ...node, children: updateNode(node.children) };
              }
              return node;
            });
          };
          return updateNode(prevFolders);
        });
      }
    } else {
      newExpanded.delete(folderId);

      setFolders((prevFolders) => {
        const updateNode = (nodes: FolderTreeNode[]): FolderTreeNode[] => {
          return nodes.map((node) => {
            if (node.id === folderId) {
              return { ...node, isExpanded: false };
            }
            if (node.children) {
              return { ...node, children: updateNode(node.children) };
            }
            return node;
          });
        };
        return updateNode(prevFolders);
      });
    }

    setExpandedFolders(newExpanded);
  };

  // Select folder
  const handleFolderSelect = (folder: FolderTreeNode) => {
    if (disabled) return;
    onFolderSelect(folder);

    // Update breadcrumb path
    const buildPath = (
      nodes: FolderTreeNode[],
      targetId: string,
      path: FolderInfo[] = []
    ): FolderInfo[] | null => {
      for (const node of nodes) {
        if (node.id === targetId) {
          return [...path, node];
        }
        if (node.children) {
          const found = buildPath(node.children, targetId, [...path, node]);
          if (found) return found;
        }
      }
      return null;
    };

    const path = buildPath(folders, folder.id);
    if (path) {
      setCurrentPath(path);
    }
  };

  // Navigate via breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    if (disabled) return;

    if (index === -1) {
      // Navigate to root
      onFolderSelect(null);
      setCurrentPath([]);
    } else {
      const folder = currentPath[index];
      onFolderSelect(folder);
      setCurrentPath(currentPath.slice(0, index + 1));
    }
  };

  // Create new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || !onCreateFolder || isCreating) return;

    setIsCreating(true);
    setError(null);

    try {
      const currentParentId = currentPath.length > 0 ? currentPath[currentPath.length - 1].id : undefined;
      const newFolder = await onCreateFolder(currentParentId, newFolderName.trim());

      // Add to tree
      if (currentParentId) {
        // Add to parent's children
        setFolders((prevFolders) => {
          const updateNode = (nodes: FolderTreeNode[]): FolderTreeNode[] => {
            return nodes.map((node) => {
              if (node.id === currentParentId) {
                return {
                  ...node,
                  children: [
                    ...(node.children || []),
                    { ...newFolder, children: [], isExpanded: false },
                  ],
                };
              }
              if (node.children) {
                return { ...node, children: updateNode(node.children) };
              }
              return node;
            });
          };
          return updateNode(prevFolders);
        });
      } else {
        // Add to root
        setFolders((prev) => [
          ...prev,
          { ...newFolder, children: [], isExpanded: false },
        ]);
      }

      // Select the new folder
      handleFolderSelect({ ...newFolder, children: [], isExpanded: false });

      // Reset
      setNewFolderName('');
      setShowCreateInput(false);
    } catch (err: any) {
      console.error('Failed to create folder:', err);
      setError(err.message || 'Failed to create folder');
    } finally {
      setIsCreating(false);
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setDebouncedSearch('');
  };

  // Render folder node
  const renderFolderNode = (node: FolderTreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.id);
    const isSelected = selectedFolderId === node.id;

    return (
      <div key={node.id} role="treeitem" aria-expanded={isExpanded}>
        <button
          type="button"
          onClick={() => handleFolderSelect(node)}
          disabled={disabled}
          className={cn(
            'group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors',
            'hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isSelected && 'bg-primary/10 text-primary font-medium',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
        >
          {/* Expand/collapse button */}
          {node.hasChildren && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFolder(node.id);
              }}
              disabled={disabled}
              className={cn(
                'shrink-0 p-0.5 rounded hover:bg-muted transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
              aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
            >
              {node.isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          )}

          {/* Folder icon */}
          <div className={cn('shrink-0', !node.hasChildren && 'ml-5')}>
            {isExpanded ? (
              <FolderOpen className="h-4 w-4 text-primary" />
            ) : (
              <Folder className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          {/* Folder name */}
          <span className="truncate flex-1 text-left">{node.name}</span>

          {/* Selected indicator */}
          {isSelected && (
            <Check className="h-4 w-4 text-primary shrink-0" aria-label="Selected" />
          )}
        </button>

        {/* Children */}
        {isExpanded && node.children && node.children.length > 0 && (
          <div role="group">
            {node.children.map((child) => renderFolderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={() => navigateToBreadcrumb(-1)}
              className="cursor-pointer flex items-center gap-1"
              aria-label="Navigate to root"
            >
              <Home className="h-3.5 w-3.5" />
              <span>Root</span>
            </BreadcrumbLink>
          </BreadcrumbItem>

          {currentPath.map((folder, index) => (
            <div key={folder.id} className="flex items-center gap-1.5">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink
                  onClick={() => navigateToBreadcrumb(index)}
                  className="cursor-pointer"
                >
                  {folder.name}
                </BreadcrumbLink>
              </BreadcrumbItem>
            </div>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search folders..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          disabled={disabled}
          className="pl-9 pr-9"
          aria-label="Search folders"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={clearSearch}
            disabled={disabled}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-sm',
              'hover:bg-muted transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
            aria-label="Clear search"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Folder Tree */}
      <ScrollArea className="flex-1 border rounded-md">
        <div className="p-2 min-h-[300px]" role="tree" aria-label="Folder tree">
          {/* Loading State */}
          {isLoading && folders.length === 0 && (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && folders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Folder className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {debouncedSearch ? 'No folders found' : 'No folders available'}
              </p>
            </div>
          )}

          {/* Folder Nodes */}
          {!isLoading && !error && folders.length > 0 && (
            <div className="space-y-0.5">
              {folders.map((folder) => renderFolderNode(folder))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Create Folder */}
      {onCreateFolder && (
        <div className="pt-2 border-t">
          {!showCreateInput ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateInput(true)}
              disabled={disabled}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                ref={createInputRef}
                type="text"
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateFolder();
                  } else if (e.key === 'Escape') {
                    setShowCreateInput(false);
                    setNewFolderName('');
                  }
                }}
                disabled={isCreating}
                className="flex-1"
                aria-label="New folder name"
              />
              <Button
                size="sm"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim() || isCreating}
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreateInput(false);
                  setNewFolderName('');
                }}
                disabled={isCreating}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
