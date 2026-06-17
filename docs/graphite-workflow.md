# Tabula.md Graphite Workflow

Status: Active
Owner: taeha
Created: 2026-06-16
Sources checked: 2026-06-17

Localized companion: `graphite-workflow.ko.md`

This document defines how the Tabula.md team uses Graphite. It is based on the
official Graphite docs index at `https://graphite.com/docs/llms.txt`.

## Principles

- Linear owns planned work, priorities, and issue state.
- GitHub owns pull requests, CI, code review, and merge history.
- Graphite owns the local PR lifecycle, stack structure, and stacked review.
- Git owns the actual commit graph.
- Use `gt` as the mandatory way to create and update PR-bound branches.
- Default to stack-first PR-bound work, especially for agent-authored or
  vibe-coded sessions where one prompt can touch many areas.
- Use a single Graphite PR only when the work is narrowly scoped to one
  reviewable concern.
- Use a Graphite stack whenever one Linear issue or one agent session contains
  multiple independently reviewable layers.
- Treat each Graphite branch as an atomic changeset, usually one commit.
- Do not create an empty Git branch first when using Graphite. Make the edit,
  stage it, then run `gt create`.

## Agent Operating Contract

Graphite is mandatory for PR-bound Tabula.md work. Agents must treat this
document as the source of truth before creating, updating, submitting, or merging
PR branches.

Unit boundaries:

- Linear issue: work intent.
- Graphite stack: review and merge structure.
- GitHub PR: one concrete review layer in the stack.
- Git commit: underlying change history.

One Linear issue can have several Graphite PRs when the work has one product or
engineering outcome but multiple reviewable implementation layers. Do not create
extra Linear issues just to mirror the PR count.

Required behavior:

- Read this document before doing branch, PR, stack, or merge work.
- Default to stack-first. Before broad edits, identify the intended review
  layers.
- Use Graphite for small work too; small work may be a single Graphite PR only
  when it has one reviewable concern.
- Use `gt submit --stack` whenever a session creates more than one branch.
- Do not collapse refactor, storage, behavior, UI, tests, and docs into one
  branch when they can be reviewed separately.
- Keep Linear issue keys in PR titles and bodies.
- Report Graphite blockers instead of silently falling back to raw GitHub or Git
  flows.

Do not use these for normal Tabula PR work:

- `git checkout -b`
- raw `git push` as the PR publishing mechanism
- `gh pr create`
- GitHub Issues as the primary work tracker
- GitHub Merge Queue when Graphite Merge Queue is the chosen merge queue

Allowed exceptions:

- taeha explicitly asks for a non-Graphite fallback.
- The repository has no initial commit yet. Graphite cannot initialize before the
  first commit; bootstrap the repository once, then return to the Graphite flow.
- The task is purely local and does not require branch, commit, PR, or merge
  handoff.

If `gt` is unavailable, unauthenticated, uninitialized, or blocked by repository
state, the agent should still complete local code or document edits when useful,
but the final handoff must clearly say that Graphite submission is blocked and
why.

## References

- Graphite docs index: `https://graphite.com/docs/llms.txt`
- CLI quick start: `https://graphite.com/docs/cli-quick-start`
- Create a pull request: `https://graphite.com/docs/create-a-pull-request`
- Create a stack: `https://graphite.com/docs/create-stack`
- CLI command cheatsheet: `https://graphite.com/docs/cheatsheet`
- CLI command reference: `https://graphite.com/docs/command-reference`
- CLI configuration: `https://graphite.com/docs/configure-cli`
- GitHub repository settings: `https://graphite.com/docs/github-configuration-guidelines`
- Linear integration: `https://graphite.com/docs/linear`
- GitHub autolinks: `https://graphite.com/docs/github-autolinks`
- Merge queue overview: `https://graphite.com/docs/graphite-merge-queue`
- Merge queue setup: `https://graphite.com/docs/set-up-merge-queue`

## Setup

Graphite requires at least one commit in the repository. If the repository has no
commits yet, bootstrap the initial commit once before running `gt init`.

Run Graphite setup once per developer machine after the initial commit exists:

```sh
gt auth
gt init
```

Use the repository trunk branch as Graphite trunk, currently expected to be
`main` after the GitHub repository is initialized.

Let Graphite generate branch names from the commit title. The stable identifier
is the Linear issue key in the commit and PR title, not the exact branch slug.
Do not add a manual branch naming convention unless taeha explicitly changes the
Graphite configuration.

## Default Stack-First Flow

Use this for normal PR-bound work, especially agent-authored sessions where one
request can produce many related changes.

