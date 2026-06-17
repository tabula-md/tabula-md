# WORKFLOW.md

This file is the standard workflow for this repository. It should be enough to
plan, implement, submit, review, merge, and clean up normal work without opening
another workflow document. If another workflow document conflicts with this
file, this file wins.

## Operating Model

- Linear tracks work intent: what should change, why it matters, priority, issue
  state, and acceptance criteria.
- Graphite owns PR-bound branch creation, stack shape, submit, review flow, and
  post-merge sync.
- GitHub owns PR records, CI, code review metadata, and merge history.
- Git owns local history.
- ADRs track long-lived architecture decisions.

GitHub Issues are not the default tracker. Use Linear unless the repository
owner explicitly asks for a GitHub-native issue flow.

## Agent Contract

When the human operator gives a concrete instruction, an agent has exactly three valid
responses:

- Explain why the instruction is technically wrong, product-inconsistent, or
  likely to break the project, with a concrete reason and a better alternative.
- Ask for clarification if the instruction is ambiguous enough that execution
  would likely produce the wrong result.
- Execute the instruction.

Do not ignore the instruction, silently substitute a different workflow, or stop
at a proposal when implementation is feasible. Do not add compatibility paths,
legacy behavior, defensive fallbacks, or alternate implementations unless the
human operator explicitly asks for them or the existing product contract already
requires them.

## Work Classification

Default mapping:

```txt
One trackable request
-> one Linear issue
-> one Graphite stack
-> one or more GitHub PRs
```

Use this decision order before editing:

- Local-only work: skip Linear and PR only when the task is an obvious,
  low-risk local cleanup or investigation and does not need handoff.
- Single PR: use one Graphite PR when the work has one reviewable concern, such
  as a typo, small docs patch, isolated test, or narrow bug fix.
- Stack: use multiple Graphite PRs when one outcome has several reviewable
  layers, such as foundation refactor, storage, behavior, UI, tests, docs, or
  migration.
- Multiple Linear issues: split the issue only when the request has separate
  product outcomes, owners, timelines, or acceptance criteria.

Do not create extra Linear issues merely because a Graphite stack has multiple
PRs.

## Start Of Work

Start every PR-bound task from trunk:

```sh
gt sync --delete-all
gt checkout --trunk
npm run workflow:status
```

Before editing:

- Confirm the worktree is clean or understand every existing change.
- Create or identify the `MTS-*` Linear issue for trackable work.
- Decide whether the work is local-only, one PR, one stack, or multiple Linear
  issues.
- Identify the intended Graphite layers before broad edits.

Use `npm run workflow:status` when resuming a thread, after Graphite submit, and
after merge. It summarizes the current branch, PR, metadata, checks, Graphite
stack, and next expected action.

Use `npm run workflow:doctor` when workflow setup looks suspicious. It checks
repo-local templates, scripts, Graphite availability, GitHub merge settings, and
label catalog drift without submitting or merging anything. Use
`npm run workflow:doctor -- --fix` only when you want to apply safe local
Graphite branch naming settings.

## Linear Standard

Current Linear team: `Members of Technical Staff`.
Current Linear issue key: `MTS`.
Current Linear project: `tabula-md`.

Create a Linear issue when work has durable product, architecture, security, or
implementation context.

Required issue states:

- `Backlog`
- `Todo`
- `In Progress`
- `In Review`
- `Done`

State transitions:

- Move to `In Progress` when implementation starts.
- Move to `In Review` after the Graphite PR or stack is submitted.
- Move to `Done` after the closing PR lands and no follow-up work remains.

Required type labels:

- `Bug`: Intended behavior is broken or regressed.
- `Feature`: New user-facing capability.
- `Improvement`: Better version of an existing capability.
- `Refactor`: Internal code improvement without behavior change.
- `Infra`: Build, CI, deploy, tooling, or environment work.
- `Docs`: Documentation, specs, ADRs, or written process.
- `Chore`: Maintenance that does not fit another type.
- `Spike`: Research or investigation before implementation.

