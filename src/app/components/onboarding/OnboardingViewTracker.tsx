'use client';

import { useContentViewTracking } from '@/lib/hooks/useEngagementTracking';

interface Props {
  contentId: string;
}

export function OnboardingViewTracker({ contentId }: Props): null {
  useContentViewTracking(contentId);
  return null;
}
