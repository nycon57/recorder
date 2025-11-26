'use client';

import React from 'react';
import {
  Calendar,
  X,
  Hash,
  ExternalLink,
  AlertCircle,
  Loader2,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

import { Button } from '@/app/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/app/components/ui/sheet';
import { Badge } from '@/app/components/ui/badge';
import { Separator } from '@/app/components/ui/separator';
import { ScrollArea } from '@/app/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/app/components/ui/alert';
import { ConceptBadge, ConceptTypeLabel } from './ConceptBadge';
import {
  type Concept,
  type RelatedConcept,
  type ConceptMention,
} from '@/lib/validations/knowledge';

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

/**
 * ConceptPanel - Slide-over panel for displaying concept details
 *
 * Displays comprehensive information about a concept including:
 * - Basic info (name, type, description)
 * - Statistics (mention count, first/last seen)
 * - Related concepts
 * - Recent mentions with links to content
 *
 * @param conceptId - ID of concept to display (null = closed)
 * @param onClose - Close handler
 * @param onConceptClick - Navigate to another concept (optional)
 */
export function ConceptPanel({
  conceptId,
  onClose,
  onConceptClick,
}: ConceptPanelProps) {
  const [data, setData] = React.useState<ConceptData | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch concept data when conceptId changes
  React.useEffect(() => {
    if (!conceptId) {
      setData(null);
      setError(null);
      return;
    }

    const fetchConcept = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/knowledge/concepts/${conceptId}`);

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? 'Concept not found'
              : 'Failed to load concept'
          );
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching concept:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load concept details'
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchConcept();
  }, [conceptId]);

  const handleConceptClick = (id: string) => {
    if (onConceptClick) {
      onConceptClick(id);
    }
  };

  const formatDate = (dateString: string): string => {
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

  return (
    <Sheet open={!!conceptId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            {isLoading ? 'Loading...' : data?.concept.name || 'Concept Details'}
          </SheetTitle>
          <SheetDescription>
            View concept information and relationships
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] pr-4 mt-6">
          <div className="space-y-6">
            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Loading concept details...
                </p>
              </div>
            )}

            {/* Error State */}
            {error && !isLoading && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Content */}
            {data && !isLoading && !error && (
              <>
                {/* Basic Info */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Type
                    </p>
                    <ConceptTypeLabel type={data.concept.conceptType} size="md" />
                  </div>

                  {data.concept.description && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Description
                      </p>
                      <p className="text-sm">{data.concept.description}</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Statistics */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Statistics</h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Mentions</p>
                      <div className="flex items-center gap-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <span className="text-lg font-semibold">
                          {data.concept.mentionCount}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">First Seen</p>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">
                          {formatDate(data.concept.firstSeenAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Last Seen</p>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {formatDate(data.concept.lastSeenAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Related Concepts */}
                {data.relatedConcepts.length > 0 && (
                  <>
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold">
                        Related Concepts ({data.relatedConcepts.length})
                      </h3>

                      <div className="space-y-2">
                        {data.relatedConcepts.map((related) => (
                          <div
                            key={related.id}
                            className="flex items-center justify-between gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                          >
                            <ConceptBadge
                              name={related.name}
                              type={related.conceptType}
                              size="sm"
                              onClick={
                                onConceptClick
                                  ? () => handleConceptClick(related.id)
                                  : undefined
                              }
                            />
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {related.relationshipType}
                              </Badge>
                              <span className="font-mono">
                                {(related.strength * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />
                  </>
                )}

                {/* Recent Mentions */}
                {data.recentMentions.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold">
                      Recent Mentions ({data.recentMentions.length})
                    </h3>

                    <div className="space-y-3">
                      {data.recentMentions.map((mention) => (
                        <div
                          key={mention.id}
                          className="p-3 rounded-md border bg-card hover:bg-accent/50 transition-colors space-y-2"
                        >
                          {/* Content Link */}
                          {mention.content && (
                            <div className="flex items-start justify-between gap-2">
                              <Link
                                href={`/library/${mention.contentId}`}
                                className="flex-1 min-w-0 group"
                              >
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                                    {mention.content.title}
                                  </p>
                                  <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                                <Badge
                                  variant="outline"
                                  className="mt-1 text-xs capitalize"
                                >
                                  {mention.content.contentType.replace('_', ' ')}
                                </Badge>
                              </Link>
                            </div>
                          )}

                          {/* Context */}
                          {mention.context && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {mention.context}
                            </p>
                          )}

                          {/* Metadata */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {mention.timestampSec !== null && (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{formatTimestamp(mention.timestampSec)}</span>
                              </div>
                            )}
                            <span>
                              {(mention.confidence * 100).toFixed(0)}% confidence
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Mentions */}
                {data.recentMentions.length === 0 && (
                  <div className="text-center py-6">
                    <Hash className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No mentions found
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
