'use client';

import * as React from 'react';
import {
  Download,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileText
} from 'lucide-react';
import { toast } from 'sonner';
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';

import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Separator } from '@/app/components/ui/separator';

interface PDFDocumentViewerProps {
  documentUrl: string;
  title?: string | null;
  fileSize?: number | null;
  originalFilename?: string | null;
}

export default function PDFDocumentViewer({
  documentUrl,
  title,
  fileSize,
  originalFilename
}: PDFDocumentViewerProps) {
  const [pdfDoc, setPdfDoc] = React.useState<PDFDocumentProxy | null>(null);
  const [pageNum, setPageNum] = React.useState(1);
  const [pageCount, setPageCount] = React.useState(0);
  const [zoom, setZoom] = React.useState(1.0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [rendering, setRendering] = React.useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const renderTask = React.useRef<any>(null);

  // Load PDF.js dynamically
  React.useEffect(() => {
    const loadPdfJs = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');

        // Set worker path
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const loadingTask = pdfjsLib.getDocument(documentUrl);
        const pdf = await loadingTask.promise;

        setPdfDoc(pdf);
        setPageCount(pdf.numPages);
        setLoading(false);
      } catch (err: any) {
        console.error('Failed to load PDF:', err);
        setError(err.message || 'Failed to load PDF document');
        setLoading(false);
      }
    };

    loadPdfJs();
  }, [documentUrl]);

  // Render page whenever pageNum or zoom changes
  React.useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      setRendering(true);

      try {
        // Cancel any ongoing render task
        if (renderTask.current) {
          renderTask.current.cancel();
        }

        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;

        const viewport = page.getViewport({ scale: zoom });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        } as any;

        renderTask.current = page.render(renderContext);
        await renderTask.current.promise;
        renderTask.current = null;
        setRendering(false);
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error('Failed to render page:', err);
          setRendering(false);
        }
      }
    };

    renderPage();
  }, [pdfDoc, pageNum, zoom]);

  const handleDownload = async () => {
    try {
      const response = await fetch(documentUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = window.document.createElement('a');
      link.href = blobUrl;
      link.download = originalFilename || `${title || 'document'}.pdf`;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      toast.success('Download started');
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed');
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3.0));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handlePrevPage = () => {
    setPageNum((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setPageNum((prev) => Math.min(prev + 1, pageCount));
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= pageCount) {
      setPageNum(value);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (bytes == null) return 'N/A';
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      const kb = bytes / 1024;
      return `${kb.toFixed(2)} KB`;
    }
    return `${mb.toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-24 flex flex-col items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Loading PDF document...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-24 flex flex-col items-center justify-center">
          <AlertCircle className="size-8 text-destructive mb-4" />
          <p className="text-destructive font-semibold mb-2">Failed to load PDF</p>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={handleDownload} variant="outline">
            <Download className="size-4" />
            Download to view locally
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* Document Info */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300">
                <FileText className="size-3 mr-1" />
                PDF
              </Badge>
              {fileSize && (
                <span className="text-sm text-muted-foreground">
                  {formatFileSize(fileSize)}
                </span>
              )}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                aria-label="Zoom out"
              >
                <ZoomOut className="size-4" />
              </Button>
              <span className="text-sm font-medium min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleZoomIn}
                disabled={zoom >= 3.0}
                aria-label="Zoom in"
              >
                <ZoomIn className="size-4" />
              </Button>
            </div>

            {/* Page Navigation */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePrevPage}
                disabled={pageNum <= 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={pageCount}
                  value={pageNum}
                  onChange={handlePageInputChange}
                  className="w-16 h-9 text-center"
                  aria-label="Page number"
                />
                <span className="text-sm text-muted-foreground">
                  / {pageCount}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleNextPage}
                disabled={pageNum >= pageCount}
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>

            {/* Download Button */}
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="size-4" />
              Download
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PDF Canvas */}
      <Card className="overflow-hidden">
        <ScrollArea className="h-[800px]">
          <CardContent className="p-8 flex justify-center bg-muted/30">
            <div className="relative bg-white shadow-lg">
              {rendering && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <canvas
                ref={canvasRef}
                className="max-w-full h-auto"
                aria-label={`PDF page ${pageNum} of ${pageCount}`}
              />
            </div>
          </CardContent>
        </ScrollArea>
      </Card>

      {/* Keyboard Shortcuts Info */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong>Keyboard shortcuts:</strong> Arrow keys to navigate pages, +/- to zoom
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
