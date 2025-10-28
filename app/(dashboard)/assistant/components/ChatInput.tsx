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
import { Send, Paperclip, Mic, X, Image as ImageIcon, FileText } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputAttachFiles,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputAttachmentName,
  PromptInputAttachmentRemove,
  PromptInputAttachmentPreview,
} from '@/components/ai-elements/prompt-input';
import type { FileUIPart } from 'ai';
import type { MessageAttachment } from '../types';
import { cn } from '@/lib/utils';

/**
 * Chat Input Props
 */
export interface ChatInputProps {
  /**
   * Input value (controlled)
   */
  value?: string;

  /**
   * On value change
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
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (formData: FormData) => {
      const messageText = formData.get('message') as string;

      if (!messageText?.trim() && !formData.getAll('files').length) {
        return;
      }

      // Process file attachments
      const files = formData.getAll('files') as File[];
      const attachments: MessageAttachment[] = await Promise.all(
        files.map(async (file) => {
          // Create preview for images
          let preview: string | undefined;
          if (file.type.startsWith('image/')) {
            preview = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(file);
            });
          }

          return {
            id: crypto.randomUUID(),
            type: file.type.startsWith('image/')
              ? 'image'
              : file.type.includes('audio')
                ? 'audio'
                : file.type.includes('video')
                  ? 'video'
                  : 'file',
            name: file.name,
            mimeType: file.type,
            size: file.size,
            preview,
            // In a real implementation, you'd upload to storage and get a URL
            url: preview, // Temporary
          } as MessageAttachment;
        })
      );

      await onSubmit({
        text: messageText.trim(),
        files: attachments.length > 0 ? attachments : undefined,
      });
    },
    [onSubmit]
  );

  /**
   * Start voice recording
   */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.addEventListener('dataavailable', (event) => {
        audioChunksRef.current.push(event.data);
      });

      mediaRecorder.addEventListener('stop', async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm',
        });

        // In a real implementation, send to speech-to-text API
        // For now, we'll just show it as an attachment
        console.log('Audio recorded:', audioBlob);

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
      });

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, []);

  /**
   * Stop voice recording
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  /**
   * Toggle recording
   */
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <div className={cn('w-full space-y-3', className)}>
      {/* Suggestions (show when input is empty) */}
      {suggestions.length > 0 && !value && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => onSuggestionClick?.(suggestion)}
              className="text-xs"
            >
              {suggestion}
            </Button>
          ))}
        </div>
      )}

      {/* Main input */}
      <PromptInput
        className="w-full"
        onSubmit={handleSubmit}
        accept={acceptedFileTypes}
        multiple={true}
      >
        <PromptInputBody className="flex flex-col">
          {/* File Attachments Preview */}
          <PromptInputAttachments className="flex flex-wrap gap-2 p-2 border-b">
            <PromptInputAttachment className="group relative flex items-center gap-2 rounded-md border bg-muted p-2 text-sm">
              {/* Preview for images */}
              <PromptInputAttachmentPreview className="h-12 w-12 rounded object-cover" />

              {/* File info */}
              <div className="flex-1 min-w-0">
                <PromptInputAttachmentName className="truncate font-medium" />
                <div className="text-xs text-muted-foreground">
                  {/* Size will be added by the component */}
                </div>
              </div>

              {/* Remove button */}
              <PromptInputAttachmentRemove asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </Button>
              </PromptInputAttachmentRemove>
            </PromptInputAttachment>
          </PromptInputAttachments>

          {/* Text Input Area */}
          <div className="flex items-end gap-2 p-2">
            {/* Attach Files Button */}
            {showAttachments && (
              <PromptInputAttachFiles asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={isLoading}
                  className="shrink-0"
                  title="Attach files"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </PromptInputAttachFiles>
            )}

            {/* Voice Input Button */}
            {showSpeechToText && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggleRecording}
                disabled={isLoading}
                className={cn(
                  'shrink-0',
                  isRecording && 'text-destructive animate-pulse'
                )}
                title={isRecording ? 'Stop recording' : 'Start voice input'}
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}

            {/* Textarea */}
            <PromptInputTextarea
              placeholder={placeholder}
              disabled={isLoading}
              className="flex-1 min-h-[44px] resize-none"
              value={value}
              onChange={(e) => onChange?.(e.currentTarget.value)}
            />

            {/* Submit Button */}
            <PromptInputSubmit asChild>
              <Button
                type="submit"
                size="icon"
                disabled={isLoading}
                className="shrink-0"
                title="Send message (Enter)"
              >
                <Send className="h-4 w-4" />
              </Button>
            </PromptInputSubmit>
          </div>

          {/* Helper text */}
          <div className="px-3 pb-2 text-xs text-muted-foreground">
            <kbd className="rounded bg-muted px-1 py-0.5">Enter</kbd> to send
            <span className="mx-1">·</span>
            <kbd className="rounded bg-muted px-1 py-0.5">Shift</kbd> +{' '}
            <kbd className="rounded bg-muted px-1 py-0.5">Enter</kbd> for new line
          </div>
        </PromptInputBody>
      </PromptInput>
    </div>
  );
}
