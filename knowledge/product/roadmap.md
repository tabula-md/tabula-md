---
type: Product Context
title: Roadmap
description: Current Tabula.md priority is product completeness before deeper infrastructure hardening.
tags: [product, roadmap, priority]
---

# Current Decision

Product completeness comes before deeper infrastructure hardening.

Tabula.md now has a separate `tabula-room` path for encrypted collaboration
relay and snapshots. The next product risk is whether the Markdown workspace
experience feels complete enough to use and publicly explain.

# Current Priority

1. Product shape and UX polish.
2. Public collaboration split: `tabula-md` app plus `tabula-room` server.
3. Future scaling only after product usage creates a concrete need.

# Product Track

- Refine the Markdown workspace surface.
- Improve Write and Preview modes.
- Make tabs and document identity clearer.
- Tighten Share and Live collaboration UX.
- Decide comments, libraries, and version history product shape.

# Infrastructure Track

- Keep `tabula-room` small: relay encrypted envelopes and store encrypted
  snapshots only.
- Keep room keys and Markdown plaintext out of the server.
- Add managed persistence, scaling, and auth only after public v0 feedback.
- Keep Redis, R2/S3, database-backed snapshots, and billing parked until
  needed.

# Related

- [Phase 1 infrastructure](/architecture/phase-1-infra.md)
- [Launch readiness](/runbooks/launch-readiness.md)
