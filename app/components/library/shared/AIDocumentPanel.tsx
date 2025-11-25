'use client';

import * as React from 'react';
import {
  Copy,
  Download,
  FileText,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';

import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/app/components/ui/alert-dialog';

interface Document {
  id: string;
  content_id: string;
  markdown: string;
  html?: string | null;
  summary?: string | null;
  version: string;
  status: string;
  model?: string | null;
}

interface AIDocumentPanelProps {
  document: Document;
  recordingId: string;
  onRegenerate?: () => Promise<void>;
  className?: string;
}

export default function AIDocumentPanel({
  document,
  recordingId,
  onRegenerate,
  className,
}: AIDocumentPanelProps) {
  const { theme } = useTheme();
  const [isRegenerateDialogOpen, setIsRegenerateDialogOpen] = React.useState(false);
  const [isRegenerating, setIsRegenerating] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(true);

  const handleCopyDocument = async () => {
    try {
      await navigator.clipboard.writeText(document.markdown);
      toast.success('Document copied to clipboard');
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error('Failed to copy document');
    }
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([document.markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `document-${recordingId}.md`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Markdown download started');
  };

  const handleDownloadHTML = () => {
    // Convert markdown to HTML for download
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document ${recordingId}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      color: #333;
    }
    pre {
      background-color: #f5f5f5;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    code {
      background-color: #f5f5f5;
      padding: 0.2rem 0.4rem;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
    }
  </style>
</head>
<body>
${document.html || document.markdown}
</body>
</html>
    `.trim();

    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `document-${recordingId}.html`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('HTML download started');
  };

  const handleRegenerateConfirm = async () => {
    setIsRegenerating(true);
    setIsRegenerateDialogOpen(false);

    try {
      if (onRegenerate) {
        await onRegenerate();
        toast.success('Document regeneration started');
      }
    } catch (error) {
      console.error('Regenerate failed:', error);
      toast.error('Failed to regenerate document');
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <CardTitle className="text-base">AI-Generated Document</CardTitle>
              {document.status && (
                <Badge
                  variant={
                    document.status === 'generated' ? 'default' : 'secondary'
                  }
                >
                  {document.status}
                </Badge>
              )}
            </div>

            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm">
                  {isExpanded ? (
                    <ChevronUp className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </CardHeader>

        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Summary (if available) */}
              {document.summary && (
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <p className="text-sm font-semibold mb-2">Summary</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {document.summary}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyDocument}
                  title="Copy markdown"
                >
                  <Copy className="size-4" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadMarkdown}
                  title="Download as Markdown"
                >
                  <Download className="size-4" />
                  Markdown
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadHTML}
                  title="Download as HTML"
                >
                  <FileText className="size-4" />
                  HTML
                </Button>
                {onRegenerate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRegenerateDialogOpen(true)}
                    disabled={isRegenerating}
                    title="Regenerate document with AI"
                  >
                    {isRegenerating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="size-4" />
                    )}
                    Regenerate
                  </Button>
                )}
              </div>

              {/* Document Content */}
              <ScrollArea className="h-[500px] rounded-md border p-6 bg-card">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      code({ inline, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const language = match ? match[1] : '';

                        return !inline && language ? (
                          <SyntaxHighlighter
                            style={theme === 'dark' ? oneDark : oneLight}
                            language={language}
                            PreTag="div"
                            {...props}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...props}>
                            {children}
                          </code>
                        );
                      },
                    }}
                  >
                    {document.markdown}
                  </ReactMarkdown>
                </div>
              </ScrollArea>

              {/* Metadata */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                {document.model && <span>Model: {document.model}</span>}
                {document.version && <span>Version: {document.version}</span>}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Regenerate Confirmation Dialog */}
      <AlertDialog
        open={isRegenerateDialogOpen}
        onOpenChange={setIsRegenerateDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Document?</AlertDialogTitle>
            <AlertDialogDescription>
              This will use AI to regenerate the document from the transcript. The
              current document will be replaced. This action may take a few minutes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerateConfirm}>
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
