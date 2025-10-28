/**
 * Message List Component
 *
 * Displays a scrollable list of messages with:
 * - Auto-scroll to bottom
 * - Empty state
 * - Loading indicators
 * - Smooth animations
 */

'use client';

import React, { useRef, useEffect } from 'react';
import { Bot } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { MessageItem, type MessageItemProps } from './MessageItem';
import { TypingIndicator } from './LoadingSkeletons';
import type { ExtendedMessage } from '../types';
import { cn } from '@/lib/utils';

/**
 * Message List Props
 */
export interface MessageListProps {
  /**
   * Messages to display
   */
  messages: ExtendedMessage[];

  /**
   * Whether the chat is loading
   */
  isLoading?: boolean;

  /**
   * Loading message text
   */
  loadingMessage?: string;

  /**
   * Empty state title
   */
  emptyTitle?: string;

  /**
   * Empty state description
   */
  emptyDescription?: string;

  /**
   * Example prompts for empty state
   */
  examplePrompts?: string[];

  /**
   * On example prompt click
   */
  onExampleClick?: (prompt: string) => void;

  /**
   * Message item props
   */
  messageItemProps?: Partial<MessageItemProps>;

  /**
   * Custom className
   */
  className?: string;

  /**
   * Whether to enable auto-scroll to bottom
   */
  autoScroll?: boolean;
}

/**
 * MessageList Component
 */
export function MessageList({
  messages,
  isLoading = false,
  loadingMessage = 'Thinking...',
  emptyTitle = 'Ask me anything',
  emptyDescription = 'I can search your recordings and answer questions about them',
  examplePrompts = [
    'What did we discuss about the project timeline?',
    'Summarize the key points from my last meeting',
    'Find mentions of the budget',
  ],
  onExampleClick,
  messageItemProps,
  className,
  autoScroll = true,
}: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  /**
   * Scroll to bottom
   */
  const scrollToBottom = React.useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  /**
   * Auto-scroll when messages change
   */
  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [messages, isLoading, autoScroll, scrollToBottom]);

  return (
    <div className={cn('flex-1 overflow-hidden', className)} role="region" aria-label="Chat messages">
      <ScrollArea className="h-full" ref={scrollAreaRef}>
        <div className="space-y-4 p-4">
          {/* Empty State */}
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-12 px-4" role="status" aria-live="polite">
              <Bot className="w-16 h-16 mx-auto mb-4 text-muted-foreground" aria-hidden="true" />
              <h3 className="text-lg font-medium mb-2">{emptyTitle}</h3>
              <p className="text-sm text-muted-foreground mb-6">
                {emptyDescription}
              </p>

              {/* Example Prompts */}
              {examplePrompts.length > 0 && (
                <div className="max-w-md mx-auto space-y-2">
                  <p className="text-xs font-medium text-muted-foreground mb-3">
                    Try asking:
                  </p>
                  <div role="group" aria-label="Example prompts">
                    {examplePrompts.map((prompt, index) => (
                      <button
                        key={index}
                        onClick={() => onExampleClick?.(prompt)}
                        className={cn(
                          'w-full text-left p-3 rounded-lg border dark:border-border/50',
                          'bg-muted/50 dark:bg-muted/30 hover:bg-muted dark:hover:bg-muted/50 transition-colors',
                          'text-sm focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary/60'
                        )}
                        aria-label={`Ask: ${prompt}`}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                {...messageItemProps}
                animate={true}
              />
            ))}
          </AnimatePresence>

          {/* Loading Indicator */}
          {isLoading && (
            <div
              className="flex gap-3 justify-start"
              role="status"
              aria-live="polite"
              aria-label="Assistant is typing"
            >
              <div
                className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/20 flex items-center justify-center flex-shrink-0"
                aria-hidden="true"
              >
                <Bot className="w-5 h-5 text-primary dark:text-primary/90" />
              </div>
              <div className="max-w-3xl rounded-lg px-4 py-3 bg-muted dark:bg-muted/60 text-foreground">
                <TypingIndicator text={loadingMessage} />
              </div>
            </div>
          )}

          {/* Scroll Anchor */}
          <div ref={messagesEndRef} aria-hidden="true" />
        </div>
      </ScrollArea>

      {/* Screen reader announcements for new messages */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {messages.length > 0 && messages[messages.length - 1] && (
          <>
            {messages[messages.length - 1].role === 'assistant'
              ? 'Assistant responded'
              : 'Message sent'}
          </>
        )}
      </div>
    </div>
  );
}
