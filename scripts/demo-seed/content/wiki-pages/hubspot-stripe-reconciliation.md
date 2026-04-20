# HubSpot: Stripe Refund Reconciliation

## Summary
Weekly reconciliation process matching Stripe refund exports against HubSpot deal records. Runs every Thursday. Required for the monthly Finance report.

## Weekly Process (Thursdays)

1. **Export Stripe refunds** — Payments > Refunds > set date range to last 7 days > export CSV.

2. **Run HubSpot report** — Open "Refunds by Month" from Finance folder in Reports. This report joins on *Stripe Payment Intent* custom property.

3. **Match records** — Join on Payment Intent ID. Expected mismatch rate: 2–5% (webhook delays or manual entries).

4. **Handle mismatches:**
   - Missing Payment Intent on deal → backfill manually using Close Date + customer email in Stripe
   - Stripe refund with no HubSpot deal → check if subscription cancellation (these live on customer record, not deal)
   - Add mismatches to reconciliation tab of shared Finance spreadsheet

5. **Deadline** — Reconciliation tab complete by noon on last business day of month.

## Reason Codes

| Code | Meaning |
|------|---------|
| `duplicate-charge` | Same amount charged twice |
| `not-as-described` | Product didn't match expectations |
| `cancelled-trial-charge` | Trial converted without consent |
| `fraud-suspected` | Unauthorized use — escalate to Priya |
| `goodwill` | Retention-motivated |

## References
- Source recording: `refund-playbook-hubspot-02`
- Stripe refund policy (imported doc: `stripe-refund-policy`)
