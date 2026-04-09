'use client';

import React from 'react';
import {
  Calendar,
  ExternalLink,
  AlertCircle,
  Loader2,
  Clock,
  TrendingUp,
  Link2,
  FileText,
  Sparkles,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

import { Button } from '@/app/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/app/components/ui/sheet';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { cn } from '@/lib/utils/cn';
import {
  type Concept,
  type RelatedConcept,
  type ConceptMention,
  type ConceptType,
  CONCEPT_TYPE_COLORS,
} from '@/lib/validations/knowledge';

// Edge relationship colors - MUST match KnowledgeGraph.tsx getEdgeColor()
const EDGE_TYPE_COLORS: Record<string, string> = {
  prerequisite: '#ef4444',  // red-500
  requires: '#ef4444',
  'co-occurs': '#22c55e',   // green-500
  often_used_with: '#22c55e',
  uses: '#3b82f6',          // blue-500
  implements: '#3b82f6',
  created_by: '#f97316',    // orange-500
  works_on: '#f97316',
  employs: '#f97316',
  provides: '#8b5cf6',      // violet-500
  related: '#6366f1',       // indigo-500
  related_to: '#6366f1',
};

function getEdgeColor(type: string): string {
  return EDGE_TYPE_COLORS[type] || EDGE_TYPE_COLORS.related;
}

interface ConceptPanelProps {
  conceptId: string | null;
  onClose: () => void;
  onConceptClick?: (conceptId: string) => void;
}

interface ConceptData {
  concept: Concept;
  relatedConcepts: RelatedConcept[];
  recentMentions: ConceptMention[];
}

// Type-based color schemes with gradients
// IMPORTANT: These colors must match CONCEPT_TYPE_COLORS in lib/validations/knowledge.ts
// tool: blue, process: green, person: orange, organization: slate, technical_term: purple, general: yellow
const typeStyles: Record<ConceptType, {
  gradient: string;
  bg: string;
  border: string;
  icon: string;
  glow: string;
}> = {
  tool: {
    gradient: 'from-blue-500 to-blue-600',      // blue-500 (#3b82f6)
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: 'text-blue-400',
    glow: 'shadow-blue-500/20',
  },
  process: {
    gradient: 'from-green-500 to-emerald-600',  // green-500 (#22c55e)
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    icon: 'text-green-400',
    glow: 'shadow-green-500/20',
  },
  person: {
    gradient: 'from-orange-500 to-amber-600',   // orange-500 (#f97316)
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    icon: 'text-orange-400',
    glow: 'shadow-orange-500/20',
  },
  organization: {
    gradient: 'from-slate-500 to-slate-600',    // slate-500 (#64748b)
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    icon: 'text-slate-400',
    glow: 'shadow-slate-500/20',
  },
  technical_term: {
    gradient: 'from-purple-500 to-violet-600',  // purple-500 (#a855f7)
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    icon: 'text-purple-400',
    glow: 'shadow-purple-500/20',
  },
  general: {
    gradient: 'from-yellow-500 to-amber-500',   // yellow-500 (#eab308)
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: 'text-yellow-400',
    glow: 'shadow-yellow-500/20',
  },
};

const typeLabels: Record<ConceptType, string> = {
  tool: 'Tool',
  process: 'Process',
  person: 'Person',
  organization: 'Organization',
  technical_term: 'Technical Term',
  general: 'General',
};

const typeIcons: Record<ConceptType, string> = {
  tool: '🔧',
  process: '⚡',
  person: '👤',
  organization: '🏢',
  technical_term: '📚',
  general: '💡',
};

/**
 * ConceptPanel - Elegant slide-over panel for concept details
 *
 * Design: "Knowledge Observatory" - refined, editorial aesthetic
 * with sophisticated data visualization and elegant typography
 */
export function ConceptPanel({
  conceptId,
  onClose,
  onConceptClick,
}: ConceptPanelProps) {
  const [data, setData] = React.useState<ConceptData | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Ref for scrolling to mentions section
  const mentionsSectionRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!conceptId) {
      setData(null);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const fetchConcept = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/knowledge/concepts/${conceptId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? 'Concept not found'
              : 'Failed to load concept'
          );
        }

        const result = await response.json();
        setData(result.data);
        setIsLoading(false);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Error fetching concept:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load concept details'
        );
        setIsLoading(false);
      }
    };

    fetchConcept();

    return () => {
      controller.abort();
    };
  }, [conceptId]);

  const handleConceptClick = (id: string) => {
    if (onConceptClick) {
      onConceptClick(id);
    }
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Unknown';
    try {
      const date = new Date(dateString);
      return !isNaN(date.getTime()) ? format(date, 'MMM d, yyyy') : 'Unknown';
    } catch {
      return 'Unknown';
    }
  };

  const formatTimestamp = (seconds: number | null): string => {
    if (seconds === null) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Scroll to mentions section when mentions count is clicked
  const scrollToMentions = () => {
    mentionsSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  // Build the URL for a mention with proper highlighting/timestamp params
  const getMentionUrl = (mention: ConceptMention): string => {
    const baseUrl = `/library/${mention.contentId}`;
    const params = new URLSearchParams();

    // For video/audio content with timestamp
    if (
      mention.timestampSec !== null &&
      mention.content?.contentType &&
      ['recording', 'video', 'audio'].includes(mention.content.contentType)
    ) {
      params.set('t', String(Math.floor(mention.timestampSec)));
    }

    // For documents with chunk ID for highlighting
    if (mention.chunkId && mention.content?.contentType === 'document') {
      params.set('highlight', mention.chunkId);
    }

    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  };

  const conceptType = data?.concept.conceptType || 'general';
  const style = typeStyles[conceptType];

  return (
    <Sheet open={!!conceptId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-xl border-l border-white/5 bg-gradient-to-b from-background via-background to-background/95 p-0 overflow-hidden">
        {/* Visually hidden title for screen readers */}
        <VisuallyHidden.Root asChild>
          <SheetTitle>
            {data?.concept?.name ? `Concept: ${data.concept.name}` : 'Concept Details'}
          </SheetTitle>
        </VisuallyHidden.Root>
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center h-full"
            >
              <div className="relative">
                <div className="absolute inset-0 blur-xl bg-primary/20 rounded-full" />
                <Loader2 className="h-10 w-10 animate-spin text-primary relative" />
              </div>
              <p className="mt-6 text-sm text-muted-foreground tracking-wide">
                Loading concept...
              </p>
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-6"
            >
              <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="flex flex-col gap-4">
                  <span>{error}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setError(null);
                      if (conceptId) {
                        setIsLoading(true);
                        fetch(`/api/knowledge/concepts/${conceptId}`)
                          .then(res => res.json())
                          .then(result => {
                            setData(result.data);
                            setIsLoading(false);
                          })
                          .catch(err => {
                            setError(err.message);
                            setIsLoading(false);
                          });
                      }
                    }}
                  >
                    Try Again
                  </Button>
                </AlertDescription>
              </Alert>
            </motion.div>
          ) : data ? (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              {/* Hero Header */}
              <div className={cn(
                "relative px-6 pt-8 pb-6",
                "bg-gradient-to-br from-black/40 via-transparent to-transparent"
              )}>
                {/* Decorative gradient orb */}
                <div className={cn(
                  "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-30",
                  `bg-gradient-to-br ${style.gradient}`
                )} />

                {/* Type badge */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className={cn(
                    "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium tracking-wide",
                    "bg-gradient-to-r shadow-lg",
                    style.gradient,
                    style.glow
                  )}
                >
                  <span>{typeIcons[conceptType]}</span>
                  <span className="text-white">{typeLabels[conceptType]}</span>
                </motion.div>

                {/* Concept name */}
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="mt-4 text-2xl font-semibold tracking-tight text-foreground"
                >
                  {data.concept.name}
                </motion.h2>

                {/* Description */}
                {data.concept.description && (
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-2 text-sm text-muted-foreground leading-relaxed"
                  >
                    {data.concept.description}
                  </motion.p>
                )}
              </div>

              <ScrollArea className="flex-1 px-6">
                <div className="space-y-6 pb-8">
                  {/* Statistics Cards */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className={cn("h-4 w-4", style.icon)} />
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Statistics
                      </h3>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {/* Mentions - Clickable to scroll to mentions section */}
                      <button
                        onClick={scrollToMentions}
                        className={cn(
                          "relative overflow-hidden rounded-xl p-4 text-left",
                          "bg-gradient-to-br from-white/5 to-white/[0.02]",
                          "border border-white/10",
                          "transition-all duration-200 hover:border-primary/30 hover:from-primary/10 hover:to-primary/5",
                          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                          "cursor-pointer group"
                        )}
                        title="Click to view all mentions"
                      >
                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-xl group-hover:from-primary/20" />
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground mb-1">Mentions</p>
                          <ArrowRight className="h-3 w-3 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </div>
                        <p className="text-2xl font-bold tabular-nums group-hover:text-primary transition-colors">
                          {data.concept.mentionCount}
                        </p>
                      </button>

                      {/* First Seen */}
                      <div className={cn(
                        "relative overflow-hidden rounded-xl p-4",
                        "bg-gradient-to-br from-white/5 to-white/[0.02]",
                        "border border-white/10"
                      )}>
                        <p className="text-xs text-muted-foreground mb-1">First Seen</p>
                        <p className="text-sm font-medium">
                          {formatDate(data.concept.firstSeenAt)}
                        </p>
                      </div>

                      {/* Last Seen */}
                      <div className={cn(
                        "relative overflow-hidden rounded-xl p-4",
                        "bg-gradient-to-br from-white/5 to-white/[0.02]",
                        "border border-white/10"
                      )}>
                        <p className="text-xs text-muted-foreground mb-1">Last Seen</p>
                        <p className="text-sm font-medium">
                          {formatDate(data.concept.lastSeenAt)}
                        </p>
                      </div>
                    </div>
                  </motion.div>

                  {/* Related Concepts */}
                  {data.relatedConcepts.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Link2 className={cn("h-4 w-4", style.icon)} />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Related Concepts
                        </h3>
                        <span className="ml-auto text-xs text-muted-foreground/60">
                          {data.relatedConcepts.length}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {data.relatedConcepts.map((related, index) => {
                          // Use CONCEPT_TYPE_COLORS for node color (matches graph)
                          const nodeColor = CONCEPT_TYPE_COLORS[related.conceptType] || CONCEPT_TYPE_COLORS.general;
                          return (
                            <motion.button
                              key={related.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.35 + index * 0.05 }}
                              onClick={() => onConceptClick && handleConceptClick(related.id)}
                              className={cn(
                                "w-full group relative overflow-hidden rounded-lg p-3",
                                "bg-gradient-to-r from-white/5 to-transparent",
                                "border border-white/10 hover:border-white/20",
                                "transition-all duration-300",
                                "hover:shadow-lg"
                              )}
                              style={{
                                boxShadow: `0 4px 14px -3px ${nodeColor}20`,
                              }}
                            >
                              {/* Left accent - uses node type color from graph */}
                              <div
                                className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                                style={{ backgroundColor: nodeColor }}
                              />

                              <div className="flex items-center justify-between pl-2">
                                <div className="flex items-center gap-3">
                                  <span className="text-lg">{typeIcons[related.conceptType]}</span>
                                  <div className="text-left">
                                    <p className="text-sm font-medium group-hover:text-primary transition-colors">
                                      {related.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {typeLabels[related.conceptType]}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Relationship type badge - uses edge colors from graph */}
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider"
                                    style={{
                                      backgroundColor: `${getEdgeColor(related.relationshipType || 'related')}20`,
                                      color: getEdgeColor(related.relationshipType || 'related'),
                                    }}
                                  >
                                    {related.relationshipType?.replace(/_/g, ' ') || 'related'}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <div className="h-1.5 w-12 bg-white/10 rounded-full overflow-hidden">
                                      {/* Strength bar uses edge color too */}
                                      <div
                                        className="h-full rounded-full"
                                        style={{
                                          width: `${related.strength * 100}%`,
                                          backgroundColor: getEdgeColor(related.relationshipType || 'related'),
                                        }}
                                      />
                                    </div>
                                    <span className="text-[10px] text-muted-foreground tabular-nums w-8">
                                      {(related.strength * 100).toFixed(0)}%
                                    </span>
                                  </div>
                                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                </div>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}

                  {/* Recent Mentions */}
                  {data.recentMentions.length > 0 ? (
                    <motion.div
                      ref={mentionsSectionRef}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className={cn("h-4 w-4", style.icon)} />
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Found In
                        </h3>
                        <span className="ml-auto text-xs text-muted-foreground/60">
                          {data.recentMentions.length} {data.recentMentions.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {data.recentMentions.map((mention, index) => (
                          <motion.div
                            key={mention.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.45 + index * 0.05 }}
                          >
                            <Link
                              href={getMentionUrl(mention)}
                              className={cn(
                                "group block relative overflow-hidden rounded-xl",
                                "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent",
                                "border border-primary/20 hover:border-primary/40",
                                "transition-all duration-300",
                                "hover:shadow-lg hover:shadow-primary/10"
                              )}
                            >
                              {/* Content header */}
                              <div className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                        {mention.content?.title || 'Untitled Content'}
                                      </p>
                                      <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground/50 group-hover:text-primary transition-colors" />
                                    </div>

                                    {/* Content type badge */}
                                    <span className={cn(
                                      "inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider",
                                      "bg-primary/20 text-primary"
                                    )}>
                                      {mention.content?.contentType?.replace('_', ' ') || 'Content'}
                                    </span>
                                  </div>

                                  {/* Confidence indicator */}
                                  <div className="flex flex-col items-end gap-1">
                                    <div className={cn(
                                      "px-2 py-1 rounded-lg text-xs font-medium",
                                      "bg-emerald-500/20 text-emerald-400"
                                    )}>
                                      {(mention.confidence * 100).toFixed(0)}%
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">confidence</span>
                                  </div>
                                </div>

                                {/* Context quote */}
                                {mention.context && (
                                  <div className="mt-3 pl-3 border-l-2 border-primary/30">
                                    <p className="text-xs text-muted-foreground line-clamp-2 italic">
                                      "{mention.context}"
                                    </p>
                                  </div>
                                )}

                                {/* Timestamp */}
                                {mention.timestampSec !== null && (
                                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/60">
                                    <Clock className="h-3 w-3" />
                                    <span>at {formatTimestamp(mention.timestampSec)}</span>
                                  </div>
                                )}
                              </div>

                              {/* Hover gradient */}
                              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                            </Link>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 }}
                      className="text-center py-8"
                    >
                      <div className={cn(
                        "inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4",
                        "bg-gradient-to-br from-white/10 to-white/5",
                        "border border-white/10"
                      )}>
                        <Eye className="h-7 w-7 text-muted-foreground/50" />
                      </div>
                      <p className="text-sm text-muted-foreground">
                        No content mentions yet
                      </p>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        This concept will link to content as you add more recordings
                      </p>
                    </motion.div>
                  )}

                  {/* Footer sparkle */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="flex items-center justify-center gap-2 pt-4 text-xs text-muted-foreground/40"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Extracted by AI from your content</span>
                  </motion.div>
                </div>
              </ScrollArea>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </SheetContent>
    </Sheet>
  );
}
