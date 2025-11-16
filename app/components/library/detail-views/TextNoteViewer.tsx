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
  Loader2,
  Type,
  Hash,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown, { Components } from 'react-markdown';
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
import { cn } from '@/lib/utils';

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

  // File type color configuration - using new content-type CSS variables
  const fileTypeConfig = {
    'txt': {
      color: 'text-content-text',
      bgColor: 'bg-content-text-bg',
      borderColor: 'border-l-content-text-border'
    },
    'md': {
      color: 'text-content-text',
      bgColor: 'bg-content-text-bg',
      borderColor: 'border-l-content-text-border'
    },
    'default': {
      color: 'text-content-text',
      bgColor: 'bg-content-text-bg',
      borderColor: 'border-l-content-text-border'
    }
  };
  const config = fileTypeConfig[fileType || 'default'] || fileTypeConfig.default;

  // Enhanced stats with reading time
  const readingTime = Math.ceil(wordCount / 200);
  const statsConfig = [
    {
      label: 'Words',
      value: wordCount,
      icon: <Type className="h-4 w-4" />,
      subtext: `~${readingTime} min read`
    },
    {
      label: 'Characters',
      value: charCount,
      icon: <Hash className="h-4 w-4" />
    },
    {
      label: 'Lines',
      value: lineCount,
      icon: <FileText className="h-4 w-4" />
    }
  ];

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
      if (onContentUpdate) {
        onContentUpdate(editedContent);
      }
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
    <div className="space-y-6">
      {/* Enhanced Header */}
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:gap-6">
            {/* Title Row */}
            <div className="flex items-start gap-3">
              <div className={cn("p-2.5 rounded-lg shrink-0", config.bgColor)}>
                <FileText className={cn("h-5 w-5", config.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
                  {title || 'Untitled Note'}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {(fileType || 'txt').toUpperCase()} Document
                </p>
              </div>
            </div>

            {/* Actions Row */}
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {!isEditing ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopy}
                    className="transition-all hover:shadow-sm hover:scale-105"
                  >
                    <Copy className="size-4" />
                    Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownload}
                    className="transition-all hover:shadow-sm hover:scale-105"
                  >
                    <Download className="size-4" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleEdit}
                    className="transition-all hover:shadow-sm hover:scale-105"
                  >
                    <Edit3 className="size-4" />
                    Edit
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    className="transition-all hover:shadow-sm"
                  >
                    <X className="size-4" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={isSaving || editedContent === initialContent}
                    className="transition-all hover:shadow-sm"
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
        </CardContent>
      </Card>

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {statsConfig.map((stat) => (
          <Card
            key={stat.label}
            className={cn(
              'transition-all duration-200 hover:shadow-md hover:scale-[1.02] border-l-4',
              config.borderColor
            )}
          >
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </div>
                <div className={cn('p-2 rounded-md', config.bgColor)}>
                  {stat.icon}
                </div>
              </div>
              <div className="text-3xl font-bold tabular-nums tracking-tight">
                {stat.value.toLocaleString()}
              </div>
              {stat.subtext && (
                <div className="text-xs text-muted-foreground">
                  {stat.subtext}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

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
                <TabsContent value="preview" className="p-8 m-0">
                  <div className="min-h-[600px] max-h-[800px] overflow-y-auto">
                    <div className="prose dark:prose-invert max-w-3xl mx-auto prose-sm sm:prose-base prose-headings:font-semibold prose-p:leading-relaxed">
                      <ReactMarkdown
                        components={{
                          code(props: Parameters<NonNullable<Components['code']>>[0]) {
                            const { inline, className, children, ...rest } = props;
                            const match = /language-(\w+)/.exec(className || '');
                            const language = match ? match[1] : '';

                            return !inline && language ? (
                              <SyntaxHighlighter
                                style={theme === 'dark' ? oneDark : oneLight}
                                language={language}
                                PreTag="div"
                                {...rest}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code className={className} {...rest}>
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {editedContent}
                      </ReactMarkdown>
                    </div>
                  </div>
                </TabsContent>
              )}
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-none bg-transparent">
          <CardContent className="p-0">
            <div className="min-h-[400px] max-h-[800px] overflow-y-auto px-6 py-8 sm:px-8 sm:py-10">
              {isMarkdown ? (
                <div className="prose dark:prose-invert max-w-3xl mx-auto prose-sm sm:prose-base prose-headings:font-semibold prose-p:leading-relaxed">
                  <ReactMarkdown
                    components={{
                      code(props: Parameters<NonNullable<Components['code']>>[0]) {
                        const { inline, className, children, ...rest } = props;
                        const match = /language-(\w+)/.exec(className || '');
                        const language = match ? match[1] : '';

                        return !inline && language ? (
                          <SyntaxHighlighter
                            style={theme === 'dark' ? oneDark : oneLight}
                            language={language}
                            PreTag="div"
                            {...rest}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={className} {...rest}>
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
                <pre className="font-mono text-sm sm:text-base whitespace-pre-wrap leading-relaxed max-w-3xl mx-auto">
                  {initialContent}
                </pre>
              )}
            </div>
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
