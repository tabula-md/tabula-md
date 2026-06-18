---
type: Workflow Concept
title: PR review artifacts
description: Graphite PRs should be written as reviewable artifacts, not flat file-diff changelogs.
tags: [workflow, graphite, pull-requests, review]
---

# Purpose

The PR body is the review artifact. It should explain the outcome, where review
should focus, what non-obvious implementation choices matter, what was
validated, and what risk remains.

# Title

Use:

```txt
type(scope): summary
```

The title must represent the final diff, not just the original task wording.
Before readiness, compare the PR title against the changed files, current
commit subject, and PR body `Summary`. If implementation scope drifted, update
the current commit subject and PR title, or split new work into an upstack PR.

# Body Shape

```md
## Summary

-

## Review Focus

-

## Implementation Notes

-

## Validation

- Automated:
- Manual:
- Not run:

## Risk

-

## Evidence

- Screenshots/video:
```

Use `Implementation Notes` only for meaningful decisions, tradeoffs, stack or
layer context, or alternatives that help review. Do not force empty process
detail into every small PR.

# Handoff Command

After Graphite submit, use one handoff command:

```sh
npm run pr:handoff -- \
  --title "type(scope): summary" \
  --label <Label> \
  --summary "<what changed and why>" \
  --review-focus "<what the reviewer should inspect>" \
  --implementation-notes "<important decision, tradeoff, or none with reason>" \
  --validation-automated "<command or check that ran>" \
  --validation-manual "<manual check, if any>" \
  --validation-not-run "<skipped validation and reason, if any>" \
  --risk "<remaining risk>" \
  --evidence "<screenshot/video link or Not visual.>"
```

`pr:handoff` applies the standard template; it does not summarize the work for
the agent. The agent writes content from the actual implementation, validation,
and remaining risk.

# Metadata

Agent-authored PRs include an `Agent` section inserted by metadata tooling.
Public contributor PRs do not need that section.

Solo-project defaults:

- Assignee: `taehalim`.
- Reviewer: skipped for self-authored solo PRs.
- Label: one type label from `.github/labels.json`, selected from PR context.

# Linear Linkage

Prefer the Graphite/Linear integration as the visible source of truth. Only the
PR that should close the Linear issue includes `Fixes MTS-123`; do not put
closing keywords on every PR in a stack.

# Related

- [Agent session provenance](agent-session-provenance.md)
- [Linear tracking](linear-tracking.md)
- [Graphite stack shape](graphite-stack-shape.md)
