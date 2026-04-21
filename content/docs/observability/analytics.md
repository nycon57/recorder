---
title: Analytics dashboard
description: Reading org-scoped analytics including engagement, reach, and recording health. Navigating the analytics surface at /analytics.
audience: org-admin
section: observability
order: 10
related:
  - observability/storage-and-cost
  - knowledge-ops/knowledge-gaps
tags:
  - org-admin
  - analytics
  - engagement
---

## Overview

The analytics dashboard at `/analytics` shows how your organization's knowledge base is being used. All metrics are scoped to your organization — you cannot see data from other orgs. Data is updated every 24 hours.

## Engagement metrics

**Active users** — unique members who accessed at least one recording, wiki page, or the AI assistant in the selected period. Baseline is monthly active users (MAU).

**Session count** — total user sessions in the period. A session begins on login and ends after 30 minutes of inactivity.

**Average session duration** — mean session length in minutes. A healthy org typically sees 8–15 minutes. Very short sessions (< 2 min) indicate users are not finding what they came for.

**AI assistant queries** — total questions sent to the assistant. Growing query count typically tracks with knowledge base quality — as the assistant gets better answers, users ask more.

## Reach metrics

**Recordings viewed** — unique recordings accessed by at least one user in the period. A low reach-to-library ratio (e.g., < 30% of recordings ever viewed) indicates your team is not surfacing the right content at the right time. Consider using onboarding plans to drive discovery.

**Wiki page views** — unique wiki page views. Compare this to the total wiki page count: if 80% of pages have never been viewed, knowledge curation may be over-indexing on edge cases.

**Search queries** — total searches performed. The **Zero-result rate** (percentage of searches that returned no results) is the most actionable signal here — this directly feeds the knowledge-gaps detection pipeline.

## Recording health

**Processing backlog** — recordings awaiting transcription or AI enrichment. A sustained backlog (> 12 hours) may indicate a worker performance issue. Contact support if the backlog persists.

**Enrichment completion rate** — percentage of recordings that have completed transcription, summarization, and wiki extraction. Healthy orgs run > 95%.

**Contradiction rate** — percentage of wiki review queue items flagged as contradictions. Rising contradiction rate suggests your team is capturing divergent information — review the [contradictions dashboard](../knowledge-ops/contradictions).

## Filtering and date ranges

The analytics dashboard supports:

- **Date range** — preset (7d, 30d, 90d) or custom range picker
- **Department filter** — scope all metrics to one or more departments
- **Member filter** — scope to specific members (Owner/Admin only)

## Exporting data

Click **Export** (top right) to download a CSV of the currently visible metric table. The CSV includes the same filters applied to the dashboard.

For custom reporting beyond what the dashboard provides, your analytics data is available via the API (API key required, `analytics:read` scope).

## Related

- [Storage and cost](storage-and-cost) — resource consumption metrics complementing engagement data
- [Acting on knowledge gaps](../knowledge-ops/knowledge-gaps) — the zero-result rate directly feeds the gaps queue
