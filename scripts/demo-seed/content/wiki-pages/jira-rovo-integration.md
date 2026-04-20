# Jira: Rovo Integration for Support Knowledge Search

## Summary
Atlassian Rovo AI integration enabling natural-language Confluence search from inside Zendesk tickets. Saves ~25 minutes per agent per day versus manual tab-switching.

## What Rovo Does

Rovo searches Confluence documentation from the Jira panel sidebar in Zendesk. Type a question in natural language; it returns relevant sections from internal KB articles and procedures.

**Scope:** Searches our workspace's Confluence only — agents won't see other organizations' data.

**Limitation:** Rovo searches Confluence, not Zendesk macros or internal notes. For macro search, use Zendesk's native macro search.

## Per-Agent Setup

1. In the Zendesk Jira panel, click the **Rovo** tab.
2. Click **Authenticate with Atlassian** — uses company SSO (same credentials as Jira).
3. Once authenticated, search queries auto-scope to the company workspace.

## Troubleshooting

**"Authentication required" persists after login:** Clear browser cookies for atlassian.com and retry. If it persists, check that the agent's SSO account has Confluence access in the Atlassian admin portal.

**Results don't include recent Confluence updates:** Rovo's index typically updates within 24 hours. For brand-new pages, check Confluence directly.

## Future: Tribora Integration

The team is evaluating connecting Rovo to the Tribora knowledge base, which would make recorded training content (transcripts, wiki pages) searchable from within Zendesk tickets.

## References
- Source recording: `integrations-jira-05`
