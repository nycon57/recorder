# HubSpot: Dual Approval Workflow for Refunds

## Summary
Approval chain for refunds requiring sign-off beyond individual agent authority. Applies to partial refunds over $500 and all full refunds. Prevents unauthorized refund issuance.

## When Dual Approval Is Required

- Partial refunds > $500
- All full refunds regardless of amount
- All goodwill refunds > $200 (per rolling 12-month cap)

## Approval Process

1. **Open the deal** in HubSpot and set Refund status to the appropriate value.

2. **Create tasks** — In HubSpot, create a task assigned to Priya Rangan and the deal owner with due date = today.

3. **Wait for task completion** — Both tasks must be marked complete before proceeding to Stripe. The *Refund approved by* field (read-only for agents) gets populated when Priya approves.

4. **Process in Stripe** — Only after both tasks are marked complete.

## Background

Two cases this quarter where tier-1 agents issued refunds without dual approval. Both required chargeback clawbacks via Stripe disputes, which carry a $15 dispute fee and damage the merchant account health score.

The *Refund approved by* field is restricted to admin users — agents see it as read-only. This is intentional to prevent self-approval.

## References
- Source recordings: `refund-playbook-hubspot-01`, `refund-playbook-hubspot-03`
- Escalation matrix (imported doc: `escalation-matrix`)
