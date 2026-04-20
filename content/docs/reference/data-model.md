---
title: 'Data model'
description: 'High-level overview of the core Tribora entities — recording, transcript, document, wiki page, org, and role — as seen by users and the API.'
audience: public
section: reference
order: 10
tags: [data-model, entities, api, schema]
related: ['product/recordings', 'product/wiki', 'reference/limits-and-quotas']
---

## Overview

This page describes the core entities in Tribora from the perspective of users and the public API. Internal schema details and database identifiers not exposed in the API are not documented here.

All entities are scoped to an organization. You cannot access entities from another organization through the API or the product UI.

## Recording

A *recording* is the primary input artifact. It represents a single captured session.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique identifier |
| `title` | string | Human-readable label, editable |
| `description` | string | Optional summary, editable |
| `capturedBy` | User ID | The user who made the recording |
| `capturedAt` | ISO datetime | When the recording session started |
| `duration` | integer (seconds) | Session length |
| `status` | enum | One of: `processing`, `ready`, `review_required`, `failed` |
| `visibility` | enum | One of: `private`, `team`, `link` |
| `tags` | string[] | User-applied labels |
| `retainUntil` | ISO date | Date after which the recording file is deleted |

## Transcript

A *transcript* is produced from the audio track of a recording during pipeline processing. It is not directly editable.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique identifier |
| `recordingId` | UUID | Parent recording |
| `language` | string | BCP-47 language code detected |
| `segments` | Segment[] | Time-coded text segments |
| `createdAt` | ISO datetime | When transcription completed |

A transcript is linked 1:1 to its recording. If a recording had no audio, no transcript is created.

## Document

A *document* is the structured artifact produced by the AI structuring step. It is the bridge between a raw transcript and a published wiki page.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique identifier |
| `recordingId` | UUID | Source recording |
| `title` | string | AI-generated or user-edited title |
| `steps` | Step[] | Ordered, numbered step list |
| `confidence` | number (0–1) | Pipeline confidence score |
| `reviewState` | enum | One of: `pending`, `approved`, `rejected` |

Documents in `pending` state appear in the wiki review queue.

## Wiki page

A *wiki page* is a published knowledge article visible in the corpus and searchable by organization members.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique identifier |
| `documentId` | UUID | Source document (if pipeline-generated) |
| `title` | string | Editable article title |
| `body` | Markdown | Full article content |
| `publishedAt` | ISO datetime | When first published |
| `lastEditedAt` | ISO datetime | Most recent edit timestamp |
| `lastEditedBy` | User ID | Most recent editor |
| `tags` | string[] | Applied labels |
| `archived` | boolean | Whether archived (removed from corpus) |

## Organization

An *organization* (org) is the top-level tenant. All other entities belong to exactly one org.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique identifier |
| `name` | string | Display name |
| `slug` | string | URL-safe identifier |
| `plan` | string | Current billing plan |
| `createdAt` | ISO datetime | Org creation time |

## User and role

A *user* is a person with access to one or more organizations.

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique identifier |
| `email` | string | Primary email address |
| `name` | string | Display name |

Within each organization, a user has a *role*. Roles control what actions the user can perform:

| Role | Permissions summary |
|---|---|
| `owner` | Full access including billing and deletion |
| `admin` | Member management, wiki review, org settings |
| `contributor` | Record, share, edit own wiki articles |
| `reader` | View and search published wiki articles |

A user can have different roles in different organizations.
