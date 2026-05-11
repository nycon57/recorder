---
title: Extension release gate
description: Release confidence checklist for the Clicky-style browser extension and extension API contract.
audience: system-admin
section: platform-runbooks
order: 30
related:
  - platform-runbooks/deployment-lifecycle
  - platform-runbooks/incident-response
tags:
  - runbook
  - extension
  - release
---

# Extension Release Gate

Use this gate before treating the Clicky-style extension arm as production-ready.
It is a release confidence check, not a container for fixing every underlying
runtime issue.

## Command

```bash
npm run verify:extension-release
```

The command runs focused extension and extension API contract tests, then builds
the browser extension package.

## Required Evidence

| Concern | Gate evidence |
| --- | --- |
| Off state sends no page context or debug telemetry | `page-context-payload.test.ts`, `telemetry.test.ts`, `debug-events/route.test.ts` |
| Auth callback spoof attempts fail | `auth-callback.test.ts` |
| API-key extension query works where intended | `extension/query/route.test.ts` |
| Mutating tools block or confirm risky actions and sensitive fields | `action-safety-policy.test.ts`, `action-confirmation.test.ts`, `action-verification.test.ts` |
| Chrome voice uses the intended knowledge/tool routing contract | `voice-agent-policy.test.ts`, `voice-tool-routing.test.ts`, `live-context/route.test.ts` |
| `interactiveElements` and element references survive into extension recall | `context-engine-dom-first.test.ts`, `context-knowledge-provenance.test.ts`, `extension/query/route.test.ts` |
| Debug/product telemetry is redacted, schema-validated, and durable enough for analytics | `telemetry.test.ts`, `debug-events/route.test.ts` |
| Extension package builds | `npm run build:extension` |

## Reviewer Checklist

- Verify the gate command passes on the release candidate branch.
- Link any skipped or quarantined test to an open blocking issue.
- Ensure failures are fixed in the owning remediation issue, not hidden in this gate.
- Validate extension build output is generated from the same commit being reviewed.
- Document known limitations remaining after the gate in the release notes.

## Not Covered

This gate does not prove live third-party voice, browser-store submission, or
production telemetry ingestion. Those checks need environment credentials and
should be attached as manual release evidence when available.