Use exactly one type label by default. Avoid domain labels such as `Design` or
`Security`; capture those concerns in the title, description, project, priority,
or linked ADR instead.

Use `.linear/ISSUE_TEMPLATE.md` when creating Linear issues. The repo-local
template is the source of truth for agents; Linear UI templates are optional
helpers for humans.

## Graphite Standard

Graphite is mandatory for normal PR work in this repository. Do not replace it
with raw Git, GitHub CLI, or GitHub Issues unless the repository owner
explicitly asks for a fallback.

Allowed exceptions:

- The repository owner explicitly asks for a non-Graphite fallback.
- The repository has no initial commit yet. Bootstrap once, then return to
  Graphite.
- The task is purely local and does not require branch, commit, PR, or merge
  handoff.

If Graphite is unavailable, unauthenticated, uninitialized, or blocked, complete
safe local edits when useful and clearly report that submission is blocked.

Local Graphite setup:

- Disable date prefixes in generated branch names.
- Do not use a tool, author, GitHub account, or session prefix by default.
- Prefer Graphite-generated semantic branch names from commit titles.

Branch names are short-lived implementation details. The review surface is the
Graphite stack, PR title, PR body, checks, and metadata.

Graphite terms:

- Trunk: the base branch for new work, usually `main`.
- Branch: one reviewable layer, usually one atomic commit.
- Stack: ordered Graphite branches where later layers depend on earlier layers.
- Submit: push Graphite branches and create or update GitHub PRs.
- Restack: rewrite dependent branches after a lower layer changes.

Core CLI commands:

```sh
gt sync --delete-all        # update trunk, restack, and delete merged branches
gt checkout --trunk         # move back to trunk before new work
gt add <files>              # stage files through Graphite
gt create -m "type(scope): summary"
gt log short                # inspect the current stack
gt submit                   # submit one branch
gt submit --stack           # submit the whole stack
gt checkout <branch>        # move to an existing Graphite branch
gt modify                   # amend the current Graphite branch
gt modify -a                # stage all changes and amend
gt restack                  # repair stack order after dependency changes
gt fold                     # combine a too-small layer into another layer
gt split                    # split one branch into reviewable layers
```

Graphite branch rules:

- Do not create an empty branch first.
- Make the edit, stage it, then run `gt create`.
- Let Graphite generate short semantic branch names from the commit title.
- Do not put tool identity, GitHub username, session id, or Linear issue key in
  branch names by default.
- If an explicit branch name is needed, use a short work-description slug such
  as `workflow-entrypoint` or `rail-alignment`.
- Use Conventional Commit style for commit and PR titles:
  `type(scope): summary`.
- Keep Linear issue keys out of commit titles and PR titles by default.
- Treat each Graphite branch as one atomic review layer.

Allowed title types:

- `feat`: user-facing capability.
- `fix`: bug fix.
- `docs`: documentation, specs, ADRs, or written process.
- `refactor`: internal code improvement without behavior change.
- `test`: test-only change.
- `build`: build system or dependency change.
- `ci`: CI configuration or automation.
- `chore`: maintenance that does not fit another type.
- `perf`: performance improvement.
- `style`: formatting-only change.
- `revert`: revert of a prior change.

Use a scope when it helps review, such as `editor`, `preview`, `workflow`,
`codex`, `collab`, `comments`, `files`, `layout`, or `ci`. Keep summaries
short, lower-case, and free of trailing periods.

Create a single PR:

```sh
gt add <files>
gt create -m "fix(editor): keep rail aligned across modes"
gt submit
```

Create a stack:

```sh
# layer 1
gt add <files>
gt create -m "refactor(comments): extract panel view model"

# layer 2
gt add <files>
gt create -m "feat(comments): add anchored thread interactions"

gt log short
gt submit --stack
```

Update an existing branch after feedback:

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

## Stack Shape

Keep a layer split when:

