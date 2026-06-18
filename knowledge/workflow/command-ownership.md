---
type: Workflow Concept
title: Command ownership
description: Graphite owns PR lifecycle commands, while GitHub and Git are used only for the parts Graphite does not own.
tags: [workflow, graphite, commands]
---

# Purpose

Command ownership prevents the repository from drifting into a mixed
Git/GitHub/Graphite workflow where branch state, PR state, and stack state stop
matching.

# Graphite-Owned Work

Use Graphite for PR-bound lifecycle work:

- Branch creation and commits: `gt create`.
- Updating a branch after feedback: `gt modify`.
- Stack navigation: `gt checkout`, `gt up`, `gt down`, `gt top`, `gt bottom`.
- Stack shape: `gt move`, `gt reorder`, `gt fold`, `gt split`, `gt absorb`.
- Remote stack retrieval: `gt get`.
- Sync and restack: `gt sync`, `gt restack`.
- PR creation, PR updates, draft publishing, and reviewer requests:
  `gt submit`.
- Conflict continuation and abort: `gt continue`, `gt abort`.
- Branch protection while stacking on other work: `gt freeze`, `gt unfreeze`.
- Recovery from a bad Graphite mutation: `gt undo`.

# GitHub-Owned Work

Use repository scripts for GitHub metadata that Graphite does not own:

- `npm run pr:handoff` for title, body, metadata, assignee, label, and agent
  provenance after Graphite submit.
- `npm run pr:title`, `npm run pr:body`, and `npm run pr:metadata` only for
  focused recovery or targeted edits.
- `npm run pr:ready` for local handoff completeness.
- `npm run workflow:doctor -- --sync-labels` for label catalog sync.

# Avoid Mixing Lifecycles

Do not use raw `git` or `gh` commands for Graphite-owned lifecycle operations:

- `git checkout -b`
- `git switch -c`
- `git branch <new-branch>`
- `git commit`
- raw `git push`
- `git pull`
- `git merge`
- `gh pr create`
- `gh pr ready`
- `gh pr edit`
- `gh pr merge`
- direct mutating `gh api` calls against pull requests or remote refs

# Concurrency

State-changing workflow commands must be serialized. Do not run Graphite
mutations, GitHub metadata mutations, Linear status updates, or remote ref
cleanup in parallel with each other or with reads that depend on their result.

When multiple agents work in parallel, use one Git worktree per agent session.
Do not have two agents mutate the same Graphite stack from the same worktree.

# Related

- [Graphite PR lifecycle](graphite-pr-lifecycle.md)
- [PR review artifacts](pr-review-artifacts.md)
