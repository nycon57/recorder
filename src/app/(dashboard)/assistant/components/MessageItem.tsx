/**
 * Message Item Component
 *
 * Refactored to use standardized ai-elements components:
 * - Message, MessageContent, MessageAvatar for base structure
 * - Sources for citations
 * - ChainOfThought for reasoning
 * - Tool for tool calls
 * - Actions for message actions
 * - Response for markdown rendering
 */

'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { Bot, Copy, Check, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import {
  messageVariants,
  usePrefersReducedMotion,
} from '../utils/animations';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';
import type { ExtendedMessage } from '../types';
import {
  extractMessageText,
  formatMessageTimestamp,
  formatSources,
  messageHasSources,
  messageHasReasoning,
  messageHasToolCalls,
  copyMessageToClipboard,
  getMessageColor,
  parseCitationsToMarkdown,
} from '../utils/message-utils';

// Import ai-elements components
import {
  Message,
  MessageContent,
  MessageAvatar,
} from '@/app/components/ai-elements/message';
import {
  Sources,
  SourcesTrigger,
  SourcesContent,
  Source,
} from '@/app/components/ai-elements/sources';
import {
  ChainOfThought,
  ChainOfThoughtHeader,
  ChainOfThoughtContent,
  ChainOfThoughtStep,
} from '@/app/components/ai-elements/chain-of-thought';
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from '@/app/components/ai-elements/tool';
import { Response } from '@/app/components/ai-elements/response';
import { Badge } from '@/app/components/ui/badge';

/**
 * Message Item Props
 */
export interface MessageItemProps {
  /**
   * The message to display
   */
  message: ExtendedMessage;

  /**
   * Whether to show message actions
   */
  showActions?: boolean;

  /**
   * On copy message
   */
  onCopy?: (message: ExtendedMessage) => void;

  /**
   * On edit message
   */
  onEdit?: (message: ExtendedMessage) => void;

  /**
   * On regenerate message
   */
  onRegenerate?: (message: ExtendedMessage) => void;

  /**
   * On branch from message
   */
  onBranch?: (message: ExtendedMessage) => void;

  /**
   * On delete message
   */
  onDelete?: (message: ExtendedMessage) => void;

  /**
   * On feedback (thumbs up/down)
   */
  onFeedback?: (message: ExtendedMessage, feedback: 'positive' | 'negative') => void;

  /**
   * Custom className
   */
  className?: string;

  /**
   * Whether to animate entrance
   */
  animate?: boolean;
}

/**
 * MessageItem Component
 */
