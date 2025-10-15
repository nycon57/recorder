'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, BookOpen, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils/cn';
import { Button } from '@/app/components/ui/button';
import { ScrollArea } from '@/app/components/ui/scroll-area';

interface StreamingTextDisplayProps {
  text: string;
  isStreaming: boolean;
  language?: 'markdown' | 'plain';
  className?: string;
  showControls?: boolean;
  processingSpeed?: number; // chars per second
}

export default function StreamingTextDisplay({
  text,
  isStreaming,
  language = 'markdown',
  className,
  showControls = true,
  processingSpeed,
}: StreamingTextDisplayProps) {
  const { theme } = useTheme();
  const [copied, setCopied] = React.useState(false);
  const [userScrolled, setUserScrolled] = React.useState(false);
  const [startTime] = React.useState<number>(Date.now());
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Calculate reading stats
  const wordCount = React.useMemo(() => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }, [text]);

  const charCount = React.useMemo(() => {
    return text.length;
  }, [text]);

  const readingTime = React.useMemo(() => {
    // Average reading speed: 200 words per minute
    const minutes = Math.ceil(wordCount / 200);
    return minutes;
  }, [wordCount]);

  const averageSpeed = React.useMemo(() => {
    if (!isStreaming || charCount === 0) return 0;
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    return elapsedSeconds > 0 ? Math.round(charCount / elapsedSeconds) : 0;
  }, [isStreaming, charCount, startTime]);

  // Handle copy to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Auto-scroll to bottom when streaming, unless user has scrolled
  React.useEffect(() => {
    if (isStreaming && !userScrolled && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [text, isStreaming, userScrolled]);

  // Detect user scroll
  React.useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      setUserScrolled(!isAtBottom);
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  // Reset user scroll when streaming completes
  React.useEffect(() => {
    if (!isStreaming) {
      setUserScrolled(false);
    }
  }, [isStreaming]);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Controls Bar */}
      {showControls && text && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 rounded-lg border bg-muted/50 px-4 py-2"
        >
          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {/* Streaming indicator */}
            {isStreaming && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 text-blue-600 dark:text-blue-500"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Activity className="size-3.5" aria-hidden="true" />
                </motion.div>
                <span className="font-medium">Streaming</span>
              </motion.div>
            )}

            {/* Processing speed */}
            {(processingSpeed && processingSpeed > 0) || (isStreaming && averageSpeed > 0) && (
              <div className="flex items-center gap-1.5">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                >
                  <span className="text-amber-500">⚡</span>
                </motion.div>
                <span>{processingSpeed ? Math.round(processingSpeed) : averageSpeed} chars/sec</span>
              </div>
            )}

            {/* Character count when streaming */}
            {isStreaming && charCount > 0 && (
              <div className="flex items-center gap-1.5">
                <span>📝</span>
                <span>{charCount.toLocaleString()} chars</span>
              </div>
            )}

            {/* Word count */}
            <div className="flex items-center gap-1.5">
              <BookOpen className="size-3.5" aria-hidden="true" />
              <span>
                {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
              </span>
            </div>

            {/* Reading time */}
            {readingTime > 0 && !isStreaming && (
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden="true" />
                <span>{readingTime} min read</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7 px-2 text-xs"
            disabled={!text}
            aria-label="Copy to clipboard"
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.div
                  key="check"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  exit={{ scale: 0, rotate: 180 }}
                  className="flex items-center gap-1.5"
                >
                  <Check className="size-3.5 text-green-600 dark:text-green-500" />
                  <span>Copied</span>
                </motion.div>
              ) : (
                <motion.div
                  key="copy"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="flex items-center gap-1.5"
                >
                  <Copy className="size-3.5" />
                  <span>Copy</span>
                </motion.div>
              )}
            </AnimatePresence>
          </Button>
        </motion.div>
      )}

      {/* Content Display */}
      <ScrollArea
        ref={scrollAreaRef}
        className="h-[400px] w-full rounded-lg border bg-background"
      >
        <div ref={contentRef} className="p-6">
          {!text ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex h-[352px] items-center justify-center text-muted-foreground"
            >
              <p className="text-sm">Waiting for content...</p>
            </motion.div>
          ) : language === 'markdown' ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '');
                    const codeContent = String(children).replace(/\n$/, '');

                    return !inline && match ? (
                      <SyntaxHighlighter
                        style={theme === 'dark' ? vscDarkPlus : vs}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-md text-sm"
                        {...props}
                      >
                        {codeContent}
                      </SyntaxHighlighter>
                    ) : (
                      <code
                        className={cn(
                          'rounded bg-muted px-1.5 py-0.5 font-mono text-sm',
                          className
                        )}
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {text}
              </ReactMarkdown>
              {isStreaming && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="ml-1 inline-block h-4 w-1 bg-blue-600 dark:bg-blue-500"
                  aria-label="Streaming indicator"
                />
              )}
            </div>
          ) : (
            <div className="whitespace-pre-wrap font-mono text-sm">
              {text}
              {isStreaming && (
                <motion.span
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="ml-1 inline-block h-4 w-1 bg-blue-600 dark:bg-blue-500"
                  aria-label="Streaming indicator"
                />
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Scroll to Bottom Indicator */}
      <AnimatePresence>
        {userScrolled && isStreaming && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => {
              setUserScrolled(false);
              const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
              if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
              }
            }}
            className="mx-auto rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            aria-label="Scroll to bottom"
          >
            New content below ↓
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
