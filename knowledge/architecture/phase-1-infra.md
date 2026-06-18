---
type: Architecture Context
title: Phase 1 infrastructure
description: Phase 1 beta infrastructure uses Hocuspocus, Neon Postgres, and Modal single-container deployment.
tags: [architecture, infrastructure, beta]
---

# Current Scope

Phase 1 infrastructure is Hocuspocus + Neon Postgres + Modal single-container
beta deployment.

Local file persistence remains the default development mode. Production beta
uses Postgres persistence.

# Persistence Direction

- Add `COLLAB_PERSISTENCE=file|postgres` with `file` as the local default.
- Keep Hocuspocus server logic independent from the storage adapter.
- Use Neon for room state, snapshots, and later publish persistence after the
  product flow is validated.

# Deployment Direction

- Deploy the collaboration server to Modal as a single-container beta service.
- Keep `max_containers=1` while Hocuspocus room state is in-process.
- Configure `COLLAB_ALLOWED_ORIGINS`, `COLLAB_TOKEN_SECRET`, and
  `DATABASE_URL` for beta.

# Parked

- R2/S3 for large Yjs blobs or snapshots.
- Redis-backed Hocuspocus horizontal scaling.
- Multi-container Modal scaling.
- Full audit logs, memberships, permissions, billing, and plan limits.
- Optional URL-key E2EE persistence migration.

# Related

- [Roadmap](/product/roadmap.md)
- [Launch readiness](/runbooks/launch-readiness.md)
- [E2EE collaboration model](e2ee-collaboration.md)