```sh
gt sync
gt checkout --trunk

# Layer 1: smallest stable foundation
gt add <files>
gt create -m "[MTS-123] Add foundation layer"

# Layer 2: behavior or wiring
gt add <files>
gt create -m "[MTS-123] Wire behavior layer"

# Layer 3: UI, tests, docs, or follow-up layer
gt add <files>
gt create -m "[MTS-123] Add reviewable follow-up layer"

gt log short
gt submit --stack
# Applies to the PR for the branch you are on. Repeat per PR in a stack.
npm run pr:metadata -- --label <Label>
```

Layering rules:

- Create one Graphite branch per reviewable concern.
- Keep pure refactors below behavior changes.
- Keep data model or storage changes below UI changes that depend on them.
- Keep tests with the layer they verify when that keeps the branch
  self-contained; split tests into a separate layer when they cover multiple
  prior layers.
- Put docs in the same branch when they explain that branch; split docs when
  they document the whole stack or operating process.
- If a session touches multiple product surfaces, split by surface unless the
  shared foundation must land first.

After feedback on any branch:

```sh
gt checkout <branch>
# edit files
gt add <files>
gt modify
gt submit --stack
```

Shortcut when all modified files should be included:

```sh
gt modify -a
gt submit --stack
```

After the stack is merged:

```sh
gt sync
```

## Single-PR Exception Flow

Use a single Graphite PR only for work that is already one reviewable concern,
such as a typo fix, one isolated test, one small docs patch, or one narrow bug
fix.

```sh
gt sync
gt checkout --trunk
# edit files
gt add <files>
gt create -m "[MTS-123] Short title"
gt submit
npm run pr:metadata -- --label <Label>
```

PR title:

```txt
[MTS-123] Short title
```

PR body:

```txt
Linear: MTS-123
```

Use `Fixes MTS-123` only when that PR should close the Linear issue.

## GitHub PR Metadata

Graphite creates and updates the GitHub pull request, but Tabula.md still keeps
explicit GitHub PR metadata attached after submit.

After each `gt submit`, run:

```sh
npm run pr:metadata -- --label <Label>
```

Default solo-project behavior:

- Assignee: `taehalim`.
- Label: one agent-selected type label from `.github/labels.json`: `Bug`,
  `Feature`, `Improvement`, `Refactor`, `Infra`, `Docs`, `Chore`, or `Spike`.
- Reviewer: no self-review request. GitHub does not allow requesting review from
  the PR author, so taeha-authored solo PRs use assignee ownership instead.
- Checks: GitHub Actions creates the PR checks from `.github/workflows/ci.yml`.

The agent chooses the label from the label name and description in
`.github/labels.json`; the metadata script does not infer labels from file-path
rules. To inspect the selectable labels:

```sh
npm run pr:metadata -- --list-labels
```

When another reviewer exists, request them at submit time:

```sh
gt submit --reviewers <github-login>
```

or after submit:

```sh
npm run pr:metadata -- --label <Label> --reviewer <github-login>
```

For stacked work, apply metadata to each submitted PR branch. The script also
accepts an explicit PR number:

```sh
npm run pr:metadata -- --pr <number> --label <Label>
```

After feedback on a single PR:

```sh
gt checkout <branch>
# edit files
gt add <files>
gt modify
gt submit
```

Shortcut when all modified files should be included:

```sh
gt modify -a
gt submit
```

After the PR is merged:

```sh
gt sync
```

## Stack Candidates

Stack-first is the default. These categories should almost never be collapsed
into one PR:

Good candidates:

- E2EE collaboration redesign.
- Storage or sync migrations.
- Editor engine changes.
- Markdown command or preview architecture changes.
- Cloudflare runtime or deployment architecture.
- Large UI panel reorganizations with separate behavior and style steps.

Example:

```sh
gt sync
gt checkout --trunk

# Layer 1: foundation
gt add <files>
gt create -m "[MTS-200] Add encrypted room primitives"

# Layer 2: storage or API wiring
gt add <files>
gt create -m "[MTS-200] Store encrypted room snapshots"

# Layer 3: UI or migration layer
gt add <files>
gt create -m "[MTS-200] Replace share flow with encrypted rooms"

gt log short
gt submit --stack
```

Stack rules:

- The bottom PR should establish the smallest stable foundation.
- Each PR should pass tests independently.
- Each PR should have one clear reason to exist.
- Keep the same Linear issue prefix across the stack when all layers belong to
  one issue.
- Use draft PRs until the stack is reviewable from bottom to top.
- Review and merge from bottom to top unless Graphite merge tooling handles the
  stack explicitly.

After feedback on a middle branch:

```sh
gt checkout <branch>
# edit files
gt add <files>
gt modify
gt submit --stack
```

Graphite restacks dependent branches after `gt modify`. Submit the stack again
so GitHub and Graphite show the updated branch order and diffs.

## Stack Judgment Criteria

Use these criteria before creating a stack, before `gt submit --stack`, and
after review feedback changes the shape of the work.

Keep a layer split when:

