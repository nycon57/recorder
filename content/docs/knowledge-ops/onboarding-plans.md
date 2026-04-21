---
title: Onboarding plans
description: Building role-based onboarding playlists from existing recordings, using plan templates, assigning plans, and tracking progress.
audience: org-admin
section: knowledge-ops
order: 50
related:
  - knowledge-ops/knowledge-gaps
  - org-admin/departments
tags:
  - knowledge
  - onboarding
---

## What onboarding plans are

An onboarding plan is a curated sequence of recordings (and optionally wiki pages) assigned to a new hire or team member. Plans make existing knowledge reusable: instead of scheduling shadow sessions for every new employee, a manager assigns a plan and the new hire works through it at their own pace.

Plans are managed from `/onboarding` in the admin dashboard.

## Creating a plan

1. Click **New plan**.
2. Set a **Name** (e.g., "Account Executive — 30-day onboarding") and **Target role** (free text; used for discoverability).
3. Add items to the plan:
   - **Search and add recordings** by title, topic, or tag.
   - **Add wiki pages** for context that complements the recordings.
   - Drag to reorder items. The sequence matters — foundational recordings should come first.
4. Set an **Estimated completion time** (in days). This sets the progress expectation shown to assignees.
5. Save as **Draft** or **Active**. Only active plans can be assigned.

## Using plan templates

Templates are pre-built plans for common roles. To use a template:

1. Click **New plan → Start from template**.
2. Select a template (e.g., "Customer success manager," "Software engineer").
3. Review and customize the items — templates pull from your org's recordings, so the content is already relevant to your context.
4. Activate and assign.

Templates are seeded from your org's most-viewed recordings and highest-rated wiki pages. They update automatically as your knowledge base grows.

## Assigning a plan

1. Open the plan and click **Assign**.
2. Select one or more team members. You can also assign to a **department** — all current and future members of the department receive the assignment.
3. Set an optional **due date**.
4. Click **Send assignments**. Assignees receive an email with a link to their plan.

## Tracking progress

The plan detail page shows per-assignee progress:

| Metric | Description |
|---|---|
| Completion % | Items completed / total items |
| Time spent | Total viewing time logged |
| Last activity | When the assignee last engaged with the plan |
| Completed on | Date of final item completion (if done) |

Filter by status (in-progress, completed, not started) to identify assignees who need a nudge.

## Updating a plan

Plans that are already assigned can be updated — new items appear for all assignees with the item marked "new." Removing items does not retroactively remove them from assignees who have already completed them.

If you need to make a breaking change (restructuring the entire sequence), create a new plan version and re-assign rather than modifying in place.

## Related

- [Departments](../org-admin/departments) — department assignments auto-enroll new members in plans targeted at that department
- [Acting on knowledge gaps](knowledge-gaps) — gaps often indicate that onboarding plans are missing a critical topic
