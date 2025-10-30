/**
 * Message Utility Functions
 *
 * Helper functions for message formatting, actions, and transformations.
 */

import type { ExtendedMessage, MessagePart, SourceCitation } from '../types';

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
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('\n\n');
    if (text) return text;
  }

  // 3. Try 'text' field directly - alternative format
  if ('text' in message && typeof (message as any).text === 'string') {
    return (message as any).text;
  }

  // 4. Try parts array - AI SDK v5 streaming format
  // This is used by useChat() when streaming responses
  if ('parts' in message && Array.isArray((message as any).parts)) {
    const text = (message as any).parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text || '')
      .join('\n\n');
    if (text) return text;
  }

  // Return empty string if no text content found
  return '';
}

/**
 * Extract reasoning parts from a message
 */
export function extractReasoningParts(message: ExtendedMessage): MessagePart[] {
  if (typeof message.content === 'string' || !Array.isArray(message.content)) {
    return [];
  }

  return message.content.filter((p) => p.type === 'reasoning');
}

/**
 * Extract source parts from a message
 */
export function extractSourceParts(message: ExtendedMessage): MessagePart[] {
  if (typeof message.content === 'string' || !Array.isArray(message.content)) {
    return [];
  }

  return message.content.filter((p) => p.type === 'source-url');
}

/**
 * Extract tool call parts from a message
 */
export function extractToolCallParts(message: ExtendedMessage): MessagePart[] {
  if (typeof message.content === 'string' || !Array.isArray(message.content)) {
    return [];
  }

  return message.content.filter(
    (p) => p.type === 'tool-call' || p.type === 'tool-result'
  );
}

/**
 * Format message timestamp
 */
export function formatMessageTimestamp(
  date: Date | undefined,
  format: 'short' | 'long' | 'relative' = 'short'
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
  message: ExtendedMessage
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
export function getMessageWordCount(message: ExtendedMessage): number {
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
export function messageHasAttachments(message: ExtendedMessage): boolean {
  return message.attachments !== undefined && message.attachments.length > 0;
}

/**
 * Format sources for display
 */
export function formatSources(
  message: ExtendedMessage
): SourceCitation[] {
  // First, check if message has sources array
  if (message.sources && message.sources.length > 0) {
    return message.sources;
  }

  // Check if sources are in message.data (from AI SDK streaming response)
  if ((message as any).data?.sources && Array.isArray((message as any).data.sources)) {
    return (message as any).data.sources;
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
export function groupMessagesByDate(messages: ExtendedMessage[]): {
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
export function sanitizeMessageContent(content: string): string {
  // Basic sanitization - in production, use a library like DOMPurify
  return content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
}

/**
 * Truncate message content
 */
export function truncateMessage(
  message: ExtendedMessage,
  maxLength: number = 100
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
export function isUserMessage(message: ExtendedMessage): boolean {
  return message.role === 'user';
}

/**
 * Check if message is from assistant
 */
export function isAssistantMessage(message: ExtendedMessage): boolean {
  return message.role === 'assistant';
}

/**
 * Check if message was edited
 */
export function isEditedMessage(message: ExtendedMessage): boolean {
  return message.metadata?.edited === true;
}

/**
 * Check if message was regenerated
 */
export function isRegeneratedMessage(message: ExtendedMessage): boolean {
  return message.metadata?.regenerated === true;
}

/**
 * Get message icon based on role
 */
export function getMessageIcon(message: ExtendedMessage): string {
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
export function estimateReadingTime(message: ExtendedMessage): number {
  const wordCount = getMessageWordCount(message);
  const wordsPerMinute = 200; // Average reading speed

  return Math.ceil((wordCount / wordsPerMinute) * 60);
}

/**
 * Convert message to plain text for search
 */
export function messageToSearchableText(message: ExtendedMessage): string {
  const text = extractMessageText(message);
  const sources = formatSources(message)
    .map((s) => s.title)
    .join(' ');
  const reasoning = message.reasoning?.steps.map((s) => s.content).join(' ') || '';

  return `${text} ${sources} ${reasoning}`.toLowerCase();
}

/**
 * Search messages by query
 */
export function searchMessages(
  messages: ExtendedMessage[],
  query: string
): ExtendedMessage[] {
  if (!query.trim()) {
    return messages;
  }

  const lowerQuery = query.toLowerCase();

  return messages.filter((message) =>
    messageToSearchableText(message).includes(lowerQuery)
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
 */
export function parseCitationsToMarkdown(
  text: string,
  sources: SourceCitation[]
): string {
  if (!sources || sources.length === 0) return text;

  // Create a map of citation numbers to source URLs
  const citationMap = new Map<number, string>();
  sources.forEach((source, index) => {
    citationMap.set(index + 1, source.url);
  });

  // Replace citation patterns:
  // - Single: [1] -> [1](url)
  // - Multiple: [1, 2, 3] -> [1](url1), [2](url2), [3](url3)
  return text.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (match, nums) => {
    // Split by comma to handle multiple citations
    const citationNums = nums.split(/\s*,\s*/).map((n: string) => parseInt(n, 10));

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
