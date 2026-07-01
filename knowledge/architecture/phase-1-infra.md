---
type: Architecture Context
title: Phase 1 infrastructure
description: Phase 1 beta infrastructure uses the Tabula.md app, a relay-only Tabula Room server, Firebase live recovery, and Tabula JSON snapshots.
tags: [architecture, infrastructure, beta]
---

# Current Scope

Phase 1 infrastructure has three public repositories plus one hosted provider:

- `tabula-md`: the Tabula app and Markdown workspace.
- `tabula-room`: the encrypted collaboration room relay.
- `tabula-json`: the encrypted immutable Snapshot link store.
- Firebase Firestore: the hosted live-room recovery provider.

The official hosted `tabula.md` service is not a fourth public product repo. It
is the managed deployment of these open-source components plus Firebase
recovery configuration. Hosted provider choices, production credentials, and
private operational automation belong
outside the public repositories unless and until a private `tabula-cloud`
operations repo is created.

The public `tabula-room` server is the source of truth for both self-hosted and
official hosted realtime relay in v0. The official hosted service should deploy
`tabula-room` with production configuration, not fork a second room runtime in
private code. Private operations code may wrap deployment, environment, DNS,
monitoring, Firebase rules, and rollback, but it should not redefine the room
protocol.

# Persistence Direction

- Keep Markdown content and room keys client-only.
- Keep `tabula-room` relay-only. It does not store room recovery snapshots.
- Persist live-room recovery state as encrypted Firestore documents through
  `tabula-app/data/firebase.ts`.
- Persist Snapshot link blobs only in `tabula-json`.

# Deployment Direction

- Deploy the Tabula app with `VITE_TABULA_ROOM_URL` pointing at the selected Room
  relay.
- Deploy the Tabula app with `VITE_TABULA_JSON_URL` pointing at the selected
  JSON snapshot store.
- Deploy the Tabula app with `VITE_TABULA_FIREBASE_CONFIG` when durable live
  recovery is enabled.
- Do not rely on the local room fallback outside development. Production and
  self-hosted builds without `VITE_TABULA_ROOM_URL` should leave Start session
  unavailable until a room server is configured.
- Keep the public `tabula-room` Node server self-hostable with allowed origins,
  payload limits, rate limits, health checks, peer join events, and volatile
  message relay.
- Keep hosted provider-specific deployment configuration in private operations
  code. The hosted room service should still run the public `tabula-room`
  server.
- Keep accounts, billing, audit logs, and multi-tenant permission systems out
  of the public v0.

# Parked

- Redis-backed horizontal scaling for the OSS Node runtime.
- Non-Firebase `RoomRecoveryStore` providers for self-hosters.
- Full membership and permission service.
- Authenticated private publishing.
- Billing and plan limits.

# Related

- [OSS and hosted service boundary](oss-hosted-boundary.md)
- [Roadmap](/product/roadmap.md)
- [Launch readiness](/runbooks/launch-readiness.md)
- [E2EE collaboration model](e2ee-collaboration.md)
- [Tabula Room](/repo/tabula-room.md)
