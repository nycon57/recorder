/**
 * query-client.ts — SSE streaming client for the Tribora query API.
 *
 * POSTs to /api/extension/query with an API key and reads the SSE
 * response stream, emitting typed events to registered callbacks.
 */

import type { PageContext } from './context';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TextChunkEvent {
  type: 'text_chunk';
  text: string;
}

export interface ElementRefEvent {
  type: 'element_ref';
  selector: string;
  label: string;
  action: 'highlight' | 'point' | 'pulse';
}

export interface CitationEvent {
  type: 'citation';
  sourceId: string;
  title: string;
  recordingUrl?: string;
}

export interface DoneEvent {
  type: 'done';
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type QueryEvent =
  | TextChunkEvent
  | ElementRefEvent
  | CitationEvent
  | DoneEvent
  | ErrorEvent;

export interface QueryCallbacks {
  onTextChunk?: (text: string) => void;
  onElementRef?: (event: ElementRefEvent) => void;
  onCitation?: (event: CitationEvent) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

export interface QueryClientOptions {
  apiKey: string;
  apiUrl: string;
}

// ─── SDK Init Response ──────────────────────────────────────────────────────

export interface SdkInitResponse {
  branding: {
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    product_name?: string;
    support_email?: string;
  };
  voiceConfig: {
    elevenlabs_voice_id?: string;
    stability?: number;
    similarity_boost?: number;
  };
  knowledgeScope: string[] | null;
}

// ─── Client ─────────────────────────────────────────────────────────────────

export class QueryClient {
  private apiKey: string;
  private apiUrl: string;
  private abortController: AbortController | null = null;

  constructor(options: QueryClientOptions) {
    this.apiKey = options.apiKey;
    this.apiUrl = options.apiUrl;
  }

  /**
   * Fetch SDK initialization data (branding, voice config) from the backend.
   */
  async fetchInitConfig(): Promise<SdkInitResponse> {
    const response = await fetch(`${this.apiUrl}/api/sdk/init`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(`SDK init failed (${response.status}): ${text}`);
    }

    return response.json() as Promise<SdkInitResponse>;
  }

  /**
   * Submit a question to the query API and stream the response via SSE.
   * Returns a cleanup function that aborts the stream.
   */
  query(
    question: string,
    context: PageContext,
    callbacks: QueryCallbacks,
  ): () => void {
    // Abort any in-flight request
    this.abort();

    const controller = new AbortController();
    this.abortController = controller;

    const body = JSON.stringify({
      question,
      context: {
        ...context,
        appSignature: `${context.app}:${context.screen}`,
      },
    });

    fetch(`${this.apiUrl}/api/extension/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body,
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          response
            .text()
            .then((text) => {
              callbacks.onError?.(
                `Query failed (${response.status}): ${text}`,
              );
            })
            .catch(() => {
              callbacks.onError?.(`Query failed (${response.status})`);
            });
          return;
        }

        if (!response.body) {
          callbacks.onError?.('No response body');
          return;
        }

        this.readSSEStream(response.body, callbacks, controller.signal);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        callbacks.onError?.(err.message);
      });

    return () => this.abort();
  }

  /**
   * Abort any in-flight query.
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // ── SSE Stream Reader ──────────────────────────────────────────────────

  private async readSSEStream(
    body: ReadableStream<Uint8Array>,
    callbacks: QueryCallbacks,
    signal: AbortSignal,
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by double newlines
        const parts = buffer.split('\n\n');
        // Keep the last incomplete part in the buffer
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          this.parseSSEEvent(part, callbacks);
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        this.parseSSEEvent(buffer, callbacks);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        callbacks.onError?.((err as Error).message);
      }
    } finally {
      reader.releaseLock();
    }
  }

  private parseSSEEvent(raw: string, callbacks: QueryCallbacks): void {
    // Extract the data line(s) from the SSE event
    const lines = raw.split('\n');
    let data = '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        data += line.slice(6);
      } else if (line.startsWith('data:')) {
        data += line.slice(5);
      }
    }

    if (!data) return;

    let event: QueryEvent;
    try {
      event = JSON.parse(data) as QueryEvent;
    } catch {
      // Not valid JSON — ignore
      return;
    }

    switch (event.type) {
      case 'text_chunk':
        callbacks.onTextChunk?.(event.text);
        break;
      case 'element_ref':
        callbacks.onElementRef?.(event as ElementRefEvent);
        break;
      case 'citation':
        callbacks.onCitation?.(event as CitationEvent);
        break;
      case 'done':
        callbacks.onDone?.();
        break;
      case 'error':
        callbacks.onError?.((event as ErrorEvent).message);
        break;
    }
  }
}
