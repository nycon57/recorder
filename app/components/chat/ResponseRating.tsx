'use client';

import { useState, useCallback } from 'react';
import { Star, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ResponseRatingProps {
  /** Unique identifier for this response (e.g. conversationId + message index) */
  responseId: string;
  /** The user query that produced this response */
  query: string;
  /** First ~200 chars of the assistant response for context */
  responseSnippet: string;
  className?: string;
}

/**
 * ResponseRating - 1-5 star rating for RAG assistant responses.
 *
 * Stores feedback via POST /api/agent-feedback with feedback_type 'rating'.
 * Duplicate ratings by the same user on the same responseId are updated in place.
 */
export function ResponseRating({
  responseId,
  query,
  responseSnippet,
  className,
}: ResponseRatingProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredStar, setHoveredStar] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const submitRating = useCallback(
    async (score: number, userComment?: string) => {
      setIsSaving(true);
      try {
        const res = await fetch('/api/agent-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feedback_type: 'rating',
            score,
            comment: userComment || undefined,
            metadata: {
              responseId,
              query,
              responseSnippet: responseSnippet.slice(0, 200),
            },
          }),
        });

        if (!res.ok) {
          console.error('Failed to submit rating');
          return;
        }

        setSaved(true);
      } catch (err) {
        console.error('Rating submission error:', err);
      } finally {
        setIsSaving(false);
      }
    },
    [responseId, query, responseSnippet]
  );

  const handleStarClick = useCallback(
    (star: number) => {
      setRating(star);
      setShowComment(true);
      // Submit immediately; user can add comment after
      submitRating(star);
    },
    [submitRating]
  );

  const handleCommentSubmit = useCallback(() => {
    if (!comment.trim() || !rating) return;
    setSaved(false);
    submitRating(rating, comment.trim());
  }, [comment, rating, submitRating]);

  if (saved && !showComment) {
    return (
      <div className={cn('flex items-center gap-1 text-xs text-muted-foreground', className)}>
        <span>Rated {rating}/5</span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => handleStarClick(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            disabled={isSaving}
            className="rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            aria-label={`Rate ${star} out of 5 stars`}
          >
            <Star
              aria-hidden="true"
              className={cn(
                'h-3.5 w-3.5 transition-colors',
                star <= (hoveredStar || rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground/40'
              )}
            />
          </button>
        ))}
        {isSaving && (
          <Loader2 aria-hidden="true" className="ml-1 h-3 w-3 animate-spin text-muted-foreground" />
        )}
        {saved && !showComment && (
          <span className="ml-1 text-xs text-muted-foreground">Saved</span>
        )}
      </div>

      {showComment && rating > 0 && (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCommentSubmit();
              }
            }}
            placeholder="Add a comment (optional)"
            className="flex-1 rounded border border-border/50 bg-muted/30 px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus-visible:border-accent focus-visible:outline-none"
            aria-label="Rating comment"
          />
          {comment.trim() && (
            <button
              type="button"
              onClick={handleCommentSubmit}
              disabled={isSaving}
              className="rounded px-2 py-1 text-xs font-medium text-accent hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            >
              Send
            </button>
          )}
        </div>
      )}
    </div>
  );
}
