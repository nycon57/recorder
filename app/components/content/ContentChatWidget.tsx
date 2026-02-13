'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Trash2, X, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { trackChatQuestion } from '@/lib/hooks/useEngagementTracking';
import { ResponseRating } from '@/app/components/chat/ResponseRating';

const DEFAULT_ERROR = 'Unable to get a response. Please try again.';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  /** Set when the assistant message finishes streaming */
  done?: boolean;
  /** The user query that produced this assistant response */
  query?: string;
}

interface ContentChatWidgetProps {
  contentId: string;
  contentTitle: string;
  className?: string;
}

export function ContentChatWidget({
  contentId,
  contentTitle,
  className,
}: ContentChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    } else {
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
    if (isOpen) cancelStream();
  }, [isOpen, cancelStream]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleToggle();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleToggle]);

  const handleClear = useCallback(() => {
    cancelStream();
    setMessages([]);
    setInput('');
    setError(null);
    conversationIdRef.current = null;
    messageCounterRef.current = 0;
    inputRef.current?.focus();
  }, [cancelStream]);

  // Counter for generating unique response IDs
  const messageCounterRef = useRef(0);

  const appendToken = useCallback((token: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role !== 'assistant') return prev;
      return [...prev.slice(0, -1), { ...last, content: last.content + token }];
    });
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    setError(null);
    setInput('');

    const userMessage: Message = { role: 'user', content: trimmed };
    const currentQuery = trimmed;
    setMessages((prev) => [...prev, userMessage, { role: 'assistant', content: '', query: currentQuery }]);
    setIsStreaming(true);
    trackChatQuestion(trimmed);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          recordingIds: [contentId],
          conversationId: conversationIdRef.current,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorMessage = DEFAULT_ERROR;
        try {
          const errorData = await response.json();
          if (errorData.error) errorMessage = errorData.error;
        } catch {
          // Non-JSON error body — use default message
        }
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error(DEFAULT_ERROR);

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);

          try {
            const event = JSON.parse(jsonStr);

            switch (event.type) {
              case 'token':
                appendToken(event.token);
                break;
              case 'done':
                if (event.conversationId) {
                  conversationIdRef.current = event.conversationId;
                }
                messageCounterRef.current += 1;
                // Mark the last assistant message as done for rating
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role !== 'assistant') return prev;
                  return [...prev.slice(0, -1), { ...last, done: true }];
                });
                break;
              case 'error':
                setError(DEFAULT_ERROR);
                break;
            }
          } catch {
            // Malformed JSON — skip
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;

      const message = err instanceof Error ? err.message : '';
      setError(message || DEFAULT_ERROR);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && !last.content) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, [input, isStreaming, contentId, appendToken]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className={cn('fixed bottom-6 right-6 z-40', className)}>
      {isOpen && (
        <div
          id="content-chat-panel"
          role="region"
          aria-label={`Chat about ${contentTitle}`}
          className="mb-3 flex max-h-[calc(100vh-8rem)] w-[calc(100vw-3rem)] flex-col rounded-xl border border-border/50 bg-background shadow-xl sm:max-h-[500px] sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
            <h3 className="truncate text-sm font-medium text-foreground">
              {contentTitle}
            </h3>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label="Clear conversation"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={handleToggle}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                aria-label="Close chat"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto px-4 py-3"
            role="log"
            aria-live="polite"
          >
            {messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Ask a question to get started
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'mb-3 text-sm',
                  msg.role === 'user' ? 'text-right' : 'text-left'
                )}
              >
                <div
                  className={cn(
                    'inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2',
                    msg.role === 'user'
                      ? 'bg-accent/20 text-foreground'
                      : 'bg-muted text-foreground'
                  )}
                >
                  {msg.content || (
                    <>
                      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-muted-foreground" />
                      <span className="sr-only">Generating response</span>
                    </>
                  )}
                </div>
                {msg.role === 'assistant' && msg.done && msg.content && (
                  <ResponseRating
                    responseId={`${contentId}-${i}`}
                    query={msg.query ?? ''}
                    responseSnippet={msg.content}
                    className="mt-1"
                  />
                )}
              </div>
            ))}

            {error && (
              <div
                role="alert"
                className="mb-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                disabled={isStreaming}
                className="flex-1 rounded-lg border border-border/50 bg-muted/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-50"
                aria-label="Type your question"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={isStreaming || !input.trim()}
                className="rounded-lg bg-accent p-2 text-background transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Send message"
              >
                {isStreaming ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Send aria-hidden="true" className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          'flex items-center gap-2 rounded-full px-4 py-3 text-sm font-medium shadow-lg transition-all hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          isOpen
            ? 'bg-muted text-foreground'
            : 'bg-accent text-background hover:bg-accent/90'
        )}
        aria-label={isOpen ? 'Close chat' : 'Ask about this'}
        aria-expanded={isOpen}
        aria-controls="content-chat-panel"
      >
        <MessageSquare aria-hidden="true" className="h-5 w-5" />
        {!isOpen && <span>Ask about this</span>}
      </button>
    </div>
  );
}
