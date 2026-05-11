'use client';

import { type Dispatch, useEffect, useReducer } from 'react';
import * as motion from 'motion/react-client';
import { AnimatePresence } from 'motion/react';
import {
  Bot,
  User,
  ExternalLink,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Send,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';

/**
 * AssistantDemo - Matches the real AssistantChat UI
 *
 * Bespoke component for the /features/assistant page.
 * Mirrors the actual product interface with:
 * - Message list with user/assistant messages
 * - Sources section with collapsible trigger and relevance scores
 * - Markdown-rendered responses
 * - Example prompts in empty state
 */

interface Source {
  id: string;
  title: string;
  snippet: string;
  timestamp?: string;
  relevanceScore: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  createdAt: Date;
}

const DEMO_CONVERSATION: Message[] = [
  {
    id: '1',
    role: 'user',
    content: "What were the key decisions from last week's product meeting?",
    createdAt: new Date(Date.now() - 60000),
  },
  {
    id: '2',
    role: 'assistant',
    content: `Based on your recordings, here are the key decisions from last week's product meeting:

**Priority Features for Q1:**
- User authentication improvements (SSO integration)
- Dashboard performance optimization
- Mobile responsive redesign

**Action Items:**
1. Sarah to finalize the SSO provider selection by Friday
2. Dev team to create performance benchmarks
3. Design team to deliver mobile mockups by end of sprint

The meeting also discussed pushing the analytics feature to Q2 due to resource constraints.`,
    sources: [
      {
        id: 's1',
        title: 'Product Planning Meeting - Jan 22',
        snippet:
          '"...we agreed to prioritize SSO integration as the top auth improvement..."',
        timestamp: '12:34',
        relevanceScore: 0.94,
      },
      {
        id: 's2',
        title: 'Weekly Standup Recording',
        snippet:
          '"Sarah mentioned she\'ll have the provider comparison ready by Friday..."',
        timestamp: '3:15',
        relevanceScore: 0.87,
      },
      {
        id: 's3',
        title: 'Engineering Sync - Sprint 14',
        snippet:
          '"Dashboard is running slow on large datasets, we need to benchmark..."',
        timestamp: '8:42',
        relevanceScore: 0.79,
      },
    ],
    createdAt: new Date(Date.now() - 30000),
  },
];

const EXAMPLE_PROMPTS = [
  'What did we discuss about the project timeline?',
  'Summarize the key points from my last meeting',
  'Find mentions of the budget',
  'What are the action items from recent recordings?',
];

const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};

type AssistantDemoState = {
  visibleMessages: number;
  isTyping: boolean;
  sourcesExpanded: boolean;
  copied: boolean;
  inputValue: string;
};

type AssistantDemoAction =
  | { type: 'patch'; patch: Partial<AssistantDemoState> }
  | { type: 'toggle-sources' };

const initialAssistantDemoState: AssistantDemoState = {
  visibleMessages: 0,
  isTyping: false,
  sourcesExpanded: false,
  copied: false,
  inputValue: '',
};

function assistantDemoReducer(
  state: AssistantDemoState,
  action: AssistantDemoAction,
): AssistantDemoState {
  if (action.type === 'toggle-sources') {
    return { ...state, sourcesExpanded: !state.sourcesExpanded };
  }

  return { ...state, ...action.patch };
}

function scheduleAssistantDemo(dispatch: Dispatch<AssistantDemoAction>) {
  const timer1 = setTimeout(() => {
    dispatch({ type: 'patch', patch: { visibleMessages: 1 } });
  }, 500);

  const timer2 = setTimeout(() => {
    dispatch({ type: 'patch', patch: { isTyping: true } });
  }, 1500);

  const timer3 = setTimeout(() => {
    dispatch({
      type: 'patch',
      patch: { isTyping: false, visibleMessages: 2 },
    });
  }, 4000);

  const timer4 = setTimeout(() => {
    dispatch({ type: 'patch', patch: { sourcesExpanded: true } });
  }, 5000);

  return () => {
    clearTimeout(timer1);
    clearTimeout(timer2);
    clearTimeout(timer3);
    clearTimeout(timer4);
  };
}

