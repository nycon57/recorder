---
title: Digest configuration
description: Who receives digests, cadence options, scope filters, and how to mute or unsubscribe.
audience: org-admin
section: knowledge-ops
order: 40
related:
  - knowledge-ops/knowledge-gaps
tags:
  - knowledge
  - digest
  - notifications
---

## What the digest is

The Tribora digest is a scheduled email summary that surfaces what your team has captured since the last digest: new recordings, wiki updates, unresolved gaps, and pending review items. It is intended for managers and knowledge-ops owners who want a regular pulse without checking the dashboard daily.

Digest emails are sent from your configured sender domain (or `notifications@tribora.app` if no custom domain is set).

## Configuring digests — `/digest`

Navigate to `/digest` in the admin dashboard to manage digest settings.

### Recipients

By default, all users with `owner` or `admin` roles receive the org-level digest. To add or remove recipients:

1. Click **Manage recipients**.
2. Add by email address. The user must already have an account in your org.
3. To remove a recipient, click the × next to their name.

Individual contributors can subscribe to digests covering their own department. That opt-in is in their personal **Notification settings**, not in the admin digest configuration.

### Cadence

| Cadence | Send time | Default for |
|---|---|---|
| Daily | 7:00 AM in the org's primary timezone | Not default |
| Weekly | Monday 7:00 AM | Default |
| Biweekly | Every other Monday | — |

To change cadence, select from the dropdown and save. The change takes effect on the next scheduled send.

### Scope filters

By default, the digest covers all departments. To narrow it:

1. Under **Scope**, select **Departments**.
2. Check the departments to include.

Department-scoped digests are useful when you have separate digest owners per business unit (e.g., sales ops receives a sales digest; engineering leads receive an engineering digest).

### Content sections

Each digest includes these sections by default. Toggle them off if they are not relevant to your recipients:

| Section | Default | Description |
|---|---|---|
| New recordings | On | Count and highlights from the period |
| Wiki updates | On | Pages changed, additions, and resolutions |
| Pending review items | On | Queue length and oldest item |
| Knowledge gaps | On | Top 3 new gaps by frequency |
| Team activity | Off | Who recorded what (privacy-sensitive — review before enabling) |

## Muting and unsubscribing

**Org admin muting a recipient:** Remove them from the recipient list (above).

**Self-muting:** Users can unsubscribe from the digest by clicking **Unsubscribe** in the email footer. This removes them from the recipient list and they will not receive future digests unless re-added by an admin.

**Temporary pause:** Click **Pause digest** in `/digest` to suspend all sends without losing configuration. Useful during company-wide quiet periods (e.g., end-of-year shutdown). The pause has no end date — re-enable manually.

## Related

- [Acting on knowledge gaps](knowledge-gaps) — the gaps surface that digests surface weekly
