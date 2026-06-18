---
type: Workflow Concept
title: Operating model
description: The repository separates public intake, maintainer tracking, PR lifecycle, review records, and local history across the right tools.
tags: [workflow, operating-model, tools]
---

# Purpose

The workflow is intentionally split across a few tools instead of forcing one
system to do every job. This keeps public intake, maintainer planning, review,
merge, and local history understandable.

# Tool Roles

- GitHub Issues are the public inbound channel for bug reports and feature
  requests.
- Linear tracks accepted maintainer work: what should change, why it matters,
  priority, state, and acceptance criteria.
- Graphite owns PR-bound branch creation, stack shape, submit, review flow, and
  post-merge sync.
- GitHub owns PR records, CI, code review metadata, and merge history.
- Git owns local history.
- ADRs track long-lived architecture decisions.
- `knowledge/` holds durable project context and workflow explanations.

# Maintainer Default

For maintainer execution, use Linear unless the repository owner explicitly
asks for a GitHub-native issue flow. Do not duplicate accepted maintainer work
into GitHub Issues just to make the issue list look active.

# Agent Entry Files

- `WORKFLOW.md` is the compact execution contract.
- `WORKFLOW.ko.md` is the Korean-language mirror of that contract.
- `AGENTS.md` and `CLAUDE.md` provide tool-specific repository context.
- `knowledge/index.md` is the durable context map.

Tool-specific entry files may add context needed by that tool, but they must
not define a competing workflow.

# Related

- [Linear tracking](linear-tracking.md)
- [Graphite PR lifecycle](graphite-pr-lifecycle.md)
- [Agent contract](agent-contract.md)
