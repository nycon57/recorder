/**
 * Mock Streaming Processor
 * Placeholder for the actual streaming processor that will be implemented by another agent
 */

export interface StreamChunk {
  id: string;
  type: 'text' | 'progress' | 'complete' | 'error';
  content: string;
  metadata?: Record<string, any>;
}

export class MockStreamingProcessor {
  private chunks: StreamChunk[] = [];

  async emit(chunk: StreamChunk): Promise<void> {
    this.chunks.push(chunk);
    // In real implementation, this would send to SSE/WebSocket
    console.log(`[Stream] ${chunk.type}: ${chunk.content.substring(0, 100)}...`);
  }

  async emitProgress(message: string, progress: number): Promise<void> {
    await this.emit({
      id: Date.now().toString(),
      type: 'progress',
      content: message,
      metadata: { progress }
    });
  }

  async emitText(text: string): Promise<void> {
    await this.emit({
      id: Date.now().toString(),
      type: 'text',
      content: text
    });
  }

  async emitComplete(message: string): Promise<void> {
    await this.emit({
      id: Date.now().toString(),
      type: 'complete',
      content: message
    });
  }

  async emitError(error: Error | string): Promise<void> {
    await this.emit({
      id: Date.now().toString(),
      type: 'error',
      content: typeof error === 'string' ? error : error.message
    });
  }

  getChunks(): StreamChunk[] {
    return this.chunks;
  }
}

export const createStreamingProcessor = () => new MockStreamingProcessor();