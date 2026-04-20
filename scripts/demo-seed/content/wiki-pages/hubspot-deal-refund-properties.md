# HubSpot: Required Deal Properties for Refund Tracking

## Summary
Custom HubSpot deal properties required for billing and refund workflows. Property order and edit permissions are strictly controlled — do not add or reorder without coordination with Priya.

## Required Properties

| Property | Type | Who Can Edit | Notes |
|----------|------|-------------|-------|
| Refund status | Dropdown | All agents | Required field on any billing deal |
| Stripe Payment Intent | Text | System (webhook) | Auto-populated; backfill if blank |
| Refund amount | Currency | All agents | Enter exact amount |
| Refund reason | Dropdown | All agents | Use approved reason codes only |
| Refund approved by | Text | Admin only | Read-only for agents |
| Refund date | Date | System (webhook) | Auto-populated from Stripe |

## Refund Status Values

- `None` — No refund activity
- `Partial requested` — Awaiting approval/processing
- `Full requested` — Awaiting approval/processing
- `Refund processed` — Complete
- `Refund denied` — Rejected with documented reason

## Troubleshooting

**Refund date blank after processing in Stripe:** Webhook connection may have dropped. Check HubSpot integration health dashboard. If status is red, flag in #tech-ops Slack channel.

**Refund approved by blank after Priya approves:** Priya must click Approve in the task, not just mark the task complete — different actions.

## References
- Source recording: `refund-playbook-hubspot-04`
