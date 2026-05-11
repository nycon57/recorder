'use client';

import { useReducer, useCallback } from 'react';
import { Star, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

interface ResponseRatingProps {
  responseId: string;
  query: string;
  responseSnippet: string;
  className?: string;
}

export function ResponseRating({
  responseId,
  query,
  responseSnippet,
  className,
}: ResponseRatingProps) {
  const [state, dispatch] = useReducer(
    (
      current: {
        rating: number;
        hoveredStar: number;
        comment: string;
        showComment: boolean;
        isSaving: boolean;
      },
      patch: Partial<{
        rating: number;
        hoveredStar: number;
        comment: string;
        showComment: boolean;
        isSaving: boolean;
      }>,
    ) => ({ ...current, ...patch }),
    {
      rating: 0,
      hoveredStar: 0,
      comment: '',
      showComment: false,
      isSaving: false,
    },
  );
  const { rating, hoveredStar, comment, showComment, isSaving } = state;

  const submitRating = useCallback(
    async (score: number, userComment?: string): Promise<boolean> => {
      dispatch({ isSaving: true });
      try {
        const res = await fetch('/api/agent-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            feedback_type: 'rating',
            score,
            comment: userComment,
            metadata: {
              responseId,
              query,
              responseSnippet: responseSnippet.slice(0, 200),
            },
          }),
        });

        if (res.ok) {
          return true;
        }
        return false;
      } catch (err) {
        console.error('Rating submission error:', err);
        return false;
      } finally {
        dispatch({ isSaving: false });
      }
    },
    [responseId, query, responseSnippet],
  );

  const handleStarClick = useCallback((star: number) => {
    dispatch({ rating: star, showComment: true });
  }, []);

  const handleCommentSubmit = useCallback(async () => {
    if (!rating) return;
    const success = await submitRating(rating, comment.trim() || undefined);
    if (success) {
      dispatch({ showComment: false });
    }
  }, [comment, rating, submitRating]);

  if (rating > 0 && !showComment && !isSaving) {
    return (
      <div
        className={cn(
          'flex items-center gap-1 text-xs text-muted-foreground',
          className,
        )}
      >
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
            onMouseEnter={() => dispatch({ hoveredStar: star })}
            onMouseLeave={() => dispatch({ hoveredStar: 0 })}
            disabled={isSaving}
            className="rounded p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            aria-label={`Rate ${star} out of 5 stars`}
          >
            <Star
              aria-hidden="true"
              className={cn(
                'size-3.5 transition-colors',
                star <= (hoveredStar || rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground/40',
              )}
            />
          </button>
        ))}
        {isSaving && (
          <Loader2
            aria-hidden="true"
            className="ml-1 size-3 animate-spin text-muted-foreground"
          />
        )}
      </div>

      {showComment && rating > 0 && (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={comment}
            onChange={(e) => dispatch({ comment: e.target.value })}
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
          <button
            type="button"
            onClick={handleCommentSubmit}
            disabled={isSaving}
            className="rounded px-2 py-1 text-xs font-medium text-accent hover:text-accent/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
          >
            {comment.trim() ? 'Send' : 'Submit'}
          </button>
        </div>
      )}
    </div>
  );
}
