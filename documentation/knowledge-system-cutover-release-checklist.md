# Knowledge Cutover Release Checklist

This checklist is for the final rollout from mixed legacy knowledge behavior to
the compiled-memory-first operating model.

See also: [Knowledge Reviewer Playbook](./knowledge-system-reviewer-playbook.md)

## Launch Rule

Do not call the knowledge-system cutover complete just because individual PRs
merged cleanly. The release is only ready when the operator workflow, answer
workflow, and rollback workflow all work together.

## Prerequisites

Before launch sign-off, confirm these capabilities are actually shipped:

- shared compiled-memory resolution is in place for non-extension surfaces
- dashboard chat uses compiled memory as its default answer layer
- raw evidence remains available only as explicit discovery/audit behavior
- source lifecycle statuses and knowledge statuses are consistent enough for operators to trust
- wiki contradiction review works end-to-end
- org-level contradiction routing settings exist and are understandable

If any of the above is still missing, the correct move is to delay the cutover,
not to document around the gap.

## Pre-Launch Checklist

- [ ] Read and circulate the reviewer playbook
- [ ] Confirm who owns launch-day review coverage
- [ ] Confirm who can change org agent settings and who can access `/admin/wiki-review`
- [ ] Confirm the rollout orgs and any orgs that should stay manual-only

## Configuration Checklist

- [ ] Open `/settings/organization/agents`
- [ ] Confirm contradiction routing mode for each rollout org
- [ ] If using hybrid mode, confirm the contradiction-count and confidence-delta thresholds
- [ ] Confirm risky agent actions still require approval where appropriate
- [ ] Confirm there is no stale hybrid configuration left active after switching back to manual mode

## Content and Data Checklist

- [ ] Confirm representative vendor baselines exist for the rollout apps/screens
- [ ] Confirm at least one org knowledge page is available in each target workflow area
- [ ] Confirm `Vendor Only` areas are understood and are not being treated as finished org coverage
- [ ] Confirm there is no unusual backlog of `Processing` or `Needs Review` items before launch

## Reviewer Workflow Checklist

- [ ] Open `/admin/wiki-review` and confirm the queue loads correctly
- [ ] Approve a safe contradiction and confirm the old row is superseded
- [ ] Reject a contradiction and confirm the live page remains unchanged
- [ ] Use edit-and-approve on a sample item and confirm the edited body becomes the live row
- [ ] Confirm the audit trail is preserved after each action

## Answer Quality Checklist

- [ ] Ask a dashboard chat question that should resolve from compiled memory
- [ ] Confirm the answer uses citations and does not invent unsupported details
- [ ] Confirm org knowledge overrides vendor knowledge where expected
- [ ] Confirm discovery/raw evidence is still explicit and not presented as the canonical answer layer
- [ ] Re-ask a question after a reviewed contradiction to confirm the live answer updates

## Health and Monitoring Checklist

- [ ] Open `/knowledge/health` and confirm pending contradiction counts look reasonable
- [ ] Confirm operators know what queue growth rate counts as an incident
- [ ] Confirm telemetry/logging for routing and review outcomes is visible to the launch team
- [ ] Confirm someone is assigned to watch rollout health during the first release window

## Launch-Day Stop Conditions

Pause the cutover if any of the following is true:

- review volume spikes beyond reviewer capacity
- auto-applied changes cannot be explained from the configured routing policy
- compiled-memory answers lose citations or start behaving like raw retrieval
- contradictory updates cluster around the same page or workflow
- vendor baselines are being shown as if they were approved org knowledge

## Rollback Checklist

If launch quality drops, use this order of operations:

- [ ] Switch contradiction routing to `Manual review`
- [ ] Stop any broad rollout communication that implies the cutover is complete
- [ ] Keep raw discovery available for audit, but do not treat it as canonical
- [ ] Clear or stabilize the pending review queue before re-enabling hybrid or auto behavior
- [ ] Document the failure mode and the exact threshold/configuration that triggered it

## Final Sign-Off

All of the following should be true before marking the cutover complete:

- [ ] Reviewer workflow is understood and staffed
- [ ] Compiled-memory answers behave correctly in real product flows
- [ ] Contradiction review, rejection, and edit-and-approve all work end-to-end
- [ ] Operators can explain the current routing policy without reading implementation code
- [ ] Rollback steps have been rehearsed or explicitly validated
