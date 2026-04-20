# Zendesk: Onboarding a New Support Agent

## Summary
Step-by-step process for configuring Zendesk access when a new tier-1 support agent joins the team. Covers account creation, group assignment, view configuration, macro setup, and Talk voice enablement.

## Steps

1. **Account setup** — In Settings > People > Team members, click Add team member. Assign role **Agent** (not Light agent). Add to the **Tier 1** group.

2. **Default view** — Set the default ticket view to *Unsolved tickets in my groups* so the agent's queue is populated from day one.

3. **Pin views** — Go to Views and pin *Your unsolved tickets* and *Recently updated* to the sidebar. Also add *Group: Tier 1 unassigned* as the work queue pull view.

4. **Macros** — Assign the three core tier-1 macros: `greeting-initial`, `info-requested`, `closing-resolved`. Walk through macro application in the ticket compose toolbar.

5. **Self-test** — Have the agent send a test ticket to themselves on day one to surface permission gaps early.

6. **Talk voice** — Enable Talk per-agent under Channels > Talk. Without this toggle, calls will not route to the new hire.

7. **Checklist** — Document all steps in the agent's onboarding checklist for HR audit trail.

## References
- Zendesk Admin Center: Settings > People
- Internal onboarding checklist (Confluence)
- Talk setup recording: `onboarding-zendesk-06`
