---
type: Workflow Concept
title: Vertical slice strategy
description: Risky boundaries should be proven with a thin end-to-end path before deepening individual layers.
tags: [workflow, slicing, architecture]
---

# Principle

When a change crosses a new or uncertain boundary, start with a vertical slice
or tracer bullet. The first PR should prove the path, not complete every layer.

# Use It For

- New repositories, services, packages, deployment targets, or runtime
  boundaries.
- Client/server, browser/server, worker/server, or multi-repo integration.
- Collaboration, authentication, encryption, persistence, migrations, or
  external systems.
- Changes where the biggest risk is whether the parts actually connect.

# Example

For cross-repo collaboration work, the first slice should prove:

```txt
Tabula web
-> room client config
-> external room endpoint
-> minimal room response
-> smoke or manual verification
```

Security hardening, persistence, deployment, and protocol depth can then deepen
that proven path in small Graphite PRs.

# Related

- [Tabula Room](/repo/tabula-room.md)
- [Collaboration security](/architecture/collaboration-security.md)
