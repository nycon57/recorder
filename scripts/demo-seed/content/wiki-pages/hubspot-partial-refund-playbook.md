# HubSpot: Partial Refund Playbook

## Summary
End-to-end process for handling partial refund requests on closed HubSpot deals. Includes dual-approval requirements for amounts over $500 and Stripe processing via integration panel.

## Process

1. **Open the deal** — Find it in Closed Won pipeline. Set *Refund status* property (Finance section) to **Partial requested**.

2. **Log the rationale** — Add a call or email log in the Activity tab with the customer's refund reason. Do not rely on memory.

3. **Create or link a Billing ticket** — Type: Billing, Priority: High. Add the refund line item as a **structured field** (not a note — Finance pulls structured fields weekly).

4. **Dual approval for amounts > $500** — @mention Priya Rangan and the deal owner before submitting to Stripe. Wait for both approvals.

5. **Process in Stripe** — Use the Stripe integration panel on the deal sidebar. **Do not** use the Stripe dashboard directly — this breaks HubSpot sync.

6. **Update deal status** — Set Refund status to *Refund processed* once Stripe confirms.

## Approval Thresholds

| Amount | Approval Required |
|--------|-----------------|
| < $500 | Agent only |
| $500–$2,000 | Priya + deal owner |
| > $2,000 | Priya + deal owner + CFO |

## References
- Source recordings: `refund-playbook-hubspot-01`, `refund-playbook-hubspot-04`
- HubSpot billing SOP (imported doc: `hubspot-billing-sop`)
