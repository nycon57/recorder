'use client';

import { useState, useEffect } from 'react';
import * as motion from 'motion/react-client';
import { AnimatePresence } from 'framer-motion';
import {
  FileText,
  Sparkles,
  Copy,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Check,
  Loader2,
  Code,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { ScrollArea } from '@/app/components/ui/scroll-area';

/**
 * DocumentationDemo - Matches the real AIDocumentPanel UI
 *
 * Bespoke component for the /features/documentation page.
 * Mirrors the actual product interface with:
 * - Card with header (Sparkles icon, title, status badge)
 * - Collapsible content
 * - Summary section
 * - Action buttons (Copy, Markdown, HTML, Regenerate)
 * - ScrollArea with markdown content + syntax highlighting
 * - Metadata footer (model, version)
 */

const springTransition = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
};

// Mock generated document content
const MOCK_DOCUMENT = {
  summary:
    'This document outlines the step-by-step process for setting up a new Next.js project with TypeScript, Tailwind CSS, and best practices for production deployment.',
  markdown: `# Setting Up a Next.js Project

## Overview
This guide walks through creating a modern Next.js application with all the bells and whistles.

## Prerequisites
Before getting started, ensure you have:
- Node.js 18+ installed
- npm or yarn package manager
- Basic knowledge of React and TypeScript

## Step 1: Create the Project

Run the following command to scaffold a new Next.js project:

\`\`\`bash
npx create-next-app@latest my-app --typescript --tailwind --app
\`\`\`

## Step 2: Configure TypeScript

Update your \`tsconfig.json\` with strict mode settings:

\`\`\`json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}
\`\`\`

## Step 3: Add shadcn/ui Components

Install and configure the component library:

\`\`\`bash
npx shadcn@latest init
npx shadcn@latest add button card
\`\`\`

## Key Features Covered
- **App Router** - Modern routing with layouts and loading states
- **Server Components** - Better performance with server-side rendering
- **TypeScript** - Full type safety across the application
- **Tailwind CSS** - Utility-first styling approach

## Next Steps
After setup, consider adding:
1. Authentication (Clerk, NextAuth)
2. Database (Prisma, Drizzle)
3. Deployment (Vercel, Railway)`,
  model: 'GPT-4 Turbo',
  version: '1.0',
  status: 'generated',
};

// Parse markdown into visual sections for progressive reveal
interface DocSection {
  type: 'heading' | 'paragraph' | 'code' | 'list';
  level?: number;
  language?: string;
  content: string;
  items?: string[];
}

function parseMarkdownSections(markdown: string): DocSection[] {
  const lines = markdown.split('\n');
  const sections: DocSection[] = [];
  let currentSection: DocSection | null = null;
  let inCodeBlock = false;
  let codeContent = '';
  let codeLanguage = '';

  for (const line of lines) {
    // Code block handling
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        sections.push({
          type: 'code',
          language: codeLanguage,
          content: codeContent.trim(),
        });
        inCodeBlock = false;
        codeContent = '';
        codeLanguage = '';
      } else {
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim() || 'text';
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + '\n';
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      sections.push({ type: 'heading', level: 1, content: line.slice(2) });
    } else if (line.startsWith('## ')) {
      sections.push({ type: 'heading', level: 2, content: line.slice(3) });
    } else if (line.startsWith('### ')) {
      sections.push({ type: 'heading', level: 3, content: line.slice(4) });
    }
    // List items
    else if (line.startsWith('- ') || line.match(/^\d+\.\s/)) {
      const listContent = line.startsWith('- ') ? line.slice(2) : line.replace(/^\d+\.\s/, '');
      if (currentSection?.type === 'list') {
        currentSection.items?.push(listContent);
      } else {
        currentSection = { type: 'list', content: '', items: [listContent] };
        sections.push(currentSection);
      }
    }
    // Paragraphs
    else if (line.trim()) {
      sections.push({ type: 'paragraph', content: line });
      currentSection = null;
    } else {
      currentSection = null;
    }
  }

  return sections;
}

