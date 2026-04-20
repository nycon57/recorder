# Jira Escalation Protocol for Support Teams

**Owner:** Priya Rangan
**Last Updated:** 2026-02-01

## When to Escalate to Jira

Escalate to Jira (create a bug in SUP project) when:
- The customer's issue cannot be resolved by support with existing tools or documentation
- The issue appears to be a product defect or unexpected behavior
- Multiple customers are reporting the same issue

Do NOT escalate to Jira for:
- Configuration questions the agent can answer
- Billing issues (use HubSpot)
- Feature requests (use the product feedback Notion board)

## Mandatory Issue Contents

Every Jira bug from support must contain:
1. Customer's exact description of the problem
2. Reproduction steps (steps the customer took leading to the issue)
3. Expected vs. actual behavior
4. Environment details (browser, plan tier, API version if applicable)
5. Zendesk ticket URL
6. All three mandatory labels: `customer-impacting`, product area, severity

## Sev-1 Protocol

Sev-1 (data loss or complete account lockout) bypasses the normal Jira queue:
1. Create the Jira issue immediately
2. Post in #engineering-escalations Slack channel with the Jira issue key
3. Alert Priya directly via DM or phone
4. Update the customer every 30 minutes until resolved

## Quarterly Audit

The SUP project is audited quarterly. Issues > 60 days old with all Zendesk tickets resolved are closed as Won't Fix. Issues > 90 days On Hold are closed as Cannot Reproduce.
