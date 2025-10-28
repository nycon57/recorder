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
import { Bot, Loader2 } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { MessageItem, type MessageItemProps } from './MessageItem';
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
    <div className={cn('flex-1 overflow-hidden', className)}>
      <ScrollArea className="h-full" ref={scrollAreaRef}>
        <div className="space-y-4 p-4">
          {/* Empty State */}
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-12 px-4">
              <Bot className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
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
                  {examplePrompts.map((prompt, index) => (
                    <button
                      key={index}
                      onClick={() => onExampleClick?.(prompt)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border',
                        'bg-muted/50 hover:bg-muted transition-colors',
                        'text-sm'
                      )}
                    >
                      {prompt}
                    </button>
                  ))}
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
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-primary" />
              </div>
              <div className="max-w-3xl rounded-lg px-4 py-3 bg-muted text-foreground">
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{loadingMessage}</span>
                </div>
              </div>
            </div>
          )}

          {/* Scroll Anchor */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
    </div>
  );
}
