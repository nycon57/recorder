/**
 * Advanced Chat Input Component
 *
 * Integrates the PromptInput component from ai-elements with:
 * - Multi-modal file uploads (images, documents)
 * - Speech-to-text support
 * - Keyboard shortcuts
 * - File previews
 * - Suggested prompts
 */

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import {
  PromptInput,
  PromptInputHeader,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputAttachFiles,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputTools,
  PromptInputSpeechButton,
  type PromptInputMessage,
} from '@/app/components/ai-elements/prompt-input';
import type { MessageAttachment } from '../types';
import { cn } from '@/lib/utils';

/**
 * Chat Input Props
 */
export interface ChatInputProps {
  /**
   * Input value (controlled) - optional, uses PromptInputProvider if not provided
   */
  value?: string;

  /**
   * On value change - optional, uses PromptInputProvider if not provided
   */
  onChange?: (value: string) => void;

  /**
   * On submit with text and files
   */
  onSubmit: (data: {
    text: string;
    files?: MessageAttachment[];
  }) => Promise<void> | void;

  /**
   * Whether the chat is loading/processing
   */
  isLoading?: boolean;

  /**
   * Placeholder text
   */
  placeholder?: string;

  /**
   * Whether to show file attachment button
   */
  showAttachments?: boolean;

  /**
   * Whether to show speech-to-text button
   */
  showSpeechToText?: boolean;

  /**
   * Accepted file types
   */
  acceptedFileTypes?: string;

  /**
   * Max file size in bytes
   */
  maxFileSize?: number;

  /**
   * Max number of files
   */
  maxFiles?: number;

  /**
   * Custom className
   */
  className?: string;

  /**
   * Suggested prompts to show when empty
   */
  suggestions?: string[];

  /**
   * On suggestion click
   */
  onSuggestionClick?: (suggestion: string) => void;
}

/**
 * ChatInput Component
 *
 * Advanced input with file uploads, speech-to-text, and suggestions.
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  placeholder = 'Ask a question about your recordings...',
  showAttachments = true,
  showSpeechToText = true,
  acceptedFileTypes = 'image/*,.pdf,.txt,.doc,.docx',
  maxFileSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 5,
  className,
  suggestions = [],
  onSuggestionClick,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Handle form submission from PromptInput
   */
  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const messageText = message.text || '';

      if (!messageText.trim() && !message.files?.length) {
        return;
      }

      // Convert FileUIPart to MessageAttachment
      const attachments: MessageAttachment[] | undefined = message.files?.map((file) => ({
        id: crypto.randomUUID(),
        type: file.mediaType?.startsWith('image/')
          ? 'image'
          : file.mediaType?.includes('audio')
            ? 'audio'
            : file.mediaType?.includes('video')
              ? 'video'
              : 'file',
        name: file.filename || 'Untitled',
        mimeType: file.mediaType || 'application/octet-stream',
        size: 0, // Size not available in FileUIPart
        url: file.url,
        preview: file.mediaType?.startsWith('image/') ? file.url : undefined,
      }));

      await onSubmit({
        text: messageText.trim(),
        files: attachments,
      });
    },
    [onSubmit]
  );

  return (
    <div className={cn('w-full', className)} role="region" aria-label="Message input">
      {/* Main input */}
      <PromptInput
        className="w-full"
        onSubmit={handleSubmit}
        accept={acceptedFileTypes}
        multiple={true}
        maxFiles={maxFiles}
        maxFileSize={maxFileSize}
        aria-label="Chat message form"
      >
        {/* Attachments Header - proper placement */}
        <PromptInputHeader>
          <PromptInputAttachments>
            {(attachment) => <PromptInputAttachment key={attachment.id} data={attachment} />}
          </PromptInputAttachments>
        </PromptInputHeader>

        {/* Textarea - direct child for proper flex layout */}
        <PromptInputTextarea
          ref={textareaRef}
          placeholder={placeholder}
          disabled={isLoading}
          className="flex-1 min-h-[56px]"
          aria-label="Type your message"
          aria-describedby="input-helper-text"
        />

        {/* Footer with controls and helper text inline */}
        <PromptInputFooter className="flex items-center justify-between">
          {/* Left side tools */}
          <PromptInputTools className="flex items-center gap-1">
            {/* Attach Files Button */}
            {showAttachments && (
              <PromptInputAttachFiles asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isLoading}
                  title="Attach files"
                  aria-label="Attach files (Ctrl+U)"
                >
                  <Paperclip className="h-4 w-4" aria-hidden="true" />
                </Button>
              </PromptInputAttachFiles>
            )}

            {/* Voice Input Button */}
            {showSpeechToText && (
              <PromptInputSpeechButton
                textareaRef={textareaRef}
                disabled={isLoading}
                title="Voice input"
                aria-label="Voice input (Ctrl+M)"
              />
            )}

            {/* Helper text inline with buttons */}
            <div
              id="input-helper-text"
              className="ml-2 text-[11px] text-muted-foreground whitespace-nowrap hidden sm:block"
              role="status"
              aria-live="polite"
            >
              <kbd className="rounded bg-muted px-1 py-0.5 text-[10px]" aria-label="Enter key">Enter</kbd> to send
              <span className="mx-1" aria-hidden="true">·</span>
              <kbd className="rounded bg-muted px-1 py-0.5 text-[10px]" aria-label="Shift key">Shift</kbd> +{' '}
              <kbd className="rounded bg-muted px-1 py-0.5 text-[10px]" aria-label="Enter key">Enter</kbd> for new line
            </div>
          </PromptInputTools>

          {/* Submit Button */}
          <PromptInputSubmit
            status={isLoading ? 'submitted' : undefined}
            disabled={isLoading}
            title="Send message (Enter)"
            aria-label="Send message (Enter)"
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
