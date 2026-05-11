'use client';

import * as React from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Copy, Check, BookOpen, Clock, Activity, Hash } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { cn } from '@/lib/utils/cn';
import { Button } from '@/app/components/ui/button';
import { ScrollArea } from '@/app/components/ui/scroll-area';

interface StreamingTextDisplayProps {
  text: string;
  isStreaming: boolean;
  language?: 'markdown' | 'plain';
  className?: string;
  showControls?: boolean;
  processingSpeed?: number;
}

interface StreamingControlsProps {
  text: string;
  isStreaming: boolean;
  processingSpeed?: number;
  averageSpeed: number;
  charCount: number;
  wordCount: number;
  readingTime: number;
  copied: boolean;
  onCopy: () => void;
}

interface StreamingContentProps {
  text: string;
  language: 'markdown' | 'plain';
  isStreaming: boolean;
  contentRef: React.Ref<HTMLDivElement>;
}

function StreamingCursor() {
  return (
    <m.span
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 1, repeat: Infinity }}
      className="ml-1 inline-block h-4 w-1 bg-blue-600 dark:bg-blue-500"
      aria-label="Streaming indicator"
    />
  );
}

function MarkdownCode(props: React.ComponentPropsWithoutRef<'code'> & { inline?: boolean }) {
  const { inline, className, children, ...rest } = props;
  const match = /language-(\w+)/.exec(className || '');
  const codeContent = String(children).replace(/\n$/, '');

  if (!inline && match) {
    return (
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={match[1]}
        PreTag="div"
        className="rounded-md text-sm"
      >
        {codeContent}
      </SyntaxHighlighter>
    );
  }

  return (
    <code
      className={cn('rounded bg-muted px-1.5 py-0.5 font-mono text-sm', className)}
      {...rest}
    >
      {children}
    </code>
  );
}

function StreamingControls({
  text,
  isStreaming,
  processingSpeed,
  averageSpeed,
  charCount,
  wordCount,
  readingTime,
  copied,
  onCopy,
}: StreamingControlsProps) {
  const displaySpeed =
    processingSpeed && processingSpeed > 0
      ? Math.round(processingSpeed)
      : isStreaming && averageSpeed > 0
        ? averageSpeed
        : null;

  return (
    <m.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between gap-4 rounded-lg border bg-muted/50 px-4 py-2"
    >
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {isStreaming && (
          <m.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 text-blue-600 dark:text-blue-500"
          >
            <m.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Activity className="size-3.5" aria-hidden="true" />
            </m.div>
            <span className="font-medium">Streaming</span>
          </m.div>
        )}

        {displaySpeed !== null && (
          <div className="flex items-center gap-1.5">
            <Activity className="size-3.5 text-amber-500" aria-hidden="true" />
            <span>{displaySpeed} chars/sec</span>
          </div>
        )}

        {isStreaming && charCount > 0 && (
          <div className="flex items-center gap-1.5">
            <Hash className="size-3.5" aria-hidden="true" />
            <span>{charCount.toLocaleString()} chars</span>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <BookOpen className="size-3.5" aria-hidden="true" />
          <span>
            {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
          </span>
        </div>

        {readingTime > 0 && !isStreaming && (
          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden="true" />
            <span>{readingTime} min read</span>
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onCopy}
        className="h-7 px-2 text-xs"
        disabled={!text}
        aria-label="Copy to clipboard"
      >
        <AnimatePresence mode="wait">
          {copied ? (
            <m.div
              key="check"
              initial={{ scale: 0.95, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.95, rotate: 180 }}
              className="flex items-center gap-1.5"
            >
              <Check className="size-3.5 text-green-600 dark:text-green-500" />
              <span>Copied</span>
            </m.div>
          ) : (
            <m.div
              key="copy"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="flex items-center gap-1.5"
            >
              <Copy className="size-3.5" />
              <span>Copy</span>
            </m.div>
          )}
        </AnimatePresence>
      </Button>
    </m.div>
  );
}

function StreamingContent({
  text,
  language,
  isStreaming,
  contentRef,
}: StreamingContentProps) {
  if (!text) {
    return (
      <div ref={contentRef} className="p-6">
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex h-[352px] items-center justify-center text-muted-foreground"
        >
          <p className="text-sm">Waiting for content…</p>
        </m.div>
      </div>
    );
  }

  return (
    <div ref={contentRef} className="p-6">
      {language === 'markdown' ? (
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{ code: MarkdownCode }}
          >
            {text}
          </ReactMarkdown>
          {isStreaming && <StreamingCursor />}
        </div>
      ) : (
        <div className="whitespace-pre-wrap font-mono text-sm">
          {text}
          {isStreaming && <StreamingCursor />}
        </div>
      )}
    </div>
  );
}

function ScrollToBottomButton({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <m.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          onClick={onClick}
          className="mx-auto rounded-full bg-blue-600 px-4 py-2 text-xs font-medium text-white shadow-lg hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          aria-label="Scroll to bottom"
        >
          New content below
        </m.button>
      )}
    </AnimatePresence>
  );
}

export default function StreamingTextDisplay({
  text,
  isStreaming,
  language = 'markdown',
  className,
  showControls = true,
  processingSpeed,
}: StreamingTextDisplayProps) {
  const [copied, setCopied] = React.useState(false);
  const [userScrolled, setUserScrolled] = React.useState(false);
  const userScrolledRef = React.useRef(false);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);

  const wordCount = React.useMemo(
    () => text.trim().split(/\s+/).filter(Boolean).length,
    [text],
  );
  const charCount = text.length;
  const readingTime = React.useMemo(() => Math.ceil(wordCount / 200), [wordCount]);
  const averageSpeed = 0;

  const scrollToBottom = React.useCallback(() => {
    userScrolledRef.current = false;
    setUserScrolled(false);
    const scrollContainer = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]',
    );
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }, []);

  const handleCopy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }, [text]);

  React.useEffect(() => {
    if (isStreaming && !userScrolledRef.current) {
      scrollToBottom();
    }
  }, [text, isStreaming, scrollToBottom]);

  React.useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]',
    );
    if (!scrollContainer) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const didScrollAway = scrollTop + clientHeight < scrollHeight - 10;
      userScrolledRef.current = didScrollAway;
      setUserScrolled(didScrollAway);
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  React.useEffect(() => {
    if (!isStreaming) {
      userScrolledRef.current = false;
      setUserScrolled(false);
    }
  }, [isStreaming]);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {showControls && text && (
        <StreamingControls
          text={text}
          isStreaming={isStreaming}
          processingSpeed={processingSpeed}
          averageSpeed={averageSpeed}
          charCount={charCount}
          wordCount={wordCount}
          readingTime={readingTime}
          copied={copied}
          onCopy={handleCopy}
        />
      )}

      <ScrollArea
        ref={scrollAreaRef}
        className="h-[400px] w-full rounded-lg border bg-background"
      >
        <StreamingContent
          text={text}
          language={language}
          isStreaming={isStreaming}
          contentRef={contentRef}
        />
      </ScrollArea>

      <ScrollToBottomButton
        visible={userScrolled && isStreaming}
        onClick={scrollToBottom}
      />
    </div>
  );
}
