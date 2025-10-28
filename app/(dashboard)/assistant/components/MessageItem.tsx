/**
 * Message Item Component
 *
 * Displays a single message with:
 * - User/Assistant styling
 * - Sources/citations
 * - Reasoning/chain-of-thought
 * - Tool call visualization
 * - Message actions (copy, edit, etc.)
 * - Markdown rendering
 * - Code blocks
 * - File attachments
 */

'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Bot,
  User,
  Copy,
  Check,
  MoreVertical,
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Wrench,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/app/components/ui/collapsible';
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
} from '../utils/message-utils';

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
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const [toolCallsExpanded, setToolCallsExpanded] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const messageText = extractMessageText(message);
  const sources = formatSources(message);
  const hasSources = messageHasSources(message);
  const hasReasoning = messageHasReasoning(message);
  const hasToolCalls = messageHasToolCalls(message);

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
    <div
      className={cn(
        'flex gap-3',
        isUser ? 'justify-end' : 'justify-start',
        className
      )}
    >
      {/* Assistant Avatar */}
      {isAssistant && (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Bot className="w-5 h-5 text-primary" />
        </div>
      )}

      {/* Message Content */}
      <div className="max-w-3xl space-y-2 flex-1">
        {/* Tool Calls (if assistant) */}
        {isAssistant && hasToolCalls && (
          <Collapsible open={toolCallsExpanded} onOpenChange={setToolCallsExpanded}>
            <div className="bg-muted/50 rounded-lg border border-border overflow-hidden">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-xs font-medium p-3 h-auto"
                >
                  <div className="flex items-center gap-2">
                    <Wrench className="w-3 h-3" />
                    <span>
                      {message.toolInvocations?.length || 0} Tool{' '}
                      {message.toolInvocations?.length !== 1 ? 'Calls' : 'Call'}
                    </span>
                  </div>
                  {toolCallsExpanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-3 space-y-2 border-t">
                  {message.toolInvocations?.map((tool, idx) => (
                    <div key={idx} className="text-xs space-y-1">
                      <div className="font-medium flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {tool.toolName}
                        </Badge>
                      </div>
                      {tool.args && (
                        <pre className="bg-background p-2 rounded text-xs overflow-x-auto">
                          {JSON.stringify(tool.args, null, 2)}
                        </pre>
                      )}
                      {tool.result && (
                        <div className="bg-background p-2 rounded">
                          <div className="text-[10px] text-muted-foreground mb-1">
                            Result:
                          </div>
                          <pre className="text-xs overflow-x-auto">
                            {typeof tool.result === 'string'
                              ? tool.result
                              : JSON.stringify(tool.result, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* Reasoning (if available) */}
        {hasReasoning && (
          <Collapsible open={reasoningExpanded} onOpenChange={setReasoningExpanded}>
            <div className="bg-accent/30 rounded-lg border border-border overflow-hidden">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-xs font-medium p-3 h-auto"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3 h-3" />
                    <span>Reasoning</span>
                  </div>
                  {reasoningExpanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-3 space-y-2 border-t">
                  {message.reasoning?.steps.map((step, idx) => (
                    <div key={step.id || idx} className="text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          Step {idx + 1}
                        </Badge>
                        <span className="text-muted-foreground capitalize">
                          {step.type}
                        </span>
                      </div>
                      <div className="text-muted-foreground whitespace-pre-wrap">
                        {step.content}
                      </div>
                    </div>
                  ))}
                  {message.reasoning?.conclusion && (
                    <div className="text-xs pt-2 border-t">
                      <div className="font-medium mb-1">Conclusion:</div>
                      <div className="text-muted-foreground">
                        {message.reasoning.conclusion}
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* Sources (if available) */}
        {hasSources && sources.length > 0 && (
          <Collapsible open={sourcesExpanded} onOpenChange={setSourcesExpanded}>
            <div className="bg-muted/50 rounded-lg border border-border overflow-hidden">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between text-xs font-medium p-3 h-auto"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-3 h-3" />
                    <span>
                      {sources.length} {sources.length === 1 ? 'Source' : 'Sources'}
                    </span>
                  </div>
                  {sourcesExpanded ? (
                    <ChevronUp className="w-3 h-3" />
                  ) : (
                    <ChevronDown className="w-3 h-3" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-3 space-y-2 border-t">
                  {sources.map((source, idx) => (
                    <Link
                      key={source.id || idx}
                      href={source.url}
                      className="block text-xs hover:bg-accent p-2 rounded transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div className="flex items-start gap-2">
                        <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{source.title}</div>
                          {source.snippet && (
                            <div className="text-muted-foreground line-clamp-2 mt-1">
                              {source.snippet}
                            </div>
                          )}
                          {source.relevanceScore && (
                            <div className="text-[10px] text-muted-foreground mt-1">
                              Relevance: {(source.relevanceScore * 100).toFixed(0)}%
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        )}

        {/* Main Message Bubble */}
        <div className="relative group">
          <div
            className={cn(
              'rounded-lg px-4 py-3',
              colors.bg,
              colors.text
            )}
          >
            {/* Message Content */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{messageText}</ReactMarkdown>
            </div>

            {/* Timestamp */}
            {message.createdAt && (
              <div className="text-xs opacity-60 mt-2">
                {formatMessageTimestamp(message.createdAt, 'short')}
              </div>
            )}
          </div>

          {/* Message Actions */}
          {showActions && (
            <div className="absolute -bottom-8 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex items-center gap-1 bg-background border rounded-lg shadow-sm p-1">
                {/* Copy */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleCopy}
                  title="Copy message"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>

                {/* More Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="More actions"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {isUser && onEdit && (
                      <DropdownMenuItem onClick={() => onEdit(message)}>
                        Edit message
                      </DropdownMenuItem>
                    )}
                    {isAssistant && onRegenerate && (
                      <DropdownMenuItem onClick={() => onRegenerate(message)}>
                        Regenerate response
                      </DropdownMenuItem>
                    )}
                    {onBranch && (
                      <DropdownMenuItem onClick={() => onBranch(message)}>
                        Branch conversation
                      </DropdownMenuItem>
                    )}
                    {onDelete && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(message)}
                          className="text-destructive"
                        >
                          Delete message
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </div>

        {/* File Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-2 rounded-lg border bg-muted p-2 text-xs"
              >
                <FileText className="h-4 w-4" />
                <span className="font-medium">{attachment.name}</span>
                <span className="text-muted-foreground">
                  ({(attachment.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User Avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-muted-foreground" />
        </div>
      )}
    </div>
  );

  if (!animate) {
    return messageContent;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      {messageContent}
    </motion.div>
  );
}
