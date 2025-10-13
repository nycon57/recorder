'use client';

import * as React from 'react';
import { Copy, Download, Edit3, X, Check, FileText, Loader2, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Separator } from '@/app/components/ui/separator';
import { Badge } from '@/app/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/app/components/ui/accordion';

interface Document {
  id: string;
  recording_id: string;
  markdown: string;
  html: string | null;
  summary: string | null;
  version: string;
  status: string;
}

interface DocumentViewerProps {
  document: Document;
  recordingId: string;
}

export default function DocumentViewer({ document, recordingId }: DocumentViewerProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [editedMarkdown, setEditedMarkdown] = React.useState(document.markdown);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isRegenerating, setIsRegenerating] = React.useState(false);

  const downloadAsFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = filename;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(document.markdown);
      toast.success('Markdown copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy markdown');
    }
  };

  const handleExportMd = () => {
    downloadAsFile(
      document.markdown,
      `document-${recordingId}.md`,
      'text/markdown'
    );
    toast.success('Document downloaded as MD');
  };

  const handleExportHtml = () => {
    const htmlContent = document.html || `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.6; }
    h1, h2, h3 { margin-top: 1.5em; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    pre { background: #f4f4f4; padding: 12px; border-radius: 6px; overflow-x: auto; }
  </style>
</head>
<body>
  ${document.html}
</body>
</html>
`;

    downloadAsFile(htmlContent, `document-${recordingId}.html`, 'text/html');
    toast.success('Document downloaded as HTML');
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/recordings/${recordingId}/document`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown: editedMarkdown }),
      });

      if (!response.ok) {
        throw new Error('Failed to save document');
      }

      toast.success('Document updated successfully');
      setIsEditing(false);
      setShowPreview(false);
      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      toast.error('Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedMarkdown(document.markdown);
    setIsEditing(false);
    setShowPreview(false);
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const response = await fetch(`/api/recordings/${recordingId}/document`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to regenerate document');
      }

      toast.success('Document regeneration started. This may take a few minutes.');

      // Reload after a few seconds to show the job status
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      toast.error('Failed to start document regeneration');
      setIsRegenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <Badge variant="outline">Version {document.version}</Badge>
          {document.status && (
            <Badge variant="secondary">{document.status}</Badge>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isEditing ? (
            <>
              <Button size="sm" variant="outline" onClick={handleCopyMarkdown}>
                <Copy className="size-4" />
                Copy Markdown
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportMd}>
                <Download className="size-4" />
                Export MD
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportHtml}>
                <Download className="size-4" />
                Export HTML
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                <Edit3 className="size-4" />
                Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRegenerate}
                disabled={isRegenerating}
              >
                {isRegenerating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <FileText className="size-4" />
                )}
                Regenerate
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? 'Edit' : 'Preview'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="size-4" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Check className="size-4" />
                    Save
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Summary Section */}
      {document.summary && !isEditing && (
        <Accordion type="single" collapsible defaultValue="summary">
          <AccordionItem value="summary" className="border rounded-md px-4">
            <AccordionTrigger className="hover:no-underline">
              <span className="font-semibold text-sm">Summary</span>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {document.summary}
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Content */}
      {isEditing ? (
        <div className="space-y-4">
          {showPreview ? (
            <ScrollArea className="h-[600px] rounded-md border p-8">
              <div className="max-w-none space-y-4 document-viewer">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => <h1 className="text-3xl font-bold mt-8 mb-4 first:mt-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-2xl font-bold mt-6 mb-3">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-xl font-semibold mt-5 mb-2">{children}</h3>,
                    p: ({ children }) => <p className="leading-relaxed mb-4 text-base">{children}</p>,
                    code: ({ inline, children }) =>
                      inline ? (
                        <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">{children}</code>
                      ) : (
                        <code className="block bg-muted p-3 rounded text-sm font-mono overflow-x-auto">{children}</code>
                      ),
                    strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                    ul: ({ children }) => <ul className="my-4 ml-6 list-disc space-y-2">{children}</ul>,
                    ol: ({ children }) => <ol className="my-4 ml-6 list-decimal space-y-2">{children}</ol>,
                    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                  }}
                >
                  {editedMarkdown}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          ) : (
            <Textarea
              value={editedMarkdown}
              onChange={(e) => setEditedMarkdown(e.target.value)}
              className="min-h-[600px] font-mono text-sm"
              placeholder="Edit document markdown..."
            />
          )}
        </div>
      ) : (
        <ScrollArea className="h-[600px] rounded-md border p-8">
          <div className="max-w-none space-y-4 document-viewer">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-3xl font-bold mt-8 mb-4 first:mt-0">{children}</h1>,
                h2: ({ children }) => <h2 className="text-2xl font-bold mt-6 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-xl font-semibold mt-5 mb-2">{children}</h3>,
                p: ({ children }) => <p className="leading-relaxed mb-4 text-base">{children}</p>,
                code: ({ inline, children }) =>
                  inline ? (
                    <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">{children}</code>
                  ) : (
                    <code className="block bg-muted p-3 rounded text-sm font-mono overflow-x-auto">{children}</code>
                  ),
                strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
                ul: ({ children }) => <ul className="my-4 ml-6 list-disc space-y-2">{children}</ul>,
                ol: ({ children }) => <ol className="my-4 ml-6 list-decimal space-y-2">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              }}
            >
              {document.markdown}
            </ReactMarkdown>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
