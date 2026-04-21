---
title: Quotas and usage
description: Reading storage, recording, and AI-call quotas for your organization. Understanding hard vs. soft caps and how to request increases.
audience: org-admin
section: org-admin
order: 50
related:
  - org-admin/billing
  - observability/storage-and-cost
tags:
  - org-admin
  - quotas
  - storage
---

## Understanding your quotas

Your plan includes three resource dimensions, each with a monthly ceiling:

| Dimension | What it measures | Unit |
|---|---|---|
| Recording duration | Total minutes captured across all recordings | Seconds (displayed as hours/minutes) |
| Storage | Total bytes stored in your knowledge base | Bytes (displayed as GB) |
| AI tokens | LLM inference tokens consumed by enrichment, assistant, and wiki compilation | Tokens |

Usage counters reset on the first day of each billing cycle.

## Viewing current usage — `/settings/quotas`

The Quotas page shows:

- **Used / Limit** — raw numbers for each dimension
- **Progress bar** — color-coded: green (< 80%), amber (80–95%), red (> 95%)
- **Estimated days until limit** — based on current monthly usage rate
- **Top consumers** — the 5 members or recordings consuming the most of each dimension

## Hard caps and what happens at the limit

All three dimensions are **hard caps** by default. When your org reaches 100% of a quota:

- **Recording duration:** New recording sessions are blocked. Existing recordings and the knowledge base remain fully accessible.
- **Storage:** New uploads and recording ingestion are blocked. Existing content is unaffected.
- **AI tokens:** AI enrichment and wiki compilation jobs are queued but not executed until the next billing cycle or a limit increase is applied.

You receive an email notification at 80% and a second notification at 95% of each dimension. There is no automatic charge for overages — you must request an increase.

## Requesting a quota increase

For plan-based limits: upgrade your plan from **Settings → Billing**. Higher plans include proportionally higher limits.

For custom limits above the Enterprise plan: contact your account manager or email `sales@tribora.app` with:

- Your org name and current plan
- Which dimension you need increased
- The target limit and duration (monthly vs. permanent)

Enterprise orgs with custom contracts can request limit increases directly through their CSM.

## Usage audit — who consumed what

To understand what drove usage in the current period:

1. Go to **Settings → Quotas** and click **View usage breakdown**.
2. The breakdown shows usage by member and by recording for each dimension.
3. Filter by date range to isolate a specific period.

Common causes of unexpected usage spikes:

- A bulk import from an external connector (large Drive folder, Zoom cloud export)
- A team-wide recording sprint (e.g., onboarding a new department)
- A wiki compilation sweep after a large corpus update

## Related

- [Billing](billing) — plan limits and how to upgrade
- [Storage and cost](../observability/storage-and-cost) — detailed storage analytics and cost breakdown
