'use client';

import * as React from 'react';
import {
  Copy,
  Download,
  Edit3,
  X,
  Check,
  FileText,
  Eye,
  Code,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';

import { Button } from '@/app/components/ui/button';
import { Textarea } from '@/app/components/ui/textarea';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Separator } from '@/app/components/ui/separator';
import { Badge } from '@/app/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/app/components/ui/tabs';

interface TextNoteViewerProps {
  recordingId: string;
  content: string;
  title?: string | null;
  fileType?: 'txt' | 'md' | null;
  onContentUpdate?: (content: string) => void;
}

export default function TextNoteViewer({
  recordingId,
  content: initialContent,
  title,
  fileType = 'txt',
  onContentUpdate
}: TextNoteViewerProps) {
  const { theme } = useTheme();
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedContent, setEditedContent] = React.useState(initialContent);
  const [isSaving, setIsSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<'edit' | 'preview'>('preview');

  const isMarkdown = fileType === 'md';
  const wordCount = initialContent.split(/\s+/).filter(Boolean).length;
  const charCount = initialContent.length;
  const lineCount = initialContent.split('\n').length;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(initialContent);
      toast.success('Content copied to clipboard');
    } catch {
      toast.error('Failed to copy content');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([initialContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'note'}.${fileType || 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Download started');
  };

  const handleExportPDF = () => {
    // For future implementation: convert to PDF using browser print
    window.print();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Update via transcript API (text content is stored in transcript table)
      const response = await fetch(`/api/recordings/${recordingId}/transcript`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: editedContent,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save content');
      }

      toast.success('Content updated successfully');
      setIsEditing(false);
      onContentUpdate?.(editedContent);
      // Refresh the page to show updated data
      window.location.reload();
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save content');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(initialContent);
    setIsEditing(false);
    setActiveTab('preview');
  };

  const handleEdit = () => {
    setIsEditing(true);
    setActiveTab('edit');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Text Note</CardTitle>
              <Badge variant="outline" className="uppercase">
                {fileType}
              </Badge>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {!isEditing ? (
                <>
                  <Button size="sm" variant="outline" onClick={handleCopy}>
                    <Copy className="size-4" />
                    Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDownload}>
                    <Download className="size-4" />
                    Download
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleEdit}>
                    <Edit3 className="size-4" />
                    Edit
                  </Button>
                </>
              ) : (
                <>
                  <Button size="sm" variant="outline" onClick={handleCancel}>
                    <X className="size-4" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving || editedContent === initialContent}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Saving...
                      </>
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
        </CardHeader>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Words</p>
            <p className="text-2xl font-bold">{wordCount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Characters</p>
            <p className="text-2xl font-bold">{charCount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Lines</p>
            <p className="text-2xl font-bold">{lineCount.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Content */}
      {isEditing ? (
        <Card>
          <CardContent className="p-0">
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <div className="border-b px-4 pt-4">
                <TabsList>
                  <TabsTrigger value="edit">
                    <Code className="size-4" />
                    Edit
                  </TabsTrigger>
                  {isMarkdown && (
                    <TabsTrigger value="preview">
                      <Eye className="size-4" />
                      Preview
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <TabsContent value="edit" className="p-4 m-0">
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="min-h-[600px] font-mono text-sm resize-none"
                  placeholder="Enter your text here..."
                  autoFocus
                />
              </TabsContent>

              {isMarkdown && (
                <TabsContent value="preview" className="p-4 m-0">
                  <ScrollArea className="h-[600px]">
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
                        {editedContent}
                      </ReactMarkdown>
                    </div>
                  </ScrollArea>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <ScrollArea className="h-[600px]">
              {isMarkdown ? (
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
                    {initialContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <pre className="font-mono text-sm whitespace-pre-wrap leading-relaxed">
                  {initialContent}
                </pre>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Print styles for PDF export */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .prose,
          .prose * {
            visibility: visible;
          }
          .prose {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