- It has one clear purpose that a reviewer can explain in one sentence.
- It can build and test independently.
- It can be reverted independently.
- It has a different product surface, risk profile, reviewer, or architecture
  boundary from nearby layers.
- It establishes a foundation that later layers depend on.

Fold a layer into another branch when:

- It only makes sense with the branch directly below or above it.
- The review cost of a separate PR is higher than the clarity it adds.
- It is a tiny copy, CSS, fixture, or test adjustment for one implementation
  layer.
- Reviewing it separately would force reviewers to reconstruct context that
  should be local to one PR.
- It cannot pass meaningful verification on its own.

Split a branch further when:

- Refactor, behavior, UI, tests, docs, or migration work are mixed together and
  can be reviewed separately.
- Failure would be hard to localize to one kind of change.
- Reverting the branch would remove more product behavior than necessary.
- The branch requires multiple reviewers for unrelated reasons.
- The diff hides a risky change inside a broad cleanup.

Reorder a stack when:

- A later branch introduces primitives, contracts, or data shape that earlier
  branches already depend on.
- A pure refactor can sit below behavior changes and reduce later diffs.
- Tests or docs describe behavior that has not appeared downstack yet.

Before submit, confirm:

- `gt log short` reads bottom-to-top as a coherent implementation story.
- Each branch title follows `type(scope): summary` and names the layer's
  purpose.
- Each branch is independently reviewable, testable, and revertible.
- Use `gt fold` for layers that are too small or too dependent to review alone.
- Use `gt split` for branches that contain multiple review concerns.
- Use `gt reorder`, `gt move`, or `gt restack` when dependencies are out of
  order.

## Pull Request Standard

PR title:

```txt
type(scope): summary
```

Good examples:

```txt
feat(editor): add split preview mode
fix(layout): keep rail position stable
docs(workflow): define repository workflow
chore(codex): add workflow state hooks
ci: verify pull requests
```

Linear linkage:

- Prefer the Graphite/Linear integration as the visible source of truth.
- Do not add a `Links` section just to repeat the Linear issue or Graphite
  stack when the Graphite UI already shows them.
- If the integration did not attach the issue, add the issue through the
  Graphite issue tracker sidebar or include the smallest body reference needed
  to link it.
- Only the PR that should close the Linear issue includes `Fixes MTS-123`.
- Do not put `Fixes MTS-123` on every PR in a stack.

PR body shape:

```md
## Summary

-

## Review Focus

-

## Implementation Notes

-

## Agent

- Tool:
- Session:

## Validation

- Automated:
- Manual:
- Not run:

## Risk

-

## Evidence

- Screenshots/video:
```

Use the PR body to make the work reviewable in Graphite. It should explain the
outcome, where review should focus, what non-obvious implementation choices
matter, what was validated, and what risk remains. Avoid a flat changelog that
only repeats file diffs.

Use `Implementation Notes` for meaningful decisions, tradeoffs, stack/layer
context, or alternatives only when they help review. Do not force those details
into every small PR.

For UI changes, include screenshots or an explicit `Not visual` note. For
behavior changes, include the exact verification command or manual check. If
validation is intentionally skipped, explain why in `Not run`.

After Graphite submit, apply metadata:

```sh
npm run pr:metadata -- --label <Label>
```

`pr:metadata` also records the agent tool and session id in the PR body. It
auto-detects common agent context when available, and supports explicit
provenance:

```sh
npm run pr:metadata -- --label <Label> --agent "Codex" --session <session-id>
```

Before asking the repository owner to merge, run:

```sh
npm run pr:ready
```

This checks local cleanliness, PR metadata, title shape, body template shape,
branch naming policy, fast whitespace checks, and GitHub check status. It does
not submit, merge, or run expensive validation.

Keep commit history concise:

```txt
type(scope): summary (#123)
```

The PR body is the review artifact. The squash merge commit body should stay
blank so `main` remains easy to scan.

Repository squash settings:

- Squash title: pull request title.
- Squash message: blank.

Solo-project defaults:

