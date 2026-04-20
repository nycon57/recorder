# Jira: Triage Labels for Support Escalations

## Summary
Label taxonomy for issues in the SUP Jira project. Correct labeling determines engineering triage priority. Mislabeling causes friction and erodes trust between support and engineering.

## Mandatory Labels (all bugs must have all three)

### 1. customer-impacting
All bugs created from Zendesk must have this label. Engineering filters their triage board on it.

### 2. Product Area Labels

| Label | Coverage |
|-------|---------|
| `payments-integration` | Stripe, billing, subscriptions |
| `notifications` | Email, in-app, webhook notifications |
| `api-access` | REST API, authentication, rate limits |
| `reporting-module` | Dashboards, exports, analytics |
| `account-management` | Login, settings, team management |

### 3. Severity Labels

| Label | Meaning | Response |
|-------|---------|----------|
| `sev-1-data-loss` | Data lost or account inaccessible | Immediate Slack alert to engineering |
| `sev-2-feature-broken` | Core feature completely broken | Engineering reviews in daily standup |
| `sev-3-degraded` | Feature works but poorly | Scheduled into next sprint |
| `sev-4-cosmetic` | Display issues, no functional impact | Added to backlog |

**Guidance:** When uncertain, go one level lower than you think. Over-escalation damages the signal-to-noise ratio. Severity can always be upgraded; frequent over-escalation trains engineering to deprioritize your reports.

## References
- Source recording: `integrations-jira-04`
