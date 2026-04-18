# Knowledge Reviewer Playbook

This playbook is for the people who will operate Tribora's compiled-knowledge
system during rollout. It focuses on the surfaces that exist today and avoids
assuming future workflow UI that is still planned on the Linear board.

See also: [Knowledge Cutover Release Checklist](./knowledge-system-cutover-release-checklist.md)

## Purpose

Use this playbook to:

- decide when knowledge should auto-apply versus wait for review
- resolve flagged contradictions without losing audit history
- keep compiled-memory answers separate from raw discovery
- handle agent approvals without reverse-engineering the codebase

## Current Operator Surfaces

These are the primary places operators should work from during rollout:

- `/settings/organization/agents`
  - configure wiki contradiction routing mode
  - set hybrid thresholds for contradiction auto-apply
  - review the Approval Queue for agent actions that require approval
- `/admin/wiki-review`
  - approve, reject, or edit-and-approve flagged contradictions
  - inspect the current content versus the proposed change before publishing
- `/knowledge/health`
  - monitor pending contradictions, lint signals, and overall knowledge health
- Dashboard chat and other answer surfaces
  - compiled memory is the canonical answer layer
  - discovery/raw evidence remains a separate audit path, not the default answer substrate

## Status Glossary

The knowledge system now uses a shared status vocabulary:

| Status | Meaning | Reviewer action |
| --- | --- | --- |
| `Processing` | Source material is still being compiled | Wait unless it appears stuck or failed |
| `Needs Routing` | Knowledge exists but does not have a reliable app/screen assignment yet | Treat as manual follow-up until a dedicated routing queue ships |
| `Live` | A trusted organization knowledge page is available | Spot-check only when there is a new risk signal |
| `Needs Review` | A contradiction or governance check needs a human decision | Work this in `/admin/wiki-review` |
| `Superseded` | A newer row replaced this knowledge | Keep for audit; do not edit back into circulation |
| `Vendor Only` | Vendor baseline exists but org knowledge has not been published yet | Use as coverage signal, not as a completed org page |

## Default Operating Model

Use the following policy unless product leadership explicitly changes it for a
launch wave:

1. Keep contradiction routing in `manual` or carefully bounded `hybrid` mode
   until rollout quality is stable.
2. Use `Always auto-apply` only for organizations with proven, low-risk input
   quality and clear rollback coverage.
3. Treat compiled pages as the canonical answer layer. Use discovery mode only
   to inspect raw evidence, not to answer as if it were already trusted knowledge.

## Reviewer Workflow

### 1. Start the day in agent settings

Open `/settings/organization/agents` and confirm:

- the contradiction routing mode is the one expected for this org
- hybrid thresholds match the current rollout tolerance
- there is no stale hybrid configuration left behind after a manual-review change
- approval tiers are still appropriate for risky agent actions

Recommended default during rollout:

- `Contradiction routing mode`: `Hybrid thresholds`
- `Auto-apply up to N contradictions`: `1`
- `Minimum confidence delta for auto-apply`: `0` or higher

### 2. Check knowledge health before reviewing queue items

Open `/knowledge/health` and look at:

- pending contradictions
- lint and coverage signals
- unusual spikes in review volume

Escalate before approving anything if:

- pending contradictions spike sharply
- multiple pages in the same app/screen cluster start disagreeing
- a vendor-only area suddenly receives many org-level contradictions

### 3. Resolve flagged contradictions in `/admin/wiki-review`

Each card shows:

- the current live page content
- the proposed contradiction resolution or merged content
- the source recording id
- the detected timestamp
- the specific contradictions and additions when available

Choose the action that matches the evidence:

#### Approve

Approve when all of the following are true:

- the proposed update clearly matches the source evidence
- the contradiction is real, not just a difference in wording or scope
- the merged content preserves still-valid material instead of overwriting too much

Result:

- the existing page is superseded
- the approved content becomes the new live row
- audit history is preserved

#### Edit & Approve

Use edit-and-approve when:

- the new evidence is correct
- the generated merge is directionally right but not publishable as written
- you need to rewrite for clarity, structure, or safer wording

Result:

- your edited body becomes the new live row
- the prior row is still preserved for audit

#### Reject

Reject when:

- the evidence is weak, ambiguous, or obviously misrouted
- the contradiction is not actually a contradiction
- the proposal would remove still-valid instructions
- the item should wait for more routing context or a broader content pass

Result:

- the live page stays unchanged
- the flagged entry is marked rejected in the audit trail

## Approval Queue Workflow

The Approval Queue in `/settings/organization/agents` is separate from wiki
contradiction review.

Use it for agent actions that are configured with the `approve` permission tier,
such as high-impact curation or publication-style changes.

Reviewer rules:

- approve only if the requested action is clearly scoped and reversible
- reject with a reason when the action is unsafe, premature, or based on bad input
- use the queue to control risky automation, not to micromanage low-risk defaults

## Spot-Checking Answer Quality

After clearing material review items, spot-check live answering:

1. Ask a dashboard chat question that should be answered from compiled memory.
2. Confirm the answer cites compiled sources rather than inventing a response.
3. Confirm discovery/raw evidence is still treated as a separate mode.
4. If a contradiction was just approved, verify the updated answer reflects the new live page.

Escalate immediately if:

- compiled-memory answers stop citing pages
- answer surfaces fall back to raw discovery without making that mode explicit
- org guidance no longer overrides vendor guidance when it should

## Known Gaps During Rollout

These are important so reviewers do not assume workflows exist when they do not:

- A dedicated `Needs Routing` queue is still planned separately. Until that lands,
  treat routing ambiguity as manual follow-up work.
- The broader docs/search/graph workspace rollout is still staged across later
  Linear waves. Do not claim full workspace cutover until those issues are complete.
- Raw evidence retrieval is intentionally preserved as a discovery path. It is
  useful for audits but should not be presented as already-approved canonical knowledge.

## Escalation Rules

Pause or tighten automation immediately if any of the following happens:

- the review queue begins growing faster than operators can clear it
- multiple contradictions appear against the same page in one release window
- reviewers cannot explain why a change was auto-applied
- source routing looks ambiguous or obviously wrong

The safe rollback move is:

1. switch contradiction routing to `Manual review`
2. continue using `/admin/wiki-review` to resolve backlog safely
3. keep compiled memory live only where trust remains high
