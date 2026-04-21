---
title: Single sign-on
description: Configuring SAML or OIDC-based SSO via Better Auth, provisioning rules, and fallback authentication.
audience: org-admin
section: org-admin
order: 30
related:
  - org-admin/members-and-roles
  - org-admin/billing
tags:
  - org-admin
  - sso
  - saml
  - oidc
---

## Overview

Single sign-on (SSO) lets your team authenticate using your identity provider (IdP) instead of Tribora passwords. Tribora supports SAML 2.0 and OIDC. SSO is available on Business and Enterprise plans.

Once configured, members who visit Tribora are redirected to your IdP for authentication. Successful authentication provisions the member's account automatically on first login.

## Supported identity providers

Tribora has been tested with:

- Okta (SAML 2.0 and OIDC)
- Azure Active Directory (SAML 2.0 and OIDC)
- Google Workspace (OIDC)
- OneLogin (SAML 2.0)
- Any standards-compliant SAML 2.0 or OIDC provider

## Configuring SAML 2.0

### Step 1 — Create an application in your IdP

In your IdP, create a new SAML application with:

- **ACS (Assertion Consumer Service) URL:** `https://<your-domain>/api/auth/sso/saml/callback`
- **Entity ID:** `https://<your-domain>/api/auth/sso/saml/metadata`
- **NameID format:** `emailAddress`

Your IdP will provide an **IdP metadata URL** or XML file. You will need this in Step 2.

### Step 2 — Configure Tribora

1. Go to **Settings → Single Sign-On**.
2. Select **SAML 2.0**.
3. Paste the IdP metadata URL or upload the metadata XML.
4. Click **Validate** to confirm connectivity.
5. Click **Save**.

### Step 3 — Test with a single user

Before enforcing SSO org-wide, click **Test SSO** and authenticate as a non-admin member. Confirm they land on the Tribora dashboard without error.

## Configuring OIDC

1. In your IdP, create an OIDC application with:
   - **Redirect URI:** `https://<your-domain>/api/auth/sso/oidc/callback`
   - **Scopes:** `openid email profile`
2. Copy the **Client ID**, **Client Secret**, and **Issuer URL** from your IdP.
3. In Tribora, go to **Settings → Single Sign-On → OIDC**.
4. Enter the Client ID, Client Secret, and Issuer URL.
5. Click **Validate** and **Save**.

## Provisioning rules

When a user authenticates via SSO for the first time, Tribora provisions their account with:

- **Default role:** Configurable under **Settings → SSO → Default role** (default: `contributor`)
- **Email domain matching:** Only users whose email matches your org's verified domain(s) are provisioned. Email domains are listed under **Settings → Domains**.

Users who authenticate via SSO and whose email does not match a verified domain are rejected with an error message.

## Enforcing SSO

To require SSO for all members (block password login):

1. Go to **Settings → SSO**.
2. Toggle **Enforce SSO**.

Once enforced, members who previously used password authentication will be required to authenticate through SSO on their next login. Existing sessions remain active until they expire (default session duration: 7 days).

**Owner accounts are exempt from SSO enforcement** — at least one owner can always sign in with a password as an emergency fallback. This prevents the org from being locked out if the IdP has an outage.

## Fallback authentication

If your IdP is unavailable:

1. The SSO login page shows a **Use password instead** link (available to owner accounts).
2. Owners sign in with their password and can continue operating the platform.
3. Non-owner members cannot sign in until the IdP recovers.

To configure additional break-glass owner accounts, promote a trusted member to **Owner** before enabling SSO enforcement.

## Related

- [Members and roles](members-and-roles) — role assignment for SSO-provisioned users
- [Billing](billing) — SSO requires Business or Enterprise plan
