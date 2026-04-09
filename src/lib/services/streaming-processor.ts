/**
 * Server-Sent Events (SSE) Streaming Processor
 *
 * Manages SSE connections for real-time progress updates during job processing.
 * Supports multiple event types and handles connection lifecycle.
 */

import { createLogger } from '@/lib/utils/logger';

const logger = createLogger({ service: 'streaming-processor' });

export type StreamEventType =
  | 'progress'
  | 'log'
  | 'transcript_chunk'
  | 'document_chunk'
  | 'error'
  | 'complete'
  | 'heartbeat';

export type ProcessingStep = 'transcribe' | 'document' | 'embeddings' | 'all';

export interface StreamEvent {
  type: StreamEventType;
  step?: ProcessingStep;
  progress?: number; // 0-100
  message: string;
  data?: any;
  timestamp: string;
}

export interface StreamConnection {
  recordingId: string;
  controller: ReadableStreamDefaultController;
  connected: boolean;
  lastHeartbeat: number;
}

/**
 * Global connection manager for SSE streams
 * Maps recordingId -> StreamConnection
 */
class StreamingManager {
  private connections: Map<string, StreamConnection> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 15000; // 15 seconds

  constructor() {
    this.startHeartbeat();
  }

  /**
   * Register a new SSE connection
   */
  register(recordingId: string, controller: ReadableStreamDefaultController): void {
    logger.info('Registering SSE connection', {
      context: { recordingId },
    });

    // Close existing connection if any
    if (this.connections.has(recordingId)) {
      logger.warn('Connection already exists, closing previous connection', {
        context: { recordingId },
      });
      this.disconnect(recordingId);
    }

    this.connections.set(recordingId, {
      recordingId,
      controller,
      connected: true,
      lastHeartbeat: Date.now(),
    });

    // Send initial connection event
    this.sendEvent(recordingId, {
      type: 'log',
      message: 'Connected to reprocessing stream',
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Disconnect and clean up a connection
   */
  disconnect(recordingId: string): void {
    const connection = this.connections.get(recordingId);
    if (!connection) {
      return;
    }

    logger.info('Disconnecting SSE connection', {
      context: { recordingId },
    });

    try {
      connection.controller.close();
    } catch (error) {
      logger.debug('Error closing controller (may already be closed)', {
        context: { recordingId },
        error: error as Error,
      });
    }

    connection.connected = false;
    this.connections.delete(recordingId);
  }

  /**
   * Send event to a specific recording's stream
   */
  sendEvent(recordingId: string, event: StreamEvent): boolean {
    const connection = this.connections.get(recordingId);
    if (!connection || !connection.connected) {
      logger.debug('No active connection for recording', {
        context: { recordingId },
      });
      return false;
    }

    try {
      // Format as SSE
      const sseData = `data: ${JSON.stringify(event)}\n\n`;
      connection.controller.enqueue(new TextEncoder().encode(sseData));

      logger.debug('Sent SSE event', {
        context: { recordingId, eventType: event.type },
        data: event,
      });

      return true;
    } catch (error) {
      logger.error('Error sending SSE event', {
        context: { recordingId },
        error: error as Error,
      });

      // Disconnect on error
      this.disconnect(recordingId);
      return false;
    }
  }

  /**
   * Send progress update
   */
  sendProgress(
    recordingId: string,
    step: ProcessingStep,
    progress: number,
    message: string,
    data?: any
  ): boolean {
    return this.sendEvent(recordingId, {
      type: 'progress',
      step,
      progress: Math.min(100, Math.max(0, progress)), // Clamp 0-100
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send log message
   */
  sendLog(recordingId: string, message: string, data?: any): boolean {
    return this.sendEvent(recordingId, {
      type: 'log',
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send transcript chunk
   */
  sendTranscriptChunk(recordingId: string, chunk: string, data?: any): boolean {
    return this.sendEvent(recordingId, {
      type: 'transcript_chunk',
      message: chunk,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send document chunk
   */
  sendDocumentChunk(recordingId: string, chunk: string, data?: any): boolean {
    return this.sendEvent(recordingId, {
      type: 'document_chunk',
      message: chunk,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send error event
   */
  sendError(recordingId: string, error: string, data?: any): boolean {
    return this.sendEvent(recordingId, {
      type: 'error',
      message: error,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Send completion event
   */
  sendComplete(recordingId: string, message: string, data?: any): boolean {
    const sent = this.sendEvent(recordingId, {
      type: 'complete',
      message,
      data,
      timestamp: new Date().toISOString(),
    });

    // Disconnect immediately after sending completion event
    // Client is responsible for closing EventSource to prevent reconnection
    this.disconnect(recordingId);

    return sent;
  }

  /**
   * Check if a connection exists and is active
   */
  isConnected(recordingId: string): boolean {
    const connection = this.connections.get(recordingId);
    return connection !== undefined && connection.connected;
  }

  /**
   * Get active connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Start heartbeat interval to keep connections alive
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      // Use Array.from to avoid iterator issues
      const entries = Array.from(this.connections.entries());
      for (const [recordingId, connection] of entries) {
        if (!connection.connected) {
          this.connections.delete(recordingId);
          continue;
        }

        // Send heartbeat
        try {
          connection.controller.enqueue(
            new TextEncoder().encode(': heartbeat\n\n')
          );
          connection.lastHeartbeat = now;
        } catch (error) {
          logger.warn('Heartbeat failed, disconnecting', {
            context: { recordingId },
            error: error as Error,
          });
          this.disconnect(recordingId);
        }
      }

      logger.debug('Heartbeat sent', {
        data: { activeConnections: this.connections.size },
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Stop heartbeat interval
   */
  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Clean up all connections
   */
  cleanup(): void {
    logger.info('Cleaning up all SSE connections', {
      data: { count: this.connections.size },
    });

    // Use Array.from to avoid iterator issues
    const recordingIds = Array.from(this.connections.keys());
    for (const recordingId of recordingIds) {
      this.disconnect(recordingId);
    }

    this.stopHeartbeat();
  }
}

/**
 * Global singleton instance
 */
export const streamingManager = new StreamingManager();

/**
 * Create a new SSE ReadableStream
 */
export function createSSEStream(recordingId: string): ReadableStream {
  return new ReadableStream({
    start(controller) {
      // Register connection
      streamingManager.register(recordingId, controller);
    },
    cancel() {
      // Client disconnected
      logger.info('Client disconnected SSE stream', {
        context: { recordingId },
      });
      streamingManager.disconnect(recordingId);
    },
  });
}

/**
 * Helper to create SSE Response
 */
export function createSSEResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
