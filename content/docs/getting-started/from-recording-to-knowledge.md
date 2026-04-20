---
title: 'From recording to knowledge'
description: 'How Tribora transforms a raw screen recording into a structured, searchable knowledge article: capture, transcribe, structure, index.'
audience: public
section: getting-started
order: 40
tags: [pipeline, transcription, wiki, ai]
related: ['getting-started/record-your-first-workflow', 'product/wiki', 'product/search']
---

## The four stages

A recording moves through four pipeline stages from the moment you click *Stop recording* to the moment a colleague can find it via search.

### 1. Capture

The extension packages the raw screen recording — video frames, audio track, tab metadata, and timestamp markers — and uploads it to Tribora's processing queue. Files are encrypted in transit (TLS 1.3) and encrypted at rest on Cloudflare R2.

Capture is synchronous from your perspective: once the upload confirms, the recording is in the queue. Your local browser holds no copy.

### 2. Transcribe

Tribora sends the audio track to a speech-to-text service. The transcript is time-coded to the video, meaning every word maps back to a specific moment in the recording.

If you recorded without microphone audio, transcription is skipped. The pipeline still proceeds using on-screen text extraction (OCR) and visual context.

### 3. Structure

The AI structuring step is where the raw transcript and screen context become a *knowledge article*. The model:
- Identifies discrete steps (numbered actions the user performed).
- Extracts application names, page titles, form fields, and UI labels visible on screen.
- Produces a human-readable title and description if none were provided.
- Flags ambiguities or low-confidence segments for the wiki review queue.

The resulting knowledge article is a Markdown document with structured step data, source metadata (recording ID, recorded-by, timestamp), and optional tags.

### 4. Index

After the knowledge article is accepted into the wiki corpus, the search indexer processes it. The article is broken into searchable segments and added to the organization's search index. It becomes retrievable by any user with access within seconds of indexing.

The article also becomes available as grounding material for the AI assistant.

## What the pipeline does not do

- It does not edit or redact sensitive information automatically. If a recording captures passwords or PII, you are responsible for reviewing and managing that content.
- It does not post content to external systems without an integration configured.
- It does not retain audio beyond the processing window. Once the transcript is confirmed, the raw audio is not preserved in the knowledge article.

## Processing time

Most recordings under 10 minutes complete all four stages within 5 minutes of submission. Longer recordings scale roughly linearly. Current job concurrency limits are described in [Limits and quotas](/docs/reference/limits-and-quotas).

## Monitoring status

You can track status in the Library view. Possible states:

| Status | Meaning |
|---|---|
| **Processing** | Job is in one of the four pipeline stages |
| **Ready** | Article is published and searchable |
| **Review required** | Structuring flagged low-confidence content; human review needed |
| **Failed** | Pipeline error; contact support with the recording ID |
