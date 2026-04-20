---
title: 'Recordings library'
description: 'Browse, filter, share, and manage recordings in the Tribora library. Covers retention defaults and sharing controls.'
audience: public
section: product
order: 10
tags: [recordings, library, sharing, retention]
related: ['getting-started/record-your-first-workflow', 'product/wiki', 'reference/limits-and-quotas']
---

## The library

The *Library* is the central view for all recordings your account has access to. It shows recordings captured by you, shared with you by colleagues, and (for org admins) all recordings within the organization.

Each entry in the library displays:
- Recording title and optional description.
- Captured-by user and capture date.
- Duration and processing status.
- Tags applied during or after capture.

## Filtering recordings

Use the filter controls at the top of the Library to narrow the list:

- **Owner** — filter by the user who captured the recording.
- **Date range** — show recordings captured within a specific period.
- **Status** — show only Ready, Processing, Review required, or Failed recordings.
- **Tags** — filter by one or more tags.
- **Search** — full-text match against recording titles and descriptions.

Filters combine with AND logic. You can save frequently-used filter combinations as *views* if your organization has that feature enabled.

## Sharing a recording

Recordings are private to the capturing user by default. To share:

1. Open the recording detail page.
2. Click **Share** in the top-right action bar.
3. Choose one of the sharing modes:
   - **Team** — all members of your organization can view the recording and its knowledge article.
   - **Link** — generates a time-limited URL valid for 7 days. The recipient does not need a Tribora account.
   - **Specific users** — share with named organization members by email address.

Shared recordings are read-only for recipients. Only the owner or an org admin can delete or retitle a shared recording.

## Retention

Recordings are retained for **90 days** from the capture date under the default plan. After 90 days, the raw recording file is deleted from storage; the associated knowledge article and wiki content are retained indefinitely unless explicitly deleted.

Higher retention tiers (180 days, 1 year, unlimited) are available on paid plans. Current retention settings for your organization are shown in *Settings → Storage*. See [Limits and quotas](/docs/reference/limits-and-quotas) for the complete retention table.

## Deleting a recording

Deleting a recording removes the recording file and the associated knowledge article from the corpus and from search. This action cannot be undone.

To delete: open the recording detail page, click **More actions (...)**, then **Delete**. You will be asked to confirm.

If the recording has been referenced in a wiki article, those references will show a "source removed" indicator after deletion.

## Exporting

Recording files (MP4) can be downloaded from the recording detail page while they are within the retention window. Knowledge articles can be exported as Markdown from the wiki. Bulk export for organizations is available via the API.
