---
title: Storage and cost
description: Storage usage by tier, cost dashboards, and when to archive vs. delete content.
audience: org-admin
section: observability
order: 20
related:
  - org-admin/quotas
  - observability/analytics
tags:
  - org-admin
  - storage
  - cost
---

## Overview

Storage analytics give you visibility into what is consuming your storage quota and how that consumption translates into cost. This page covers the storage analytics surface and how to act on it.

## Storage tiers

Tribora stores content across three tiers based on access recency:

| Tier | Description | Typical access pattern |
|---|---|---|
| **Hot** | Actively accessed or recently uploaded | Last 90 days |
| **Warm** | Less frequently accessed | 90 days – 1 year |
| **Cold archive** | Rarely accessed, compressed | > 1 year |

Migration between tiers happens automatically based on the access recency threshold. You cannot manually assign a tier, but you can influence it by archiving content (which immediately moves it to cold archive).

## Storage analytics — `/admin/storage-analytics`

The storage analytics page shows:

- **Total storage by tier** — bytes consumed in hot, warm, and cold storage
- **Top storage consumers** — the 10 recordings or collections consuming the most space, with file size and last-accessed date
- **Growth trend** — 90-day chart of daily storage additions
- **Projected quota exhaustion** — based on current growth rate, estimated date when the org reaches its storage limit

## Cost dashboard

Each storage tier has a different cost per GB/month. The cost dashboard (within `/admin/storage-analytics`) shows:

- **Monthly cost estimate** — rolling estimate for the current month
- **Cost by tier** — breakdown of what you are paying for hot, warm, and cold storage
- **Cost trend** — 90-day view of estimated monthly cost

Cold-archive storage costs approximately 80% less per GB than hot storage. A large archive of rarely accessed recordings can reduce your monthly bill significantly without losing any content.

## Storage recommendations

The **Recommendations** tab surfaces automated suggestions:

- **Archive candidates** — recordings not accessed in 180+ days that are in hot or warm storage
- **Deletion candidates** — recordings flagged as duplicates or with zero views in 365+ days
- **Deduplication opportunities** — groups of recordings with identical content hashes

Each recommendation shows the estimated storage savings and a single-click action.

## When to archive vs. delete

**Archive** when:

- The recording may still be relevant for compliance, onboarding, or historical reference
- You want to reduce cost without losing content
- The content has not been accessed in 6+ months but is from a key team or project

**Delete** when:

- The recording is clearly obsolete (superseded product, departed team member's scratch recordings)
- The recording was created in error (test recording, wrong screen captured)
- You have confirmed with the recording owner that it is not needed

Deleted recordings are soft-deleted for 30 days (recoverable by admins from the Library trash view), then permanently removed from storage.

## Bulk actions

From the **Storage analytics → Top consumers** table:

- Select multiple recordings using the checkbox column.
- Click **Archive selected** or **Delete selected** from the bulk action bar.
- Confirm. Archive actions complete immediately; deletes enter the 30-day soft-delete window.

## Related

- [Quotas and usage](../org-admin/quotas) — your plan's storage ceiling and how to increase it
- [Analytics dashboard](analytics) — engagement metrics that complement storage data
