---
title: "Welcome to Tribora"
description: "Tribora captures screen recordings and transforms them into structured, searchable documentation — automatically."
audience: public
section: getting-started
order: 10
tags: [overview, getting-started]
---

## What is Tribora?

Tribora is an AI-powered knowledge intelligence layer. It records your screen, extracts meaning from what you do, and turns those recordings into structured documentation your whole team can search and reference.

No manual note-taking. No wiki rot. Just accurate, up-to-date knowledge — automatically.

## How it works

1. **Record** — Install the browser extension or embed the SDK widget. Start a recording session whenever you want to capture a process.
2. **Process** — Tribora's AI pipeline transcribes audio, identifies on-screen context, and structures the session into a searchable knowledge article.
3. **Search** — Every processed recording is indexed and surfaced through the knowledge base. Ask a question; get the answer with source attribution.

## Quick start

```bash
# Install the CLI (optional — most users start with the browser extension)
npm install -g @tribora/cli
tribora login
tribora record --output my-first-recording
```

Or head to the [browser extension](/docs/integrations) to get started in under two minutes.

## Key concepts

| Term | Meaning |
|---|---|
| **Recording** | A captured screen session, with audio and context metadata |
| **Knowledge article** | The structured output produced from a recording by the AI pipeline |
| **Wiki** | The team-wide searchable corpus of all knowledge articles |
| **Digest** | A periodic summary of new and updated articles, delivered via email or Slack |

## What's next?

- [Install the browser extension](/docs/integrations) — fastest path to your first recording
- [Understand the product guide](/docs/product) — feature walkthroughs for day-to-day use
- [Configure your organization](/docs/org-admin) — for admins setting up teams and SSO
