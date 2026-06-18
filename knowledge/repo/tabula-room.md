---
type: Repository Area
title: Tabula Room
description: Separate encrypted collaboration room server for Tabula.md live sessions.
resource: https://github.com/tabula-md/tabula-room
tags: [repo, collaboration, room, e2ee]
---

# Scope

`tabula-room` is a separate open-source repository for live collaboration
transport and encrypted snapshot storage.

It is not part of this `tabula-md` workspace. The web app talks to it through
`VITE_TABULA_ROOM_URL`.

# Boundaries

- The server sees `roomId`, connection membership, ciphertext envelopes, IVs,
  versions, and timestamps.
- The server must not receive `roomKey` or plaintext Markdown.
- The client keeps Yjs merge behavior and encrypts updates before relay or
  snapshot storage.
- Local development expects a sibling checkout at `../tabula-room` unless
  `TABULA_ROOM_REPO_DIR` or `VITE_TABULA_ROOM_URL` points elsewhere.

# Related

- [Collaboration security](/architecture/collaboration-security.md)
- [E2EE collaboration model](/architecture/e2ee-collaboration.md)
- [Web app](web-app.md)
