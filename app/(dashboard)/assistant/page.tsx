'use client';

/**
 * AI Assistant Page
 *
 * RAG-powered chat interface with streaming responses using Vercel AI SDK.
 * Supports sources and reasoning display.
 */

import { useRef, useEffect, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Send, Bot, User, FileText, Loader2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

export default function AssistantPage() {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  const {
    messages,
    sendMessage,
    status,
    error,
  } = useChat({
    api: '/api/chat',
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 h-[calc(100vh-8rem)] flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">AI Assistant</h1>
        <p className="text-muted-foreground">
          Ask questions about your recordings and get AI-powered answers with sources
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          <strong>Error:</strong> {error.message}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Bot className="w-16 h-16 mx-auto mb-4 text-muted" />
            <p className="text-lg font-medium">Ask me anything</p>
            <p className="text-sm mt-2">
              I can search your recordings and answer questions about them
            </p>
            <div className="mt-6 space-y-2 text-left max-w-md mx-auto">
              <p className="text-xs font-medium">Try asking:</p>
              <div className="space-y-1 text-xs">
                <div className="p-2 bg-muted rounded">💡 "What did we discuss about the project timeline?"</div>
                <div className="p-2 bg-muted rounded">📊 "Summarize the key points from my last meeting"</div>
                <div className="p-2 bg-muted rounded">🔍 "Find mentions of the budget"</div>
              </div>
            </div>
          </div>
        )}

        {messages.map((message) => {
          // Parse message parts if content is an array
          const textParts = message.parts?.filter(part => part.type === 'text') || [];
          const reasoningParts = message.parts?.filter(part => part.type === 'reasoning') || [];
          const sourceParts = message.parts?.filter(part => part.type === 'source-url') || [];

          // Fallback to content if no parts
          const displayContent = textParts.length > 0
            ? textParts.map(p => p.text).join('\n')
            : (message as any).content || '';

          return (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
              )}

              <div className="max-w-3xl space-y-2">
                {/* Sources (show first if available) */}
                {sourceParts.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3 border border-border">
                    <div className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      {sourceParts.length} {sourceParts.length === 1 ? 'Source' : 'Sources'}
                    </div>
                    <div className="space-y-1">
                      {sourceParts.map((source, idx) => (
                        <Link
                          key={idx}
                          href={source.url || '#'}
                          className="block text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {source.title || source.url}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reasoning (if available) */}
                {reasoningParts.length > 0 && (
                  <details className="bg-accent/30 rounded-lg p-3 border border-border">
                    <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                      💭 View reasoning
                    </summary>
                    <div className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                      {reasoningParts.map(p => p.text).join('\n')}
                    </div>
                  </details>
                )}

                {/* Main Message */}
                <div
                  className={`rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{displayContent}</ReactMarkdown>
                  </div>
                </div>
              </div>

              {message.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {(status === 'streaming' || status === 'submitted') && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5 text-primary" />
            </div>
            <div className="max-w-3xl rounded-lg px-4 py-3 bg-muted text-foreground">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Thinking...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim() || status === 'streaming' || status === 'submitted') {
            return;
          }
          sendMessage({ text: input });
          setInput('');
        }}
        className="border-t border-border pt-4"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your recordings..."
            disabled={status === 'streaming' || status === 'submitted'}
            className="flex-1 px-4 py-3 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent disabled:opacity-50"
            autoFocus
          />
          <button
            type="submit"
            disabled={status === 'streaming' || status === 'submitted' || !input.trim()}
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {status === 'streaming' || status === 'submitted' ? (
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
