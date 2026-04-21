---
title: Members and roles
description: Inviting members, the owner/admin/contributor/reader role matrix, changing roles, and seat accounting.
audience: org-admin
section: org-admin
order: 10
related:
  - org-admin/departments
  - org-admin/sso
  - org-admin/billing
tags:
  - org-admin
  - members
  - roles
---

## Role matrix

Tribora uses four roles. Every member has exactly one role.

| Role | Who it's for | Permissions |
|---|---|---|
| **Owner** | Founding user or designated billing authority | All permissions plus billing, subscription, and org deletion |
| **Admin** | Department leads, IT, ops managers | Member management, knowledge ops, all content access |
| **Contributor** | Individual contributors, knowledge workers | Record, upload, view all content, edit own wiki pages |
| **Reader** | Stakeholders, executives, compliance | View content; cannot record or edit |

One org must always have at least one **Owner**. You cannot demote the last owner — promote another member first.

## Inviting a member

1. Go to **Settings → Members** (or navigate to `/settings/members`).
2. Click **Invite member**.
3. Enter the email address and select a role.
4. Click **Send invite**.

The invitee receives an email with a link that expires in 48 hours. If they do not accept in time, re-send the invite from the Invitations tab.

**SSO organizations:** Members who sign in via SSO are provisioned automatically on first login with the default role configured in **Settings → SSO**. You can change their role after provisioning.

## Changing a member's role

1. Open **Settings → Members**.
2. Find the member and click **Edit role**.
3. Select the new role and confirm.

Role changes take effect immediately — the member's next API request uses the new role.

## Seat accounting

Your plan includes a seat limit. Each active (non-deactivated) member consumes one seat regardless of role. The current seat count and limit appear at the top of **Settings → Members**.

When you reach your seat limit, the **Invite member** button is disabled. To add more seats, upgrade your plan from **Settings → Billing**.

## Deactivating a member

Deactivated members lose access immediately. Their content and history are preserved.

1. Open **Settings → Members**.
2. Click **···** next to the member → **Deactivate**.
3. Confirm.

Deactivated accounts free a seat and are not counted toward the limit. You can reactivate them at any time from the **Deactivated** filter tab.

## Related

- [Departments](departments) — assigning members to departments for scoped knowledge routing
- [Single sign-on](sso) — automating member provisioning via SAML or OIDC
- [Billing](billing) — seat limits and plan upgrades