export function DocumentationDemo() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isGenerating, setIsGenerating] = useState(true);
  const [visibleSections, setVisibleSections] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [status, setStatus] = useState<'generating' | 'generated'>('generating');

  const sections = parseMarkdownSections(MOCK_DOCUMENT.markdown);

  // Progressive reveal animation
  useEffect(() => {
    // Start generating after a short delay
    const summaryTimer = setTimeout(() => {
      setShowSummary(true);
    }, 800);

    // Reveal sections progressively
    const sectionTimers: NodeJS.Timeout[] = [];
    sections.forEach((_, index) => {
      const timer = setTimeout(
        () => {
          setVisibleSections(index + 1);
        },
        1200 + index * 400
      );
      sectionTimers.push(timer);
    });

    // Mark as complete
    const completeTimer = setTimeout(
      () => {
        setIsGenerating(false);
        setStatus('generated');
      },
      1200 + sections.length * 400 + 500
    );

    return () => {
      clearTimeout(summaryTimer);
      sectionTimers.forEach(clearTimeout);
      clearTimeout(completeTimer);
    };
  }, [sections.length]);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const visibleContent = sections.slice(0, visibleSections);

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
              <FileText className="h-4 w-4 text-accent" />
              <span className="text-sm font-medium text-accent">Auto Documentation</span>
            </div>
            <h3 className="font-outfit text-2xl sm:text-3xl font-light mb-2">
              Watch docs{' '}
              <span className="bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
                generate
              </span>
            </h3>
            <p className="text-muted-foreground">
              Recording to structured documentation in seconds
            </p>
          </motion.div>

          {/* AI Document Panel - Matches real AIDocumentPanel.tsx */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ ...springTransition, delay: 0.2 }}
          >
            <Card
              className={cn(
                'overflow-hidden',
                'border-accent/20',
                'shadow-[0_0_80px_rgba(0,223,130,0.15)]'
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    <CardTitle className="text-base">AI-Generated Document</CardTitle>
                    <Badge variant={status === 'generated' ? 'default' : 'secondary'}>
                      {status === 'generating' ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          generating
                        </span>
                      ) : (
                        'generated'
                      )}
                    </Badge>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                  >
                    {isExpanded ? (
                      <ChevronUp className="size-4" />
                    ) : (
                      <ChevronDown className="size-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CardContent className="space-y-4">
                      {/* Summary */}
                      <AnimatePresence>
                        {showSummary && (
                          <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 bg-muted/50 rounded-lg border"
                          >
                            <p className="text-sm font-semibold mb-2">Summary</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {MOCK_DOCUMENT.summary}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopy}
                          title="Copy markdown"
                        >
                          {copied ? (
                            <Check className="size-4 text-green-500" />
                          ) : (
                            <Copy className="size-4" />
                          )}
                          Copy
                        </Button>
                        <Button variant="outline" size="sm" title="Download as Markdown">
                          <Download className="size-4" />
                          Markdown
                        </Button>
                        <Button variant="outline" size="sm" title="Download as HTML">
                          <FileText className="size-4" />
                          HTML
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isGenerating}
                          title="Regenerate document with AI"
                        >
                          {isGenerating ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <RefreshCw className="size-4" />
                          )}
                          Regenerate
                        </Button>
                      </div>

                      {/* Document Content */}
                      <ScrollArea className="h-[500px] rounded-md border p-6 bg-card">
                        <div className="prose prose-sm dark:prose-invert max-w-none">
                          <AnimatePresence>
                            {visibleContent.map((section, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                {section.type === 'heading' && section.level === 1 && (
                                  <h1 className="text-xl font-semibold text-foreground mb-4 mt-0">
                                    {section.content}
                                  </h1>
                                )}
                                {section.type === 'heading' && section.level === 2 && (
                                  <h2 className="text-lg font-medium text-foreground mt-6 mb-3">
                                    {section.content}
                                  </h2>
                                )}
                                {section.type === 'heading' && section.level === 3 && (
                                  <h3 className="text-base font-medium text-foreground mt-4 mb-2">
                                    {section.content}
                                  </h3>
                                )}
                                {section.type === 'paragraph' && (
                                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                                    {/* Handle bold text */}
                                    {section.content.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
                                      if (part.startsWith('**') && part.endsWith('**')) {
                                        return (
                                          <strong key={i} className="text-foreground">
                                            {part.slice(2, -2)}
                                          </strong>
                                        );
                                      }
                                      return part;
                                    })}
                                  </p>
                                )}
                                {section.type === 'list' && section.items && (
                                  <ul className="space-y-1.5 mb-4 list-none pl-0">
                                    {section.items.map((item, i) => (
                                      <li
                                        key={i}
                                        className="flex items-start gap-2 text-sm text-muted-foreground"
                                      >
                                        <span className="shrink-0 mt-2 w-1.5 h-1.5 rounded-full bg-accent" />
                                        {/* Handle bold text in list items */}
                                        {item.split(/(\*\*[^*]+\*\*)/).map((part, j) => {
                                          if (part.startsWith('**') && part.endsWith('**')) {
                                            return (
                                              <strong key={j} className="text-foreground">
                                                {part.slice(2, -2)}
                                              </strong>
                                            );
                                          }
                                          return part;
                                        })}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                {section.type === 'code' && (
                                  <div className="relative rounded-lg overflow-hidden mb-4 bg-background border border-border/50">
                                    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-muted/30">
                                      <Code className="h-3.5 w-3.5 text-muted-foreground" />
                                      <span className="text-xs text-muted-foreground font-mono">
                                        {section.language}
                                      </span>
                                    </div>
                                    <pre className="p-4 text-sm font-mono overflow-x-auto">
                                      <code className="text-accent">{section.content}</code>
                                    </pre>
                                  </div>
                                )}
                              </motion.div>
                            ))}
                          </AnimatePresence>

                          {/* Typing cursor while generating */}
                          {isGenerating && (
                            <motion.span
                              animate={{ opacity: [1, 0, 1] }}
                              transition={{ repeat: Infinity, duration: 0.5 }}
                              className="inline-block w-2 h-4 bg-accent"
                            />
                          )}
                        </div>
                      </ScrollArea>

                      {/* Metadata */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                        <span>Model: {MOCK_DOCUMENT.model}</span>
                        <span>Version: {MOCK_DOCUMENT.version}</span>
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </motion.div>

          {/* Caption */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.8 }}
            className="text-center text-sm text-muted-foreground mt-6"
          >
            Edit inline · Export to Notion, Google Docs, or PDF
          </motion.p>
        </div>
      </div>
    </section>
  );
}
