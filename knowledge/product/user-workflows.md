---
type: Product Context
title: User workflows
description: Primary Tabula.md user flows for first visit, writing, sharing, publishing, copying, failure recovery, and comments.
tags: [product, workflows, ux]
---

# Workflows

Tabula.md should optimize these flows before broad workspace or account
features.

# First Visit

The user should immediately understand that Tabula.md is a Markdown workspace,
not a landing page. The first screen should be a real Markdown document preview,
with a blank writing document available.

# Writing And Preview

The user writes Markdown in Write mode, switches to Split or Preview, and sees
frontmatter as quiet metadata in Preview. Preview typography should feel close
to the editor scale and serious enough for product, design, operations, and
codebase context.

# Markdown Starting Points

Libraries and new document flows should feel like Markdown starting points for
agent instructions, product context, design notes, runbooks, and decisions, not
a heavy template gallery.

# Live Collaboration

Live collaboration starts from the top-right Live action and creates
`/r/:roomId#key=...`. The user should understand whether a document is local,
connecting, live, reconnecting, offline, or token-failed.

# Publish

Publish creates a public read-only page, separate from the live room. The human
URL is `/p/:publishId`; AI-readable outputs are included automatically at
`/p/:publishId/llms.txt` and `/p/:publishId/llms-full.txt`. Updating the
published page keeps the same publish URL and changes the public page only when
the user explicitly updates it.

# Copy And AI Context

The current document should have an obvious raw Markdown copy path. Room-wide
AI context belongs as included Publish outputs, not in a separate heavy panel or
as the primary reason to publish.

# Failure Recovery

Token expiry, server disconnects, missing rooms, and persistence failures should
show clear states and preserve local text. Avoid vague errors and never
silently discard edits.

# Comments

Comments should support document review without becoming a separate chat
product. They are scoped to a document and should show the selected quote or a
recoverable anchor.

# Related

- [Product positioning](positioning.md)
- [Collaboration security](/architecture/collaboration-security.md)
