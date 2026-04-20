# Zendesk Administrator Guide — Acme Support Edition

**Source:** Zendesk Help Center (internal copy)
**Last reviewed:** 2026-01-10

## Scope

This guide covers the administrator-level configuration maintained by the Support Ops team. Agent-level onboarding is covered separately in the training recordings.

## Key Configuration Areas

### User Management
- Role hierarchy: Light agent < Agent < Team lead < Administrator
- Group membership drives ticket routing and view access
- SSO is mandatory for all agent accounts — no local password login

### Ticket Fields
Custom fields added to all tickets: Product area, Issue type, Customer tier, Refund flag. These feed the Explore reporting dashboards.

### Automations
- Auto-close: tickets pending > 72 hours after follow-up send, status set to Solved
- SLA breach alert: fires internal note 1 hour before breach
- Tag-based webhook: `escalate-to-engineering` fires Jira API endpoint

### Integrations Configured
- Jira (bi-directional via OAuth)
- HubSpot (one-way: Zendesk → HubSpot on ticket creation)
- Slack (notifications only — breach alerts and escalation confirmations)

## Change Management
All configuration changes require a change ticket in Jira (INFRA project). Breaking changes need a 48-hour notice in the #support-ops channel.
