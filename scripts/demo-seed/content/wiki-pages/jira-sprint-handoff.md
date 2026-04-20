# Jira: Sprint Handoff and Support-Engineering Sync

## Summary
Weekly support-engineering sync process and how Jira issue link counts drive sprint prioritization. Understanding this makes support escalations more effective.

## Weekly Sync (Tuesdays, 10am)

**First 15 minutes — Status updates:**
- Which issues moved to Done last week
- Issues needing additional info from support (48-hour window to provide reproduction steps)
- Issues moved to On Hold (>48h without customer reproduction steps)

**Next 15 minutes — New escalations:**
- Any sev-1 or sev-2 issues since last Tuesday
- Engineering lead triages and assigns to sprint or backlog

**Last 15 minutes — Process improvement:**
- One item from support, one from engineering

## How Link Count Drives Priority

Engineering sorts triage by priority, then by Zendesk ticket link count. **10 customers with the same bug linked to one Jira issue = critical. 10 separate Jira issues = 10 low-priority items.**

Always link new Zendesk tickets to existing Jira issues rather than creating duplicates.

## Information Requests

When engineering needs reproduction steps, they assign a sub-task to the Zendesk ticket reporter. Support has **48 hours** to get the information. If unobtainable in 48 hours → Jira moves to On Hold, documented.

## References
- Source recordings: `integrations-jira-02`, `integrations-jira-06`
- Jira escalation protocol (imported doc: `jira-escalation-protocol`)
