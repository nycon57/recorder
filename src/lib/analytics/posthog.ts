import { PostHog } from 'posthog-node';

let _posthog: PostHog | null = null;

function getPostHog(): PostHog | null {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (!_posthog) {
    _posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return _posthog;
}

export function trackEvent(distinctId: string, event: string, properties?: Record<string, unknown>) {
  getPostHog()?.capture({ distinctId, event, properties });
}

export function identifyUser(distinctId: string, properties?: Record<string, unknown>) {
  getPostHog()?.identify({ distinctId, properties });
}

export async function shutdownPostHog() {
  await _posthog?.shutdown();
}
