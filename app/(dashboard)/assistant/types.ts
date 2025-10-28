/**
 * Type definitions for the state-of-the-art chat implementation
 */

import { Message } from '@ai-sdk/react';
import { ToolInvocation } from 'ai';

/**
 * Extended message type with additional metadata
 */
export interface ExtendedMessage extends Message {
  /**
   * Unique message ID
   */
  id: string;

  /**
   * Message role (user or assistant)
   */
  role: 'user' | 'assistant' | 'system';

  /**
   * Message content (text or structured parts)
   */
  content: string | MessagePart[];

  /**
   * Creation timestamp
   */
  createdAt?: Date;

  /**
   * Tool invocations for this message
   */
  toolInvocations?: ToolInvocation[];

  /**
   * Reasoning/chain-of-thought data
   */
  reasoning?: ReasoningData;

  /**
   * Source citations for RAG responses
   */
  sources?: SourceCitation[];

  /**
   * File attachments
   */
  attachments?: MessageAttachment[];

  /**
   * Action metadata
   */
  metadata?: MessageMetadata;
}

/**
 * Message part for structured content
 */
export interface MessagePart {
  type: 'text' | 'reasoning' | 'source-url' | 'tool-call' | 'tool-result';
  text?: string;
  url?: string;
  title?: string;
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

/**
 * Reasoning/chain-of-thought data
 */
export interface ReasoningData {
  steps: ReasoningStep[];
  conclusion?: string;
}

/**
 * Individual reasoning step
 */
export interface ReasoningStep {
  id: string;
  type: 'thinking' | 'searching' | 'analyzing' | 'concluding';
  content: string;
  timestamp?: Date;
}

/**
 * Source citation
 */
export interface SourceCitation {
  id: string;
  recordingId?: string;
  title: string;
  url: string;
  snippet?: string;
  relevanceScore?: number;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Message attachment (file, image, etc.)
 */
export interface MessageAttachment {
  id: string;
  type: 'image' | 'file' | 'audio' | 'video';
  name: string;
  url?: string;
  mimeType: string;
  size: number;
  preview?: string; // Base64 or URL for preview
}

/**
 * Message metadata for actions and state
 */
export interface MessageMetadata {
  /**
   * Whether this message was edited
   */
  edited?: boolean;

  /**
   * Original message ID if this is an edit
   */
  originalId?: string;

  /**
   * Whether this message was regenerated
   */
  regenerated?: boolean;

  /**
   * Parent message ID for branching
   */
  parentId?: string;

  /**
   * Branch ID if this is a branched conversation
   */
  branchId?: string;

  /**
   * User feedback (thumbs up/down)
   */
  feedback?: 'positive' | 'negative';

  /**
   * Any custom data
   */
  custom?: Record<string, unknown>;
}

/**
 * Conversation (in-memory, no database persistence yet)
 */
export interface Conversation {
  /**
   * Unique conversation ID
   */
  id: string;

  /**
   * Conversation title (auto-generated or user-set)
   */
  title: string;

  /**
   * Messages in this conversation
   */
  messages: ExtendedMessage[];

  /**
   * Creation timestamp
   */
  createdAt: Date;

  /**
   * Last update timestamp
   */
  updatedAt: Date;

  /**
   * Conversation metadata
   */
  metadata?: {
    /**
     * Whether this conversation is pinned
     */
    pinned?: boolean;

    /**
     * Tags/labels
     */
    tags?: string[];

    /**
     * Parent conversation ID if branched
     */
    parentId?: string;

    /**
     * Custom data
     */
    custom?: Record<string, unknown>;
  };
}

/**
 * Conversation store state
 */
export interface ConversationState {
  /**
   * All conversations (in-memory)
   */
  conversations: Conversation[];

  /**
   * Current active conversation ID
   */
  currentConversationId: string | null;

  /**
   * Search query for filtering conversations
   */
  searchQuery: string;

  /**
   * Whether the sidebar is open (for mobile)
   */
  sidebarOpen: boolean;
}

/**
 * Conversation store actions
 */
export interface ConversationActions {
  /**
   * Create a new conversation
   */
  createConversation: (title?: string) => Conversation;

  /**
   * Delete a conversation
   */
  deleteConversation: (conversationId: string) => void;

  /**
   * Switch to a different conversation
   */
  switchConversation: (conversationId: string) => void;

  /**
   * Update conversation title
   */
  updateConversationTitle: (conversationId: string, title: string) => void;

  /**
   * Add a message to the current conversation
   */
  addMessage: (message: ExtendedMessage) => void;

  /**
   * Update a message
   */
  updateMessage: (messageId: string, updates: Partial<ExtendedMessage>) => void;

  /**
   * Delete a message
   */
  deleteMessage: (messageId: string) => void;

  /**
   * Branch conversation from a message
   */
  branchConversation: (messageId: string) => Conversation;

  /**
   * Set search query
   */
  setSearchQuery: (query: string) => void;

  /**
   * Toggle sidebar
   */
  toggleSidebar: () => void;

  /**
   * Get current conversation
   */
  getCurrentConversation: () => Conversation | null;

  /**
   * Clear all conversations
   */
  clearAll: () => void;
}

/**
 * Complete conversation context type
 */
export type ConversationContextType = ConversationState & ConversationActions;

/**
 * Suggestion for follow-up questions
 */
export interface Suggestion {
  id: string;
  text: string;
  icon?: string;
}
