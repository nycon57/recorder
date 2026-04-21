---
title: Departments
description: Creating departments, assigning members, and how departments scope knowledge routing and notifications.
audience: org-admin
section: org-admin
order: 20
related:
  - org-admin/members-and-roles
  - knowledge-ops/onboarding-plans
  - knowledge-ops/digest-configuration
tags:
  - org-admin
  - departments
---

## What departments do

Departments group members by team or function. Tribora uses department membership to:

- Scope knowledge routing — AI assistant answers are weighted toward the member's department context
- Scope digest subscriptions — department-level digests cover recordings and wiki changes relevant to that department
- Drive onboarding plans — new members added to a department are automatically enrolled in plans targeted at that department
- Filter recording views — members can filter the library to their department's recordings

Departments are optional. Organizations without departments route all knowledge globally.

## Creating a department

1. Go to **Settings → Departments**.
2. Click **New department**.
3. Enter a **Name** (e.g., "Customer Success") and optional **Description**.
4. Click **Save**.

## Assigning members

After creating the department:

1. Click the department name to open its detail page.
2. Click **Add members**.
3. Search for members by name or email and select them.
4. Confirm. Members can belong to multiple departments.

Alternatively, bulk-assign from the Members list: select multiple members, click **Assign to department**, and choose the target department.

## Setting a department manager

Each department can have one designated manager. The manager:

- Receives escalation notifications for the department's wiki review queue
- Appears as the default assignee for knowledge gaps related to department topics
- Is shown as the department contact in the directory

To set a manager, open the department detail and click **Set manager**, then select a member who has the **Admin** or **Owner** role.

## Department-scoped knowledge routing

When a member asks the AI assistant a question, the assistant weights results from recordings and wiki pages associated with the member's departments. If a member belongs to both "Engineering" and "Product," results from both department corpora are blended.

Members with no department assignment receive a global result set (all departments visible to them).

## Removing a department

1. Open the department detail page.
2. Click **Settings → Delete department**.
3. Confirm.

Deleting a department does not delete members or recordings — it only removes the grouping. Members are automatically unassigned. Existing onboarding plan assignments are preserved until they expire or are completed.

## Related

- [Members and roles](members-and-roles) — role permissions apply org-wide, not per-department
- [Onboarding plans](../knowledge-ops/onboarding-plans) — auto-enroll new members based on department
- [Digest configuration](../knowledge-ops/digest-configuration) — department-scoped digest subscriptions
