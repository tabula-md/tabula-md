# WORKFLOW.md

This is the compact execution contract for this repository. It applies to
humans and coding agents. If another workflow document conflicts with this
file, this file wins.

Use `knowledge/index.md` only when deeper context is needed. Do not make every
task pay for the full background material.

## Default

Use the lightest mode that satisfies the request.

### Fast Local Loop

Default for ordinary implementation prompts.

- Implement the requested change.
- Run focused validation for the touched files.
- Report what changed and what validation did or did not run.
- Do not create Linear issues, Graphite PRs, or PR metadata unless review
  handoff is intended.

### PR Handoff Loop

Use when the owner asks for PR/Graphite/review handoff, or when the work is
clearly meant to be reviewed as a PR or stack.

- Use Graphite for branch, commit, submit, stack, publish, and sync.
- Run focused validation before handoff.
- After Graphite submit, run one `npm run pr:handoff -- ...`.
- Run `npm run pr:ready` once before handing the PR to the owner.
- Do not poll CI or Graphite mergeability after handoff. The owner reviews and
  merges in Graphite App; if merge is blocked, they pass the concrete error
  back to the agent.

### Release/Public Loop

Use for release, changelog, public launch, security, CI, repository settings,
or cross-repo Tabula work.

- Prefer explicit Linear tracking.
- Use Graphite stacks when there are separate reviewable layers.
- Run broader validation and docs checks.
- Treat public docs, templates, CI, and repository settings as product surfaces.

Mode selection is agent judgment, not a keyword filter. Hooks may signal
missing work, but they do not choose the mode.

## Work Shape

- One accepted trackable request normally maps to one Linear issue, one
  Graphite stack, and one or more GitHub PRs.
- Use one PR for one reviewable concern.
- Use a stack when the outcome has several dependent reviewable layers.
- Use a vertical slice when work crosses a new runtime, repo, persistence,
  encryption, collaboration, auth, or external-system boundary.
- Do not split Linear issues just because a Graphite stack has multiple PRs.

Details: `knowledge/workflow/vertical-slice-strategy.md` and
`knowledge/workflow/graphite-stack-shape.md`.

## Graphite

Graphite owns PR-bound branch and PR lifecycle.

- Start from trunk with `gt sync --delete-all` and `gt checkout --trunk`.
- Make edits, then create a branch with `gt create <branch> --all -m "type(scope): summary"`.
- Update the current review layer with `gt modify --all -m "type(scope): summary"`.
- Submit one PR with `gt submit`; submit a stack with `gt submit --stack`.
- Publish an existing draft with `gt submit --publish --update-only`.
- Use `gt restack`, `gt move`, `gt reorder`, `gt fold`, `gt split`, and
  `gt undo` before raw Git recovery.

Do not use raw `git commit`, raw `git push`, `git checkout -b`, `git pull`,
`gh pr create`, `gh pr ready`, or `gh pr merge` for normal PR work.

Details: `knowledge/workflow/graphite-pr-lifecycle.md`.

## PR Handoff

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

## Validation

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

## Merge Cleanup

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
