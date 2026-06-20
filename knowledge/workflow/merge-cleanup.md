---
type: Workflow Concept
title: Merge cleanup
description: Graphite stack cleanup, stale temporary branches, Linear state, and local Git maintenance happen at the post-merge boundary.
tags: [workflow, graphite, merge, cleanup]
---

# Purpose

Cleanup happens after the owner merges a PR or stack, not while active review is
still changing branch relationships.

# Merge Surface

Use Graphite App for normal PR and stack merge. Merge stack layers in dependency
order from bottom to top. After handoff, agents should not repeatedly poll
GitHub or Graphite; the owner reports concrete merge blockers if they appear.

# Repository Policy

- `main` is the only long-lived branch.
- Do not create `dev`, `develop`, or `staging` branches for normal work.
- Open PR branches stay alive while review is active.
- Merged and closed branches should not be kept around.
- GitHub automatically deletes merged head branches.
- Do not use GitHub Merge Queue before Graphite Merge Queue is intentionally
  enabled.

# Post-Merge Command

After the owner merges:

```sh
npm run workflow:sync
```

This is the normal cleanup command. It runs Graphite sync, checks out trunk,
prunes remote-tracking refs, runs post-merge local Git object maintenance, runs
workflow doctor, and reports status.

# Graphite Temporary Branches

During active stack merges, Graphite may create remote `graphite-base/*`
branches to keep upstack PR diffs stable while it rebases or retargets them.
Do not touch them while PRs are open.

After the full stack is merged, `workflow:sync` has run, and there are no open
PRs, any remaining `graphite-base/*` branches are stale temporary branches. Run:

```sh
npm run workflow:doctor -- --delete-stale-graphite-base
```

# Linear

Move the Linear issue to `Done` when the closing PR has landed and no required
follow-up work remains.

# Related

- [Graphite PR lifecycle](graphite-pr-lifecycle.md)
- [Start of work](start-of-work.md)
