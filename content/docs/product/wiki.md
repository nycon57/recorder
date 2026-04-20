---
title: 'Wiki'
description: 'How Tribora generates wiki articles from recordings, the review queue, and the publish lifecycle for knowledge articles.'
audience: public
section: product
order: 20
tags: [wiki, knowledge, review, publish]
related: ['getting-started/from-recording-to-knowledge', 'product/search', 'product/assistant']
---

## What the wiki is

The *wiki* is the organization's searchable corpus of structured knowledge articles. Every article in the wiki was either generated from a processed recording or authored directly by a team member with the appropriate permissions.

Articles in the wiki are not raw transcripts. They are structured documents with a title, description, numbered steps, context annotations, and source attribution (the recording it came from, who recorded it, and when).

## Article generation

When a recording completes the pipeline, a knowledge article is automatically created in a *draft* state and placed in the **review queue**. The article is not published to the wiki corpus or visible in search until it is reviewed and published.

This design is intentional: automated generation can produce low-confidence results, and knowledge that is wrong or out of date causes more harm than missing knowledge.

## The review queue

The review queue shows all knowledge articles awaiting a human decision. For each article, a reviewer can:

- **Publish** — mark the article ready. It becomes part of the searchable corpus immediately.
- **Edit then publish** — revise the AI-generated content before publishing.
- **Reject** — remove the article. The underlying recording is not affected.
- **Request revision** — flag the article for the original recorder to review.

Articles in the review queue are visible only to reviewers (typically org admins or designated knowledge managers). Regular users do not see draft articles in search results.

## Publish lifecycle

| State | Description | Visible in search? |
|---|---|---|
| **Draft** | Awaiting review | No |
| **Published** | Live in corpus | Yes |
| **Archived** | Removed from corpus, retained for audit | No |

Publishing is not permanent in a destructive sense: a published article can be archived or unpublished at any time by an org admin or the article owner.

## Editing wiki articles

Published articles can be edited in-place. The editor supports Markdown. Changes take effect immediately and the content hash is updated, which causes re-indexing within 60 seconds.

Each edit is tracked with a version timestamp and the editor's user ID. You can view edit history from the article detail page under *More actions → History*.

## Article ownership and attribution

Every wiki article carries:
- **Source recording** — the recording it was generated from (if any).
- **Recorded by** — the user who captured the source recording.
- **Last edited by** — the most recent editor.

Attribution is not editable. The "recorded by" field reflects the original capture.
