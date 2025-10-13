'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Upload,
  File,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  AlertCircle
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/app/components/ui/table';
import { Progress } from '@/app/components/ui/progress';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';
import { cn } from '@/lib/utils/cn';

interface UploadedFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  errorMessage?: string;
}

interface UploadHistoryItem {
  id: string;
  filename: string;
  fileType: string;
  size: string;
  uploadDate: string;
  status: 'completed' | 'processing' | 'failed';
  errorMessage?: string;
}

const SUPPORTED_TYPES = [
  { extension: '.pdf', label: 'PDF', mime: 'application/pdf' },
  { extension: '.docx', label: 'Word', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { extension: '.txt', label: 'Text', mime: 'text/plain' },
  { extension: '.md', label: 'Markdown', mime: 'text/markdown' }
];

export default function UploadPage() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Set page title
  useEffect(() => {
    document.title = 'File Upload - Connectors - Record';
  }, []);

  useEffect(() => {
    const fetchUploadHistory = async () => {
      try {
        // TODO: Replace with actual API call
        // Mock data for demonstration
        await new Promise(resolve => setTimeout(resolve, 1000));

        setUploadHistory([
          {
            id: '1',
            filename: 'Product Requirements.pdf',
            fileType: 'PDF',
            size: '2.4 MB',
            uploadDate: '2025-10-13T10:30:00Z',
            status: 'completed'
          },
          {
            id: '2',
            filename: 'Meeting Notes.docx',
            fileType: 'DOCX',
            size: '856 KB',
            uploadDate: '2025-10-12T15:45:00Z',
            status: 'completed'
          },
          {
            id: '3',
            filename: 'Technical Spec.md',
            fileType: 'MD',
            size: '124 KB',
            uploadDate: '2025-10-11T09:15:00Z',
            status: 'completed'
          }
        ]);
      } catch (error) {
        console.error('Error fetching upload history:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUploadHistory();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleFiles = async (fileList: File[]) => {
    const supportedMimes = SUPPORTED_TYPES.map(t => t.mime);
    const validFiles = fileList.filter(file => {
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      const mimeValid = supportedMimes.includes(file.type);
      const extensionValid = SUPPORTED_TYPES.some(t => t.extension === extension);
      return mimeValid || extensionValid;
    });

    const newFiles: UploadedFile[] = validFiles.map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: 'pending',
      progress: 0
    }));

    setFiles(prev => [...prev, ...newFiles]);

    // Simulate upload for each file
    for (const uploadFile of newFiles) {
      await uploadFile_(uploadFile);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFiles(selectedFiles);
  };

  const uploadFile_ = async (uploadFile: UploadedFile) => {
    // Update status to uploading
    setFiles(prev => prev.map(f =>
      f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
    ));

    // Simulate upload progress
    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise(resolve => setTimeout(resolve, 200));
      setFiles(prev => prev.map(f =>
        f.id === uploadFile.id ? { ...f, progress } : f
      ));
    }

    // Update status to processing
    setFiles(prev => prev.map(f =>
      f.id === uploadFile.id ? { ...f, status: 'processing' } : f
    ));

    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Complete upload
    setFiles(prev => prev.map(f =>
      f.id === uploadFile.id ? { ...f, status: 'completed', progress: 100 } : f
    ));

    // Add to history
    const historyItem: UploadHistoryItem = {
      id: uploadFile.id,
      filename: uploadFile.file.name,
      fileType: uploadFile.file.type.split('/').pop()?.toUpperCase() || 'FILE',
      size: formatFileSize(uploadFile.file.size),
      uploadDate: new Date().toISOString(),
      status: 'completed'
    };
    setUploadHistory(prev => [historyItem, ...prev]);

    // Remove from active uploads after 2 seconds
    setTimeout(() => {
      setFiles(prev => prev.filter(f => f.id !== uploadFile.id));
    }, 2000);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      case 'uploading':
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" />;
      default:
        return <File className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getHistoryStatusIcon = (status: UploadHistoryItem['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">File Upload</h1>
            <p className="text-muted-foreground">Upload documents directly to your knowledge base</p>
          </div>
        </div>
      </div>

      {/* Supported File Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Supported File Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_TYPES.map((type) => (
              <Badge key={type.extension} variant="secondary" className="px-3 py-1">
                {type.label} ({type.extension})
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upload Zone */}
      <Card>
        <CardContent className="p-0">
          <div
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'relative border-2 border-dashed rounded-lg p-12 text-center transition-colors',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50 hover:bg-accent/50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={SUPPORTED_TYPES.map(t => t.mime).join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />

            <div className="flex flex-col items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="h-10 w-10 text-primary" />
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-2">
                  {isDragging ? 'Drop files here' : 'Upload Documents'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  Drag and drop files here, or click to browse
                </p>
              </div>

              <Button
                onClick={() => fileInputRef.current?.click()}
                size="lg"
              >
                <Upload className="mr-2 h-5 w-5" />
                Select Files
              </Button>

              <p className="text-sm text-muted-foreground">
                Maximum file size: 10 MB per file
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Uploads */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Uploading ({files.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                <div className="flex-shrink-0">
                  {getStatusIcon(file.status)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium truncate">{file.file.name}</p>
                    <span className="text-sm text-muted-foreground ml-2">
                      {formatFileSize(file.file.size)}
                    </span>
                  </div>

                  {file.status === 'uploading' && (
                    <>
                      <Progress value={file.progress} className="h-2 mb-1" />
                      <p className="text-xs text-muted-foreground">
                        Uploading... {file.progress}%
                      </p>
                    </>
                  )}

                  {file.status === 'processing' && (
                    <p className="text-sm text-muted-foreground">Processing document...</p>
                  )}

                  {file.status === 'completed' && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Upload complete
                    </p>
                  )}

                  {file.status === 'failed' && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {file.errorMessage || 'Upload failed'}
                    </p>
                  )}
                </div>

                {file.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upload History */}
      <Card>
        <CardHeader>
          <CardTitle>Upload History</CardTitle>
          <CardDescription>Recently uploaded documents</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : uploadHistory.length === 0 ? (
            <div className="text-center py-12">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No uploads yet</h3>
              <p className="text-muted-foreground mb-4">
                Upload your first document to get started
              </p>
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Files
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadHistory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.filename}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.fileType}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{item.size}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(item.uploadDate).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getHistoryStatusIcon(item.status)}
                        <span className="text-sm capitalize">{item.status}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Processing Information</AlertTitle>
        <AlertDescription>
          Uploaded documents are automatically processed with AI to enable semantic search and chat features.
          Processing typically takes 30-60 seconds per document depending on size.
        </AlertDescription>
      </Alert>
    </div>
  );
}
