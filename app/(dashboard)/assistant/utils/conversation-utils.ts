/**
 * Conversation Utility Functions
 *
 * Helper functions for conversation management, export, and search.
 */

import type { Conversation, ExtendedMessage } from '../types';

/**
 * Generate a conversation title from the first user message
 */
export function generateConversationTitle(
  messages: ExtendedMessage[],
  maxLength: number = 50
): string {
  const firstUserMessage = messages.find((m) => m.role === 'user');

  if (!firstUserMessage) {
    return 'New Conversation';
  }

  const content =
    typeof firstUserMessage.content === 'string'
      ? firstUserMessage.content
      : firstUserMessage.content
          .filter((p) => p.type === 'text')
          .map((p) => p.text)
          .join(' ');

  return content.length > maxLength
    ? content.slice(0, maxLength) + '...'
    : content || 'New Conversation';
}

/**
 * Export conversation to Markdown format
 */
export function exportConversationToMarkdown(conversation: Conversation): string {
  const header = `# ${conversation.title}\n\n`;
  const metadata = `Created: ${conversation.createdAt.toLocaleString()}\nLast Updated: ${conversation.updatedAt.toLocaleString()}\n\n---\n\n`;

  const messages = conversation.messages
    .map((message) => {
      const role = message.role === 'user' ? '**You**' : '**Assistant**';
      const timestamp = message.createdAt
        ? `_${message.createdAt.toLocaleTimeString()}_`
        : '';

      const content =
        typeof message.content === 'string'
          ? message.content
          : message.content
              .filter((p) => p.type === 'text')
              .map((p) => p.text)
              .join('\n\n');

      // Add sources if available
      let sources = '';
      if (message.sources && message.sources.length > 0) {
        sources =
          '\n\n**Sources:**\n' +
          message.sources.map((s) => `- [${s.title}](${s.url})`).join('\n');
      }

      // Add reasoning if available
      let reasoning = '';
      if (message.reasoning) {
        reasoning =
          '\n\n<details>\n<summary>Reasoning</summary>\n\n' +
          message.reasoning.steps.map((s) => `- ${s.content}`).join('\n') +
          '\n</details>';
      }

      return `### ${role} ${timestamp}\n\n${content}${sources}${reasoning}`;
    })
    .join('\n\n---\n\n');

  return header + metadata + messages;
}

/**
 * Export conversation to JSON format
 */
export function exportConversationToJSON(conversation: Conversation): string {
  return JSON.stringify(conversation, null, 2);
}

/**
 * Export conversation to plain text format
 */
export function exportConversationToText(conversation: Conversation): string {
  const header = `${conversation.title}\n${'='.repeat(conversation.title.length)}\n\n`;
  const metadata = `Created: ${conversation.createdAt.toLocaleString()}\nLast Updated: ${conversation.updatedAt.toLocaleString()}\n\n`;

  const messages = conversation.messages
    .map((message) => {
      const role = message.role === 'user' ? 'You' : 'Assistant';
      const timestamp = message.createdAt
        ? `[${message.createdAt.toLocaleTimeString()}]`
        : '';

      const content =
        typeof message.content === 'string'
          ? message.content
          : message.content
              .filter((p) => p.type === 'text')
              .map((p) => p.text)
              .join('\n\n');

      return `${role} ${timestamp}:\n${content}`;
    })
    .join('\n\n---\n\n');

  return header + metadata + messages;
}

/**
 * Download conversation as a file
 */
