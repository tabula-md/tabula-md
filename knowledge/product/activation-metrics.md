---
type: Product Context
title: Activation metrics
description: Defines early hosted-service activation events without leaking document content, room keys, or OSS privacy boundaries.
tags: [product, metrics, privacy, hosted]
---

# Activation Metrics

Tabula.md should measure whether a new user reaches the product's first useful
moment: writing a Markdown file and safely handing it to another person or a
coding agent.

# Core Activation Events

Track these as product events in the hosted service only:

1. `file_created_or_opened` - a user creates a new Markdown file or opens a
   local Markdown file.
2. `edited_30_seconds` - a user keeps editing for at least 30 seconds.
3. `live_session_started` - a user starts an encrypted live room.
4. `second_user_joined_session` - another browser joins the live room.
5. `shareable_link_exported` - a user exports an encrypted copy link.
6. `shareable_link_loaded` - a browser loads a `#json` encrypted copy link.
7. `returned_within_7_days` - the same anonymous browser returns within seven
   days.

# Privacy Boundary

Do not collect:

- Markdown text.
- File names.
- Comments.
- URL fragments.
- Room keys.
- Snapshot keys.
- Raw room ids or snapshot ids.
- Collaborator names.
- Clipboard contents.
- Local filesystem paths.

If hosted analytics is added, events should use anonymous, rotating identifiers
and coarse metadata only, such as event type, timestamp bucket, app version,
and whether the event happened in a local file, live room, or imported
snapshot.

# OSS Boundary

Open-source builds must not send hosted analytics by default. Self-hosters
should be able to run the app without Tabula.md receiving telemetry. Hosted
analytics belongs to the managed `tabula.md` deployment configuration, not to
the generic self-host path.

# Launch Use

For early PMF work, the useful funnel is:

1. Visitor opens Tabula.md.
2. Visitor creates or opens Markdown.
3. Visitor edits for 30 seconds.
4. Visitor either starts a live session, exports a shareable link, or copies an
   agent handoff prompt.
5. Visitor or recipient returns within seven days.

# Related

- [Product positioning](positioning.md)
- [User workflows](user-workflows.md)
- [OSS and hosted service boundary](/architecture/oss-hosted-boundary.md)
