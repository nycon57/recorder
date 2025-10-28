/**
 * Assistant Chat Component
 *
 * Main chat container that integrates:
 * - Conversation management
 * - AI SDK useChat hook
 * - Message display
 * - Advanced input
 * - All features
 */

'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { toast } from 'sonner';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';
import { useConversations } from '../store/ConversationContext';
import type { ExtendedMessage, MessageAttachment } from '../types';
import { cn } from '@/lib/utils';

/**
 * Assistant Chat Props
 */
export interface AssistantChatProps {
  /**
   * API endpoint for chat
   */
  apiEndpoint?: string;

  /**
   * Custom className
   */
  className?: string;

  /**
   * Whether to show advanced features
   */
  showAdvancedFeatures?: boolean;

  /**
   * Custom example prompts
   */
  examplePrompts?: string[];
}

/**
 * AssistantChat Component
 *
 * Complete chat interface with all state-of-the-art features.
 */
export function AssistantChat({
  apiEndpoint = '/api/chat',
  className,
  showAdvancedFeatures = true,
  examplePrompts = [
    'What did we discuss about the project timeline?',
    'Summarize the key points from my last meeting',
    'Find mentions of the budget',
  ],
}: AssistantChatProps) {
  const {
    getCurrentConversation,
    addMessage,
    updateMessage,
    deleteMessage,
    createConversation,
  } = useConversations();

  const currentConversation = getCurrentConversation();

  /**
   * AI SDK useChat hook
   */
  const {
    messages: aiMessages,
    input,
    setInput,
    handleSubmit: aiHandleSubmit,
    isLoading,
    error,
    reload,
    stop,
    append,
  } = useChat({
    api: apiEndpoint,
    onFinish: (message) => {
      // Sync finished message to conversation store
      const extendedMessage: ExtendedMessage = {
        ...message,
        createdAt: new Date(),
      };
      addMessage(extendedMessage);
    },
    onError: (error) => {
      toast.error('Failed to send message', {
        description: error.message,
      });
    },
  });

  /**
   * Sync AI messages to conversation store
   */
  useEffect(() => {
    if (aiMessages.length > 0 && currentConversation) {
      // Only sync if there are new messages not in the store
      const lastAiMessage = aiMessages[aiMessages.length - 1];
      const lastStoreMessage =
        currentConversation.messages[currentConversation.messages.length - 1];

      if (!lastStoreMessage || lastAiMessage.id !== lastStoreMessage.id) {
        aiMessages.forEach((msg) => {
          const existsInStore = currentConversation.messages.some(
            (m) => m.id === msg.id
          );
          if (!existsInStore) {
            const extendedMessage: ExtendedMessage = {
              ...msg,
              createdAt: new Date(),
            };
            addMessage(extendedMessage);
          }
        });
      }
    }
  }, [aiMessages, currentConversation, addMessage]);

  /**
   * Handle form submission with files
   */
  const handleSubmit = useCallback(
    async (data: { text: string; files?: MessageAttachment[] }) => {
      const { text, files } = data;

      if (!text.trim() && (!files || files.length === 0)) {
        return;
      }

      // Create conversation if none exists
      if (!currentConversation) {
        createConversation(text.slice(0, 50));
      }

      // If there are files, we need to handle multi-modal input
      if (files && files.length > 0) {
        // TODO: Implement multi-modal file upload
        // For now, just send text
        toast.info('File uploads coming soon!');
      }

      // Submit to AI
      await append({
        role: 'user',
        content: text,
      });

      // Clear input
      setInput('');
    },
    [currentConversation, createConversation, append, setInput]
  );

  /**
   * Handle example prompt click
   */
  const handleExampleClick = useCallback(
    (prompt: string) => {
      setInput(prompt);
    },
    [setInput]
  );

  /**
   * Handle message copy
   */
  const handleCopy = useCallback((message: ExtendedMessage) => {
    toast.success('Message copied to clipboard');
  }, []);

  /**
   * Handle message edit
   */
  const handleEdit = useCallback(
    (message: ExtendedMessage) => {
      // Set input to message text for editing
      setInput(
        typeof message.content === 'string'
          ? message.content
          : message.content
              .filter((p) => p.type === 'text')
              .map((p) => p.text)
              .join(' ')
      );

      // TODO: Delete messages after this one and regenerate from edited message
      toast.info('Edit mode - modify and send to regenerate');
    },
    [setInput]
  );

  /**
   * Handle message regenerate
   */
  const handleRegenerate = useCallback(
    async (message: ExtendedMessage) => {
      try {
        await reload();
        toast.success('Regenerating response...');
      } catch (error) {
        toast.error('Failed to regenerate response');
      }
    },
    [reload]
  );

  /**
   * Handle message branch
   */
  const handleBranch = useCallback(
    (message: ExtendedMessage) => {
      // TODO: Implement conversation branching
      toast.info('Branching coming soon!');
    },
    []
  );

  /**
   * Handle message delete
   */
  const handleDelete = useCallback(
    (message: ExtendedMessage) => {
      deleteMessage(message.id);
      toast.success('Message deleted');
    },
    [deleteMessage]
  );

  /**
   * Convert AI messages to ExtendedMessage format
   */
  const extendedMessages: ExtendedMessage[] = useMemo(
    () =>
      aiMessages.map((msg) => ({
        ...msg,
        createdAt: new Date(),
      })),
    [aiMessages]
  );

  /**
   * Generate suggested follow-up prompts
   */
  const suggestions = useMemo(() => {
    // If there are messages, generate context-aware suggestions
    if (extendedMessages.length > 0) {
      return []; // TODO: Implement AI-generated suggestions
    }
    return examplePrompts;
  }, [extendedMessages, examplePrompts]);

  return (
    <div className={cn('h-full flex flex-col', className)} role="main" aria-label="AI Assistant Chat">
      {/* Error Display */}
      {error && (
        <div
          className="px-4 py-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm"
          role="alert"
          aria-live="assertive"
        >
          <strong>Error:</strong> {error.message}
        </div>
      )}

      {/* Message List */}
      <MessageList
        messages={extendedMessages}
        isLoading={isLoading}
        loadingMessage="Searching and thinking..."
        emptyTitle="Ask me anything"
        emptyDescription="I can search your recordings and answer questions with sources and reasoning"
        examplePrompts={examplePrompts}
        onExampleClick={handleExampleClick}
        messageItemProps={{
          showActions: showAdvancedFeatures,
          onCopy: handleCopy,
          onEdit: handleEdit,
          onRegenerate: handleRegenerate,
          onBranch: handleBranch,
          onDelete: handleDelete,
        }}
      />

      {/* Chat Input */}
      <div className="border-t p-3">
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder="Ask a question about your recordings..."
          showAttachments={showAdvancedFeatures}
          showSpeechToText={showAdvancedFeatures}
          suggestions={suggestions}
          onSuggestionClick={handleExampleClick}
        />
      </div>
    </div>
  );
}
