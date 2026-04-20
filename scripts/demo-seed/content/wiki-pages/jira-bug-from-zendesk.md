# Jira: Creating a Bug from a Zendesk Escalation

## Summary
How to create a Jira bug ticket from inside a Zendesk ticket without switching tabs. Covers required fields, mandatory labels, and the auto-linking behavior of the Rovo integration.

## Steps

1. **Open the Jira panel** — In the Zendesk ticket sidebar, click the Jira panel. If not visible, check App settings and confirm the agent has access.

2. **Create issue** — Click *Create issue*. Select:
   - Project: **SUP**
   - Issue type: **Bug** (not Task or Story)
   - Priority: matches the Zendesk ticket priority

3. **Summary** — Copy the Zendesk ticket subject verbatim.

4. **Description** — Include:
   - Customer's reproduction steps
   - What you already tried
   - Zendesk ticket URL

5. **Labels (mandatory):**
   - `customer-impacting`
   - Product area label (e.g., `payments-integration`, `api-access`)
   - Severity label (e.g., `sev-2-feature-broken`)

6. **Customer Count field** — Enter how many customers you know are affected.

7. **Submit** — Jira pill appears on the Zendesk ticket within ~5 minutes via Rovo auto-link.

## If the Bug Already Exists in Jira

Use *Link to existing issue* instead of creating a new one. Search by Jira issue key. This increments the link count, which drives engineering triage priority.

## References
- Source recording: `integrations-jira-01`
- Jira escalation protocol (imported doc: `jira-escalation-protocol`)
