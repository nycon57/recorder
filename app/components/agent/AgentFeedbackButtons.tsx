'use client';

import { useState, useCallback } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentFeedbackButtonsProps {
  activityLogId: string;
  onFeedback?: (feedbackType: 'thumbs_up' | 'thumbs_down') => void;
}

export function AgentFeedbackButtons({
  activityLogId,
  onFeedback,
}: AgentFeedbackButtonsProps) {
  const [selected, setSelected] = useState<'thumbs_up' | 'thumbs_down' | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  const isDisabled = !activityLogId || submitting;

  const handleFeedback = useCallback(
    async (feedbackType: 'thumbs_up' | 'thumbs_down') => {
      if (isDisabled || selected === feedbackType) return;

      setSubmitting(true);
      try {
        const res = await fetch('/api/agent-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_activity_log_id: activityLogId,
            feedback_type: feedbackType,
          }),
        });

        if (res.ok) {
          setSelected(feedbackType);
          onFeedback?.(feedbackType);
        }
      } catch {
        // Silently fail — feedback is non-critical
      } finally {
        setSubmitting(false);
      }
    },
    [activityLogId, isDisabled, selected, onFeedback]
  );

  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => handleFeedback('thumbs_up')}
        disabled={isDisabled}
        aria-label="Thumbs up"
        aria-pressed={selected === 'thumbs_up'}
        className={cn(
          'inline-flex items-center justify-center rounded p-1 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:pointer-events-none disabled:opacity-40',
          selected === 'thumbs_up'
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        <ThumbsUp
          className="size-3.5"
          fill={selected === 'thumbs_up' ? 'currentColor' : 'none'}
        />
      </button>
      <button
        type="button"
        onClick={() => handleFeedback('thumbs_down')}
        disabled={isDisabled}
        aria-label="Thumbs down"
        aria-pressed={selected === 'thumbs_down'}
        className={cn(
          'inline-flex items-center justify-center rounded p-1 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:pointer-events-none disabled:opacity-40',
          selected === 'thumbs_down'
            ? 'text-red-600 dark:text-red-400'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        )}
      >
        <ThumbsDown
          className="size-3.5"
          fill={selected === 'thumbs_down' ? 'currentColor' : 'none'}
        />
      </button>
    </span>
  );
}
