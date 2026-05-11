'use client';

/* global HTMLCanvasElement */

import * as React from 'react';
import {
  Download,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';

import { Card, CardContent } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Input } from '@/app/components/ui/input';
import { ScrollArea } from '@/app/components/ui/scroll-area';

interface PDFDocumentViewerProps {
  documentUrl: string;
  title?: string | null;
  fileSize?: number | null;
  originalFilename?: string | null;
}

interface PdfViewerState {
  pageNum: number;
  pageCount: number;
  error: string | null;
  rendering: boolean;
}

type PdfViewerAction =
  | { type: 'reset' }
  | { type: 'loaded'; pageCount: number }
  | { type: 'error'; message: string }
  | { type: 'set-page'; pageNum: number }
  | { type: 'set-rendering'; rendering: boolean };

const INITIAL_PDF_VIEWER_STATE: PdfViewerState = {
  pageNum: 1,
  pageCount: 0,
  error: null,
  rendering: false,
};

function pdfViewerReducer(
  state: PdfViewerState,
  action: PdfViewerAction,
): PdfViewerState {
  switch (action.type) {
    case 'reset':
      return INITIAL_PDF_VIEWER_STATE;
    case 'loaded':
      return { ...state, pageCount: action.pageCount, error: null };
    case 'error':
      return { ...state, error: action.message, rendering: false };
    case 'set-page':
      return { ...state, pageNum: action.pageNum };
    case 'set-rendering':
      return { ...state, rendering: action.rendering };
    default:
      return state;
  }
}

function formatFileSize(bytes: number | null) {
  if (bytes == null) return 'N/A';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${mb.toFixed(2)} MB`;
}

function PdfLoadingState() {
  return (
    <Card>
      <CardContent className="py-24 flex flex-col items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading PDF document…</p>
      </CardContent>
    </Card>
  );
}

function PdfErrorState({
  error,
  onDownload,
}: {
  error: string;
  onDownload: () => void;
}) {
  return (
    <Card>
      <CardContent className="py-24 flex flex-col items-center justify-center">
        <AlertCircle className="size-8 text-destructive mb-4" />
        <p className="text-destructive font-semibold mb-2">
          Failed to load PDF
        </p>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Button onClick={onDownload} variant="outline">
          <Download className="size-4" />
          Download to view locally
        </Button>
      </CardContent>
    </Card>
  );
}

function PdfControls({
  fileSize,
  zoom,
  pageNum,
  pageCount,
  onZoomIn,
  onZoomOut,
  onPrevPage,
  onNextPage,
  onPageInputChange,
  onDownload,
}: {
  fileSize: number;
  zoom: number;
  pageNum: number;
  pageCount: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPageInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDownload: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300"
            >
              <FileText className="size-3 mr-1" />
              PDF
            </Badge>
            {fileSize > 0 && (
              <span className="text-sm text-muted-foreground">
                {formatFileSize(fileSize)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onZoomOut}
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
              onClick={onZoomIn}
              disabled={zoom >= 3.0}
              aria-label="Zoom in"
            >
              <ZoomIn className="size-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onPrevPage}
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
                onChange={onPageInputChange}
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
              onClick={onNextPage}
              disabled={pageNum >= pageCount}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <Button size="sm" variant="outline" onClick={onDownload}>
            <Download className="size-4" />
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PdfCanvas({
  rendering,
  canvasRef,
  pageNum,
  pageCount,
}: {
  rendering: boolean;
  canvasRef: React.Ref<HTMLCanvasElement>;
  pageNum: number;
  pageCount: number;
}) {
  return (
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
  );
}

function PdfKeyboardHint() {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">
          <strong>Keyboard shortcuts:</strong> Arrow keys to navigate pages, +/-
          to zoom
        </p>
      </CardContent>
    </Card>
  );
}

export default function PDFDocumentViewer({
  documentUrl,
  title,
  fileSize,
  originalFilename,
}: PDFDocumentViewerProps) {
  const [state, dispatch] = React.useReducer(
    pdfViewerReducer,
    INITIAL_PDF_VIEWER_STATE,
  );
  const [zoom, setZoom] = React.useState(1.0);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const pdfDocRef = React.useRef<PDFDocumentProxy | null>(null);
  const renderTask = React.useRef<RenderTask | null>(null);
  const normalizedFileSize = fileSize ?? 0;
  const { pageNum, pageCount, error, rendering } = state;

  React.useEffect(() => {
    const loadPdfJs = async () => {
      try {
        pdfDocRef.current = null;
        dispatch({ type: 'reset' });

        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        const loadingTask = pdfjsLib.getDocument(documentUrl);
        const pdf = await loadingTask.promise;

        pdfDocRef.current = pdf;
        dispatch({ type: 'loaded', pageCount: pdf.numPages });
      } catch (err) {
        console.error('Failed to load PDF:', err);
        dispatch({
          type: 'error',
          message:
            err instanceof Error ? err.message : 'Failed to load PDF document',
        });
      }
    };

    loadPdfJs();
  }, [documentUrl]);

  React.useEffect(() => {
    const pdfDoc = pdfDocRef.current;
    if (!pdfDoc || !canvasRef.current) return;

    const renderPage = async () => {
      dispatch({ type: 'set-rendering', rendering: true });

      try {
        if (renderTask.current) {
          renderTask.current.cancel();
        }

        const page = await pdfDoc.getPage(pageNum);
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;
        const viewport = page.getViewport({ scale: zoom });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext: Parameters<PDFPageProxy['render']>[0] = {
          canvas,
          canvasContext: context,
          viewport,
        };

        renderTask.current = page.render(renderContext);
        await renderTask.current.promise;
        renderTask.current = null;
        dispatch({ type: 'set-rendering', rendering: false });
      } catch (err) {
        if (
          !(err instanceof Error) ||
          err.name !== 'RenderingCancelledException'
        ) {
          console.error('Failed to render page:', err);
          dispatch({ type: 'set-rendering', rendering: false });
        }
      }
    };

    renderPage();
  }, [pageCount, pageNum, zoom]);

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
    } catch (downloadError) {
      console.error('Download failed:', downloadError);
      toast.error('Download failed');
    }
  };

  if (!error && pageCount === 0) {
    return <PdfLoadingState />;
  }

  if (error) {
    return <PdfErrorState error={error} onDownload={handleDownload} />;
  }

  return (
    <div className="space-y-4">
      <PdfControls
        fileSize={normalizedFileSize}
        zoom={zoom}
        pageNum={pageNum}
        pageCount={pageCount}
        onZoomIn={() => setZoom((prev) => Math.min(prev + 0.25, 3.0))}
        onZoomOut={() => setZoom((prev) => Math.max(prev - 0.25, 0.5))}
        onPrevPage={() =>
          dispatch({ type: 'set-page', pageNum: Math.max(pageNum - 1, 1) })
        }
        onNextPage={() =>
          dispatch({
            type: 'set-page',
            pageNum: Math.min(pageNum + 1, pageCount),
          })
        }
        onPageInputChange={(event) => {
          const value = parseInt(event.target.value, 10);
          if (!isNaN(value) && value >= 1 && value <= pageCount) {
            dispatch({ type: 'set-page', pageNum: value });
          }
        }}
        onDownload={handleDownload}
      />

      <PdfCanvas
        rendering={rendering}
        canvasRef={canvasRef}
        pageNum={pageNum}
        pageCount={pageCount}
      />

      <PdfKeyboardHint />
    </div>
  );
}
