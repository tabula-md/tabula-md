---
type: Workflow Concept
title: Graphite PR lifecycle
description: PR-bound work starts from trunk, submits through Graphite, receives metadata, and cleans up after merge.
tags: [workflow, graphite, pr]
---

# Purpose

Graphite owns PR-bound branch creation, stack shape, submit, review flow, and
post-merge sync. GitHub owns PR records, CI, code review metadata, and merge
history. Git owns local history.

# Standard Path

1. Start from trunk with `gt sync --delete-all`, `gt checkout --trunk`, and
   `npm run workflow:status`.
2. Edit the files for one reviewable concern or one stack layer.
3. Stage with `gt add <files>`.
4. Create or update with `gt create ...` or `gt modify`.
5. Submit with `gt submit` or `gt submit --stack`.
6. Review the title with `npm run pr:title -- --title "type(scope): summary"`.
7. Write the review body with `npm run pr:body -- ...`.
8. Apply metadata with `npm run pr:metadata -- --label <Label>`.
9. Publish with `gt submit --publish --update-only`.
10. Check readiness with `npm run pr:ready`.
11. After merge, run `npm run workflow:sync`.

# Update Existing PRs

Use `gt modify` for changes that still belong to the current PR's review layer:
review feedback, required fixes, tests, title/body cleanup, or metadata cleanup.

When the implementation introduces a new reviewable concern, create an upstack
branch with `gt create` and submit the stack. Do not keep widening an open PR
just because it is convenient.

# Guardrail

Do not replace Graphite-owned lifecycle steps with raw `git push`, `git
commit`, `gh pr create`, `gh pr ready`, or `gh pr merge`.

# Related

- [Agent session provenance](agent-session-provenance.md)
- [Vertical slice strategy](vertical-slice-strategy.md)
