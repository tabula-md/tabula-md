---
type: Runbook
title: Release preparation
description: Prepare releases and changelog entries from main based on user-visible value.
tags: [release, changelog, runbook]
---

# Standard

Release from `main` only. Do not release from a feature branch, `dev`, or a
temporary Graphite branch.

Keep `main` releasable. Use short-lived Graphite branches and stacks for normal
work, and use feature flags or stacked layers for incomplete larger work.

# Versioning

Use semantic version tags:

```txt
v0.1.0
v0.1.1
v0.2.0
```

Use patch releases for fixes, docs, and small polish. Use minor releases before
`1.0.0` for meaningful product capabilities or workflow improvements.
Reserve major releases for post-preview stability.

# Release Criteria

Release by user-visible value, not by PR count. A release happens when `main`
contains a coherent set of changes worth explaining to users.

Do not create a release, tag, or publish release notes unless the repository
owner explicitly asks. The templates are preparation aids, not automatic release
triggers.

# Templates

- `.release/RELEASE_NOTES_TEMPLATE.md`
- `.release/CHANGELOG_ENTRY_TEMPLATE.md`

Update `CHANGELOG.md` for user-facing changes before tagging a release.
Internal workflow-only changes may skip changelog entries unless they affect
contributors or maintainers.

PR bodies are review artifacts. Do not paste PR bodies directly into
`CHANGELOG.md`; write concise user-impact notes instead.
