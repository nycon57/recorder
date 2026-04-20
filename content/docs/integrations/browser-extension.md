---
title: 'Browser extension'
description: 'Overview of the Tribora Chrome extension: what it captures, required permissions, and operating limits.'
audience: public
section: integrations
order: 10
tags: [extension, chrome, permissions, capture]
related: ['getting-started/install-the-extension', 'getting-started/record-your-first-workflow']
---

## Overview

The Tribora Chrome extension is the standard capture surface for individual users. It adds a recording panel to Chrome and allows you to capture the current tab or full screen on demand, with optional microphone audio.

The extension communicates directly with the Tribora API to upload sessions and receive processing status updates. It does not require a local server or separate application.

## Supported environments

- **Browser:** Google Chrome, version 116 or later. Chromium-based browsers (Brave, Edge) may work but are not officially tested.
- **Operating system:** macOS, Windows, and Linux (Chrome runs identically on all three for extension purposes).
- **Screen sharing permission:** On macOS, Chrome must be granted Screen Recording permission in *System Settings → Privacy & Security → Screen Recording*.

## Required permissions

| Permission | Purpose |
|---|---|
| `tabs` | Read the active tab's URL and title to annotate recordings |
| `scripting` | Inject the recording overlay UI into the current tab |
| `storage` | Persist your session token across browser restarts |
| `offscreen` | Maintain the audio capture context when the extension popup is closed |
| `microphone` | Capture narration audio during recording sessions |

No permissions beyond those listed above are requested. The extension does not request access to all-sites browsing history, cookies, or credentials.

## Capture modes

**Tab capture:** Records the current tab as a video stream. Audio is taken from the tab (system audio routing in Chrome) plus microphone if enabled. This is the recommended mode for web-based workflows.

**Screen capture:** Records the entire screen. Required for workflows that span native applications (e.g., a process that moves between a browser and a desktop app). On macOS, full-screen capture requires the Screen Recording system permission described above.

## Operating limits

- Maximum single session duration: **4 hours**.
- Maximum upload size per session: **2 GB**.
- Concurrent active sessions per user: **1**. Starting a new session ends any in-progress session.

Exceeding the duration or size limit causes the extension to stop recording and upload what it has captured up to that point. A warning appears in the extension popup when you are within 10 minutes or 200 MB of a limit.

## Offline behavior

The extension stores up to **500 MB** of recording data locally if network connectivity is lost during a session. It will retry upload automatically when connectivity is restored. Local buffer data is cleared after a successful upload.

If the local buffer is full and the network is unavailable, the recording session will terminate and the buffered content up to that point will be submitted when connectivity is restored.

## Updating the extension

Chrome updates extensions automatically when a new version is published to the Web Store. You can check the current installed version at `chrome://extensions → Tribora Recorder → Details → Version`.
