'use client';

import * as React from 'react';
import {
  Copy,
  Download,
  Search,
  X,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/app/components/ui/collapsible';

interface Word {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

interface Transcript {
  id: string;
  text: string;
  words_json?: Word[] | null;
  language?: string | null;
  confidence?: number | null;
  provider?: string | null;
}

interface TranscriptPanelProps {
  transcript: Transcript;
  recordingId: string;
  onTimestampClick?: (timestamp: number) => void;
  className?: string;
}

export default function TranscriptPanel({
  transcript,
  recordingId,
  onTimestampClick,
  className,
}: TranscriptPanelProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [highlightedIndices, setHighlightedIndices] = React.useState<number[]>(
    []
  );
  const [isExpanded, setIsExpanded] = React.useState(true);

  const words = React.useMemo(() => {
    if (transcript.words_json && Array.isArray(transcript.words_json)) {
      return transcript.words_json;
    }
    return [];
  }, [transcript.words_json]);

  const hasWords = words.length > 0;

  // Search functionality
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setHighlightedIndices([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const query = searchQuery.toLowerCase();
    const matches: number[] = [];

    words.forEach((word, index) => {
      if (word.word.toLowerCase().includes(query)) {
        matches.push(index);
      }
    });

    setHighlightedIndices(matches);
    setIsSearching(false);
  }, [searchQuery, words]);

  const handleCopyTranscript = async () => {
    try {
      await navigator.clipboard.writeText(transcript.text);
      toast.success('Transcript copied to clipboard');
    } catch (error) {
      console.error('Copy failed:', error);
      toast.error('Failed to copy transcript');
    }
  };

  const handleDownloadTranscript = () => {
    const blob = new Blob([transcript.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${recordingId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Transcript download started');
  };

  const handleDownloadVTT = () => {
    if (!hasWords) {
      toast.error('Timestamped transcript not available');
      return;
    }

    // Generate VTT format
    let vtt = 'WEBVTT\n\n';
    let currentStart = 0;
    let currentText = '';
    const chunkSize = 10; // words per subtitle

    words.forEach((word, index) => {
      if (index % chunkSize === 0 && index > 0) {
        const endTime = words[index - 1].end;
        vtt += `${formatVTTTime(currentStart)} --> ${formatVTTTime(endTime)}\n`;
        vtt += `${currentText.trim()}\n\n`;
        currentStart = word.start;
        currentText = '';
      }
      currentText += word.word + ' ';
    });

    // Add final chunk
    if (currentText) {
      const endTime = words[words.length - 1].end;
      vtt += `${formatVTTTime(currentStart)} --> ${formatVTTTime(endTime)}\n`;
      vtt += `${currentText.trim()}\n`;
    }

    const blob = new Blob([vtt], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${recordingId}.vtt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('VTT file download started');
  };

  const formatVTTTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  };

  const handleWordClick = (word: Word) => {
    onTimestampClick?.(word.start);
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-muted-foreground" />
            <CardTitle className="text-base">Transcript</CardTitle>
            {transcript.language && (
              <Badge variant="outline" className="uppercase">
                {transcript.language}
              </Badge>
            )}
            {highlightedIndices.length > 0 && (
              <Badge variant="secondary">
                {highlightedIndices.length} match{highlightedIndices.length !== 1 ? 'es' : ''}
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
            {/* Search Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search transcript..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9"
                />
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSearch}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyTranscript}
                title="Copy transcript"
              >
                <Copy className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTranscript}
                title="Download as TXT"
              >
                <Download className="size-4" />
              </Button>
              {hasWords && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadVTT}
                  title="Download as VTT subtitles"
                >
                  VTT
                </Button>
              )}
            </div>

            {/* Transcript Content */}
            <ScrollArea className="h-[400px] rounded-md border p-4">
              {hasWords ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="leading-relaxed whitespace-pre-wrap">
                    {words.map((word, index) => {
                      const isHighlighted = highlightedIndices.includes(index);
                      const isSearchMatch =
                        searchQuery &&
                        word.word.toLowerCase().includes(searchQuery.toLowerCase());

                      return (
                        <React.Fragment key={index}>
                          <span
                            onClick={() => onTimestampClick && handleWordClick(word)}
                            className={`
                              ${onTimestampClick ? 'cursor-pointer' : ''}
                              transition-colors duration-150
                              ${
                                isSearchMatch
                                  ? 'bg-yellow-300 dark:bg-yellow-700 font-semibold text-foreground'
                                  : isHighlighted
                                    ? 'bg-primary/20'
                                    : onTimestampClick
                                      ? 'hover:bg-muted'
                                      : ''
                              }
                            `}
                            title={
                              onTimestampClick
                                ? `${word.start.toFixed(1)}s - ${word.end.toFixed(1)}s`
                                : undefined
                            }
                          >
                            {word.word}
                          </span>
                          {' '}
                        </React.Fragment>
                      );
                    })}
                  </p>
                </div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <p className="leading-relaxed whitespace-pre-wrap">
                    {transcript.text}
                  </p>
                </div>
              )}
            </ScrollArea>

            {/* Helper Text */}
            {onTimestampClick && hasWords && (
              <p className="text-xs text-muted-foreground">
                Click on any word to jump to that point in the {words ? 'media' : 'recording'}
              </p>
            )}

            {/* Metadata */}
            {(transcript.confidence || transcript.provider) && (
              <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                {transcript.provider && (
                  <span>Provider: {transcript.provider}</span>
                )}
                {transcript.confidence && (
                  <span>
                    Confidence: {(transcript.confidence * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
