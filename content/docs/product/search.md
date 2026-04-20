---
title: 'Search'
description: 'What Tribora search covers, how to phrase queries effectively, and how to filter results by date, owner, and tag.'
audience: public
section: product
order: 30
tags: [search, query, filter, knowledge]
related: ['product/wiki', 'product/assistant', 'reference/data-model']
---

## What search covers

Tribora search indexes the following content:

- **Wiki articles** — the full text of all published knowledge articles in your organization.
- **Recording titles and descriptions** — metadata from recordings shared with the organization.
- **Step labels** — the structured step data extracted during pipeline processing.

Search does not index:
- Draft or archived wiki articles.
- Raw transcripts (the transcript is used to generate the article, not indexed independently).
- Private recordings that have not been shared with the organization.
- Content from other organizations.

## Keyword search

The search bar on the main search page performs full-text keyword matching across the indexed corpus. Results are ranked by relevance using a combination of term frequency and recency.

**Query tips:**
- Use specific nouns rather than general verbs. "Zendesk ticket escalation" returns more useful results than "how to escalate."
- Enclose phrases in quotation marks to match them exactly: `"onboarding checklist"`.
- Shorter queries often rank better than long natural-language questions. Save natural language for the AI assistant.

## Filtering results

After submitting a query, use the filter panel on the left to narrow results:

- **Date range** — restrict to articles updated or recorded within a time window.
- **Owner** — show articles from a specific user's recordings.
- **Tags** — filter to articles with one or more tags.
- **Type** — show only wiki articles, only recordings, or both.

Filters apply on top of the current query and update results immediately.

## Search scope

Search is scoped to your organization by default. You cannot search across other organizations using the standard search interface.

If your account is a member of multiple organizations, use the organization switcher in the top-right to change context before searching.

## When search returns no results

If a search returns no results:
1. Check that the article you are looking for is published (not in draft or review).
2. Verify that the recording that generated the article was shared with the organization, not kept private.
3. Try a broader or differently-phrased query.
4. If you believe content should be indexed and is not, contact your org admin to check the wiki review queue.

## Search and the AI assistant

The *Search* surface performs keyword matching. The *Assistant* surface uses the same indexed corpus but answers using natural language and provides source citations. For exploratory or question-like queries, the assistant typically returns more useful output. See [Assistant](/docs/product/assistant).
