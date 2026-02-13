'use client';

import { useState, useCallback } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type ThumbsFeedback = 'thumbs_up' | 'thumbs_down';

interface AgentFeedbackButtonsProps {
  activityLogId: string;
  onFeedback?: (feedbackType: ThumbsFeedback) => void;
}

const buttonBaseClasses = [
  'inline-flex items-center justify-center rounded p-1.5 transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
  'disabled:pointer-events-none disabled:opacity-40',
] as const;

const feedbackButtons = [
  {
    type: 'thumbs_up' as const,
    Icon: ThumbsUp,
    label: 'Thumbs up',
    activeColor: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    type: 'thumbs_down' as const,
    Icon: ThumbsDown,
    label: 'Thumbs down',
    activeColor: 'text-red-600 dark:text-red-400',
  },
] as const;

export function AgentFeedbackButtons({
  activityLogId,
  onFeedback,
}: AgentFeedbackButtonsProps) {
  const [selected, setSelected] = useState<ThumbsFeedback | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isDisabled = !activityLogId || submitting;

  const handleFeedback = useCallback(
    async (feedbackType: ThumbsFeedback) => {
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
        // Silently fail -- feedback is non-critical
      } finally {
        setSubmitting(false);
      }
    },
    [activityLogId, isDisabled, selected, onFeedback]
  );

  return (
    <span className="inline-flex items-center gap-0.5">
      {feedbackButtons.map(({ type, Icon, label, activeColor }) => {
        const isSelected = selected === type;
        return (
          <button
            key={type}
            type="button"
            onClick={() => handleFeedback(type)}
            disabled={isDisabled}
            aria-label={label}
            aria-pressed={isSelected}
            className={cn(
              buttonBaseClasses,
              isSelected
                ? activeColor
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            )}
          >
            <Icon
              aria-hidden="true"
              className="size-3.5"
              fill={isSelected ? 'currentColor' : 'none'}
            />
          </button>
        );
      })}
    </span>
  );
}
