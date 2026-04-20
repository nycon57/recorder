# Zendesk Talk: Voice Integration Setup

## Summary
Per-agent configuration for Zendesk Talk voice support. Covers number assignment, voicemail recording, availability management, and wrap-up time policy.

## Setup Checklist (per new agent)

- [ ] Add agent to routing group: Channels > Talk > Numbers > [routing group]
- [ ] Agent records personal voicemail greeting (not the default company greeting)
- [ ] Agent confirms availability toggle behavior — must go unavailable during lunch and meetings
- [ ] Confirm wrap-up time is set to 60 seconds

## Availability Policy

Agents must toggle **Unavailable** when:
- Lunch or scheduled breaks
- Internal meetings
- Focus time blocks

Leaving availability on during off-coverage periods causes unanswered calls to route to the agent. We've had 3 customer complaints this quarter from this issue.

## Wrap-up Time

After each call, agents have **60 seconds** of wrap-up time to add notes before re-entering the queue. This is mandatory — call notes are the primary continuity mechanism for callbacks.

## Troubleshooting

If an agent is not receiving calls after setup, check:
1. Agent is in the correct routing group (Channels > Talk > Numbers)
2. Availability is set to **Online** (not Offline or Away)
3. Browser audio permissions are granted for the Zendesk domain

## References
- Source recording: `onboarding-zendesk-06`
- Zendesk Talk admin guide (imported doc: `zendesk-admin-guide`)
