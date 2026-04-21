---
title: Billing
description: Plans, invoices, payment methods, seat true-ups, and upgrade or downgrade mechanics.
audience: org-admin
section: org-admin
order: 40
related:
  - org-admin/members-and-roles
  - org-admin/quotas
tags:
  - org-admin
  - billing
  - stripe
---

## Accessing billing settings

Navigate to **Settings → Billing** (Owner role required). This page shows your current plan, next invoice date, seat count, and payment method on file.

Billing is powered by Stripe. Payment information is stored and processed by Stripe — Tribora does not store card numbers.

## Plans

| Plan | Seats | Storage | AI tokens/mo | Key features |
|---|---|---|---|---|
| Starter | Up to 5 | 10 GB | 500K | Core recording, basic knowledge base |
| Business | Up to 50 | 100 GB | 5M | SSO, custom domain, priority support |
| Enterprise | Unlimited | Custom | Custom | SLA, custom data retention, dedicated CSM |

Current pricing at [tribora.app/pricing](https://tribora.app/pricing).

## Upgrading your plan

1. Go to **Settings → Billing**.
2. Click **Upgrade plan**.
3. Select the target plan.
4. Review the prorated charge for the current billing period.
5. Confirm.

Upgrades take effect immediately. New quotas (seats, storage, AI tokens) are applied within 60 seconds of the Stripe webhook being processed.

## Downgrading your plan

1. Go to **Settings → Billing → Change plan**.
2. Select the lower plan.
3. Confirm. The downgrade is scheduled for the end of the current billing period.

Before the downgrade takes effect, ensure your usage is within the lower plan's limits:

- **Seats:** Deactivate members to reach the seat limit. If you are over the seat limit on the downgrade date, the downgrade is blocked and you will be notified.
- **Storage:** Archive or delete content to reach the storage limit. Tribora does not auto-delete content on downgrade.

## Invoices

Past invoices are listed in **Settings → Billing → Invoices**. Each row shows the invoice date, amount, and a PDF download link.

Invoices are also emailed automatically to the billing email address on file. To update the billing email:

1. Go to **Settings → Billing → Billing details**.
2. Update the **Billing email** field and save.

## Seat true-ups

Tribora charges per active seat on a monthly basis. The seat count is measured at the time each monthly invoice is generated. If you added members mid-month, you are charged a prorated amount for their partial-month usage.

The seat count shown in **Settings → Billing** is the current active count. Deactivated members do not count toward seats.

## Adding or removing payment methods

1. Go to **Settings → Billing → Payment methods**.
2. Click **Add payment method** to add a new card or bank account via the Stripe-hosted form.
3. To remove an old payment method, click **Remove** next to it.

At least one active payment method must be on file to keep your subscription active.

## Subscription cancellation

To cancel: **Settings → Billing → Cancel subscription**. Cancellation takes effect at the end of the current billing period. Data is retained for 30 days after cancellation, then permanently deleted per the data retention policy.

To reactivate within the 30-day window, contact support.

## Related

- [Members and roles](members-and-roles) — seat consumption per role
- [Quotas and usage](quotas) — monitoring storage and AI consumption against plan limits
