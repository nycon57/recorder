'use client';

/**
 * AI Assistant Page - State of the Art
 *
 * Complete RAG-powered chat interface with:
 * - Advanced multi-modal input (files, speech-to-text)
 * - Full RAG transparency (tool calls, reasoning, sources)
 * - Conversation management
 * - Message actions
 * - Beautiful animations
 * - Mobile-responsive design
 */

import React from 'react';
import { ConversationProvider } from './store/ConversationContext';
import { AssistantChat } from './components/AssistantChat';

export default function AssistantPage() {
  return (
    <ConversationProvider>
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="border-b px-6 py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <h1 className="text-2xl font-bold">AI Assistant</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ask questions about your recordings with AI-powered search and reasoning
          </p>
        </div>

        {/* Chat Interface */}
        <AssistantChat
          apiEndpoint="/api/chat"
          showAdvancedFeatures={true}
          examplePrompts={[
            'What did we discuss about the project timeline?',
            'Summarize the key points from my last meeting',
            'Find mentions of the budget',
            'What are the action items from recent recordings?',
          ]}
        />
      </div>
    </ConversationProvider>
  );
}
