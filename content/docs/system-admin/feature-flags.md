---
title: Feature flags
description: Managing feature flags, rollouts by org or user, kill-switches, and the flag audit log.
audience: system-admin
section: system-admin
order: 10
related:
  - system-admin/global-quotas
  - system-admin/debug-tools
tags:
  - runbook
  - feature-flags
  - rollout
---

## Overview

Tribora uses PostHog feature flags for progressive rollouts and kill-switches. Flags are evaluated server-side in API routes and worker handlers, and client-side in React components via the PostHog JS SDK. This runbook covers how to create, enable, target, and disable flags.

## Flag management in PostHog

Navigate to [app.posthog.com](https://app.posthog.com) → Feature Flags. All flags are scoped to the Tribora project.

### Creating a flag

1. Click **New feature flag**.
2. Set a **Key** using `snake_case` (e.g., `wiki_v2_enabled`). This key is the string used in code.
3. Set **Release conditions**:
   - **100% of users** — fully enabled for all sessions.
   - **Percentage rollout** — gradual rollout; increase incrementally.
   - **Property filter** — target by `org_id`, `user_id`, or any custom property sent with `identify()`.
4. Save and enable.

### Targeting a specific org

In the flag's release conditions, add a filter:

- Property: `organizationId`
- Operator: `is`
- Value: `<org-id>` (UUID from the `organizations` table)

This enables the flag for all users in that org regardless of the global rollout percentage.

### Targeting a specific user

Add a filter on `distinct_id` (which equals the Better Auth `user.id`):

- Property: `$distinct_id`
- Operator: `is`
- Value: `<user-id>`

## Kill-switch pattern

All major features should have a flag keyed `<feature>_enabled` that defaults to `true`. To kill a feature:

1. Open the flag in PostHog.
2. Set rollout to **0%** (do not delete the flag — that may cause code errors if `isFeatureEnabled` returns `undefined` instead of a boolean).
3. Click **Save**.

The change propagates to all server-side evaluations within 30 seconds (PostHog SDK polls for updates). Client-side evaluations update on the next page navigation.

## Flag audit log

PostHog records every flag change with the actor's identity and a timestamp. To audit flag history:

1. Open the flag in PostHog.
2. Click **History** (top-right tab).
3. Each entry shows: actor email, change type (created/updated/deleted), and the previous vs. new value.

For security incidents where a flag change may have exposed a feature prematurely, export the history and attach it to the incident report.

## Server-side evaluation pattern

```typescript
import { posthog } from '@/lib/posthog/server';

const isEnabled = await posthog.isFeatureEnabled('wiki_v2_enabled', userId, {
  personProperties: { organizationId: orgId },
});

if (!isEnabled) {
  return Response.json({ error: 'Feature not available' }, { status: 403 });
}
```

## Client-side evaluation pattern

```typescript
'use client';
import { useFeatureFlagEnabled } from 'posthog-js/react';

export function WikiV2Banner() {
  const enabled = useFeatureFlagEnabled('wiki_v2_enabled');
  if (!enabled) return null;
  return <Banner />;
}
```

## Related

- [Global quotas](global-quotas) — complementary mechanism for controlling tenant resource consumption
- [Debug tools](debug-tools) — extension-context inspector for verifying flag propagation to the browser extension
