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

Live collaboration starts from `Share > Collaborate > Start session` and
creates `/r/:roomId#key=...` for the active Markdown file. The user should
understand whether the file is local, connecting, live, reconnecting, offline,
or unable to decrypt.

Start session is not Publish. It creates an editable live room; Publish creates
a durable read-only snapshot.

# Publish

Publish creates a public read-only page, separate from the live room. The human
URL is `/p/:publishId`. The user chooses whether to publish the current page or
the full project before publishing. AI-readable outputs are included
automatically at `/p/:publishId/llms.txt` and
`/p/:publishId/llms-full.txt`, but those endpoints should stay hidden from the
human published page UI. Updating the published page keeps the same publish URL
and changes the public page only when the user explicitly updates it. After a
page is published, Share > Publish should act as a management view; changing
between current-page and project publish is a separate explicit republish
action. Project publish should use restrained contents navigation, not a file
chip list above the document body.

# Copy And AI Context

The current document should have an obvious raw Markdown copy path. AI-readable
context belongs as hidden included Publish outputs, not in a separate heavy
panel or as the primary reason to publish.

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
- [Share Start session contract](/architecture/share-start-session-contract.md)
- [Collaboration security](/architecture/collaboration-security.md)
