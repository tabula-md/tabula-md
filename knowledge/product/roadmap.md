---
type: Product Context
title: Roadmap
description: Current Tabula.md priority is product completeness before deeper infrastructure hardening.
tags: [product, roadmap, priority]
---

# Current Decision

Product completeness comes before deeper infrastructure hardening.

Tabula.md already has a working Hocuspocus/Yjs collaboration prototype, signed
room tokens, local persistence, and browser smoke coverage. The next product
risk is whether the Markdown workspace experience feels complete enough to use.

# Current Priority

1. Product shape and UX polish.
2. Neon + Modal phase 1 infrastructure.
3. Future scaling only after product usage creates a concrete need.

# Product Track

- Refine the Markdown workspace surface.
- Improve Write and Preview modes.
- Make tabs and document identity clearer.
- Tighten Share and Live collaboration UX.
- Decide comments, libraries, and version history product shape.

# Infrastructure Track

- Keep Hocuspocus as the collaboration prototype engine for now.
- Add Neon Postgres persistence for phase 1.
- Deploy the collaboration server to Modal as a single-container beta service.
- Keep Redis, R2/S3, E2EE migration, and billing parked until needed.

# Related

- [Phase 1 infrastructure](/architecture/phase-1-infra.md)
- [Launch readiness](/runbooks/launch-readiness.md)
