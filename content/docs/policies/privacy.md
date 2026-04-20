---
title: 'Privacy'
description: 'What Tribora captures, what it does not capture, how data is encrypted, and how role-based access controls limit exposure.'
audience: public
section: policies
order: 10
tags: [privacy, data, encryption, access-control]
related: ['policies/security', 'reference/data-model', 'reference/limits-and-quotas']
---

## What Tribora captures

When you start a recording session, Tribora captures:

- **Screen video** — a video stream of the captured tab or screen at the time of recording.
- **Audio** — if microphone recording is enabled, your narration audio is captured. Tab audio is captured when screen-sharing APIs provide it.
- **Tab metadata** — the URL and page title of the active tab at the time of capture. This metadata is used to annotate the recording and the generated knowledge article.

Tribora does not capture:

- **Browser history** outside the active recording session.
- **Passwords or form fields marked as password inputs** — Chrome's screen-share API masks password fields in the video stream by default.
- **Data from tabs not selected for recording** in tab-capture mode.
- **Keystrokes** — the extension does not implement keyboard logging.
- **Clipboard contents** unless they appear visibly on the recorded screen.

You are responsible for ensuring that you do not record content you are not authorized to capture (e.g., screens containing another person's personal data or confidential information).

## Data storage and encryption

All recording files and derived artifacts (transcripts, knowledge articles) are stored on Cloudflare R2 object storage.

- **In transit:** All data transferred between the browser extension, the Tribora API, and storage is encrypted using TLS 1.3.
- **At rest:** Recording files and derived artifacts are encrypted at rest using AES-256 (managed by Cloudflare R2's server-side encryption).
- **Isolation:** Data is isolated by organization. No cross-org data access is possible through the product or API.

## Role-based access control

Access to recordings and wiki content is governed by the organization's role model. See [Data model — User and role](/docs/reference/data-model#user-and-role) for the complete role table.

Key access rules:
- A recording set to **private** visibility is accessible only to the capturing user and org admins.
- Published wiki articles are accessible to all members of the organization with a `reader` role or higher.
- Link-shared recordings are accessible to anyone with the link for the link's validity window (7 days by default).

Org admins can view, retitle, and delete any recording within the organization. System administrators (Tribora staff) can access metadata for support and incident-response purposes but do not access recording content except under documented incident procedures.

## Sub-processors

Tribora uses the following sub-processors that may process your recording data:

| Sub-processor | Purpose |
|---|---|
| Cloudflare R2 | Object storage for recording files and assets |
| Google (Gemini) | AI transcription and structuring pipeline |
| Supabase (PostgreSQL) | Metadata database |

Sub-processor data handling is governed by each provider's data processing agreements. Tribora enters DPAs with sub-processors on request.

## Data residency

Recording data and metadata are currently processed and stored in US data centers. EU data residency is not available on current plans. If your organization has data residency requirements, contact your account manager.

## Retention and deletion

See [Limits and quotas](/docs/reference/limits-and-quotas) for the full retention schedule. To request deletion of specific recordings or all data for your organization, submit a request to `privacy@tribora.com`.
