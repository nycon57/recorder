# HubSpot Billing Standard Operating Procedure

**Owner:** Priya Rangan, Head of Support Ops
**Version:** 3.2
**Effective:** 2026-01-15

## Purpose

Defines the standard process for billing-related activities handled through HubSpot: deal updates, refund processing, subscription changes, and Finance reporting.

## Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| Support Agent | Initiate refund requests, log billing tickets, link to deals |
| Support Lead | Approve refunds < $500, escalate above threshold |
| Support Ops Admin (Priya) | Approve refunds $500–$2,000, own chargeback responses, monthly audit |
| Finance | Process ACH credits for charges > 90 days old, quarterly refund review |

## Deal Property Standards

All billing-related deals must have: Refund status, Stripe Payment Intent, Refund amount, Refund reason, Refund approved by, Refund date.

Properties must be populated as structured fields, not as Activity notes. Finance reporting pulls from structured fields only.

## Refund Authority Matrix

| Amount | Authority |
|--------|-----------|
| < $500 | Agent (self-authorized) |
| $500 – $2,000 | Priya + deal owner |
| > $2,000 | Priya + deal owner + CFO |
| Goodwill > $200/year | Priya approval required |

## Audit Schedule

- Weekly: Thursday reconciliation (Stripe export vs. HubSpot report)
- Monthly: Refund reason distribution review
- Quarterly: Chargeback rate and goodwill refund percentage
