---
type: Workflow Concept
title: Start of work
description: Work starts by understanding branch state, existing changes, tracking needs, and the lightest appropriate loop.
tags: [workflow, start, graphite]
---

# Purpose

Start work by understanding the current branch and worktree before choosing how
heavy the workflow needs to be. This avoids turning small edits into full PR
handoffs and avoids starting PR-bound work from the wrong stack state.

# Fast Local Loop

For ordinary local implementation work, start with:

```sh
npm run workflow:status
```

Then confirm the worktree is clean or understand every existing change before
editing. Focused validation is enough unless the touched files or risk justify a
broader check.

# PR Handoff Loop

For PR-bound work, start from trunk:

```sh
gt sync --delete-all
gt checkout --trunk
npm run workflow:status
```

Before broad edits, decide whether the work is local-only, one PR, one stack,
or multiple Linear issues. Choose vertical slice, tracer bullet, or horizontal
layer split before the codebase is already tangled.

# When To Use Doctor

Use `npm run workflow:doctor` for setup suspicion, workflow automation changes,
environment suspicion, or post-merge cleanup diagnostics. It is not a default
step for every small implementation.

# After Merge

After the owner merges a PR or stack, use:

```sh
npm run workflow:sync
```

This is the normal post-merge cleanup boundary for Graphite sync, trunk
checkout, remote-tracking prune, local Git maintenance, workflow doctor, and
status reporting.

# Related

- [Graphite PR lifecycle](graphite-pr-lifecycle.md)
- [Graphite stack shape](graphite-stack-shape.md)
- [Merge cleanup](merge-cleanup.md)
