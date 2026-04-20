# Zendesk: Macros and Views Setup

## Summary
Configuration guide for Zendesk ticket views and macro management for tier-1 agents. Covers view filters, sort order, macro content, and the tag allowlist.

## View Configuration

Create four pinned views for every tier-1 agent:

1. **My open tickets** — filter: assignee = me, status = open or pending
2. **SLA breach risk** — filter: SLA breach < 4 hours, assignee = me
3. **Waiting for customer** — filter: status = pending, assignee = me
4. **Group: Tier 1 unassigned** — filter: group = Tier 1, assignee = nobody, status = open; sort by created ascending (oldest first — prevents cherry-picking)

## Core Macros

| Macro | Purpose |
|-------|---------|
| `greeting-initial` | First response with acknowledgment |
| `info-requested` | Asking for more details |
| `closing-resolved` | Resolved confirmation |
| `follow-up-no-response` | 48-hour nudge for pending tickets |
| `escalated-tier-2` | Sets tag + reassigns to Tier 2 group |

## Tag Allowlist

Tags are allowlisted in Business rules > Tags. Agents cannot add unapproved tags. New tag requests go to Priya — approval takes ~1 business day.

**Warning:** Some tags trigger automations. The tag `escalate-to-engineering` fires a Jira webhook automatically. Apply only when engineering is actually needed.

## References
- Source recordings: `onboarding-zendesk-03`, `onboarding-zendesk-04`, `onboarding-zendesk-05`
