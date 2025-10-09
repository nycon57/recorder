'use client';

/**
 * AI Assistant Page
 *
 * RAG-powered chat interface with streaming responses and source citations.
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, FileText, Video, Clock, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
}

interface Source {
  recordingId: string;
  recordingTitle: string;
  chunkText: string;
  similarity: number;
  timestamp?: number;
  source: 'transcript' | 'document';
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Use streaming API
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Chat request failed');
      }

      // Create assistant message placeholder
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        isStreaming: true,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Read stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response stream');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'sources') {
              // Update assistant message with sources
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessage.id
                    ? { ...msg, sources: data.sources }
                    : msg
                )
              );
            } else if (data.type === 'token') {
              // Append token to assistant message
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: msg.content + data.token }
                    : msg
                )
              );
            } else if (data.type === 'done') {
              // Mark streaming as complete
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessage.id
                    ? { ...msg, isStreaming: false }
                    : msg
                )
              );
              setConversationId(data.conversationId);
            } else if (data.type === 'error') {
              console.error('Stream error:', data.error);
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessage.id
                    ? {
                        ...msg,
                        content: 'Sorry, an error occurred. Please try again.',
                        isStreaming: false,
                      }
                    : msg
                )
              );
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      alert('Failed to send message. Please try again.');
      // Remove the placeholder message
      setMessages((prev) => prev.filter((msg) => msg.id !== (Date.now() + 1).toString()));
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">AI Assistant</h1>
        <p className="text-muted-foreground">
          Ask questions about your recordings and get AI-powered answers
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Bot className="w-16 h-16 mx-auto mb-4 text-muted" />
            <p className="text-lg font-medium">Ask me anything</p>
            <p className="text-sm mt-2">
              I can help you find information across all your recordings
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-primary" />
              </div>
            )}

            <div
              className={`max-w-3xl rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {/* Message Content */}
              <div className="whitespace-pre-wrap">{message.content}</div>

              {/* Streaming Indicator */}
              {message.isStreaming && (
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking...
                </div>
              )}

              {/* Sources */}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border">
                  <div className="text-sm font-medium text-foreground mb-2">
                    Sources:
                  </div>
                  <div className="space-y-2">
                    {message.sources.map((source, index) => (
                      <Link
                        key={index}
                        href={`/recordings/${source.recordingId}${
                          source.timestamp ? `?t=${Math.floor(source.timestamp)}` : ''
                        }`}
                        className="block text-sm bg-card rounded p-2 hover:bg-accent border border-border"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="font-medium text-primary hover:underline">
                              [{index + 1}] {source.recordingTitle}
                            </div>
                            <div className="text-muted-foreground text-xs mt-1 line-clamp-2">
                              {source.chunkText}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-xs text-muted-foreground">
                            {source.timestamp !== undefined && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(source.timestamp)}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              {source.source === 'transcript' ? (
                                <><Video className="w-3 h-3" /> Transcript</>
                              ) : (
                                <><FileText className="w-3 h-3" /> Document</>
                              )}
                            </span>
                            <span className="text-success font-medium">
                              {Math.round(source.similarity * 100)}%
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-border pt-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your recordings..."
            disabled={isLoading}
            className="flex-1 px-4 py-3 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
