import * as Sentry from '@sentry/nextjs';
import { initBotId } from 'botid/client/core';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  debug: false,
});

// Define paths that need bot protection
initBotId({
  protect: [
    // Public endpoints (highest priority - spam risk)
    {
      path: '/api/contact',
      method: 'POST',
    },
    // AI/Chat endpoints (resource-intensive - AI credits, processing cost)
    {
      path: '/api/chat',
      method: 'POST',
    },
    {
      path: '/api/chat/stream',
      method: 'POST',
    },
    // Recording operations (file uploads, storage cost)
    {
      path: '/api/recordings',
      method: 'POST',
    },
    {
      path: '/api/recordings/*/finalize',
      method: 'POST',
    },
  ],
});
