---
title: 'Record your first workflow'
description: 'A 5-minute guide to capturing a recording with the Tribora extension and handing it off to the knowledge pipeline.'
audience: public
section: getting-started
order: 30
tags: [extension, capture, workflow, recording]
related: ['getting-started/install-the-extension', 'getting-started/from-recording-to-knowledge', 'product/recordings']
---

## What is workflow capture?

*Workflow capture* is the act of recording a sequence of on-screen steps — navigating an application, completing a task, demonstrating a process — while Tribora tracks what you do. The result is not just a screen recording file: Tribora's pipeline extracts a structured account of the steps you performed and turns it into a searchable knowledge article.

A workflow capture is most useful when you are performing a repeatable process that colleagues might need to reference: onboarding steps, support procedures, configuration walkthroughs, or any task where "watch what I do" is the fastest way to transfer knowledge.

## Before you start

Confirm that:
- The Tribora Chrome extension is installed and you are signed in. See [Install the Chrome extension](/docs/getting-started/install-the-extension).
- You have a workflow in mind. Recordings are more useful when they cover a single coherent task (typical length: 2–15 minutes).
- If you want to capture narration audio, your microphone is connected and allowed in Chrome's site permissions.

## Starting a recording

1. Navigate to the web page or application you want to record.
2. Click the **Tribora icon** in the Chrome toolbar. The recording controls panel opens.
3. Choose your capture mode:
   - **Tab** — records only the current tab (recommended for focused workflows).
   - **Screen** — records the entire screen (use when the workflow spans multiple applications).
4. Toggle **Microphone** on if you want to narrate as you work.
5. Click **Start recording**. A red dot indicator appears in the toolbar to confirm the session is active.

## During the recording

Work through your workflow as you normally would. Tribora captures your on-screen actions in the background.

A few operational notes:
- You can pause and resume using the toolbar controls without losing the session.
- Avoid switching to browser tabs that contain sensitive or unrelated information — everything visible on the captured surface is recorded.
- Concise, deliberate movements produce cleaner knowledge articles than rushed or exploratory sessions.

## Stopping and submitting

1. Click the **Tribora icon** and then **Stop recording**.
2. A short preview panel appears. Add an optional **title** and **description** if you want to label the recording before it enters the pipeline. You can also edit these later.
3. Click **Save and process**. Tribora uploads the session and queues it for AI processing.

The recording now appears in your *Library* with the status **Processing**. Processing time depends on session length; most recordings under 10 minutes complete within 5 minutes.

## What happens next?

After processing completes, the recording status changes to **Ready**. Tribora has:
- Transcribed the audio track.
- Identified on-screen context and structured the session into steps.
- Created a knowledge article in your wiki corpus.
- Indexed the article for search.

See [From recording to knowledge](/docs/getting-started/from-recording-to-knowledge) for a detailed explanation of the pipeline.
