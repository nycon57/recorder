/**
 * Conversation Store using React Context
 *
 * Manages in-memory conversations, messages, and state.
 * No database persistence - everything is client-side for now.
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { nanoid } from 'nanoid';
import type {
  Conversation,
  ExtendedMessage,
  ConversationContextType,
  ConversationState,
  ConversationActions,
} from '../types';

/**
 * Initial conversation state
 */
const initialState: ConversationState = {
  conversations: [],
  currentConversationId: null,
  searchQuery: '',
  sidebarOpen: true,
};

/**
 * Conversation Context
 */
const ConversationContext = createContext<ConversationContextType | null>(null);

/**
 * Conversation Provider Props
 */
interface ConversationProviderProps {
  children: React.ReactNode;
}

/**
 * Conversation Provider Component
 *
 * Provides conversation state and actions to the entire assistant app.
 */
export function ConversationProvider({ children }: ConversationProviderProps) {
  const [state, setState] = useState<ConversationState>(initialState);

  /**
   * Create a new conversation
   */
  const createConversation = useCallback((title?: string): Conversation => {
    const newConversation: Conversation = {
      id: nanoid(),
      title: title || 'New Conversation',
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {},
    };

    setState((prev) => ({
      ...prev,
      conversations: [...prev.conversations, newConversation],
      currentConversationId: newConversation.id,
    }));

    return newConversation;
  }, []);

  /**
   * Delete a conversation
   */
  const deleteConversation = useCallback((conversationId: string) => {
    setState((prev) => {
      const conversations = prev.conversations.filter((c) => c.id !== conversationId);
      const isCurrentDeleted = prev.currentConversationId === conversationId;

      return {
        ...prev,
        conversations,
        currentConversationId: isCurrentDeleted
          ? conversations[0]?.id || null
          : prev.currentConversationId,
      };
    });
  }, []);

  /**
   * Switch to a different conversation
   */
  const switchConversation = useCallback((conversationId: string) => {
    setState((prev) => ({
      ...prev,
      currentConversationId: conversationId,
    }));
  }, []);

  /**
   * Update conversation title
   */
  const updateConversationTitle = useCallback(
    (conversationId: string, title: string) => {
      setState((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) =>
          c.id === conversationId
            ? { ...c, title, updatedAt: new Date() }
            : c
        ),
      }));
    },
    []
  );

  /**
   * Add a message to the current conversation
   */
  const addMessage = useCallback((message: ExtendedMessage) => {
    setState((prev) => {
      // If no current conversation, create one
      if (!prev.currentConversationId) {
        const newConv = {
          id: nanoid(),
          title: 'New Conversation',
          messages: [message],
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        };

        return {
          ...prev,
          conversations: [newConv],
          currentConversationId: newConv.id,
        };
      }

      // Add to existing conversation
      return {
        ...prev,
        conversations: prev.conversations.map((c) => {
          if (c.id !== prev.currentConversationId) return c;

          // Auto-generate title from first user message
          const isFirstUserMessage =
            c.messages.length === 0 && message.role === 'user';
          const newTitle = isFirstUserMessage
            ? message.content.toString().slice(0, 50) +
              (message.content.toString().length > 50 ? '...' : '')
            : c.title;

          return {
            ...c,
            messages: [...c.messages, message],
            title: newTitle,
            updatedAt: new Date(),
          };
        }),
      };
    });
  }, []);

  /**
   * Update a message
   */
  const updateMessage = useCallback(
    (messageId: string, updates: Partial<ExtendedMessage>) => {
      setState((prev) => ({
        ...prev,
        conversations: prev.conversations.map((c) => {
          const containsMessage = c.messages.some((m) => m.id === messageId);
          if (containsMessage) {
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, ...updates } : m
              ),
              updatedAt: new Date(),
            };
          }
          return c;
        }),
      }));
    },
    []
  );

  /**
   * Delete a message
   */
  const deleteMessage = useCallback((messageId: string) => {
    setState((prev) => ({
      ...prev,
      conversations: prev.conversations.map((c) => {
        const containsMessage = c.messages.some((m) => m.id === messageId);
        if (containsMessage) {
          return {
            ...c,
            messages: c.messages.filter((m) => m.id !== messageId),
            updatedAt: new Date(),
          };
        }
        return c;
      }),
    }));
  }, []);

  /**
   * Branch conversation from a specific message
   */
  const branchConversation = useCallback((messageId: string): Conversation | null => {
    let branchedConv: Conversation | null = null;

    setState((prev) => {
      const currentConv = prev.conversations.find(
        (c) => c.id === prev.currentConversationId
      );

      if (!currentConv) return prev;

      // Find message index
      const messageIndex = currentConv.messages.findIndex(
        (m) => m.id === messageId
      );

      if (messageIndex === -1) return prev;

      // Create new conversation with messages up to the branch point
      branchedConv = {
        id: nanoid(),
        title: `${currentConv.title} (branch)`,
        messages: currentConv.messages.slice(0, messageIndex + 1),
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          parentId: currentConv.id,
        },
      };

      return {
        ...prev,
        conversations: [...prev.conversations, branchedConv],
        currentConversationId: branchedConv.id,
      };
    });

    return branchedConv;
  }, []);

  /**
   * Set search query
   */
  const setSearchQuery = useCallback((query: string) => {
    setState((prev) => ({
      ...prev,
      searchQuery: query,
    }));
  }, []);

  /**
   * Toggle sidebar
   */
  const toggleSidebar = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sidebarOpen: !prev.sidebarOpen,
    }));
  }, []);

  /**
   * Get current conversation
   */
  const getCurrentConversation = useCallback((): Conversation | null => {
    return (
      state.conversations.find((c) => c.id === state.currentConversationId) ||
      null
    );
  }, [state.conversations, state.currentConversationId]);

  /**
   * Clear all conversations
   */
  const clearAll = useCallback(() => {
    setState(initialState);
  }, []);

  /**
   * Memoized context value
   */
  const contextValue = useMemo<ConversationContextType>(
    () => ({
      ...state,
      createConversation,
      deleteConversation,
      switchConversation,
      updateConversationTitle,
      addMessage,
      updateMessage,
      deleteMessage,
      branchConversation,
      setSearchQuery,
      toggleSidebar,
      getCurrentConversation,
      clearAll,
    }),
    [
      state,
      createConversation,
      deleteConversation,
      switchConversation,
      updateConversationTitle,
      addMessage,
      updateMessage,
      deleteMessage,
      branchConversation,
      setSearchQuery,
      toggleSidebar,
      getCurrentConversation,
      clearAll,
    ]
  );

  return (
    <ConversationContext.Provider value={contextValue}>
      {children}
    </ConversationContext.Provider>
  );
}

/**
 * useConversations Hook
 *
 * Access conversation state and actions from any component.
 */
export function useConversations(): ConversationContextType {
  const context = useContext(ConversationContext);

  if (!context) {
    throw new Error(
      'useConversations must be used within a ConversationProvider'
    );
  }

  return context;
}