- Assignee: `taehalim`.
- Reviewer: skipped for self-authored solo PRs because GitHub does not allow
  self-review requests.
- Label: one type label from `.github/labels.json`, selected from the PR
  context.

The agent chooses the label from label name and description, not from hard-coded
file-path rules.

List selectable labels:

```sh
npm run pr:metadata -- --list-labels
```

When another reviewer exists, request them at submit time or through metadata:

```sh
gt submit --reviewers <github-login>
npm run pr:metadata -- --label <Label> --reviewer <github-login>
```

## Validation Standard

- Run focused unit tests after pure-function changes.
- Run `npm run test:hooks` after changing `.codex/hooks/**`.
- Run `npm run build` after TypeScript, import, package, or app wiring changes.
- Run `npm run test:browser` after editor, preview, right panel, file tree,
  share, or collaboration UI changes.

Focused browser smoke aliases:

```sh
npm run test:browser:workspace
npm run test:browser:editor
npm run test:browser:layout
npm run test:browser:panels
npm run test:browser:collab
```

## Merge And Cleanup

Use Graphite UI for normal PR and stack merge. Merge stack layers in dependency
order from bottom to top.

Repository merge policy:

- GitHub merge commits are disabled.
- Squash and rebase remain available.
- Open PR branches stay alive while review is active.
- Merged and closed branches should not be kept around.
- GitHub automatically deletes merged head branches.
- Do not use GitHub Merge Queue before Graphite Merge Queue is intentionally
  enabled.

After the repository owner merges a PR or stack:

```sh
gt sync --delete-all
npm run workflow:status
```

Then move the Linear issue to `Done` when the closing PR has landed and no
follow-up work remains.

## Release And Changelog

Use `.release/RELEASE_NOTES_TEMPLATE.md` when preparing a GitHub release,
customer-facing release note, or milestone summary.

Use `.release/CHANGELOG_ENTRY_TEMPLATE.md` when drafting changelog entries from
merged PRs. Keep changelog text concise and user-impact focused; do not paste PR
bodies directly into a changelog.

Do not create a release or publish release notes unless the repository owner
explicitly asks. These templates are preparation aids, not automatic release
triggers.

## Command Policy

Do not use these for normal PR work in this repository:

- `git checkout -b`
- `git switch -c`
- `git branch <new-branch>`
- `git commit`
- raw `git push` as the PR publishing mechanism
- `git pull` instead of `gt sync`
- `git merge` instead of Graphite restack/sync flows
- `gh pr create`
- `gh pr merge`
- destructive cleanup without the human operator explicitly requesting it
- shell redirection or ad-hoc scripts to manually write source files when
  `apply_patch` is appropriate

Safe local inspection commands remain fine:

- `git status`
- `git diff`
- `git show`
- `git log`
- `git stash`
- `git add`
- `git rev-parse`

## Codex Hooks

This repository uses project-local Codex hooks in `.codex/` as guardrails. The
hooks reduce repeated workflow mistakes, but they do not replace agent judgment,
code review, Linear planning, Graphite stack design, or test selection.

Agents and contributors should know what the hooks do because hook output
explains why a command was blocked, what validation is missing, or what next
workflow action is expected.

Hooks automatically help with:

- Adding short workflow context when a Codex session starts or a user prompt
  asks for code, Graphite, Linear, or post-merge work.
- Enforcing parts of the command policy above.
- Recording likely validation needs after file changes.
- Warning or continuing the turn when validation, PR metadata, or post-merge
  sync appears to be missing.
- Denying approval requests that would bypass the same blocked command policy.

Hooks do not automatically:

- Create Linear issues.
- Decide the right stack shape.
- Choose the correct implementation.
- Run expensive validation every time.
- Submit or merge PRs by themselves.
- Replace PR metadata commands.
- Move Linear issues to `Done`.

Project-local hooks load only when the project `.codex/` layer is trusted. When
Codex reports changed hooks, review and trust them through the Codex hooks UI or
CLI hook review flow before expecting them to run.
