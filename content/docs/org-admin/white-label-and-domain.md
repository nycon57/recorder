---
title: White-label and custom domain
description: Brand kit configuration, vendor-admin surfaces, DNS validation, and serving SDK bundles on a custom domain.
audience: org-admin
section: org-admin
order: 60
related:
  - org-admin/billing
tags:
  - org-admin
  - white-label
  - custom-domain
  - sdk
---

## Overview

White-label configuration lets you replace Tribora's default branding with your own. This affects:

- The web app (logo, colors, favicon)
- Email notifications (sender name, logo)
- The embeddable SDK widget (appears as your brand in end-user browsers)
- The custom domain under which the app and SDK are served (Enterprise and Business plans)

White-label settings are under `/vendor-admin/branding` and `/vendor-admin/domain`.

## Brand kit — `/vendor-admin/branding`

### Logo

Upload a logo in SVG or PNG format (recommended: SVG at 200×48 px or wider with transparent background). The logo appears in:

- The top-left of every app page
- Email notification headers
- The SDK widget header

### Colors

Set a **primary color** (hex code). This color is used for:

- Primary buttons and links
- Highlighted navigation items
- Email CTAs

Keep your primary color accessible — the platform enforces a minimum contrast ratio of 4.5:1 against white backgrounds. If the color fails contrast, a warning appears and the default Tribora amber is used as a fallback.

### Favicon

Upload a 32×32 PNG or ICO file. Displays in browser tabs.

## Custom domain — `/vendor-admin/domain`

### Step 1 — Add your domain

1. Navigate to `/vendor-admin/domain`.
2. Enter your domain (e.g., `knowledge.acme.com`).
3. Click **Add domain**.

Tribora generates a DNS challenge record for domain verification.

### Step 2 — Add the DNS record

Add the provided TXT record to your domain's DNS settings. This typically takes 5–30 minutes to propagate.

Example (Cloudflare):

| Type | Name | Value |
|---|---|---|
| TXT | `_tribora-challenge.knowledge.acme.com` | `tribora-verify=<token>` |

### Step 3 — Add the CNAME record

Once the TXT record is verified, add a CNAME:

| Type | Name | Target |
|---|---|---|
| CNAME | `knowledge.acme.com` | `custom.tribora.app` |

### Step 4 — Verify and activate

Click **Verify** in the domain settings. Tribora validates both records and provisions an SSL certificate (via Let's Encrypt). Activation takes up to 5 minutes after verification.

### Custom domain and CORS

Once your custom domain is active, the SDK can be loaded from it: `https://knowledge.acme.com/sdk/recorder.js`. CORS is automatically configured to allow requests from all your org's configured domains.

If you need to allow additional origins (e.g., a third-party SaaS tool that embeds the SDK):

1. Go to `/vendor-admin/domain`.
2. Under **Allowed origins**, add the additional origin.
3. Save.

## SDK bundle serving

The embeddable SDK widget is served from Tribora's CDN by default. When a custom domain is active, you can optionally serve it from your own domain for better brand integration and reduced CSP complexity.

To enable:

1. Activate your custom domain (Step 4 above).
2. Go to `/vendor-admin/domain → SDK bundle`.
3. Toggle **Serve SDK from custom domain**.

Your integration script changes from `https://sdk.tribora.app/...` to `https://knowledge.acme.com/sdk/...`. Update your integration code accordingly.

## Related

- [Billing](billing) — white-label and custom domain require Business or Enterprise plan
