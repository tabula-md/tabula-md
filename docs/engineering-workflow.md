# Tabula.md Engineering Workflow

Status: Active
Owner: taeha
Created: 2026-06-16

This document defines the default operating model for Tabula.md engineering work.
It is the repo-visible source for issue, branch, PR, and stacked-review
conventions.

For team onboarding, read `docs/team-onboarding.md` first, then this document and
`docs/graphite-workflow.md`.

## Source Of Truth

- Linear tracks planned work, priorities, issue state, and product/engineering
  scope.
- GitHub tracks pull requests, CI, code review, and merge history.
- Graphite owns the default local PR lifecycle, stacked review, and future merge
  queue workflow.
- Git tracks the actual change history.
- ADRs track long-lived architecture decisions.

GitHub Issues are not the default tracker for Tabula.md. Use GitHub Issues only
if taeha explicitly asks for a GitHub-native issue flow.

## Unit Boundaries

Keep these units separate:

- Linear issue: the work-intent unit. It captures what should change, why it
  matters, acceptance criteria, and verification.
- Graphite stack: the review and merge unit for an issue or agent session. It
  shows how the work is split into reviewable layers.
- GitHub PR: one concrete Graphite layer. A stack can contain several PRs for
  one Linear issue.
- Git commit: the underlying change history. In Graphite, one branch usually
  behaves like one atomic changeset.

Default mapping:

```txt
One trackable request
-> one Linear issue
-> one Graphite stack
-> one or more GitHub PRs
```

Use multiple Linear issues when the request contains separate product outcomes,
different owners, different timelines, or separate acceptance criteria. Use one
Linear issue with multiple Graphite PRs when the work has one outcome but needs
several reviewable implementation layers.

Do not create a separate Linear issue merely because a Graphite stack has
multiple PRs.

## Instruction Handling

When taeha gives a concrete instruction, an agent has exactly three valid
responses:

- Explain why the instruction is technically wrong, product-inconsistent, or
  likely to break the project, with a concrete reason and a better alternative.
- Ask for clarification if the instruction is ambiguous enough that execution
  would likely produce the wrong result.
- Execute the instruction.

The agent must not ignore the instruction, silently substitute a different
workflow, or stop at a proposal when implementation is feasible.
The agent must not add compatibility paths, legacy behavior, defensive
fallbacks, or alternate implementations unless taeha explicitly asks for them or
the existing product contract already requires them.

## Linear

Current Linear team: `Members of Technical Staff`.
Current Linear issue key: `MTS`.
Current Linear project: `tabula-md`.

If taeha changes the Linear team key to `TAB`, update this document, `AGENTS.md`,
and the GitHub PR template in the same patch. Until then, use actual `MTS-*`
issue identifiers.

Required workspace issue labels:

- `Bug`
- `Feature`
- `Improvement`
- `Refactor`
- `Infra`
- `Docs`
- `Chore`
- `Spike`

Label definitions:

- `Bug`: Intended behavior is broken or regressed.
- `Feature`: New user-facing capability.
- `Improvement`: Better version of an existing capability.
- `Refactor`: Internal code improvement without behavior change.
- `Infra`: Build, CI, deploy, tooling, or environment work.
- `Docs`: Documentation, specs, ADRs, or written process.
- `Chore`: Maintenance that does not fit other types.
- `Spike`: Research or investigation before implementation.

Use exactly one type label by default. Avoid domain labels such as `Design` or
`Security` as issue type labels; capture those concerns in the title,
description, project, priority, or linked ADR instead.

These labels should live at the Linear workspace level, not only on one team.
Team labels are reserved for team-specific exceptions that should not become a
Tabula-wide taxonomy.

Required workflow states:

- `Backlog`
- `Todo`
- `In Progress`
- `In Review`
- `Done`

Use this issue template for trackable work:

```md
## Problem


## Scope


## Acceptance Criteria

- [ ] 

## Verification

- [ ] 

## References

-
```

