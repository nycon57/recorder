---
title: 'Security'
description: 'Authentication mechanisms, session lifecycle, and Tribora security posture. Only verifiable claims are stated here.'
audience: public
section: policies
order: 20
tags: [security, authentication, session, access-control]
related: ['policies/privacy', 'reference/data-model']
---

## Authentication

Tribora uses **Better Auth** as its authentication layer. The following authentication methods are supported:

- **Email and password** — accounts are protected by bcrypt-hashed passwords. Minimum password length is enforced at 8 characters; we recommend a password manager for stronger credentials.
- **Magic link** — passwordless email-based login. A time-limited link is delivered to your email address; the link expires after 10 minutes.
- **SSO / SAML** — organization-level SSO is available on Enterprise plans. When SSO is configured, all members are required to authenticate through the identity provider.

Multi-factor authentication (MFA) via TOTP (time-based one-time password) is supported and can be enforced at the organization level by an org admin.

## Session lifecycle

- Sessions are issued as signed JWTs with a default expiry of **7 days**.
- Session tokens are stored in browser-local storage by the extension and in HTTP-only cookies by the web application.
- Sessions are invalidated immediately on explicit sign-out.
- Org admins can revoke individual sessions for members of their organization from *Settings → Members → Sessions*.
- System administrators can revoke any session in response to a security incident.

## API keys

API keys are issued per organization and scoped to the permissions granted at creation. Keys are displayed once at creation time; Tribora does not store the plaintext key. If a key is lost, a new one must be issued and the old one revoked.

API keys should be treated as secrets. Do not embed them in client-side code or commit them to version control.

## Transport security

All communication between clients (browser, extension, SDK) and Tribora's API is conducted over HTTPS. TLS 1.2 is the minimum accepted version; TLS 1.3 is negotiated where supported.

HTTP requests to Tribora's endpoints are redirected to HTTPS. There is no option to communicate over unencrypted HTTP in production.

## Organization isolation

Tribora's data model is multi-tenant. All database queries and API endpoints enforce organization-scoped access. A request authenticated as a member of organization A cannot return data belonging to organization B, regardless of the queried resource identifiers.

## Vulnerability disclosure

To report a security vulnerability in Tribora, email `security@tribora.com`. We request that you follow responsible disclosure practices and allow 90 days for remediation before public disclosure.

## What this page does not claim

This page states only security properties that are implemented and verifiable from the codebase or public documentation. Claims about SOC 2 Type II, ISO 27001, HIPAA, or other certifications will be added to this page if and when those certifications are obtained. If you require evidence of a specific certification for vendor evaluation, contact `security@tribora.com`.
