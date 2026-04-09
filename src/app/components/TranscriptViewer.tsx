'use client';

import * as React from 'react';
import { Search, Copy, Download, Edit3, X, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Textarea } from '@/app/components/ui/textarea';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Badge } from '@/app/components/ui/badge';
import { Separator } from '@/app/components/ui/separator';

interface Transcript {
  id: string;
  content_id: string;
  text: string;
  language: string | null;
  words_json: any;
  confidence: number | null;
  provider: string | null;
}

interface TranscriptViewerProps {
  transcript: Transcript;
  recordingId: string;
}

export default function TranscriptViewer({ transcript, recordingId }: TranscriptViewerProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedText, setEditedText] = React.useState(transcript.text);
  const [isSaving, setIsSaving] = React.useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = React.useState(0);
  const [totalMatches, setTotalMatches] = React.useState(0);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const matchRefs = React.useRef<(HTMLElement | null)[]>([]);

  const wordCount = transcript.text.split(/\s+/).filter(Boolean).length;

  // Count matches when search query changes
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setTotalMatches(0);
      setCurrentMatchIndex(0);
      matchRefs.current = [];
      return;
    }

    const regex = new RegExp(searchQuery, 'gi');
    const matches = transcript.text.match(regex);
    setTotalMatches(matches ? matches.length : 0);
    setCurrentMatchIndex(matches && matches.length > 0 ? 0 : -1);
    matchRefs.current = [];
  }, [searchQuery, transcript.text]);

  // Scroll to current match
  React.useEffect(() => {
    if (currentMatchIndex >= 0 && matchRefs.current[currentMatchIndex]) {
      matchRefs.current[currentMatchIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentMatchIndex]);

  const handleNextMatch = () => {
    if (totalMatches > 0) {
      setCurrentMatchIndex((prev) => (prev + 1) % totalMatches);
    }
  };

  const handlePreviousMatch = () => {
    if (totalMatches > 0) {
      setCurrentMatchIndex((prev) => (prev - 1 + totalMatches) % totalMatches);
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
    let matchIndex = 0;

    return parts.map((part, index) => {
      const isMatch = regex.test(part);
      if (isMatch) {
        const currentIndex = matchIndex;
        const isActive = currentIndex === currentMatchIndex;
        matchIndex++;
        return (
          <mark
            key={index}
            ref={(el) => {
              matchRefs.current[currentIndex] = el;
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

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript.text);
      toast.success('Transcript copied to clipboard');
    } catch {
      toast.error('Failed to copy transcript');
    }
  };

  const downloadAsFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportTxt = () => {
    downloadAsFile(
      transcript.text,
      `transcript-${recordingId}.txt`,
      'text/plain'
    );
    toast.success('Transcript downloaded as TXT');
  };

  const handleExportSrt = () => {
    if (!transcript.words_json || !Array.isArray(transcript.words_json)) {
      toast.error('Word-level timestamps not available for SRT export');
      return;
    }

    // Generate SRT format from words_json
    let srtContent = '';
    let index = 1;
    const wordsPerSubtitle = 10;

    for (let i = 0; i < transcript.words_json.length; i += wordsPerSubtitle) {
      const chunk = transcript.words_json.slice(i, i + wordsPerSubtitle);
      const startTime = chunk[0]?.start || 0;
      const endTime = chunk[chunk.length - 1]?.end || startTime + 2;
      const text = chunk.map((w: any) => w.word).join(' ');

      srtContent += `${index}\n`;
      srtContent += `${formatSrtTime(startTime)} --> ${formatSrtTime(endTime)}\n`;
      srtContent += `${text}\n\n`;
      index++;
    }

    downloadAsFile(srtContent, `transcript-${recordingId}.srt`, 'text/plain');
    toast.success('Transcript downloaded as SRT');
  };

  const formatSrtTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/recordings/${recordingId}/transcript`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editedText }),
      });

      if (!response.ok) {
        throw new Error('Failed to save transcript');
      }

      toast.success('Transcript updated successfully');
      setIsEditing(false);
      // Refresh the page to show updated data
      window.location.reload();
    } catch {
      toast.error('Failed to save transcript');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedText(transcript.text);
    setIsEditing(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {wordCount.toLocaleString()} words
          </p>
          {transcript.language && (
            <Badge variant="outline" className="uppercase">
              {transcript.language}
            </Badge>
          )}
          {transcript.confidence && (
            <Badge variant="secondary">
              {Math.round(transcript.confidence * 100)}% confidence
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <Button size="sm" variant="outline" onClick={handleCopy}>
                <Copy className="size-4" />
                Copy
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportTxt}>
                <Download className="size-4" />
                Export TXT
              </Button>
              {transcript.words_json && (
                <Button size="sm" variant="outline" onClick={handleExportSrt}>
                  <Download className="size-4" />
                  Export SRT
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
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
              placeholder="Search transcript... (Enter: next, Shift+Enter: previous)"
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

      {/* Content */}
      {isEditing ? (
        <Textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          className="min-h-[400px] font-mono text-sm"
          placeholder="Edit transcript..."
        />
      ) : (
        <ScrollArea className="h-[500px] rounded-md border p-4" ref={scrollAreaRef}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <p className="whitespace-pre-wrap leading-relaxed">
              {highlightText(transcript.text, searchQuery)}
            </p>
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
