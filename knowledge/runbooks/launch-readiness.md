---
type: Runbook
title: Launch readiness
description: Beta readiness criteria for the no-login, link-first Markdown collaboration workspace.
tags: [launch, beta, readiness]
---

# Launch Definition

The beta is ready when Tabula.md is usable as a no-login, link-first Markdown
collaboration workspace and common failure modes are understandable.

# Product Readiness

- First screen feels like a Markdown workspace.
- Write and Preview modes are polished enough for long-form Markdown.
- Tabs, new document flow, and document identity are understandable.
- Share and Live state are clear.
- Agent export produces useful Markdown output.

# Collaboration Readiness

- User A can start a live session.
- User B can join by link without account setup.
- Both users can type simultaneously.
- Presence appears without dominating the UI.
- Reloading a live room restores document content.

# Data Trust

- Local drafts survive refresh.
- Live rooms persist beyond server memory.
- Users can tell whether a document is local or live.
- Users can recover or copy content when collaboration fails.
- Runtime data such as `.tabula-collab` is not committed.

# Infrastructure Readiness

- Neon schema is applied.
- Collaboration server uses `COLLAB_PERSISTENCE=postgres` in beta.
- Modal collaboration server is deployed with `max_containers=1`.
- Web app build points to the deployed collaboration URL.
- Production token secret and allowed origins are configured.

# Test Readiness

- `npm test` passes.
- `npm run test:browser` passes.
- `npm run build` passes.
- Local two-browser sync smoke passes.
- Modal + Neon sync smoke passes.

# Related

- [Roadmap](/product/roadmap.md)
- [Phase 1 infrastructure](/architecture/phase-1-infra.md)
