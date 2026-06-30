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
creates `/#room=<roomId>,<roomKey>` for the active Markdown file. The user should
understand whether the file is local, connecting, live, reconnecting,
disconnected, or failed.

# Snapshot Link

Snapshot link creates `/#json=<snapshotId>,<snapshotKey>` for encrypted
copy/import handoff. It is not a live room and it is not a read-only published
page. Opening a valid snapshot link should use the import/replace flow. Opening
a keyless or malformed snapshot link should stay in the same import failure
flow without adding a separate alarm-style warning surface.

# Future Publish

Publish is outside the v0 Share surface. The current Share modal should only
present Live collaboration and Snapshot link as network share contracts.
Future read-only publish may create a public `/p/:publishId` page and hidden
AI-readable outputs, but that flow must remain isolated from v0 Snapshot link
copy and from Start session.

# Copy And AI Context

The current document should have an obvious raw Markdown copy path. AI-readable
context should not become the primary reason to use the v0 Share surface.

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
