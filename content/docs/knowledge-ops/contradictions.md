---
title: Resolving contradictions
description: What a contradiction signal means, how Tribora detects conflicting statements, and how to resolve them.
audience: org-admin
section: knowledge-ops
order: 20
related:
  - knowledge-ops/wiki-review-queue
  - knowledge-ops/knowledge-gaps
tags:
  - knowledge
  - wiki
  - contradictions
---

## What a contradiction is

A contradiction occurs when two or more recordings contain statements that directly conflict on the same topic. For example, one recording states that the expense approval threshold is $500, while a later recording states it is $1,000. Tribora detects these through semantic comparison of wiki page content against new recording transcripts.

Contradictions are surfaced in `/knowledge/health` with a severity score. A high-severity contradiction means the conflicting statements appear frequently in recordings or are referenced by many wiki pages.

## Why contradictions matter

Unresolved contradictions degrade the accuracy of the AI assistant. When a user asks a question that touches contradictory information, the assistant either hedges ("I found conflicting information") or selects one answer arbitrarily. Resolving contradictions improves answer quality for the entire organization.

## Resolving a contradiction

Navigate to the contradiction in `/knowledge/health`. Each contradiction shows:

1. **Topic** — the subject both statements concern
2. **Statement A** — the original wiki claim, with the source recording
3. **Statement B** — the conflicting claim, with its source recording
4. **Occurrence count** — how many recordings reference each version

### Resolution options

**Mark one as authoritative** — choose which statement is correct. The other is archived in the wiki history but no longer used to answer questions. Use this when one version is clearly outdated (e.g., the older policy has been superseded).

**Merge** — combine both statements into a nuanced single claim. Use this when both are partially correct (e.g., the $500 threshold applies to marketing, the $1,000 threshold applies to engineering). Write the merged statement in the text field provided.

**Mark as context-dependent** — flag that both are correct in different contexts. The AI will present both when the context is ambiguous, and present only the relevant one when enough context is available (e.g., the user's department is known).

**Dismiss** — mark the contradiction as not a true conflict. Use this when the statements are about different time periods, different products, or different audiences, and no merge or authority decision is needed.

## Preventing new contradictions

Contradictions most often arise from stale documentation. The most effective prevention is keeping the wiki review queue low — approving updates promptly reduces the window during which the wiki contains outdated information.

If a topic generates repeated contradictions, consider adding a **knowledge area owner**: a team member who is the designated authority on that topic and is automatically assigned review items touching it.

## Related

- [Wiki review queue](wiki-review-queue) — approving and rejecting AI-suggested updates
- [Acting on knowledge gaps](knowledge-gaps) — the signal for information that is missing entirely
