# WORKFLOW.md

This is the compact execution contract for this repository.

## Scope

- Ship the smallest useful outcome.
- Keep one reviewable concern per pull request.
- Use a Graphite stack only when later changes genuinely depend on earlier
  ones and each layer can be reviewed and reverted independently.
- Re-check the shape around 250 meaningful changed lines or 25 files. Split
  refactors, behavior changes, mechanical edits, and different risk profiles
  when that makes review clearer.
- Do not add unrelated work to an open pull request.

## Execution Ownership

- Each branch and worktree has one branch owner at a time. Only that owner may
  modify and submit it. A Graphite stack may span multiple owners and
  worktrees; each owner treats every other owner's branches as read-only.
- A write-capable task uses a named branch. A detached worktree is read-only
  until the task receives or creates a branch.
- Before writing, inspect `git status --short --branch` and
  `git worktree list`. Stop and report if the checkout contains unrelated
  changes or its ownership is unclear.
- A branch owner may create, modify, submit, and run targeted Graphite
  operations that affect only their branch. Stop before an operation that
  would modify, reorder, or delete another owner's branch.
- A maintainer owns merge, repository-wide synchronization, cross-owner stack
  changes, branch deletion, and shared-worktree cleanup.
- Before handing work to another session, stop the previous branch owner and
  leave a clean commit or an explicit description of remaining local changes.

## Build

1. Identify the user-visible outcome.
2. Inspect the existing pattern before introducing a new abstraction.
3. Implement only the current concern.
4. Run the smallest validation that catches likely regressions.
5. Report local work or submit it for review.

## Validation

- TypeScript, package, or app wiring: `npm run build`.
- Markdown, comments, storage, or view-model logic: `npm test`.
- Browser UI, editor, preview, panels, files, sharing, or collaboration: run
  the relevant focused browser suite from `AGENTS.md`.
- Documentation-only changes may skip application tests.
- Before submission: `git diff --check`.

CI is the merge gate. Local checks should be proportional to the changed
surface; they do not need a separate readiness ceremony.

## Graphite

Make the current concern's changes before running `gt create`; do not create
empty placeholder branches. For an independent change, create the review
branch on trunk even when trunk is checked out in another worktree:

```sh
gt create codex/short-kebab-slug --onto main --all -m "type(scope): summary"
```

For a change that genuinely depends on an open branch, create it on that
explicit parent instead of waiting for the parent to merge:

```sh
gt create codex/short-kebab-slug --onto parent-branch --all -m "type(scope): summary"
```

`--no-stack` submits the current branch and any required downstack ancestors,
but excludes descendants. Submit a draft early when exposing the dependency or
review shape would help collaboration:

```sh
gt submit --no-stack --ai
# While the pull request is still in progress:
gt submit --no-stack --draft --ai
```

For another change to the same review concern:

```sh
gt modify --all -m "type(scope): summary"
gt submit --no-stack --update-only
```

Use `gt submit --stack` only when intentionally submitting dependent
descendants. Review stacks from the bottom up; an upstack pull request may be
reviewed before its parent merges.

A trusted remote session with repository and Graphite access may own and
submit its branch directly. Otherwise it hands off its branch or commit
reference, completed validation, and known risks to a maintainer.

When building on another owner's branch, fetch only the needed downstack and
restack only the owned branch:

```sh
gt get parent-branch --downstack --no-restack --no-checkout
gt restack --only --branch owned-branch
```

Fetched foreign branches remain read-only; use `gt freeze` when an existing
local branch needs that protection. A maintainer handles `gt sync`,
cross-owner stack changes, Graphite Stack Merge, and repository-wide cleanup
such as `gt sync --delete-all`. For importing, reorganizing, navigating, or
recovering a stack, use Graphite's official
[command cheatsheet](https://graphite.com/docs/cheatsheet). Prefer Graphite
commands over raw Git rebases or branch mutations for tracked branches.

For a single pull request when Graphite is unavailable, GitHub CLI is an
acceptable fallback. A maintainer reconciles Graphite after it recovers.

## Public Review

Pull requests explain three things:

- **Why:** the outcome or problem that motivated the change.
- **What:** the smallest meaningful description of the implementation.
- **Verify:** the automated or manual checks that support the change.

Add risk notes or visual evidence only when they materially help review. Do not
publish agent session IDs, private planning notes, or issue-tracker keys.

Use an issue tracker only when work needs durable product or engineering
tracking. It is not required for every pull request.

## Safety

Personal or organization-level hooks may protect against obvious secret
exposure and destructive Git commands. The repository workflow does not rely
on local hook state to decide scope, validation, submission, or completion.
