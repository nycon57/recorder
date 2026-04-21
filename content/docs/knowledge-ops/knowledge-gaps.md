---
title: Acting on knowledge gaps
description: Reading the knowledge-gaps dashboard, assigning ownership, and closing gaps through recordings or documentation updates.
audience: org-admin
section: knowledge-ops
order: 30
related:
  - knowledge-ops/wiki-review-queue
  - knowledge-ops/contradictions
tags:
  - knowledge
  - gaps
---

## What a knowledge gap is

A knowledge gap is a topic that users have asked about — via the AI assistant, search, or explicit feedback — but for which the knowledge base contains no satisfactory answer. Tribora detects gaps by correlating zero-result or low-confidence assistant responses with the questions that triggered them.

Knowledge gaps are distinct from contradictions: a contradiction means conflicting information exists; a gap means no relevant information exists at all.

## The knowledge-gaps dashboard — `/knowledge-gaps`

The dashboard lists all open gaps sorted by **frequency**: how many times a question without a good answer was asked. Each row shows:

| Column | Description |
|---|---|
| Topic | The inferred subject of the unanswered question |
| Questions | Sample phrasings users have asked |
| First seen | When the gap was first detected |
| Frequency | Number of distinct users who triggered this gap |
| Owner | Assigned team member (empty if unassigned) |
| Status | Open / In progress / Closed |

High-frequency gaps from many distinct users represent the highest-value documentation opportunities.

## Assigning ownership

Click a gap row and select **Assign owner**. The assigned team member receives an email notification with the sample questions and a link back to the gap. They are responsible for closing the gap through one of the methods below.

For gaps related to a specific department's processes, assign to a subject-matter expert in that department rather than a generalist.

## Closing a gap

### Option 1: Record a walkthrough

The most effective way to close a gap is to record a screen session that covers the missing topic. After Tribora processes the recording, it automatically detects the match and marks the gap as resolved (within 24 hours of the recording being enriched).

### Option 2: Update an existing wiki page

If the information exists but was not captured correctly, edit the relevant wiki page to add the missing details. After saving, the search index rebuilds and the gap closes on the next quality scan (runs nightly).

### Option 3: Write a new wiki page

For substantial missing topics, create a new wiki page directly from the gap detail view by clicking **Create wiki page**. The page is pre-populated with the sample questions as a starting point.

### Option 4: Dismiss

If a gap represents a question the organization deliberately does not answer (e.g., a legal-hold topic), click **Dismiss** and add a note. Dismissed gaps do not reappear in the queue.

## Bulk triage

For new organizations with many initial gaps, use the **Bulk assign** mode to sort gaps by department and assign blocks of gaps to relevant owners in one pass. Filter by topic keyword to group related gaps before assigning.

## Related

- [Wiki review queue](wiki-review-queue) — reviewing AI-suggested updates to close gaps faster
- [Resolving contradictions](contradictions) — the complementary signal when information conflicts rather than missing
