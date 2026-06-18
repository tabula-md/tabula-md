# Knowledge Bundle

This directory is an OKF-inspired knowledge bundle for humans and coding
agents. It follows the useful parts of OKF v0.1 for this repository: Markdown
concept documents, YAML frontmatter with `type`, progressive-disclosure
indexes, update logs, and cross-links.

It is not an OKF platform, schema registry, or workflow source of truth. Use
`WORKFLOW.md` for execution rules, then use this bundle when deeper project
context is useful.

`npm run knowledge:check` is a repo quality gate. It is intentionally stricter
than permissive OKF consumer conformance, especially for broken internal links.

## Product

- [Markdown-file-first product direction](product/markdown-file-first.md) - why
  Tabula.md centers files, preview, comments, and handoff instead of dashboards.
- [Product positioning](product/positioning.md) - who Tabula.md is for, what it
  promises, and what is intentionally out of scope.
- [User workflows](product/user-workflows.md) - the primary user flows the app
  should make fast and understandable.
- [Roadmap](product/roadmap.md) - the current product and infrastructure
  priority shape.

## Workflow

- [Graphite PR lifecycle](workflow/graphite-pr-lifecycle.md) - how PR-bound work
  moves from trunk to Graphite review and back to trunk.
- [Agent session provenance](workflow/agent-session-provenance.md) - how agent
  tool and session metadata should appear on PRs.
- [Codex hooks](workflow/codex-hooks.md) - how repo-local Codex guardrails
  support command policy, validation reminders, and Graphite handoff.
- [Vertical slice strategy](workflow/vertical-slice-strategy.md) - when to use a
  thin end-to-end tracer bullet instead of horizontal layers.
- [Graphite stack shape](workflow/graphite-stack-shape.md) - how to split,
  fold, reorder, and review stacked PRs.

## Architecture

- [Collaboration security](architecture/collaboration-security.md) - the
  non-negotiable room link, token, and encrypted persistence constraints.
- [E2EE collaboration model](architecture/e2ee-collaboration.md) - the
  target end-to-end encrypted room model.
- [Phase 1 infrastructure](architecture/phase-1-infra.md) - the beta
  persistence and deployment direction.

## Repository

- [Web app](repo/web-app.md) - the React/Vite Markdown workspace surface.
- [Tabula Room](repo/tabula-room.md) - the separate encrypted room server repo
  used by live collaboration.

## Runbooks

- [Release preparation](runbooks/release-preparation.md) - how releases and
  changelog work should be prepared from `main`.
- [Launch readiness](runbooks/launch-readiness.md) - beta launch readiness
  criteria for product, collaboration, data trust, infra, tests, and docs.