- The branch has one clear purpose that a reviewer can explain in one sentence.
- The branch can build and test independently.
- The branch can be reverted independently without removing unrelated work.
- The branch has a different reviewer, risk profile, product surface, or
  architecture boundary from the layers around it.
- The branch establishes a foundation that later layers depend on.

Fold a layer into another branch when:

- The branch only makes sense with the branch directly below or above it.
- The review cost of a separate PR is higher than the clarity it adds.
- The branch is a tiny copy, CSS, fixture, or test adjustment that verifies one
  specific implementation layer.
- Reviewing the branches separately would force reviewers to reconstruct context
  that should be local to one PR.
- The branch cannot pass meaningful verification on its own.

Split a branch further when:

- Refactor, behavior, UI, tests, docs, or migration work are mixed together and
  can be reviewed separately.
- Failure would be hard to localize to one kind of change.
- Reverting the branch would remove more product behavior than necessary.
- The branch requires multiple reviewers for unrelated reasons.
- The diff hides a risky change inside a broad cleanup.

Reorder the stack when:

- A later branch introduces primitives, contracts, or data shape that earlier
  branches already depend on.
- A pure refactor can sit below behavior changes and reduce the later diff.
- Tests or docs describe behavior that has not appeared downstack yet.

Submit readiness checklist:

- Run `gt log short` and confirm the stack reads bottom-to-top as a coherent
  implementation story.
- Confirm each branch title starts with the Linear key and names the layer's
  actual purpose.
- Confirm each branch is independently reviewable, testable, and revertible.
- Use `gt fold` for layers that are too small or too dependent to review alone.
- Use `gt split` for branches that contain multiple review concerns.
- Use `gt reorder`, `gt move`, or `gt restack` when dependencies are out of
  order.
- Use `gt submit --stack` only after the stack shape matches the review story.

Merge judgment:

- Agents do not merge stacks by default.
- Merge only after taeha or the maintainer explicitly asks for it, review state
  is acceptable, CI is passing, Linear closure semantics are correct, and the
  Graphite UI or merge queue path is the chosen merge authority.
- Do not merge through raw GitHub controls when Graphite owns the stack or merge
  queue flow.

## Linear And GitHub Linkage

Linear remains the issue source of truth. GitHub Issues are not the default
tracker for Tabula.md.

Required linkage:

- Put the issue key in every PR title: `[MTS-123] Short title`.
- Put the issue key in the PR body: `Linear: MTS-123`.
- Use `Fixes MTS-123` only on the PR that should close the issue.
- If a stack has multiple PRs, intermediate PRs should reference the Linear
  issue without closing it.

Optional linkage:

- Enable Linear's GitHub integration so PR titles, branches, commits, and
  closing words can move Linear issue state automatically.
- Enable GitHub autolinks for the `MTS-` prefix so issue keys are clickable in
  GitHub and Graphite surfaces.
- Enable Graphite's Linear integration if the workspace plan supports it. That
  integration lets Graphite show, link, and create Linear issues from PR pages.

## GitHub Repository Settings

Recommended before using Graphite heavily:

- Enable automatic deletion of merged head branches.
- Do not limit the repository to a small number of branches or tags.
- Protect `main` with required status checks once CI is stable.
- Keep GitHub Issues disabled unless taeha explicitly chooses a public GitHub
  issue intake flow.
- Do not enable GitHub Merge Queue if Graphite Merge Queue will be used.

## Merge Queue

Graphite Merge Queue is not the default starting point for Tabula.md. Add it
only after CI, branch protection, and normal PR review are stable.

Use Graphite Merge Queue when:

- Trunk breaks often enough that direct merges create rebase or CI churn.
- Multiple developers or agents are merging PRs in parallel.
- Stacked PRs are common and merges should preserve stack correctness.
- Long-running checks make manual merge timing expensive.

When enabled:

- Graphite Merge Queue becomes the merge authority.
- GitHub Merge Queue must stay disabled.
- GitHub branch protection should require the Graphite queue checks.
- The Graphite GitHub app should be allowed to update protected branches.
- Linear issue state should still be driven through PR titles, PR bodies,
  commits, and the Linear GitHub integration.

## Do And Do Not

Do:

- Run `gt sync` before starting work and after merges.
- Run `gt checkout --trunk` before independent work that should start from
  trunk.
- Use `gt create` after making the change.
- Use `gt modify` for review feedback on an existing Graphite branch.
- Use `gt submit --stack` when a stack has upstack changes.
- Keep each Graphite branch reviewable on its own.

Do not:

- Use Graphite only as an after-the-fact PR publisher.
- Create an empty branch first and then try to retrofit Graphite around it.
- Hide unrelated work inside a stack layer.
- Put `Fixes MTS-123` on every PR in a stack.
- Turn Graphite Merge Queue on before CI and branch protection are ready.