export function AssistantDemo() {
  return useAssistantDemoImplementation();
}

function useAssistantDemoImplementation() {
  const [state, dispatch] = useReducer(
    assistantDemoReducer,
    initialAssistantDemoState,
  );
  const { visibleMessages, isTyping, sourcesExpanded, copied, inputValue } =
    state;

  // Animate messages appearing
  useEffect(() => {
    return scheduleAssistantDemo(dispatch);
  }, []);

  const handleCopy = () => {
    dispatch({ type: 'patch', patch: { copied: true } });
    setTimeout(
      () => dispatch({ type: 'patch', patch: { copied: false } }),
      2000,
    );
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <section className="relative py-16 sm:py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-[40%] left-[50%] -translate-x-1/2 -translate-y-1/2
            w-[800px] h-[600px] rounded-full
            bg-[radial-gradient(ellipse_at_center,rgba(0,223,130,0.08)_0%,transparent_60%)]
            blur-[100px]"
        />
      </div>

      <div className="container px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={springTransition}
            className="text-center mb-12"
          >
            <div
              className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full
                bg-accent/10 border border-accent/30"
            >
              <Bot className="size-4 text-accent" />
              <span className="text-sm font-medium text-accent">
                AI Assistant
              </span>
            </div>
            <h3 className="font-outfit text-2xl sm:text-3xl font-light mb-2">
              Ask <span className=" text-primary">anything</span>
            </h3>
            <p className="text-muted-foreground">
              Get answers with citations from your recordings
            </p>
          </motion.div>

          {/* Chat Interface - Matches AssistantChat */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ ...springTransition, delay: 0.2 }}
            className={cn(
              'relative rounded-3xl overflow-hidden flex flex-col',
              'bg-gradient-to-b from-card/80 to-card/60',
              'backdrop-blur-xl',
              'border border-accent/20',
              'shadow-[0_0_80px_rgba(0,223,130,0.15)]',
              'min-h-[600px]',
            )}
          >
            {/* Header */}
            <div className="flex-shrink-0 border-b px-6 py-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <h2 className="text-xl font-normal">AI Assistant</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Ask questions about your recordings with AI-powered search and
                reasoning
              </p>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <AnimatePresence>
                {DEMO_CONVERSATION.slice(0, visibleMessages).map(
                  (message, index) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...springTransition, delay: index * 0.1 }}
                      className={cn(
                        'flex gap-3',
                        message.role === 'user' && 'flex-row-reverse',
                      )}
                    >
                      {/* Avatar */}
                      {message.role === 'assistant' && (
                        <div className="flex-shrink-0 size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Bot className="size-5 text-primary" />
                        </div>
                      )}

                      {/* Message Content */}
                      <div
                        className={cn(
                          'space-y-3',
                          message.role === 'assistant' && 'flex-1',
                        )}
                      >
                        {/* Sources (for assistant messages) */}
                        {message.role === 'assistant' &&
                          message.sources &&
                          message.sources.length > 0 && (
                            <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
                              <button
                                onClick={() =>
                                  dispatch({ type: 'toggle-sources' })
                                }
                                className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/5 transition-colors"
                              >
                                <div className="flex items-center gap-2 text-sm">
                                  <ExternalLink className="size-4 text-primary" />
                                  <span className="font-medium">
                                    {message.sources.length} sources
                                  </span>
                                </div>
                                {sourcesExpanded ? (
                                  <ChevronUp className="size-4 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="size-4 text-muted-foreground" />
                                )}
                              </button>

                              <AnimatePresence>
                                {sourcesExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-border"
                                  >
                                    <div className="p-3 space-y-2">
                                      {message.sources.map((source) => (
                                        <div
                                          key={source.id}
                                          className="rounded-lg border border-border bg-background p-3 hover:bg-accent/5 transition-colors cursor-pointer"
                                        >
                                          <div className="flex items-start gap-3">
                                            <ExternalLink className="size-4 mt-0.5 shrink-0 text-primary" />
                                            <div className="flex-1 min-w-0">
                                              <div className="flex items-center gap-2 mb-1">
                                                <span className="font-medium text-sm truncate">
                                                  {source.title}
                                                </span>
                                                {source.timestamp && (
                                                  <span className="flex items-center gap-1 text-xs text-accent shrink-0">
                                                    <Clock className="size-3" />
                                                    {source.timestamp}
                                                  </span>
                                                )}
                                              </div>
                                              <p className="text-xs text-muted-foreground line-clamp-2">
                                                {source.snippet}
                                              </p>
                                              <Badge
                                                variant="secondary"
                                                className="mt-2 text-xs"
                                              >
                                                Relevance:{' '}
                                                {Math.round(
                                                  source.relevanceScore * 100,
                                                )}
                                                %
                                              </Badge>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                        {/* Message Bubble */}
                        <div
                          className={cn(
                            'relative rounded-2xl px-4 py-3',
                            message.role === 'user'
                              ? 'bg-primary text-primary-foreground ml-auto max-w-[80%]'
                              : 'bg-card/80 border border-border',
                          )}
                        >
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            {message.content.split('\n').map((line, i) => (
                              <p
                                key={JSON.stringify(line)}
                                className="mb-2 last:mb-0"
                              >
                                {line.startsWith('**') ? (
                                  <strong>{line.replace(/\*\*/g, '')}</strong>
                                ) : line.startsWith('- ') ? (
                                  <span className="block pl-4">
                                    • {line.slice(2)}
                                  </span>
                                ) : line.match(/^\d\./) ? (
                                  <span className="block pl-4">{line}</span>
                                ) : (
                                  line
                                )}
                              </p>
                            ))}
                          </div>
                        </div>

                        {/* Timestamp and Actions */}
                        <div
                          className={cn(
                            'flex items-center gap-2 px-1',
                            message.role === 'user' && 'justify-end',
                          )}
                        >
                          <span className="text-xs text-muted-foreground opacity-60">
                            {formatTimestamp(message.createdAt)}
                          </span>
                          {message.role === 'assistant' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6"
                              onClick={handleCopy}
                            >
                              {copied ? (
                                <Check className="size-3 text-green-500" />
                              ) : (
                                <Copy className="size-3 text-muted-foreground" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* User Avatar */}
                      {message.role === 'user' && (
                        <div className="flex-shrink-0 size-8 rounded-lg bg-muted flex items-center justify-center">
                          <User className="size-5 text-muted-foreground" />
                        </div>
                      )}
                    </motion.div>
                  ),
                )}

                {/* Typing Indicator */}
                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-3"
                  >
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Bot className="size-5 text-primary" />
                    </div>
                    <div className="rounded-2xl px-4 py-3 bg-card/80 border border-border">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-muted-foreground mr-2">
                          Searching and thinking
                        </span>
                        {[
                          { id: 'search-dot-1', delay: 0 },
                          { id: 'search-dot-2', delay: 0.15 },
                          { id: 'search-dot-3', delay: 0.3 },
                        ].map((dot) => (
                          <motion.div
                            key={dot.id}
                            className="size-2 rounded-full bg-accent"
                            animate={{ y: [0, -6, 0] }}
                            transition={{
                              repeat: Infinity,
                              duration: 0.6,
                              delay: dot.delay,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty State - Example Prompts */}
              {visibleMessages === 0 && !isTyping && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Sparkles className="size-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">Ask me anything</h3>
                  <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
                    I can search your recordings and answer questions with
                    sources and reasoning
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {EXAMPLE_PROMPTS.map((prompt, i) => (
                      <button
                        key={JSON.stringify(prompt)}
                        className="px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent/10 hover:border-accent/30 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="flex-shrink-0 border-t p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) =>
                      dispatch({
                        type: 'patch',
                        patch: { inputValue: e.target.value },
                      })
                    }
                    placeholder="Ask a question about your recordings..."
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-colors"
                  />
                </div>
                <Button
                  size="lg"
                  className="size-12 rounded-xl bg-gradient-to-r from-accent to-secondary p-0"
                >
                  <Send className="size-5" />
                </Button>
              </div>
            </div>
          </motion.div>

          {/* Caption */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
            className="text-center text-sm text-muted-foreground mt-6"
          >
            Every answer backed by sources · Jump to exact moments
          </motion.p>
        </div>
      </div>
    </section>
  );
}
