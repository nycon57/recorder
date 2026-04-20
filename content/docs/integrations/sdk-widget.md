---
title: 'SDK widget'
description: 'Overview of the embeddable Tribora recorder SDK widget: what it is, who it is for, and how it differs from the Chrome extension.'
audience: public
section: integrations
order: 20
tags: [sdk, widget, embed, recorder]
related: ['integrations/browser-extension', 'reference/data-model']
---

## What the SDK widget is

The *SDK widget* is an embeddable recorder that can be added to any web application without requiring users to install a browser extension. It runs inside your application's page as a JavaScript module and exposes the same recording controls available in the extension.

The SDK widget is designed for product teams that want to offer Tribora-powered workflow capture as a native capability inside their own application — particularly for SaaS products that want to let their customers capture support workflows or onboarding sessions within the product UI.

## Who it is for

The SDK widget is most appropriate when:

- Your users are unlikely to install a separate browser extension.
- You want capture controls embedded directly in your application's UI rather than in the browser toolbar.
- You are building a white-label or embedded knowledge solution on top of Tribora's platform.

For individual users capturing their own workflows, the [browser extension](/docs/integrations/browser-extension) is simpler to set up and requires no changes to your application.

## How it differs from the extension

| | Browser extension | SDK widget |
|---|---|---|
| **Installation** | User installs from Chrome Web Store | Developer embeds in the application |
| **Browser support** | Chrome only | Any modern browser |
| **Capture scope** | Current tab or full screen | Application window (iframe or same-origin) |
| **Auth surface** | Extension popup | Host application passes an auth token |
| **Distribution** | User-driven | Developer-controlled |

The underlying pipeline — upload, transcribe, structure, index — is identical for both surfaces. The resulting knowledge articles are indistinguishable by source.

## Authentication

The SDK widget authenticates using a short-lived session token issued by your server-side integration with the Tribora API. You are responsible for passing a valid token to the widget initializer. The widget does not handle user authentication independently.

Token generation, widget initialization parameters, and API reference documentation are covered in the reference section. See [Data model](/docs/reference/data-model) for the entities involved.

## Availability

The SDK widget is available on Team and Enterprise plans. It is not included in the individual plan. Contact your account manager or the Tribora team to enable it for your workspace.
