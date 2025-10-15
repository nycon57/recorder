'use client';

import * as React from 'react';
import { Copy, Download, Edit3, X, Check, FileText, Search, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
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
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isEditing, setIsEditing] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);
  const [editedMarkdown, setEditedMarkdown] = React.useState(document.markdown);
  const [isSaving, setIsSaving] = React.useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = React.useState(0);
  const [totalMatches, setTotalMatches] = React.useState(0);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const matchRefs = React.useRef<(HTMLElement | null)[]>([]);
  const matchIndexMap = React.useRef<Map<string, number>>(new Map());

  // Count matches when search query changes
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setTotalMatches(0);
      setCurrentMatchIndex(0);
      matchRefs.current = [];
      matchIndexMap.current.clear();
      return;
    }

    const regex = new RegExp(searchQuery, 'gi');
    const matches = document.markdown.match(regex);
    const matchCount = matches ? matches.length : 0;

    console.log('[DocumentViewer] Search query changed:', {
      query: searchQuery,
      totalMatches: matchCount,
    });

    setTotalMatches(matchCount);
    setCurrentMatchIndex(matchCount > 0 ? 0 : -1);
    matchRefs.current = new Array(matchCount).fill(null);
    matchIndexMap.current.clear();
  }, [searchQuery, document.markdown]);


  // Scroll to current match
  React.useEffect(() => {
    console.log('[DocumentViewer] Current match index changed:', {
      currentMatchIndex,
      totalRefs: matchRefs.current.length,
      hasRef: !!matchRefs.current[currentMatchIndex],
      refElement: matchRefs.current[currentMatchIndex],
    });
    if (currentMatchIndex >= 0 && matchRefs.current[currentMatchIndex]) {
      matchRefs.current[currentMatchIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentMatchIndex]);

  const handleNextMatch = () => {
    if (totalMatches > 0) {
      setCurrentMatchIndex((prev) => {
        const next = (prev + 1) % totalMatches;
        console.log('[DocumentViewer] Next match:', { prev, next, totalMatches });
        return next;
      });
    }
  };

  const handlePreviousMatch = () => {
    if (totalMatches > 0) {
      setCurrentMatchIndex((prev) => {
        const next = (prev - 1 + totalMatches) % totalMatches;
        console.log('[DocumentViewer] Previous match:', { prev, next, totalMatches });
        return next;
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        handlePreviousMatch();
      } else {
        handleNextMatch();
      }
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);

    let localMatchCounter = 0;
    return parts.map((part, index) => {
      const isMatch = index % 2 === 1;
      if (isMatch) {
        // Create a unique key for this match based on text content and local position
        const matchKey = `${text}:${localMatchCounter}`;
        localMatchCounter++;

        // Get or assign a global index for this match
        let matchIdx = matchIndexMap.current.get(matchKey);
        if (matchIdx === undefined) {
          matchIdx = matchIndexMap.current.size;
          matchIndexMap.current.set(matchKey, matchIdx);
          console.log('[DocumentViewer] New match assigned:', {
            matchKey,
            matchIdx,
            part,
            mapSize: matchIndexMap.current.size,
          });
        }

        const isActive = matchIdx === currentMatchIndex;
        return (
          <mark
            key={index}
            ref={(el) => {
              if (el && matchRefs.current[matchIdx] !== el) {
                matchRefs.current[matchIdx] = el;
                console.log('[DocumentViewer] Ref assigned:', { matchIdx, part, hasElement: !!el });
              }
            }}
            className={
              isActive
                ? 'bg-orange-400 dark:bg-orange-600 font-semibold'
                : 'bg-yellow-200 dark:bg-yellow-900/50'
            }
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  // Process markdown children to add highlights
  const processChildren = (children: React.ReactNode): React.ReactNode => {
    console.log('[DocumentViewer] processChildren called:', {
      type: typeof children,
      isArray: Array.isArray(children),
      children: children,
    });
    if (typeof children === 'string') {
      return highlightText(children, searchQuery);
    }
    return children;
  };

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
    } catch {
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
    } catch {
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
                Copy
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportMd}>
                <Download className="size-4" />
                Export MD
              </Button>
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                <Edit3 className="size-4" />
                Edit
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

      {/* Search Bar */}
      {!isEditing && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search document... (Enter: next, Shift+Enter: previous)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9"
            />
          </div>
          {totalMatches > 0 && (
            <>
              <Badge variant="secondary" className="whitespace-nowrap">
                {currentMatchIndex + 1} / {totalMatches}
              </Badge>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handlePreviousMatch}
                  disabled={totalMatches === 0}
                  className="h-9 w-9"
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={handleNextMatch}
                  disabled={totalMatches === 0}
                  className="h-9 w-9"
                >
                  <ChevronDown className="size-4" />
                </Button>
              </div>
            </>
          )}
        </div>
      )}

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
                    h1: ({ children }) => (
                      <h1 className="text-3xl font-bold mt-8 mb-4 first:mt-0">
                        {processChildren(children)}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-2xl font-bold mt-6 mb-3">
                        {processChildren(children)}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-xl font-semibold mt-5 mb-2">
                        {processChildren(children)}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="leading-relaxed mb-4 text-base">
                        {processChildren(children)}
                      </p>
                    ),
                    code: ({ inline, children }) =>
                      inline ? (
                        <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">
                          {processChildren(children)}
                        </code>
                      ) : (
                        <code className="block bg-muted p-3 rounded text-sm font-mono overflow-x-auto">
                          {processChildren(children)}
                        </code>
                      ),
                    strong: ({ children }) => (
                      <strong className="font-bold text-foreground">
                        {processChildren(children)}
                      </strong>
                    ),
                    ul: ({ children }) => <ul className="my-4 ml-6 list-disc space-y-2">{children}</ul>,
                    ol: ({ children }) => <ol className="my-4 ml-6 list-decimal space-y-2">{children}</ol>,
                    li: ({ children }) => (
                      <li className="leading-relaxed">
                        {processChildren(children)}
                      </li>
                    ),
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
        <ScrollArea className="h-[600px] rounded-md border p-8" ref={scrollAreaRef}>
          <div className="max-w-none space-y-4 document-viewer">
            <ReactMarkdown
              components={{
                h1: ({ children }) => (
                  <h1 className="text-3xl font-bold mt-8 mb-4 first:mt-0">
                    {processChildren(children)}
                  </h1>
                ),
                h2: ({ children }) => (
                  <h2 className="text-2xl font-bold mt-6 mb-3">
                    {processChildren(children)}
                  </h2>
                ),
                h3: ({ children }) => (
                  <h3 className="text-xl font-semibold mt-5 mb-2">
                    {processChildren(children)}
                  </h3>
                ),
                p: ({ children }) => (
                  <p className="leading-relaxed mb-4 text-base">
                    {processChildren(children)}
                  </p>
                ),
                code: ({ inline, children }) =>
                  inline ? (
                    <code className="bg-muted px-2 py-0.5 rounded text-sm font-mono">
                      {processChildren(children)}
                    </code>
                  ) : (
                    <code className="block bg-muted p-3 rounded text-sm font-mono overflow-x-auto">
                      {processChildren(children)}
                    </code>
                  ),
                strong: ({ children }) => (
                  <strong className="font-bold text-foreground">
                    {processChildren(children)}
                  </strong>
                ),
                ul: ({ children }) => <ul className="my-4 ml-6 list-disc space-y-2">{children}</ul>,
                ol: ({ children }) => <ol className="my-4 ml-6 list-decimal space-y-2">{children}</ol>,
                li: ({ children }) => (
                  <li className="leading-relaxed">
                    {processChildren(children)}
                  </li>
                ),
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
