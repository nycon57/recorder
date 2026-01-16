import { initBotId } from 'botid/client/core';

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
