---
title: Debug tools
description: Extension-context inspector and extension-sessions browser. When to use each and how to interpret the output.
audience: system-admin
section: system-admin
order: 40
related:
  - system-admin/feature-flags
  - security/log-access
tags:
  - runbook
  - debug
  - extension
---

## Overview

The debug section under `/admin/debug/` provides two tools for inspecting the state of the browser extension without needing direct access to the end-user's machine. Both tools are system-admin-only and leave no audit trail in the user-facing activity log — they are read-only inspection surfaces.

## Extension-context inspector — `/admin/debug/extension-context`

This tool lets you query the active extension context for a specific user or session ID. It returns:

- The extension version installed on the user's browser
- The current content script injection state (injected / not injected / error)
- Active tab URL (domain only, not full path) at the time of the last heartbeat
- Feature flags as evaluated by the extension at last sync
- Auth session status from the extension's perspective

### When to use it

- A user reports the extension is not recording despite being installed. Use this tool to verify whether the extension is active and whether the auth session token is valid.
- A user reports their feature flag is not enabled despite being targeted. Compare the flags shown here against the PostHog flag configuration to identify stale cache.
- Support escalation: "extension installed, shows green, but recordings never appear." Check the injection state — if it shows `error`, the content script failed to mount, which is a version compatibility issue.

### Reading the output

| Field | Healthy value | Action if unhealthy |
|---|---|---|
| Extension version | Current release (check release notes) | User needs to update or re-install |
| Auth session | `active` + non-expired `expiresAt` | User needs to re-authenticate |
| Injection state | `injected` | If `error`, check browser console for CSP violations |
| Feature flags | Matches PostHog config | If stale, user can force-refresh by signing out and back in |

## Extension sessions browser — `/admin/debug/extension-sessions`

This tool shows a paginated list of extension sessions. Each session represents one browser-tab lifecycle where the extension was active and connected to the API. Sessions include:

- Session ID
- User and org identifiers
- Start time and last-activity timestamp
- Recording state at session end (was a recording active?)
- Any errors logged during the session

### Session detail — `/admin/debug/extension-sessions/[sessionId]`

Click any session row to open the detail view. This shows the full event timeline for that session:

1. Extension mounted
2. Auth token validated
3. Recording start/stop events with timestamps
4. Any API errors encountered (with status codes)
5. Extension unmounted or tab closed

### When to use it

- A recording is missing from `/library` but the user says they recorded. Find the session by time range and user, and check whether the recording-start event fired. If it did not, the content script did not trigger; if it fired but the recording never appears, the upload job failed.
- A user reports their session keeps being terminated. Filter sessions by user ID, look at the duration — very short sessions (< 30 s) followed by `auth_failed` indicate a token refresh issue.

### Searching sessions

```
/admin/debug/extension-sessions?userId=<user-id>&from=2026-04-01&to=2026-04-20
```

All query parameters are optional. Default view shows the 50 most recent sessions across all users.

## Security note

These tools display session metadata including user and org identifiers. Access is restricted to system admins. Do not share screenshots of session data externally — they contain personally identifiable information (user IDs, org names, timestamps).

## Related

- [Feature flags](feature-flags) — checking and updating flag targeting
- [Log access and audit](../security/log-access) — accessing Pino JSON logs and Sentry for deeper session traces
