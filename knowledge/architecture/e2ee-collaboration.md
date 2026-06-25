---
type: Architecture Decision Summary
title: E2EE collaboration model
description: Target collaboration model keeps room keys client-only and stores or relays ciphertext only.
tags: [architecture, collaboration, security, e2ee]
---

# Decision

Redesign Tabula.md live collaboration around an Excalidraw-style
end-to-end-encrypted room model.

# Target Model

- The browser generates both `roomId` and `roomKey`.
- Share URLs keep the `/r/:roomId#key=:roomKey` shape.
- `roomId` is public routing metadata.
- `roomKey` is client-only and must never be sent to the server.
- Realtime messages are encrypted in the browser before transmission.
- Room snapshots are encrypted in the browser before storage.
- The server only relays or stores ciphertext, IVs, versions, and timestamps.

# Current Direction

Live collaboration uses the separate `tabula-room` server. The web app keeps
Yjs document merge behavior in the browser and encrypts Yjs updates, presence,
and any recovery snapshots before relay or storage.

Automerge is not the v1 collaboration dependency. It remains a possible future
spike if Yjs cannot satisfy Tabula.md's Markdown source editing and hosted room
contract.

# Consequences

- The server cannot read Markdown content or comments.
- `#key` has real meaning in the product security model.
- Server-side indexing, preview, search, moderation, and agent processing are
  limited.
- Agent handoff must happen through explicit export from decrypted client
  state.

# Related

- [Collaboration security](collaboration-security.md)
- [Share Start session contract](share-start-session-contract.md)
- [Phase 1 infrastructure](phase-1-infra.md)
