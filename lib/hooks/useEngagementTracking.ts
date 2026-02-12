'use client';

import { useRef, useCallback, useEffect } from 'react';

/**
 * Tracks engagement signals for onboarding content and reports them
 * to the engagement API. Signals include:
 * - Time spent viewing content (tracked per contentId via page visibility)
 * - Search queries issued by the onboarding user
 * - Chat questions asked via ContentChatWidget
 *
 * All reporting is best-effort (fire-and-forget, errors logged to console).
 */

const FLUSH_INTERVAL_MS = 30_000; // Flush accumulated view time every 30s
const MIN_DURATION_SEC = 2; // Ignore views shorter than 2 seconds

function sendEngagement(body: Record<string, unknown>): void {
  fetch('/api/onboarding/engagement', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch((err) => {
    console.warn('[engagement] Failed to report:', err);
  });
}

export function useContentViewTracking(contentId: string | null): void {
  const startRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);

  const flush = useCallback(() => {
    if (!contentId) return;

    let duration = accumulatedRef.current;
    if (startRef.current !== null) {
      duration += (Date.now() - startRef.current) / 1000;
      startRef.current = Date.now();
    }
    accumulatedRef.current = 0;

    if (duration < MIN_DURATION_SEC) return;

    sendEngagement({
      contentView: {
        contentId,
        viewedAt: new Date().toISOString(),
        durationSec: Math.round(duration),
      },
    });
  }, [contentId]);

  useEffect(() => {
    if (!contentId) return;

    startRef.current = Date.now();
    accumulatedRef.current = 0;

    const interval = setInterval(flush, FLUSH_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.hidden) {
        // Page hidden: accumulate and pause
        if (startRef.current !== null) {
          accumulatedRef.current += (Date.now() - startRef.current) / 1000;
          startRef.current = null;
        }
      } else {
        // Page visible: resume
        startRef.current = Date.now();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      // Flush remaining on unmount
      if (startRef.current !== null) {
        accumulatedRef.current += (Date.now() - startRef.current) / 1000;
        startRef.current = null;
      }
      if (accumulatedRef.current >= MIN_DURATION_SEC && contentId) {
        sendEngagement({
          contentView: {
            contentId,
            viewedAt: new Date().toISOString(),
            durationSec: Math.round(accumulatedRef.current),
          },
        });
      }
    };
  }, [contentId, flush]);
}

/** Report a search query as an engagement signal. */
export function trackSearchQuery(query: string): void {
  const trimmed = query.trim();
  if (!trimmed) return;
  sendEngagement({ searchQuery: trimmed });
}

/** Report a chat question as an engagement signal. */
export function trackChatQuestion(question: string): void {
  const trimmed = question.trim();
  if (!trimmed) return;
  sendEngagement({ chatQuestion: trimmed });
}