export function MessageItem({
  message,
  showActions = true,
  onCopy,
  onEdit,
  onRegenerate,
  onBranch,
  onDelete,
  onFeedback,
  className,
  animate = true,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const { user } = useUser();

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const messageText = extractMessageText(message);
  const sources = formatSources(message);
  const hasSources = messageHasSources(message);
  const hasReasoning = messageHasReasoning(message);
  const hasToolCalls = messageHasToolCalls(message);

  // Extract sourceKey from message metadata for building highlight URLs
  const sourceKey = message.metadata?.custom?.sourceKey as string | undefined;

  // Debug: Log message metadata to verify data flow
  React.useEffect(() => {
    if (isAssistant && hasSources) {
      console.log('[MessageItem] Rendering with message:', {
        messageId: message.id,
        hasSources: !!message.sources,
        hasMetadata: !!message.metadata,
        hasCustom: !!message.metadata?.custom,
        sourceKeyFromMetadata: message.metadata?.custom?.sourceKey,
        sourceKeyExtracted: sourceKey,
        sourcesCount: sources.length,
      });
    }
  }, [isAssistant, hasSources, message, sourceKey, sources]);

  // Parse citations in message text to make them clickable with highlight parameters
  const messageTextWithCitations = parseCitationsToMarkdown(messageText, sources, sourceKey);

  /**
   * Handle copy
   */
  const handleCopy = useCallback(async () => {
    try {
      await copyMessageToClipboard(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.(message);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  }, [message, onCopy]);

  const colors = getMessageColor(message);

  const messageContent = (
    <Message
      from={message.role}
      className={cn('py-2', className)}
      role="article"
      aria-label={`${isUser ? 'User' : 'Assistant'} message${message.createdAt ? ` from ${formatMessageTimestamp(message.createdAt, 'long')}` : ''}`}
    >
      {/* AI Avatar on left side */}
      {isAssistant && (
        <MessageAvatar
          src="/bot-avatar.png"
          name=""
          className="bg-primary/10"
          aria-hidden="true"
        >
          <Bot className="h-5 w-5 text-primary" />
        </MessageAvatar>
      )}

      {/* Message Content Container */}
      <div className={cn('space-y-3', isAssistant && 'flex-1', isUser && 'flex flex-col items-end')}>
        {/* Tool Calls */}
        {isAssistant && hasToolCalls && message.toolInvocations && (
          <div className="space-y-2">
            {message.toolInvocations.map((tool: any, idx) => (
              <Tool key={idx} defaultOpen={false}>
                <ToolHeader
                  title={tool.toolName}
                  type={tool.toolName as any}
                  state={tool.state}
                />
                <ToolContent>
                  {tool.args && (
                    <ToolInput input={tool.args} />
                  )}
                  {(tool.result || tool.state === 'output-error') && (
                    <ToolOutput
                      output={tool.result}
                      errorText={tool.state === 'output-error' ? 'Tool execution failed' : undefined}
                    />
                  )}
                </ToolContent>
              </Tool>
            ))}
          </div>
        )}

        {/* Reasoning / Chain of Thought */}
        {hasReasoning && message.reasoning && (
          <ChainOfThought defaultOpen={false}>
            <ChainOfThoughtHeader>
              Reasoning ({message.reasoning.steps.length} steps)
            </ChainOfThoughtHeader>
            <ChainOfThoughtContent>
              {message.reasoning.steps.map((step, idx) => (
                <ChainOfThoughtStep
                  key={step.id || idx}
                  label={step.content}
                  description={step.type}
                  status={idx === message.reasoning!.steps.length - 1 ? 'complete' : 'complete'}
                />
              ))}
              {message.reasoning.conclusion && (
                <div className="mt-4 rounded-lg border border-border bg-muted/50 p-3">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Conclusion
                  </div>
                  <div className="text-sm text-foreground">
                    {message.reasoning.conclusion}
                  </div>
                </div>
              )}
            </ChainOfThoughtContent>
          </ChainOfThought>
        )}

        {/* Sources */}
        {hasSources && sources.length > 0 && (
          <Sources>
            <SourcesTrigger count={sources.length} />
            <SourcesContent role="list" aria-label="Source citations">
              {sources.map((source, idx) => {
                // Build URL with highlight parameters if available
                const chunkId = source.metadata?.chunkId as string | undefined;
                const sourceUrl = sourceKey && chunkId
                  ? `${source.url}?sourceKey=${encodeURIComponent(sourceKey)}&highlight=${encodeURIComponent(chunkId)}`
                  : source.url;

                // Debug: Log URL construction for first source
                if (idx === 0) {
                  console.log('[MessageItem] URL construction:', {
                    baseUrl: source.url,
                    sourceKey,
                    chunkId,
                    finalUrl: sourceUrl,
                  });
                }

                // Check if URL is internal (starts with /)
                const isInternalLink = sourceUrl.startsWith('/');

                return (
                  <div
                    key={source.id || idx}
                    role="listitem"
                    className="rounded-lg border border-border bg-background p-3 hover:bg-accent/50 transition-colors"
                  >
                    {isInternalLink ? (
                      // Use Next.js Link for internal navigation
                      <Link
                        href={sourceUrl}
                        className="flex items-center gap-2"
                        aria-label={`Source ${idx + 1}: ${source.title}${source.relevanceScore ? `, ${(source.relevanceScore * 100).toFixed(0)}% relevance` : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <ExternalLink className="h-4 w-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm mb-1 truncate">{source.title}</div>
                            {source.snippet && (
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {source.snippet}
                              </div>
                            )}
                            {source.relevanceScore && (
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="secondary" className="text-xs">
                                  Relevance: {(source.relevanceScore * 100).toFixed(0)}%
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    ) : (
                      // Use regular anchor for external links
                      <Source
                        href={sourceUrl}
                        title={source.title}
                        aria-label={`Source ${idx + 1}: ${source.title}${source.relevanceScore ? `, ${(source.relevanceScore * 100).toFixed(0)}% relevance` : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <ExternalLink className="h-4 w-4 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm mb-1 truncate">{source.title}</div>
                            {source.snippet && (
                              <div className="text-xs text-muted-foreground line-clamp-2">
                                {source.snippet}
                              </div>
                            )}
                            {source.relevanceScore && (
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="secondary" className="text-xs">
                                  Relevance: {(source.relevanceScore * 100).toFixed(0)}%
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </Source>
                    )}
                  </div>
                );
              })}
            </SourcesContent>
          </Sources>
        )}

        {/* Main Message Content */}
        <div className={cn('flex flex-col')}>
          <MessageContent
            variant={isUser ? 'contained' : 'flat'}
            className={cn(
              'relative',
              isUser && colors.bg,
              isUser && colors.text
            )}
          >
            {/* Markdown Content */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Response>{messageTextWithCitations}</Response>
            </div>
          </MessageContent>

          {/* Timestamp and Actions Row */}
          <div className={cn('flex items-center gap-2 mt-2 px-1', isUser && 'justify-end')}>
            {/* Timestamp */}
            {message.createdAt && (
              <div className="text-xs opacity-60">
                {formatMessageTimestamp(message.createdAt, 'short')}
              </div>
            )}

            {/* Copy button for AI messages only */}
            {showActions && isAssistant && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={handleCopy}
                aria-label={copied ? 'Message copied' : 'Copy message to clipboard'}
              >
                {prefersReducedMotion ? (
                  // Static icons for reduced motion
                  copied ? (
                    <Check className="h-3 w-3 text-green-500" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3 w-3" aria-hidden="true" />
                  )
                ) : (
                  // Animated icons for normal motion
                  <AnimatePresence mode="wait">
                    {copied ? (
                      <motion.div
                        key="check"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        <Check className="h-3 w-3 text-green-500" aria-hidden="true" />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="copy"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                      >
                        <Copy className="h-3 w-3" aria-hidden="true" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* File Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-muted p-2 text-xs"
              >
                <div className="h-4 w-4 flex items-center justify-center">
                  {attachment.type === 'image' && '🖼️'}
                  {attachment.type === 'file' && '📄'}
                  {attachment.type === 'audio' && '🎵'}
                  {attachment.type === 'video' && '🎬'}
                </div>
                <span className="font-medium">{attachment.name}</span>
                <span className="text-muted-foreground">
                  ({(attachment.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Avatar on right side */}
      {isUser && (
        <MessageAvatar
          src={user?.imageUrl || '/user-avatar.png'}
          name={user?.fullName || user?.firstName || 'You'}
          className="bg-muted"
          aria-hidden="true"
        />
      )}
    </Message>
  );

  if (!animate || prefersReducedMotion) {
    return messageContent;
  }

  // Only animate completed messages, not streaming ones
  // Streaming messages are identified by being the last assistant message
  // and having incomplete/streaming state
  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {messageContent}
    </motion.div>
  );
}
