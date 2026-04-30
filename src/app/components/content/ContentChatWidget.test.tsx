/* eslint-env jest, browser */

import { TextDecoder, TextEncoder } from 'node:util';
import { ReadableStream } from 'node:stream/web';

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

jest.mock('lucide-react', () => ({
  Loader2: () => null,
  MessageSquare: () => null,
  Send: () => null,
  Trash2: () => null,
  X: () => null,
}));

jest.mock('@/lib/hooks/useEngagementTracking', () => ({
  trackChatQuestion: jest.fn(),
}));

jest.mock('@/app/components/chat/ResponseRating', () => ({
  ResponseRating: () => <div data-testid="response-rating" />,
}));

function createSseResponse(events: Array<Record<string, unknown>>) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        }
        controller.close();
      },
    }),
  } as unknown as Response;
}

describe('ContentChatWidget', () => {
  const originalFetch = global.fetch;
  let ContentChatWidget: typeof import('./ContentChatWidget').ContentChatWidget;

  beforeEach(async () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        randomUUID: () => 'test-session-id',
      },
    });
    Object.defineProperty(globalThis, 'TextEncoder', {
      configurable: true,
      value: TextEncoder,
    });
    Object.defineProperty(globalThis, 'TextDecoder', {
      configurable: true,
      value: TextDecoder,
    });
    Element.prototype.scrollIntoView = jest.fn();
    ({ ContentChatWidget } = await import('./ContentChatWidget'));
    global.fetch = jest.fn(async () =>
      createSseResponse([
        {
          type: 'sources',
          sources: [
            {
              contentId: 'content-1',
              contentTitle: 'Install guide',
              chunkText: 'Click Settings, then API keys.',
              url: '/library/content-1',
            },
          ],
        },
        { type: 'token', token: 'Use the API keys page. ' },
        { type: 'done', conversationId: 'conversation-1' },
      ]),
    ) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('renders streamed sources under the assistant response', async () => {
    render(<ContentChatWidget contentId="content-1" contentTitle="Install guide" />);

    fireEvent.click(screen.getByRole('button', { name: 'Ask about this' }));
    fireEvent.change(screen.getByLabelText('Type your question'), {
      target: { value: 'Where are API keys?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      expect(screen.getByText('Use the API keys page.')).toBeTruthy();
    });

    expect(screen.getByRole('link', { name: 'Install guide' }).getAttribute('href')).toBe(
      '/library/content-1',
    );
    expect(screen.getByText('Click Settings, then API keys.')).toBeTruthy();
    expect(screen.getByTestId('response-rating')).toBeTruthy();
  });
});
