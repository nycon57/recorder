/**
 * Message Utility Functions
 *
 * Helper functions for message formatting, actions, and transformations.
 */

import type { ExtendedMessage, MessagePart, SourceCitation } from '../types';

type MessageWithText = ExtendedMessage & {
  text?: unknown;
  parts?: unknown;
  data?: {
    sources?: unknown;
  };
};

function isMessagePart(part: unknown): part is MessagePart {
  return (
    typeof part === 'object' &&
    part !== null &&
    'type' in part &&
    typeof (part as { type?: unknown }).type === 'string'
  );
}

function isSourceCitation(source: unknown): source is SourceCitation {
  return (
    typeof source === 'object' &&
    source !== null &&
    typeof (source as { id?: unknown }).id === 'string' &&
    typeof (source as { title?: unknown }).title === 'string' &&
    typeof (source as { url?: unknown }).url === 'string'
  );
}

/**
 * Extract text content from a message
 */
export function extractMessageText(message: ExtendedMessage): string {
  // Try multiple sources for text content to support different AI SDK versions

  // 1. Try content field (string) - AI SDK standard format
  if (typeof message.content === 'string') {
    return message.content;
  }

  // 2. Try content field (array of parts) - structured content
  if (message.content && Array.isArray(message.content)) {
    const text = message.content
      .flatMap((__item, __index, __array) =>
        __item.type === 'text' ? [__item.text] : [],
      )
      .join('\n\n');
    if (text) return text;
  }

  // 3. Try 'text' field directly - alternative format
  const flexibleMessage = message as MessageWithText;

  if (typeof flexibleMessage.text === 'string') {
    return flexibleMessage.text;
  }

  // 4. Try parts array - AI SDK v5 streaming format
  // This is used by useChat() when streaming responses
  if (Array.isArray(flexibleMessage.parts)) {
    const text = flexibleMessage.parts
      .flatMap((__item, __index, __array) =>
        isMessagePart(__item)
          ? __item.type === 'text'
            ? [__item.text || '']
            : []
          : [],
      )
      .join('\n\n');
    if (text) return text;
  }

  // Return empty string if no text content found
  return '';
}

/**
 * Extract reasoning parts from a message
 */
function extractReasoningParts(message: ExtendedMessage): MessagePart[] {
  if (typeof message.content === 'string' || !Array.isArray(message.content)) {
    return [];
  }

  return message.content.filter((p) => p.type === 'reasoning');
}

/**
 * Extract source parts from a message
 */
function extractSourceParts(message: ExtendedMessage): MessagePart[] {
  if (typeof message.content === 'string' || !Array.isArray(message.content)) {
    return [];
  }

  return message.content.filter((p) => p.type === 'source-url');
}

/**
 * Extract tool call parts from a message
 */
function extractToolCallParts(message: ExtendedMessage): MessagePart[] {
  if (typeof message.content === 'string' || !Array.isArray(message.content)) {
    return [];
  }

  return message.content.filter(
    (p) => p.type === 'tool-call' || p.type === 'tool-result',
  );
}

/**
 * Format message timestamp
 */
export function formatMessageTimestamp(
  date: Date | undefined,
  format: 'short' | 'long' | 'relative' = 'short',
): string {
  if (!date) {
    return '';
  }

  switch (format) {
    case 'short':
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

    case 'long':
      return date.toLocaleString();

    case 'relative': {
      const now = new Date();
      const diff = now.getTime() - date.getTime();

      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (seconds < 60) return 'just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days < 7) return `${days}d ago`;

      return date.toLocaleDateString();
    }

    default:
      return date.toLocaleTimeString();
  }
}

/**
 * Copy message content to clipboard
 */
export async function copyMessageToClipboard(
  message: ExtendedMessage,
): Promise<void> {
  const text = extractMessageText(message);

  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    console.error('Failed to copy message:', error);
    throw new Error('Failed to copy message to clipboard');
  }
}

/**
 * Calculate message word count
 */
function getMessageWordCount(message: ExtendedMessage): number {
  const text = extractMessageText(message);
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Check if message has sources
 */
export function messageHasSources(message: ExtendedMessage): boolean {
  return (
    (message.sources && message.sources.length > 0) ||
    extractSourceParts(message).length > 0
  );
}

/**
 * Check if message has reasoning
 */
export function messageHasReasoning(message: ExtendedMessage): boolean {
  return (
    (message.reasoning && message.reasoning.steps.length > 0) ||
    extractReasoningParts(message).length > 0
  );
}

/**
 * Check if message has tool calls
 */
export function messageHasToolCalls(message: ExtendedMessage): boolean {
  return (
    (message.toolInvocations && message.toolInvocations.length > 0) ||
    extractToolCallParts(message).length > 0
  );
}

/**
 * Check if message has attachments
 */
function messageHasAttachments(message: ExtendedMessage): boolean {
  return message.attachments !== undefined && message.attachments.length > 0;
}

/**
 * Format sources for display
 */
export function formatSources(message: ExtendedMessage): SourceCitation[] {
  // First, check if message has sources array
  if (message.sources && message.sources.length > 0) {
    return message.sources;
  }

  // Check if sources are in message.data (from AI SDK streaming response)
  const flexibleMessage = message as MessageWithText;
  const dataSources = flexibleMessage.data?.sources;
  if (Array.isArray(dataSources)) {
    return dataSources.filter(isSourceCitation);
  }

  // Otherwise, extract from message parts
  const sourceParts = extractSourceParts(message);

  return sourceParts.map((part, index) => ({
    id: `source-${index}`,
    title: part.title || part.url || 'Source',
    url: part.url || '#',
    snippet: part.text,
  }));
}

/**
 * Group messages by date
 */
function groupMessagesByDate(messages: ExtendedMessage[]): {
  date: string;
  messages: ExtendedMessage[];
}[] {
  const groups: { [key: string]: ExtendedMessage[] } = {};

  messages.forEach((message) => {
    if (!message.createdAt) return;

    const dateKey = message.createdAt.toLocaleDateString();

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }

    groups[dateKey].push(message);
  });

  return Object.entries(groups).map(([date, msgs]) => ({
    date,
    messages: msgs,
  }));
}

