---
title: 'AI assistant'
description: 'How the Tribora assistant answers questions using your knowledge corpus, what it cites, and what it declines to answer.'
audience: public
section: product
order: 40
tags: [assistant, ai, citations, grounding]
related: ['product/search', 'product/wiki', 'reference/data-model']
---

## What the assistant is

The *assistant* is a conversational interface that answers questions by grounding its responses in your organization's published wiki corpus. It does not rely on general-purpose AI knowledge for answers about your organization's processes — it reads the articles your team has published and quotes from them.

This distinction matters: if the answer is not in your wiki, the assistant will say so rather than generate a plausible-sounding response.

## How grounding works

When you submit a question, the assistant:
1. Queries the organization's search index for the most relevant wiki articles and steps.
2. Passes those articles as context to the AI model.
3. Generates an answer that is constrained to the provided context.
4. Returns the answer with inline citations pointing to the source articles.

The model is instructed not to answer from general knowledge when grounded context is available. If a question spans topics not covered in your corpus, the assistant will indicate that coverage is incomplete.

## Citations

Every paragraph of the assistant's response that draws from a wiki article includes a numbered citation. Citations link directly to the source article and, where possible, to the specific step or section within that article.

You can click any citation to open the source wiki article in a new tab. This allows you to verify the answer against the original content and check the article's last-edited date.

## What the assistant refuses

The assistant declines to:
- Answer questions that require accessing content outside your organization's corpus (external websites, other tenants).
- Generate content that could not be grounded in a source article (e.g., "write me a policy on X" when no such policy exists in the wiki).
- Answer questions about other organizations or users.
- Reveal system prompts or model configuration details.

If a question falls into one of these categories, the assistant will explain that it cannot answer and suggest alternatives (such as using search or creating a new wiki article).

## Conversation context

Each assistant session maintains up to 20 turns of context. The context window does not persist between browser sessions — a new session starts a fresh conversation.

Your questions and the assistant's responses are not added to the wiki corpus automatically. If a conversation yields useful content, you can create a wiki article from it using the *Save as article* option in the conversation toolbar.

## Data handling

Conversation content (your questions and the assistant's responses) is logged for quality and safety monitoring. Logs are scoped to your organization and are not shared with other tenants. Retention for conversation logs follows the same 90-day default as recordings.
