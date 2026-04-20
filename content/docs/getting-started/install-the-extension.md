---
title: 'Install the Chrome extension'
description: 'Add the Tribora recorder extension to Chrome in under two minutes.'
audience: public
section: getting-started
order: 20
tags: [extension, install, chrome]
related: ['getting-started/welcome', 'getting-started/record-your-first-workflow']
---

## Overview

The Tribora browser extension is the primary capture surface for most users. It runs inside Chrome and records your screen, tab audio, and on-screen context during an active session. The extension does not record when you are not in an active session.

**Supported browser:** Google Chrome only (version 116 or later). Firefox and Safari are not currently supported.

## Installation steps

1. Open **Chrome Web Store** and search for "Tribora Recorder," or navigate directly to the install URL provided in your workspace welcome email.
2. Click **Add to Chrome** on the extension listing page.
3. In the confirmation dialog, click **Add extension**. Chrome will show a brief confirmation banner.
4. Pin the extension to your toolbar: click the puzzle-piece icon in the top-right of Chrome, locate *Tribora Recorder*, and click the pin icon.

> **Callout — install URL:**
> Your organization administrator can find the direct Chrome Web Store link at `Settings → Integrations → Browser extension`. Share this link with team members for a one-click install path.

## Required permissions

During install, Chrome requests the following permissions:

| Permission | Reason |
|---|---|
| `tabs` | Identify the active tab when starting a recording |
| `scripting` | Inject the recording overlay into the page |
| `storage` | Store a session token locally so you stay signed in |
| `offscreen` | Maintain an audio capture context when the popup is closed |
| `microphone` | Capture narration audio when mic recording is enabled |

Tribora does not request access to passwords, payment data, or browsing history.

## Sign in after install

After installing, click the Tribora icon in your toolbar. You will be prompted to sign in or connect to your workspace. If your organization uses SSO, you will be redirected to your identity provider.

## Verifying the install

Once signed in, open any web page and click the Tribora toolbar icon. You should see the recording controls panel with a **Start recording** button. If you see an error, check that you are connected to the internet and that your workspace subscription is active.

## Next steps

- [Record your first workflow](/docs/getting-started/record-your-first-workflow)
- [Extension overview and permissions](/docs/integrations/browser-extension)