/**
 * Sanitize message content (remove potentially unsafe HTML)
 */
function sanitizeMessageContent(content: string): string {
  // Basic sanitization - in production, use a library like DOMPurify
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

/**
 * Truncate message content
 */
function truncateMessage(
  message: ExtendedMessage,
  maxLength: number = 100,
): string {
  const text = extractMessageText(message);

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength) + '...';
}

/**
 * Check if message is from user
 */
function isUserMessage(message: ExtendedMessage): boolean {
  return message.role === 'user';
}

/**
 * Check if message is from assistant
 */
function isAssistantMessage(message: ExtendedMessage): boolean {
  return message.role === 'assistant';
}

/**
 * Check if message was edited
 */
function isEditedMessage(message: ExtendedMessage): boolean {
  return message.metadata?.edited === true;
}

/**
 * Check if message was regenerated
 */
function isRegeneratedMessage(message: ExtendedMessage): boolean {
  return message.metadata?.regenerated === true;
}

/**
 * Get message icon based on role
 */
function getMessageIcon(message: ExtendedMessage): string {
  switch (message.role) {
    case 'user':
      return '👤';
    case 'assistant':
      return '🤖';
    case 'system':
      return '⚙️';
    default:
      return '💬';
  }
}

/**
 * Estimate message reading time in seconds
 */
function estimateReadingTime(message: ExtendedMessage): number {
  const wordCount = getMessageWordCount(message);
  const wordsPerMinute = 200; // Average reading speed

  return Math.ceil((wordCount / wordsPerMinute) * 60);
}

/**
 * Convert message to plain text for search
 */
function messageToSearchableText(message: ExtendedMessage): string {
  const text = extractMessageText(message);
  const sources = formatSources(message)
    .map((s) => s.title)
    .join(' ');
  const reasoning =
    message.reasoning?.steps.map((s) => s.content).join(' ') || '';

  return `${text} ${sources} ${reasoning}`.toLowerCase();
}

/**
 * Search messages by query
 */
function searchMessages(
  messages: ExtendedMessage[],
  query: string,
): ExtendedMessage[] {
  if (!query.trim()) {
    return messages;
  }

  const lowerQuery = query.toLowerCase();

  return messages.filter((message) =>
    messageToSearchableText(message).includes(lowerQuery),
  );
}

/**
 * Get message color based on role
 */
export function getMessageColor(message: ExtendedMessage): {
  bg: string;
  text: string;
} {
  switch (message.role) {
    case 'user':
      return {
        bg: 'bg-primary',
        text: 'text-primary-foreground',
      };
    case 'assistant':
      return {
        bg: 'bg-muted',
        text: 'text-foreground',
      };
    case 'system':
      return {
        bg: 'bg-secondary',
        text: 'text-secondary-foreground',
      };
    default:
      return {
        bg: 'bg-muted',
        text: 'text-foreground',
      };
  }
}

/**
 * Parse citations from message text and convert to markdown links
 * Converts patterns like "[1]", "[2, 3]", "[1, 2, 3]" to clickable markdown links
 * with highlight query parameters for in-document navigation
 */
export function parseCitationsToMarkdown(
  text: string,
  sources: SourceCitation[],
  sourceKey?: string,
): string {
  if (!sources || sources.length === 0) return text;

  // Create a map of citation numbers to source URLs with highlight params
  const citationMap = new Map<number, string>();
  sources.forEach((source, index) => {
    let url = source.url;

    // Add highlight query parameters if available
    if (sourceKey && source.metadata?.chunkId) {
      const chunkId = source.metadata.chunkId;
      // Ensure chunkId is a valid type (string, number, or boolean)
      const chunkIdValue =
        typeof chunkId === 'string' ||
        typeof chunkId === 'number' ||
        typeof chunkId === 'boolean'
          ? String(chunkId)
          : '';

      if (chunkIdValue) {
        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}sourceKey=${encodeURIComponent(sourceKey)}&highlight=${encodeURIComponent(chunkIdValue)}`;
      }
    }

    citationMap.set(index + 1, url);
  });

  // Replace citation patterns:
  // - Single: [1] -> [1](url)
  // - Multiple: [1, 2, 3] -> [1](url1), [2](url2), [3](url3)
  return text.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (match, nums) => {
    // Split by comma to handle multiple citations
    const citationNums = nums
      .split(/\s*,\s*/)
      .map((n: string) => parseInt(n, 10));

    // Convert each number to a markdown link
    const links = citationNums.map((num: number) => {
      const url = citationMap.get(num);
      if (url) {
        return `[[${num}]](${url})`;
      }
      return `[${num}]`;
    });

    // Join with commas and space
    return links.join(', ');
  });
}
