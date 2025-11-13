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
import {
  PromptInputProvider,
  usePromptInputController,
} from '@/app/components/ai-elements/prompt-input';
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
 * AssistantChat Component (Wrapper with PromptInputProvider)
 *
 * Complete chat interface with all state-of-the-art features.
 */
export function AssistantChat(props: AssistantChatProps) {
  return (
    <PromptInputProvider>
      <AssistantChatInner {...props} />
    </PromptInputProvider>
  );
}

/**
 * AssistantChatInner Component
 *
 * Inner chat component that uses PromptInputController.
 */
function AssistantChatInner({
  apiEndpoint = '/api/chat',
  className,
  showAdvancedFeatures = true,
  examplePrompts = [
    'What did we discuss about the project timeline?',
    'Summarize the key points from my last meeting',
    'Find mentions of the budget',
  ],
}: AssistantChatProps) {
  // Get PromptInput controller from provider
  const promptController = usePromptInputController();
  const {
    getCurrentConversation,
    addMessage,
    updateMessage,
    deleteMessage,
    createConversation,
  } = useConversations();

  const currentConversation = getCurrentConversation();

  /**
   * Store last user message ID for source fetching
   */
  const lastUserMessageIdRef = React.useRef<string | null>(null);

  /**
   * Store last assistant message ID for updating with sources
   */
  const lastAssistantMessageIdRef = React.useRef<string | null>(null);

  /**
   * Store sources by USER message ID for merging with aiMessages
   * Key = user message ID, Value = sources for the assistant's response
   */
  const [messageSourcesMap, setMessageSourcesMap] = React.useState<Map<string, any[]>>(new Map());

  /**
   * AI SDK useChat hook
   */
  const {
    messages: aiMessages,
    sendMessage,
    regenerate,
    status,
    error,
    stop,
  } = useChat({
    api: apiEndpoint,
    streamProtocol: 'data',
    onResponse: (response) => {
      // Stream started
    },
    onFinish: async (message) => {
      console.log('[AssistantChat] onFinish called with message:', {
        hasId: 'id' in message,
        id: (message as any).id,
        keys: Object.keys(message),
        message: message,
      });

      // Capture the assistant message ID immediately (synchronously)
      const assistantMessageId = message.id;
      lastAssistantMessageIdRef.current = assistantMessageId;

      // Use the stored user message ID to fetch sources
      const cacheKey = lastUserMessageIdRef.current;

      let messageWithSources = message;

      if (cacheKey) {
        try {
          const sourcesResponse = await fetch(`${apiEndpoint}?sourcesKey=${cacheKey}`);
          const { sources } = await sourcesResponse.json();

          if (sources && sources.length > 0) {
            messageWithSources = {
              ...message,
              sources,
              // Store sourceKey in metadata for building highlight URLs
              metadata: {
                ...message.metadata,
                custom: {
                  ...message.metadata?.custom,
                  sourceKey: cacheKey,
                },
              },
            };
            // Store sources in map using USER message ID as key
            setMessageSourcesMap(prev => new Map(prev).set(cacheKey, sources));

            console.log('[AssistantChat] Created message with sources and metadata:', {
              messageId: message.id,
              cacheKey,
              sourcesCount: sources.length,
              hasMetadata: !!messageWithSources.metadata,
              hasSourceKey: !!messageWithSources.metadata?.custom?.sourceKey,
            });
          }
        } catch (e) {
          console.error('[AssistantChat] Failed to fetch sources:', e);
        }
        // Clear the ref after use
        lastUserMessageIdRef.current = null;
      }

      // Update existing message in store with sources and metadata
      // Use the assistantMessageId we captured synchronously at the start
      console.log('[AssistantChat] Updating message in store via onFinish:', {
        assistantMessageId,
        hasSources: !!messageWithSources.sources,
        sourcesCount: messageWithSources.sources?.length || 0,
        hasMetadata: !!messageWithSources.metadata,
        hasSourceKey: !!messageWithSources.metadata?.custom?.sourceKey,
        sourceKey: messageWithSources.metadata?.custom?.sourceKey,
      });

      updateMessage(assistantMessageId, {
        sources: messageWithSources.sources,
        metadata: messageWithSources.metadata,
      });

      // Clear the ref after use
      lastAssistantMessageIdRef.current = null;
    },
    onError: (error) => {
      console.error('[AssistantChat] useChat onError called:', error);
      toast.error('Failed to send message', {
        description: error.message,
      });
    },
  });

  /**
   * Compute isLoading from status (for compatibility)
   */
  const isLoading = status === 'streaming' || status === 'submitted';

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
            console.log('[AssistantChat] useEffect adding message from aiMessages:', {
              messageId: msg.id,
              role: msg.role,
              hasSources: !!(msg as any).sources,
              hasMetadata: !!(msg as any).metadata,
            });

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

      // Generate a unique ID for this user message to use as cache key
      const messageId = `user-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      lastUserMessageIdRef.current = messageId;

      // Submit to AI
      try {
        await sendMessage({
          id: messageId,
          role: 'user',
          content: text,
        });
      } catch (error) {
        console.error('[AssistantChat] sendMessage() failed:', error);
        toast.error('Failed to send message', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
        // Clear the ref on error
        lastUserMessageIdRef.current = null;
        return;
      }

      // Clear input using PromptInput controller
      promptController.textInput.clear();
    },
    [currentConversation, createConversation, sendMessage, promptController]
  );

  /**
   * Handle example prompt click
   */
  const handleExampleClick = useCallback(
    (prompt: string) => {
      promptController.textInput.setInput(prompt);
    },
    [promptController]
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
      // Set input to message text for editing using PromptInput controller
      const textContent = typeof message.content === 'string'
        ? message.content
        : message.content
            .filter((p) => p.type === 'text')
            .map((p) => p.text)
            .join(' ');

      promptController.textInput.setInput(textContent);

      // TODO: Delete messages after this one and regenerate from edited message
      toast.info('Edit mode - modify and send to regenerate');
    },
    [promptController]
  );

  /**
   * Handle message regenerate
   */
  const handleRegenerate = useCallback(
    async (message: ExtendedMessage) => {
      try {
        await regenerate();
        toast.success('Regenerating response...');
      } catch (error) {
        toast.error('Failed to regenerate response');
      }
    },
    [regenerate]
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
   * Convert AI messages to ExtendedMessage format, merging sources from map
   * and metadata from ConversationStore
   */
  const extendedMessages: ExtendedMessage[] = useMemo(
    () => {
      return aiMessages.map((msg, index) => {
        // For assistant messages, find the preceding user message to get sources
        let sources: any[] | undefined;

        if (msg.role === 'assistant' && index > 0) {
          // Look backwards for the most recent user message
          for (let i = index - 1; i >= 0; i--) {
            if (aiMessages[i].role === 'user') {
              const userMessageId = aiMessages[i].id;
              sources = messageSourcesMap.get(userMessageId);
              break;
            }
          }
        }

        // Merge metadata from ConversationStore if message exists there
        let storeMetadata: any = undefined;
        if (currentConversation) {
          const storeMessage = currentConversation.messages.find((m) => m.id === msg.id);
          if (storeMessage?.metadata) {
            storeMetadata = storeMessage.metadata;
          }
        }

        return {
          ...msg,
          ...(sources && { sources }),
          ...(storeMetadata && { metadata: storeMetadata }),
          createdAt: new Date(),
        };
      });
    },
    [aiMessages, messageSourcesMap, currentConversation]
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
    <div className={cn('flex-1 flex flex-col min-h-0', className)} role="main" aria-label="AI Assistant Chat">
      {/* Error Display */}
      {error && (
        <div
          className="flex-shrink-0 px-4 py-3 bg-destructive/10 border-b border-destructive/20 text-destructive text-sm"
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
      <div className="flex-shrink-0 border-t">
        <ChatInput
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
