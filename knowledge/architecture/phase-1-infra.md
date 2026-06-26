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

The official hosted `tabula.md` service is not a third public product repo. It
is the managed deployment of these two open-source components. Hosted provider
choices, production credentials, and private operational automation belong
outside the public repositories unless and until a private `tabula-cloud`
operations repo is created.

The public `tabula-room` server is the source of truth for both self-hosted and
official hosted live collaboration in v0. The official hosted service should
deploy `tabula-room` with production configuration, not fork a second room
runtime in private code. Private operations code may wrap deployment,
environment, DNS, monitoring, and rollback, but it should not redefine the room
protocol or persistence behavior.

# Persistence Direction

- Keep Markdown content and room keys client-only.
- Persist only encrypted snapshot envelopes in `tabula-room`.
- Start with file storage for the open-source server.
- Use the same encrypted snapshot storage behavior in the hosted deployment,
  mounted on provider-managed persistent disk.

# Deployment Direction

- Deploy the web app with `VITE_TABULA_ROOM_URL` pointing at the selected Room
  server.
- Do not rely on the local room fallback outside development. Production and
  self-hosted builds without `VITE_TABULA_ROOM_URL` should leave Start session
  unavailable until a room server is configured.
- Keep the public `tabula-room` Node server self-hostable with allowed origins,
  payload limits, rate limits, and encrypted snapshot storage.
- Keep hosted provider-specific deployment configuration in private operations
  code. The hosted room service should still run the public `tabula-room`
  server.
- Keep accounts, billing, audit logs, and multi-tenant permission systems out
  of the public v0.

# Parked

- Redis-backed horizontal scaling for the OSS Node runtime.
- R2/S3 or database-backed encrypted snapshot storage for the OSS Node runtime.
- Full membership and permission service.
- Authenticated private publishing.
- Billing and plan limits.

# Related

- [OSS and hosted service boundary](oss-hosted-boundary.md)
- [Roadmap](/product/roadmap.md)
- [Launch readiness](/runbooks/launch-readiness.md)
- [E2EE collaboration model](e2ee-collaboration.md)
- [Tabula Room](/repo/tabula-room.md)
