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

import { ConversationProvider } from './store/ConversationContext';
import { AssistantChat } from './components/AssistantChat';

export default function AssistantPage() {
  return (
    <ConversationProvider>
      <div className="trbd-page h-[calc(100dvh-7.5rem)] !gap-0 !pb-0">
        <div className="trbd-page-header border-b border-border pb-4">
          <div className="trbd-page-heading">
            <h1 className="trbd-page-title">AI Assistant</h1>
            <p className="trbd-page-description">
              Ask questions about your recordings with AI-powered search and
              reasoning
            </p>
          </div>
        </div>

        <AssistantChat
          className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card/60"
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
