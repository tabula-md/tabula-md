# Tabula.md Codex Hooks

Status: Active
Owner: taeha

This repository uses project-local Codex hooks to keep agent workflows aligned
with the Tabula.md engineering process.

## Scope

The hooks are intentionally small. They enforce the parts of the workflow that
are easy to forget and cheap to check:

- Use Graphite CLI for PR-bound branch, commit, stack, and PR lifecycle.
- Attach GitHub PR metadata after Graphite submit with `npm run pr:metadata -- --label <Label>`.
- Avoid destructive Git and shell commands unless taeha explicitly asked for
  them.
- Use `apply_patch` for manual source edits instead of shell redirection or
  ad-hoc file-writing scripts.
- Track which validations are likely needed before a turn ends.

The hooks do not replace code review, Linear planning, Graphite stack design, or
test judgment.

## Graphite Policy

PR-bound development should use Graphite commands:

```sh
gt sync
gt checkout --trunk
gt add <files>
gt create -m "[MTS-123] Short title"
gt submit --stack
```

For existing Graphite branches, use:

```sh
gt add <files>
gt modify
gt submit --stack
```

After Graphite creates or updates a PR, choose one label from
`.github/labels.json` based on the PR context and apply GitHub PR metadata:

```sh
npm run pr:metadata -- --label <Label>
```

The metadata script assigns taeha's GitHub account, applies the chosen type
label, and skips self-review requests for taeha-authored PRs because GitHub does
not allow requesting review from the PR author.

The pre-tool hook blocks raw Git/GitHub lifecycle commands such as:

- `git checkout -b`
- `git switch -c`
- `git branch <new-branch>`
- `git commit`
- `git push`
- `git pull`
- `git merge`
- `gh pr create`
- `gh pr merge`

Safe Git passthrough remains allowed for local inspection and recovery support:

- `git status`
- `git diff`
- `git show`
- `git log`
- `git stash`
- `git add`
- `git rev-parse`

Raw `git checkout <branch>` and `git rebase` produce warnings rather than hard
blocks because Graphite's official docs allow Git passthrough for tracking and
recovery cases. Prefer `gt checkout`, `gt sync`, and `gt restack` for normal
work.

The pre-tool hook also blocks destructive cleanup commands such as:

- `git reset --hard`
- `git checkout -- <path>`
- `git restore <path>`
- `git clean -fd`
- `rm -rf <path>`

## Validation Policy

The post-tool hook records likely validation needs in `.codex/hook-state/`,
which is ignored by Git.

For `apply_patch`, changed files are read directly from the patch. For Bash
tools, the hook reads `git status --short --untracked-files=all` after the
command and records the changed files only when the result is bounded. Very
large dirty states are ignored to avoid noisy validation state in bootstrapped or
untracked repositories.

The stop hook prints an advisory when a session changed files that usually need
validation and the matching command was not observed after the latest relevant
change:

- TypeScript, package, import, or app wiring changes: `npm run build`
- Editor, preview, panel, file tree, share, collaboration, or smoke UI changes:
  a focused `npm run test:browser:*` command when the hook can infer one,
  otherwise `npm run test:browser`
- Pure Markdown/comment/storage-style logic changes: `npm test`
- Hook policy changes: `npm run test:hooks`

Focused browser smoke aliases are available:

```sh
npm run test:browser:workspace
npm run test:browser:editor
npm run test:browser:layout
npm run test:browser:panels
npm run test:browser:collab
```

Hook policy fixtures live in `.codex/hooks/fixtures/` and are exercised by:

```sh
npm run test:hooks
```

## Trust

Project-local hooks load only when the project `.codex/` layer is trusted. When
Codex reports changed hooks, review and trust them through the Codex hooks UI or
CLI hook review flow before expecting them to run.
