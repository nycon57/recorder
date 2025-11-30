'use client';

import * as React from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Filter,
  Folder,
  FolderOpen,
  HardDrive,
  Loader2,
  RefreshCw,
  Search,
  X,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';
import { Badge } from '@/app/components/ui/badge';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import { cn } from '@/lib/utils';

// =====================================================
// TYPES
// =====================================================

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  type: string;
  size?: number;
  modifiedAt?: string;
  url?: string;
  parentId?: string;
  isFolder: boolean;
  isGoogleWorkspace: boolean;
  isImported: boolean;
  isSupported: boolean;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

interface GoogleDriveImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (count: number) => void;
}

// =====================================================
// FILE TYPE DEFINITIONS
// =====================================================

type FileTypeFilter = 'all' | 'documents' | 'spreadsheets' | 'videos' | 'audio' | 'images' | 'archives' | 'other';

const FILE_TYPE_FILTERS: { value: FileTypeFilter; label: string }[] = [
  { value: 'all', label: 'All Files' },
  { value: 'documents', label: 'Documents' },
  { value: 'spreadsheets', label: 'Spreadsheets' },
  { value: 'videos', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
  { value: 'images', label: 'Images' },
  { value: 'archives', label: 'Archives' },
  { value: 'other', label: 'Other' },
];

// Map file types to filter categories
function getFileFilterCategory(type: string, mimeType: string): FileTypeFilter {
  // Documents
  if (['google_doc', 'pdf', 'word', 'text', 'markdown', 'html'].includes(type)) {
    return 'documents';
  }
  // Spreadsheets
  if (['google_sheet', 'excel', 'csv'].includes(type)) {
    return 'spreadsheets';
  }
  // Videos
  if (type === 'video' || mimeType.startsWith('video/')) {
    return 'videos';
  }
  // Audio
  if (type === 'audio' || mimeType.startsWith('audio/')) {
    return 'audio';
  }
  // Images
  if (type === 'image' || mimeType.startsWith('image/')) {
    return 'images';
  }
  // Archives
  if (type === 'archive') {
    return 'archives';
  }
  // Presentations
  if (type === 'google_slide') {
    return 'documents';
  }
  return 'other';
}

// =====================================================
// HELPERS
// =====================================================

function getFileIcon(file: DriveFile) {
  const iconClass = cn(
    'h-5 w-5 shrink-0',
    !file.isSupported && !file.isFolder && 'opacity-50'
  );

  // Folders
  if (file.isFolder) {
    return <Folder className={cn(iconClass, 'text-blue-500')} />;
  }

  // By file type
  switch (file.type) {
    // Google Workspace
    case 'google_doc':
      return <FileText className={cn(iconClass, 'text-blue-600')} />;
    case 'google_sheet':
      return <FileSpreadsheet className={cn(iconClass, 'text-green-600')} />;
    case 'google_slide':
      return <FileImage className={cn(iconClass, 'text-yellow-600')} />;

    // Documents
    case 'pdf':
      return <FileText className={cn(iconClass, 'text-red-500')} />;
    case 'word':
      return <FileText className={cn(iconClass, 'text-blue-700')} />;
    case 'text':
    case 'markdown':
    case 'html':
      return <FileText className={cn(iconClass, 'text-gray-600')} />;

    // Spreadsheets
    case 'excel':
    case 'csv':
      return <FileSpreadsheet className={cn(iconClass, 'text-green-700')} />;

    // Media
    case 'video':
      return <FileVideo className={cn(iconClass, 'text-purple-600')} />;
    case 'audio':
      return <FileAudio className={cn(iconClass, 'text-pink-600')} />;
    case 'image':
      return <FileImage className={cn(iconClass, 'text-teal-600')} />;

    // Archives
    case 'archive':
      return <FileArchive className={cn(iconClass, 'text-amber-600')} />;

    // Code
    case 'code':
      return <FileCode className={cn(iconClass, 'text-violet-600')} />;

    // Default
    default:
      return <File className={cn(iconClass, 'text-muted-foreground')} />;
  }
}

function getFileTypeBadge(file: DriveFile) {
  const typeLabels: Record<string, string> = {
    google_doc: 'Google Doc',
    google_sheet: 'Google Sheet',
    google_slide: 'Google Slides',
    pdf: 'PDF',
    word: 'Word',
    excel: 'Excel',
    csv: 'CSV',
    text: 'Text',
    markdown: 'Markdown',
    html: 'HTML',
    video: 'Video',
    audio: 'Audio',
    image: 'Image',
    archive: 'Archive',
    code: 'Code',
    file: 'File',
  };

  return typeLabels[file.type] || 'File';
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(dateString?: string): string {
  if (!dateString) return '';
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

// =====================================================
// COMPONENT
// =====================================================

export default function GoogleDriveImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: GoogleDriveImportModalProps) {
  // State
  const [files, setFiles] = React.useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [isImporting, setIsImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedFiles, setSelectedFiles] = React.useState<Set<string>>(new Set());
  const [breadcrumbs, setBreadcrumbs] = React.useState<BreadcrumbItem[]>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [fileTypeFilter, setFileTypeFilter] = React.useState<FileTypeFilter>('all');
  const [nextPageToken, setNextPageToken] = React.useState<string | undefined>();
  const [hasMore, setHasMore] = React.useState(false);

  const currentFolderId = breadcrumbs[breadcrumbs.length - 1]?.id;

  // Fetch files when folder changes
  React.useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  }, [isOpen, currentFolderId]);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setFiles([]);
      setSelectedFiles(new Set());
      setSearchQuery('');
      setBreadcrumbs([{ id: 'root', name: 'My Drive' }]);
      setError(null);
      setFileTypeFilter('all');
      setNextPageToken(undefined);
      setHasMore(false);
    }
  }, [isOpen]);

  const fetchFiles = async (search?: string, append = false, pageToken?: string) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setNextPageToken(undefined);
      setHasMore(false);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      if (currentFolderId && currentFolderId !== 'root') {
        params.set('folderId', currentFolderId);
      }
      if (search) {
        params.set('search', search);
      }
      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const response = await fetch(`/api/integrations/google-drive/files?${params}`);

      if (!response.ok) {
        // Try to parse JSON error, fall back to status text
        let errorMessage = 'Failed to load files';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error('Invalid response from server');
      }

      if (append) {
        setFiles(prev => [...prev, ...(data.files || [])]);
      } else {
        setFiles(data.files || []);
      }

      setNextPageToken(data.nextPageToken);
      setHasMore(data.hasMore || !!data.nextPageToken);
    } catch (err) {
      console.error('Failed to fetch files:', err);
      setError(err instanceof Error ? err.message : 'Failed to load files');
      toast.error('Failed to load Google Drive files');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadMoreFiles = () => {
    if (nextPageToken && !isLoadingMore) {
      fetchFiles(searchQuery || undefined, true, nextPageToken);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFiles(searchQuery);
  };

  const handleFolderClick = (folder: DriveFile) => {
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
    setSelectedFiles(new Set());
  };

  const handleBreadcrumbClick = (index: number) => {
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    setSelectedFiles(new Set());
  };

  const handleFileSelect = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleSelectAll = () => {
    const selectableFiles = filteredFiles.filter(f => !f.isFolder && !f.isImported && f.isSupported);
    if (selectedFiles.size === selectableFiles.length && selectableFiles.length > 0) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(selectableFiles.map(f => f.id)));
    }
  };

  const handleImport = async () => {
    if (selectedFiles.size === 0) return;

    setIsImporting(true);

    try {
      const response = await fetch('/api/integrations/google-drive/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileIds: Array.from(selectedFiles) }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Import failed');
      }

      const result = await response.json();

      toast.success(result.message || `Imported ${result.imported} file(s)`);

      if (result.failed?.length > 0) {
        toast.warning(`${result.failed.length} file(s) failed to import`);
      }

      // Refresh file list to update imported status
      await fetchFiles();
      setSelectedFiles(new Set());

      // Notify parent
      if (onImportComplete) {
        onImportComplete(result.imported);
      }
    } catch (err) {
      console.error('Import failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to import files');
    } finally {
      setIsImporting(false);
    }
  };

  // Filter files by type
  const filteredFiles = React.useMemo(() => {
    if (fileTypeFilter === 'all') return files;
    return files.filter(file => {
      if (file.isFolder) return true; // Always show folders
      return getFileFilterCategory(file.type, file.mimeType) === fileTypeFilter;
    });
  }, [files, fileTypeFilter]);

  const selectableFiles = filteredFiles.filter(f => !f.isFolder && !f.isImported && f.isSupported);
  const allSelected = selectableFiles.length > 0 && selectedFiles.size === selectableFiles.length;

  // Count files by category for filter badges
  const fileCounts = React.useMemo(() => {
    const counts: Record<FileTypeFilter, number> = {
      all: files.filter(f => !f.isFolder).length,
      documents: 0,
      spreadsheets: 0,
      videos: 0,
      audio: 0,
      images: 0,
      archives: 0,
      other: 0,
    };

    files.forEach(file => {
      if (!file.isFolder) {
        const category = getFileFilterCategory(file.type, file.mimeType);
        counts[category]++;
      }
    });

    return counts;
  }, [files]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Import from Google Drive
          </DialogTitle>
          <DialogDescription>
            Select files to import into your Tribora library. Files will be processed for AI search and chat.
          </DialogDescription>
        </DialogHeader>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm overflow-x-auto py-2">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.id}>
              {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
              <button
                onClick={() => handleBreadcrumbClick(index)}
                className={cn(
                  'px-2 py-1 rounded hover:bg-muted transition-colors shrink-0',
                  index === breadcrumbs.length - 1 && 'font-medium'
                )}
              >
                {index === 0 ? (
                  <span className="flex items-center gap-1">
                    <FolderOpen className="h-4 w-4" />
                    {crumb.name}
                  </span>
                ) : (
                  crumb.name
                )}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Search and Filter */}
        <div className="flex gap-2">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button type="submit" variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </form>

          {/* File Type Filter */}
          <Select value={fileTypeFilter} onValueChange={(v) => setFileTypeFilter(v as FileTypeFilter)}>
            <SelectTrigger className="w-[160px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILE_TYPE_FILTERS.map(filter => (
                <SelectItem key={filter.value} value={filter.value}>
                  <span className="flex items-center gap-2">
                    {filter.label}
                    {fileCounts[filter.value] > 0 && (
                      <Badge variant="secondary" className="text-xs px-1.5 py-0">
                        {fileCounts[filter.value]}
                      </Badge>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fetchFiles()}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
          </Button>
        </div>

        {/* File List */}
        <div className="flex-1 min-h-0 border rounded-md">
          {isLoading ? (
            <div className="flex items-center justify-center h-80">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-80 text-center p-4">
              <X className="h-8 w-8 text-destructive mb-2" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchFiles()}>
                Retry
              </Button>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 text-center p-4">
              <Folder className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {fileTypeFilter !== 'all' ? 'No files match the selected filter' : 'No files found'}
              </p>
              {fileTypeFilter !== 'all' && (
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={() => setFileTypeFilter('all')}
                >
                  Show all files
                </Button>
              )}
            </div>
          ) : (
            <ScrollArea className="h-80">
              {/* Select All Header */}
              {selectableFiles.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 border-b bg-background sticky top-0 z-10">
                  <Checkbox
                    id="select-all"
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                    Select all supported ({selectableFiles.length})
                  </label>
                </div>
              )}

              {/* File List */}
              <div className="divide-y">
                {filteredFiles.map((file) => {
                  const isSelectable = !file.isFolder && !file.isImported && file.isSupported;
                  const isDisabled = !file.isFolder && (!file.isSupported || file.isImported);

                  return (
                    <div
                      key={file.id}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 transition-colors',
                        file.isFolder && 'cursor-pointer hover:bg-muted/50',
                        isSelectable && 'hover:bg-muted/30',
                        isDisabled && 'opacity-60'
                      )}
                      onClick={() => file.isFolder && handleFolderClick(file)}
                    >
                      {/* Checkbox for selectable files only */}
                      {!file.isFolder && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Checkbox
                                  checked={selectedFiles.has(file.id)}
                                  onCheckedChange={() => handleFileSelect(file.id)}
                                  disabled={isDisabled}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </TooltipTrigger>
                            {!file.isSupported && (
                              <TooltipContent>
                                <p>This file type is not supported for import</p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {file.isFolder && <div className="w-4" />}

                      {/* Icon */}
                      {getFileIcon(file)}

                      {/* Name and metadata */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            'font-medium truncate',
                            isDisabled && 'text-muted-foreground'
                          )}>
                            {file.name}
                          </span>
                          {file.isImported && (
                            <Badge variant="secondary" className="shrink-0">
                              <Check className="h-3 w-3 mr-1" />
                              Imported
                            </Badge>
                          )}
                          {!file.isFolder && !file.isSupported && (
                            <Badge variant="outline" className="shrink-0 text-amber-600 border-amber-600">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Not Supported
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {!file.isFolder && (
                            <Badge variant="outline" className="text-xs font-normal">
                              {getFileTypeBadge(file)}
                            </Badge>
                          )}
                          {file.size && <span>{formatFileSize(file.size)}</span>}
                          {file.modifiedAt && <span>{formatDate(file.modifiedAt)}</span>}
                        </div>
                      </div>

                      {/* Folder arrow */}
                      {file.isFolder && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Load More Button */}
              {hasMore && (
                <div className="flex justify-center py-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadMoreFiles}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load More Files'
                    )}
                  </Button>
                </div>
              )}
            </ScrollArea>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedFiles.size > 0 && (
              <span>{selectedFiles.size} file(s) selected</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isImporting}>
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={selectedFiles.size === 0 || isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  Import {selectedFiles.size > 0 && `(${selectedFiles.size})`}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
