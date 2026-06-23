# WORKFLOW.md

This is the compact execution contract for this repository. It applies to
humans and coding agents. If another workflow document conflicts with this
file, this file wins.

Use `knowledge/index.md` only when deeper context is needed. Do not make every
task pay for the full background material.

## Purpose

Keep work small, reviewable, and synchronized with reality. The core workflow
describes how to shape work; repository-specific tools are adapters below.

## Principles

- Ship the smallest useful outcome.
- Keep one reviewable concern per slice.
- Slice before building when work is broad or uncertain.
- Keep public review surfaces clean.
- Let planning state follow reality.
- Validate the surface that changed.

## The Loop

Use the same loop for every request:

1. Intake: identify the user-visible outcome and any review expectation.
2. Shape: decide whether the answer is direct, local-only, one review slice, or
   a sequence of slices.
3. Slice: separate broad work before implementation.
4. Build: implement only the current slice; avoid incidental cleanup.
5. Validate: run the smallest checks that catch likely regressions.
6. Handoff: report local work, or submit the ready review slice.

Hooks may signal missing work, but they do not choose the shape.

## Slice Rules

A slice must make sense as an independent review. If reviewers need the whole
sequence to understand one slice, split it differently.

Prefer multiple slices when any of these are true:

- The change would exceed about 250 meaningful changed lines or 25 files.
- Refactor and behavior change would be mixed.
- Mechanical/noisy edits would be mixed with meaningful product or logic edits.
- Changes with different risk profiles would be mixed.
- The owner asks for broad product analysis, multiple issues, or a large patch.

Use these slice patterns as appropriate:

- Component: split by independently reviewable subsystem.
- Iterative: submit the first useful improvement, then refine.
- Refactor/change: land structure-only cleanup before behavior changes.
- Mechanical/noise: isolate generated, moved, renamed, or bulk style changes.
- Risk: land low-risk prep before risky behavior or performance work.

Size budgets:

- Around 250 meaningful lines or 25 files: warn and re-check shape.
- Around 800 lines: split strongly preferred.
- Around 1200 lines: stop adding more changes to that slice.

Ready slices should move to review as soon as they are ready. Do not wait for
the entire sequence to be complete before opening bottom layers.

For broad work, write a short Stack Plan before implementation:

1. `<title>` — why this slice is independently reviewable.
2. `<title>` — what it depends on from the previous slice.
3. `<title>` — what validation should focus on.

Details: `knowledge/workflow/vertical-slice-strategy.md` and
`knowledge/workflow/graphite-stack-shape.md`.

## Open Review Rule

When working on a branch that already has an open PR, classify every new edit
before coding:

- Same review concern: modify the current slice.
- Dependent follow-up concern: create a new upstack slice.
- Unrelated concern: stop and ask or switch context.

Do not grow an open PR just because it is the current branch. If the change
would make review ask a second question, create the next slice.

## Review Surfaces

- Branches use semantic work names, not planning-ticket keys.
- Pull requests are public review artifacts: problem, change, validation, risk.
- Issue trackers are private planning state: priority, owner, status, links.
- Keep ticket keys out of branch names, PR titles, and public PR bodies.
- Link PRs to tracker issues through Resources/attachments.
- Move planning state when reality changes: started, in review, merged.

## Repository Tooling

### Graphite

Graphite owns PR-bound branch and PR lifecycle.

- Start from trunk with `gt sync --delete-all` and `gt checkout --trunk`.
- Make edits, then create a branch with `gt create <branch> --all -m "type(scope): summary"`.
- Update the current review layer with `gt modify --all -m "type(scope): summary"`.
- Submit one PR with `gt submit`; submit a stack with `gt submit --stack`.
- Publish an existing draft with `gt submit --publish --update-only`.
- Use `gt restack`, `gt move`, `gt reorder`, `gt fold`, `gt split`,
  `gt absorb`, and `gt undo` before raw Git recovery.

Do not use raw `git commit`, raw `git push`, `git checkout -b`, `git pull`,
`gh pr create`, `gh pr ready`, or `gh pr merge` for normal PR work.

Details: `knowledge/workflow/graphite-pr-lifecycle.md`.

### Linear

Linear is the private planning surface for this repository.

- When PR-bound Linear work starts, move the issue to `In Progress`.
- After Graphite submit, `pr:handoff`, and `pr:ready` are complete, confirm the
  PR appears in Linear Resources and move the issue to `In Review`.
- Move the issue to `Done` only after the closing PR lands and required
  follow-up is complete.

Do not split Linear issues just because one outcome has several review slices.

### PR Handoff

After Graphite submit, run:

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

`pr:handoff` writes the review artifact, applies one type label from
`.github/labels.json`, assigns `taehalim` by default, and records agent
provenance when agent/session data is available. It is not an automatic
summarizer; the agent supplies the content.

Run `npm run pr:ready` once before handoff. It checks local handoff
completeness only. It does not submit, merge, poll CI, poll Graphite
mergeability, or run expensive validation.

### Validation

Run the smallest validation set that catches likely regressions.

- Knowledge changes: `npm run knowledge:check`.
- Hook/workflow automation changes: `npm run test:hooks`.
- TypeScript, package, or app wiring changes: `npm run build`.
- Pure Markdown/comment/storage/view-model logic: `npm test`.
- Browser UI, editor, preview, panel, file tree, share, or collaboration UI:
  use the focused browser suite when available, otherwise `npm run test:browser`.
- Before PR handoff: `git diff --check`.

For docs-only changes, it is acceptable to skip app tests or build when the PR
body explains why.

### Merge Cleanup

The owner merges in Graphite App. After merge:

```sh
npm run workflow:sync
```

If no PRs are open and stale `graphite-base/*` branches remain after sync:

```sh
npm run workflow:doctor -- --delete-stale-graphite-base
```

Move the Linear issue to `Done` only after the closing PR has landed and no
required follow-up remains.

## Command Policy

- Use `apply_patch` for manual source edits.
- Hooks block Graphite lifecycle mistakes and direct shell source writes.
- Hooks do not block `rm -rf`; shell cleanup is left to agent judgment.
- Destructive Git commands that discard user work remain blocked unless the
  owner explicitly asks for them.
- `workflow:doctor` is for setup suspicion, workflow automation changes, and
  post-merge diagnostics. It is not mandatory for every task.

Details: `knowledge/workflow/codex-hooks.md`.
