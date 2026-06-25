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

Production and self-hosted `tabula-md` builds require `VITE_TABULA_ROOM_URL` for
Start session. Local development may use the dev fallback at port `3002`, but
production builds must not silently point live collaboration at localhost.

# Boundaries

- The server sees `roomId`, connection membership, ciphertext envelopes, IVs,
  versions, and timestamps.
- The server must not receive `roomKey` or plaintext Markdown.
- The client keeps Yjs merge behavior and encrypts updates before relay or
  snapshot storage.
- Local development expects a sibling checkout at `../tabula-room` unless
  `TABULA_ROOM_REPO_DIR` or `VITE_TABULA_ROOM_URL` points elsewhere.
- Hosted deployments should configure allowed origins, payload limits, rate
  limits, TLS, and encrypted snapshot storage or an explicit relay-only policy.

# Related

- [Collaboration security](/architecture/collaboration-security.md)
- [Share Start session contract](/architecture/share-start-session-contract.md)
- [E2EE collaboration model](/architecture/e2ee-collaboration.md)
- [Web app](web-app.md)
