---
type: Architecture Context
title: Phase 1 infrastructure
description: Phase 1 beta infrastructure uses the Tabula.md web app plus a separate encrypted Tabula Room server.
tags: [architecture, infrastructure, beta]
---

# Current Scope

Phase 1 infrastructure has two public repositories:

- `tabula-md`: the web app and Markdown workspace.
- `tabula-room`: the encrypted collaboration room server.

The first public collaboration server uses local file-backed encrypted
snapshots through `TABULA_ROOM_DATA_DIR`. Production hosting and managed
storage can follow once the public split is stable.

# Persistence Direction

- Keep Markdown content and room keys client-only.
- Persist only encrypted snapshot envelopes in `tabula-room`.
- Start with file storage for the open-source server.
- Add managed storage later behind the same ciphertext-only envelope contract.

# Deployment Direction

- Deploy the web app with `VITE_TABULA_ROOM_URL` pointing at the selected Room
  server.
- Do not rely on the local room fallback outside development. Production and
  self-hosted builds without `VITE_TABULA_ROOM_URL` should leave Start session
  unavailable until a room server is configured.
- Deploy `tabula-room` as a small Node service with allowed origins, payload
  limits, rate limits, and persistent encrypted snapshot storage.
- Keep accounts, billing, audit logs, Redis, and multi-region scaling out of
  the public v0.

# Parked

- Redis-backed horizontal scaling.
- R2/S3 or database-backed encrypted snapshot storage.
- Full membership and permission service.
- Authenticated private publishing.
- Billing and plan limits.

# Related

- [Roadmap](/product/roadmap.md)
- [Launch readiness](/runbooks/launch-readiness.md)
- [E2EE collaboration model](e2ee-collaboration.md)
- [Tabula Room](/repo/tabula-room.md)