Create a Linear issue when the work has durable product, architecture, security,
or implementation context. Small local cleanups can skip Linear when they are
obvious, low-risk, and do not need future tracking.

## Graphite-First Development

Use Graphite CLI as the mandatory way to create, update, and submit PR branches.
Default to stack-first work. A single Graphite PR is allowed only when the work
is narrowly scoped to one reviewable concern. Agents must not silently replace
this with raw Git, GitHub CLI, or GitHub Issues.

Default stack-first flow:

```sh
gt sync
gt checkout --trunk
# layer 1
gt add <files>
gt create -m "[MTS-123] Foundation layer"

# layer 2
gt add <files>
gt create -m "[MTS-123] Behavior or UI layer"

gt submit --stack
```

Single-PR exception:

```sh
gt create -am "[MTS-123] Short title"
gt submit
```

Do not create an empty branch first when using Graphite. Make the change, stage
it, and then run `gt create`. For broad agent sessions, create one branch per
reviewable layer.

For the canonical Graphite workflow, stack rules, Linear linkage, and merge queue
policy, read `docs/graphite-workflow.md`.

## Pull Requests

PR title format:

```txt
[MTS-123] Short title
```

Always include this in the PR body:

```txt
Linear: MTS-123
```

If the PR closes a Linear issue, also include this in the PR body:

```txt
Fixes MTS-123
```

Use the repository PR template. For UI changes, include screenshots or an
explicit note that the change is not visual. For behavior changes, include the
exact verification command or manual check.

After Graphite creates or updates a PR, run:

```sh
npm run pr:metadata -- --label <Label>
```

This applies Tabula.md's GitHub PR metadata defaults for the current branch:

- Assignee: `taehalim` while taeha is the only developer.
- Label: one agent-selected type label from `.github/labels.json`.
- Reviewer: skipped for taeha-authored solo PRs because GitHub does not allow
  requesting review from the PR author.

The agent must choose the label from the label name and description, not from
hard-coded file-path rules. To inspect the selectable labels:

```sh
npm run pr:metadata -- --list-labels
```

When there is a separate reviewer, pass that reviewer through Graphite at submit
time or through the metadata script:

```sh
gt submit --reviewers <github-login>
npm run pr:metadata -- --label <Label> --reviewer <github-login>
```

Target PR size:

- One clear concern per PR.
- Keep agent-authored PRs easy to review.
- Split broad work by product surface, architecture boundary, or risk level.
- Do not hide large migrations inside unrelated feature work.

## Graphite Stacks

Use Graphite stacks by default. A stack is especially important when each step is
independently reviewable but the total change is too large for one PR.

Good candidates:

- E2EE collaboration redesign.
- Storage or sync migrations.
- Editor engine changes.
- Markdown command/preview architecture changes.
- Cloudflare runtime or deployment architecture.
- Large UI panel reorganizations with separate behavior and style steps.

Avoid stacks only for tiny one-concern changes such as typo fixes, isolated
tests, small docs patches, or one-file refactors.

Stack rules:

- The bottom PR should establish the smallest stable foundation.
- Each PR should pass tests independently.
- Each PR title should keep the same Linear issue prefix when part of one issue.
- Prefer draft PRs until the stack is reviewable from bottom to top.
- Rebase/restack before asking for final review.

Graphite Merge Queue is not active by default. Enable it only after CI, branch
protection, and regular PR review are stable enough to make the queue useful.

## ADR Linkage

Create or update an ADR only after taeha confirms the decision should be durable.
Link the ADR from the Linear issue and PR when a change affects:

- security model
- persistence model
- collaboration architecture
- deployment/runtime architecture
- ownership boundaries between apps/packages
- long-lived public API or data format

## Verification Defaults

Use the smallest verification set that proves the change:

- Pure Markdown or view-model logic: `npm test`
- TypeScript wiring, imports, package config: `npm run build`
- Editor, preview, right panel, file tree, share, or collaboration UI:
  `npm run test:browser`

Document skipped verification in the PR body with the reason.
