# Escalation Matrix

**Owner:** Priya Rangan
**Last Updated:** 2026-03-01

## When to Escalate (Tiers)

### Tier 1 → Tier 2 (Senior Support)

Escalate within the support team when:
- Issue requires account-level access beyond agent permissions
- Technical troubleshooting has exceeded 30 minutes without resolution
- Customer has explicitly requested senior support

**Process:** Apply `needs-tier-2` tag (auto-reassigns via macro). Add internal note with: issue summary, what you've already tried, customer sentiment.

### Tier 2 → Engineering (Jira)

Escalate to engineering when:
- Issue appears to be a product defect
- Multiple customers are reporting the same symptom
- Issue cannot be resolved without a code change or data fix

**Process:** Create Jira bug in SUP project per escalation protocol.

### Tier 2 → Finance

Escalate to Finance when:
- Refund > $2,000
- ACH credit needed (original charge > 90 days)
- Suspected fraud requiring regulatory review

**Process:** Slack #finance-escalations with ticket number, amount, and summary.

### Any Tier → Emergency Protocol

Invoke for: data loss, complete account lockout, security breach suspicion.

1. Alert Priya by phone immediately
2. Post in #engineering-escalations with issue description
3. Customer update every 30 minutes until resolved

## Key Contacts

| Role | Person | Contact |
|------|--------|---------|
| Support Ops Admin | Priya Rangan | Slack @priya, phone on file |
| Engineering On-Call | Rotating | #engineering-escalations |
| Finance | Finance team | Slack #finance-escalations |
