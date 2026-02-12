'use client';

import { useContentViewTracking } from '@/lib/hooks/useEngagementTracking';

/**
 * Invisible component that tracks time spent viewing a content item
 * for onboarding engagement. Renders no UI.
 */
export function OnboardingViewTracker({ contentId }: { contentId: string }) {
  useContentViewTracking(contentId);
  return null;
}
