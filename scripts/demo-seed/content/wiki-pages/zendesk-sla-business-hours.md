# Zendesk: SLA and Business Hours Configuration

## Summary
How to configure Zendesk business hour schedules and SLA policies correctly. Critical setup to avoid SLA clock drift during off-hours automation.

## Business Hours Setup

Create one schedule per region in Settings > Objects and rules > Business rules > Business hours:

| Region | Timezone | Holiday Calendar |
|--------|----------|-----------------|
| US-East | America/New_York | US Federal |
| US-West | America/Los_Angeles | US Federal |
| EU-Central | Europe/Berlin | German national |

## SLA Policy Configuration

**Critical rule:** First-reply-time SLA must be scoped to the *Agent responded* event, **not** *Ticket created*. Using ticket-created breaks SLA accuracy when automations auto-assign tickets outside business hours.

| Priority | First Reply | Resolution |
|----------|-------------|------------|
| Urgent | 30 minutes | 4 hours |
| High | 2 hours | 24 hours |
| Medium | 8 hours | *not committed* |
| Low | 24 hours | *not committed* |

## Agent Sidebar Widget

Tier-1 agents see SLA breach risk in the ticket sidebar widget. If the widget is missing, enable it per-view: Views > [view name] > Show SLA column.

## References
- Source recording: `onboarding-zendesk-02`
- Zendesk SLA documentation: https://support.zendesk.com/hc/en-us/articles/4408822332698