export function downloadConversation(
  conversation: Conversation,
  format: 'markdown' | 'json' | 'text' = 'markdown'
): void {
  let content: string;
  let mimeType: string;
  let extension: string;

  switch (format) {
    case 'markdown':
      content = exportConversationToMarkdown(conversation);
      mimeType = 'text/markdown';
      extension = 'md';
      break;
    case 'json':
      content = exportConversationToJSON(conversation);
      mimeType = 'application/json';
      extension = 'json';
      break;
    case 'text':
      content = exportConversationToText(conversation);
      mimeType = 'text/plain';
      extension = 'txt';
      break;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `${conversation.title.replace(/[^a-z0-9]/gi, '_')}.${extension}`;
  link.click();

  URL.revokeObjectURL(url);
}

/**
 * Search conversations by query
 */
export function searchConversations(
  conversations: Conversation[],
  query: string
): Conversation[] {
  if (!query.trim()) {
    return conversations;
  }

  const lowerQuery = query.toLowerCase();

  return conversations.filter((conv) => {
    // Search in title
    if (conv.title.toLowerCase().includes(lowerQuery)) {
      return true;
    }

    // Search in messages
    return conv.messages.some((message) => {
      const content =
        typeof message.content === 'string'
          ? message.content
          : message.content
              .filter((p) => p.type === 'text')
              .map((p) => p.text)
              .join(' ');

      return content.toLowerCase().includes(lowerQuery);
    });
  });
}

/**
 * Sort conversations by various criteria
 */
export function sortConversations(
  conversations: Conversation[],
  sortBy: 'recent' | 'oldest' | 'title' = 'recent'
): Conversation[] {
  const sorted = [...conversations];

  switch (sortBy) {
    case 'recent':
      return sorted.sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );
    case 'oldest':
      return sorted.sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
      );
    case 'title':
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return sorted;
  }
}

/**
 * Get conversation statistics
 */
export function getConversationStats(conversation: Conversation) {
  const messageCount = conversation.messages.length;
  const userMessages = conversation.messages.filter((m) => m.role === 'user')
    .length;
  const assistantMessages = conversation.messages.filter(
    (m) => m.role === 'assistant'
  ).length;

  const totalWords = conversation.messages.reduce((sum, message) => {
    const content =
      typeof message.content === 'string'
        ? message.content
        : message.content
            .filter((p) => p.type === 'text')
            .map((p) => p.text)
            .join(' ');

    return sum + content.split(/\s+/).length;
  }, 0);

  const duration =
    conversation.messages.length > 1 &&
    conversation.messages[0].createdAt &&
    conversation.messages[conversation.messages.length - 1].createdAt
      ? conversation.messages[conversation.messages.length - 1].createdAt!.getTime() -
        conversation.messages[0].createdAt!.getTime()
      : 0;

  return {
    messageCount,
    userMessages,
    assistantMessages,
    totalWords,
    duration, // in milliseconds
  };
}

/**
 * Copy conversation to clipboard
 */
export async function copyConversationToClipboard(
  conversation: Conversation,
  format: 'markdown' | 'text' = 'markdown'
): Promise<void> {
  const content =
    format === 'markdown'
      ? exportConversationToMarkdown(conversation)
      : exportConversationToText(conversation);

  try {
    await navigator.clipboard.writeText(content);
  } catch (error) {
    console.error('Failed to copy conversation:', error);
    throw new Error('Failed to copy conversation to clipboard');
  }
}

/**
 * Share conversation via URL (client-side state)
 */
export function generateShareableURL(conversation: Conversation): string {
  // Encode conversation data in URL params
  const encoded = encodeURIComponent(
    JSON.stringify({
      title: conversation.title,
      messages: conversation.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    })
  );

  return `${window.location.origin}${window.location.pathname}?shared=${encoded}`;
}

/**
 * Parse shared conversation from URL
 */
export function parseSharedConversation(
  url: string
): Partial<Conversation> | null {
  try {
    const params = new URLSearchParams(new URL(url).search);
    const shared = params.get('shared');

    if (!shared) {
      return null;
    }

    const data = JSON.parse(decodeURIComponent(shared));

    return {
      title: data.title,
      messages: data.messages,
    };
  } catch (error) {
    console.error('Failed to parse shared conversation:', error);
    return null;
  }
}
