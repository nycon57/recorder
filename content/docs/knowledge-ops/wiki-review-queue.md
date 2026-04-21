---
title: Wiki review queue
description: How to triage AI-suggested wiki updates, approve or reject suggestions, and configure reviewer rotations.
audience: org-admin
section: knowledge-ops
order: 10
related:
  - knowledge-ops/contradictions
  - knowledge-ops/knowledge-gaps
tags:
  - knowledge
  - wiki
  - review
---

## Overview

When Tribora detects that a recording contains information that differs from or extends the current wiki, it queues a suggested update for human review. The review queue at `/admin/wiki-review` is where your team approves, rejects, or defers these suggestions before they are incorporated into the knowledge base.

Suggestions are not applied automatically. Every change to the canonical wiki requires a human decision.

## Reading a suggestion

Each queue item shows:

- **Affected page** — the wiki page the suggestion would modify
- **Change type** — new section, updated paragraph, or contradiction resolution
- **Source recording** — the recording that triggered the suggestion, with a timestamp link
- **AI confidence** — a 0–100 score. Scores above 80 indicate high-confidence matches; below 50 indicate uncertain context.
- **Diff view** — the proposed before/after change, highlighted

## Approving a suggestion

Click **Approve** to accept the change. The wiki page updates immediately and the recording is marked as contributing to that page. The change is logged in the audit trail with your name and timestamp.

For high-volume queues, use the **Bulk approve** checkbox to select multiple high-confidence items and approve them together. Limit bulk approvals to items where AI confidence is above 75 — review lower-confidence items individually.

## Rejecting a suggestion

Click **Reject** and select a reason:

- **Incorrect** — the AI misinterpreted the recording
- **Duplicate** — the wiki already covers this accurately
- **Out of scope** — the content belongs in a different context
- **Policy** — the content should not be in the wiki (e.g., confidential)

Rejected suggestions are archived and do not reappear. The rejection reason is visible to other reviewers in the audit log.

## Deferring a suggestion

Click **Defer** to move the item to the bottom of the queue and revisit later. Deferred items surface again after 7 days. Use defer when you need more context from the recording owner before deciding.

## Configuring reviewer rotations

Reviewer assignments are per-department. To set up a rotation:

1. Go to **Settings → Departments** and select the department whose recordings feed this queue.
2. Under **Wiki reviewers**, add the team members who should receive review assignments.
3. Set the **rotation cadence**: round-robin (default) or by-seniority.

Each reviewer receives email notifications when items are assigned to them. Notification preferences are managed per-user under **Settings → Notifications**.

## Related

- [Resolving contradictions](contradictions) — what to do when two recordings disagree
- [Acting on knowledge gaps](knowledge-gaps) — the complementary signal for missing knowledge
