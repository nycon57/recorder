# Stripe Refund Policy — Internal Reference

**Source:** Stripe documentation + internal policy overlay
**Maintained by:** Finance

## Stripe Refund Limits

- **Standard refunds:** Must be processed within 90 days of original charge. After 90 days, Stripe cannot reverse the charge — ACH credit required through Finance.
- **Partial refunds:** Any amount up to original charge value. Multiple partial refunds can be issued against one charge until the total equals the original.
- **Dispute refunds:** Issue proactively to avoid chargeback fees ($15/dispute).

## Processing Channels

| Channel | Use When |
|---------|---------|
| HubSpot deal sidebar (Stripe integration) | Standard refund on deal with Stripe Payment Intent linked |
| Stripe Disputes panel | Responding to chargebacks — include evidence |
| Finance ACH | Charges older than 90 days, amounts > $5,000 |

**Do not** process refunds directly in the Stripe dashboard — this breaks HubSpot sync and creates reconciliation gaps.

## Chargeback Response Deadline

Stripe provides **7 days** to respond to chargebacks. Missing the deadline = automatic loss + $15 fee + merchant health score impact.

Response evidence to include: signed contract or TOS acceptance, delivery confirmation, customer communication showing product usage.

## Reason Codes Used in HubSpot

`duplicate-charge` | `not-as-described` | `cancelled-trial-charge` | `fraud-suspected` | `goodwill`

Flag `fraud-suspected` immediately to Priya — she owns the quarterly Stripe dispute review and regulatory reporting.
