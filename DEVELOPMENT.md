# Development

This is the maintainer entry point for how Tabula work moves from idea to
merged code. For exact rules, commands, and edge cases, use `WORKFLOW.md` as
the source of truth.

## How We Work

Tabula uses one source of truth for each part of development:

- GitHub Issues are the public inbound channel for bug reports and feature
  requests.
- Linear tracks accepted maintainer work: what needs to change, why it matters,
  priority, status, and acceptance criteria.
- Graphite owns PR-bound branch creation, stack shape, submit, review flow, and
  post-merge sync.
- GitHub owns PR records, CI, code review metadata, and merge history.
- Agents are contributors. Their work should leave the same Linear, Graphite,
  validation, and PR metadata trail expected from a human developer.

The normal path is:

```txt
Request -> Linear MTS issue -> Graphite stack -> GitHub PR -> Graphite merge -> local sync
```

## Daily Flow

Start from trunk:

```sh
gt sync --delete-all
gt checkout --trunk
npm run workflow:status
```

Before editing, identify or create the Linear `MTS-*` issue for accepted
maintainer work and decide whether the work is local-only, one PR, one stack,
or multiple issues.

Create reviewable layers with Graphite:

```sh
gt add <files>
gt create codex/short-kebab-slug -m "type(scope): summary"
gt submit
```

For stacked work, create each layer with `gt create`, inspect with
`gt log short`, then submit with:

```sh
gt submit --stack
```

After submit, apply PR metadata. Agent-authored PRs should pass explicit
provenance instead of relying on session inference:

```sh
npm run pr:metadata -- --label <Label>
```

```sh
npm run pr:metadata -- --label <Label> --agent "Codex" --session <session-id>
```

Before merge review:

```sh
gt submit --publish --update-only
npm run pr:ready
```

After merge:

```sh
gt sync --delete-all
git remote prune origin
npm run workflow:doctor
npm run workflow:status
```

Then move the closing Linear issue to `Done`.

## Branch And Release Strategy

Use one long-lived branch: `main`.

- No `dev`, `develop`, or `staging` branch for normal work.
- Keep `main` releasable.
- Use short-lived Graphite branches and stacks for all PR-bound changes.
- Use feature flags or stacked layers for incomplete larger work.

Release by user-visible value, not by PR count. A release happens when `main`
contains a coherent set of changes worth explaining to users.

- Patch release: fixes, docs, and small polish.
- Minor release before `1.0.0`: meaningful product capability or workflow
  improvement.
- Major release: reserved for post-preview stability.

Maintain `CHANGELOG.md` with human-written user-facing notes. Do not paste PR
bodies directly into changelog entries.

## Review Standard

Keep each Graphite branch small, focused, and independently reviewable. Use:

- `gt modify` for feedback on an existing layer.
- `gt fold` when a layer is too small to review alone.
- `gt split` when one branch mixes unrelated review concerns.
- `gt move`, `gt reorder`, or `gt restack` when stack dependencies are wrong.
- `gt absorb` when staged feedback belongs to older downstack commits.
- `gt undo` before reaching for raw Git after an incorrect Graphite mutation.

PR bodies should help reviewers understand the outcome, review focus,
non-obvious implementation choices, validation, and risk. Do not use PR bodies
as flat changelogs.

## Command Boundaries

Use Graphite for branch and PR lifecycle. Do not use raw `git` or `gh` commands
for Graphite-owned work:

- No `git checkout -b`.
- No raw `git commit` for PR-bound changes.
- No raw `git push`.
- No `gh pr create`, `gh pr ready`, `gh pr edit`, or `gh pr merge`.
- No direct mutating `gh api` calls against pull requests or remote refs.

GitHub CLI/API is allowed through repo scripts for metadata and hygiene that
Graphite does not own, such as labels, assignees, agent provenance, readiness
checks, and stale `graphite-base/*` cleanup.

State-changing workflow commands must be serialized. Run Graphite mutations,
GitHub metadata mutations, Linear status updates, and remote ref cleanup one at a
time. Parallel reads and validation are fine after the mutation completes.

## Branch Names

Use short slash/kebab-case branch names that look natural in public GitHub:

- Agent-authored work: `codex/workflow-public-readiness`,
  `claude/readme-polish`.
- Human maintainer work: `dev/taehalim/editor-rail-alignment`.
- Exceptional release work: `release/v0.1.1`.

Avoid date prefixes, Linear issue keys, session ids, and underscores. Do not
rename an open Graphite PR branch just for style; start using the better naming
policy on the next branch.

## Agents

When an agent works on this repo, it should:

- Follow `AGENTS.md` for repo context.
- Use `WORKFLOW.md` for workflow decisions.
- Record agent tool and session id in PR metadata.
- Use one Git worktree per agent session when multiple agents work in parallel.
- Keep Linear, Graphite, validation, and PR metadata in sync before handing work
  back for review.

## Where To Look

- `WORKFLOW.md`: canonical workflow rules and exact commands.
- `AGENTS.md`: agent-specific repo instructions.
- `.github/PULL_REQUEST_TEMPLATE.md`: PR review artifact shape.
- `.github/labels.json`: selectable PR labels.
- `.linear/ISSUE_TEMPLATE.md`: Linear issue shape.
