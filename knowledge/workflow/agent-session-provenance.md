---
type: Workflow Concept
title: Agent session provenance
description: Agent-authored PRs should record which tool and session produced the work.
tags: [workflow, agents, pr-metadata]
---

# Purpose

Tabula.md may be edited by Codex, Claude Code, Cursor-compatible agents, and
future tools. PRs should make the authoring tool and session visible without
putting session ids in branch names or commit titles.

# Standard

After Graphite submit, run:

```sh
npm run pr:metadata -- --label <Label> --agent "<Agent Name>" --session <session-id>
```

The script inserts or updates the PR `Agent` section and applies GitHub metadata
that Graphite does not own, such as labels and assignees.

# Branch Names

Use semantic, short-lived branch names:

- `codex/<short-slug>`
- `claude/<short-slug>`
- `cursor/<short-slug>`
- `agent/<tool-slug>/<short-slug>`
- `dev/<github-login>/<short-slug>`

Do not include Linear issue keys, dates, session ids, or underscores.

# Related

- [Graphite PR lifecycle](graphite-pr-lifecycle.md)
