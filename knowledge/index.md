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
- [Activation metrics](product/activation-metrics.md) - early hosted-service
  activation events and privacy boundaries.
- [User workflows](product/user-workflows.md) - the primary user flows the app
  should make fast and understandable.
- [Roadmap](product/roadmap.md) - the current product and infrastructure
  priority shape.

## Workflow

- [Operating model](workflow/operating-model.md) - which tool owns public
  intake, maintainer tracking, PR lifecycle, review records, and local history.
- [Agent contract](workflow/agent-contract.md) - how coding agents should
  execute, clarify, or challenge repository-owner instructions.
- [Start of work](workflow/start-of-work.md) - how to begin local work,
  PR-bound work, diagnostics, and post-merge cleanup.
- [Command ownership](workflow/command-ownership.md) - which lifecycle commands
  belong to Graphite, GitHub metadata tooling, or local Git.
- [Linear tracking](workflow/linear-tracking.md) - when accepted maintainer work
  needs Linear context, states, and labels.
- [Graphite PR lifecycle](workflow/graphite-pr-lifecycle.md) - how PR-bound work
  moves from trunk to Graphite review and back to trunk.
- [Agent session provenance](workflow/agent-session-provenance.md) - how agent
  tool and session metadata should appear on PRs.
- [PR review artifacts](workflow/pr-review-artifacts.md) - how title, body,
  validation, risk, evidence, labels, and Linear linkage should support review.
- [Validation standard](workflow/validation-standard.md) - how validation scope
  should follow changed files, risk, and handoff mode.
- [Codex hooks](workflow/codex-hooks.md) - how repo-local Codex guardrails
  support command policy, validation reminders, and Graphite handoff.
- [Vertical slice strategy](workflow/vertical-slice-strategy.md) - when to use a
  thin end-to-end tracer bullet instead of horizontal layers.
- [Graphite stack shape](workflow/graphite-stack-shape.md) - how to split,
  fold, reorder, and review stacked PRs.
- [Merge cleanup](workflow/merge-cleanup.md) - what happens after a PR or stack
  is merged, including Graphite temporary branches and Linear state.

## Architecture

- [Collaboration security](architecture/collaboration-security.md) - the
  non-negotiable room link, token, and encrypted persistence constraints.
- [Share Start session contract](architecture/share-start-session-contract.md) -
  the product, URL, hosted/open-source, and security boundary for live rooms.
- [OSS and hosted service boundary](architecture/oss-hosted-boundary.md) - the
  public repo, private operations, hosted deployment, and self-hosting boundary.
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
