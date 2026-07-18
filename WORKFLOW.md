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

Start from trunk:

```sh
gt sync --delete-all
gt checkout --trunk
```

After editing and validating:

```sh
gt create codex/short-kebab-slug --all -m "type(scope): summary"
gt submit --ai
```

For another change to the same review concern:

```sh
gt modify --all -m "type(scope): summary"
gt submit --update-only
```

Use `gt submit --stack` only for a real stack. The repository owner merges in
Graphite. After merge, run `gt sync --delete-all`.

For a single pull request when Graphite is unavailable, GitHub CLI is an
acceptable fallback. Sync Graphite after it recovers.

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
