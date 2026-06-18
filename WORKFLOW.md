# WORKFLOW.md

This file is the standard workflow for this repository for humans and coding
agents, including Codex, Cursor-compatible agents, Claude Code, and future
tools. It should be enough to plan, implement, submit, review, merge, and clean
up normal work without opening another workflow document. If another workflow
document conflicts with this file, this file wins.

## Operating Model

- GitHub Issues are the public inbound channel for bug reports and feature
  requests.
- Linear tracks accepted maintainer work: what should change, why it matters,
  priority, issue state, and acceptance criteria.
- Graphite owns PR-bound branch creation, stack shape, submit, review flow, and
  post-merge sync.
- GitHub owns PR records, CI, code review metadata, and merge history.
- Git owns local history.
- ADRs track long-lived architecture decisions.

For maintainer execution, use Linear unless the repository owner explicitly
asks for a GitHub-native issue flow.

Agent entry files are intentionally thin:

- `WORKFLOW.md`: canonical workflow for every contributor and agent.
- `WORKFLOW.ko.md`: Korean-language version of the same workflow.
- `AGENTS.md`: repo instructions for Codex and Cursor-compatible agents.
- `CLAUDE.md`: repo instructions for Claude Code.

Tool-specific entry files may add context needed by that tool, but they must
not define a competing workflow.

## Knowledge Bundle

The repository includes `knowledge/`, an OKF-inspired bundle of Markdown concept
documents with small YAML frontmatter blocks. It gives humans and agents a
portable project knowledge map without adding another service or agent-specific
runtime.

Use it for deeper context about product principles, workflow concepts,
architecture constraints, repository areas, and runbooks. Do not use it to
override execution rules. `WORKFLOW.md` remains the workflow source of truth.
The bundle uses OKF-style structure without claiming that repo-specific quality
checks are general OKF conformance checks.

Conventions:

- `knowledge/index.md` is the navigation entrypoint.
- `knowledge/log.md` records knowledge bundle changes.
- Every non-reserved Markdown file under `knowledge/` is a concept document.
- Concept documents include frontmatter with at least `type`.
- Prefer normal Markdown links between concepts.

Run this after editing the bundle:

```sh
npm run knowledge:check
```

`knowledge:check` is intentionally stricter than permissive OKF consumers. It
may fail on broken internal links because this repository treats those links as
curated context quality issues.

## Agent Contract

When the human operator gives a concrete instruction, a coding agent has
exactly three valid responses:

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

## Work Modes

Use the lightest mode that satisfies the request. Do not run the full PR
handoff workflow for every implementation prompt.

Work mode selection is agent judgment, not a keyword filter. The examples below
are signals to consider, not a rule engine. Hooks must not choose a work mode
from prompt text.

### Fast Local Loop

Default for ordinary implementation prompts when the repository owner did not
ask for review handoff and the change does not inherently need one.

In this mode:

- Implement the change.
- Run focused validation based on touched files.
- Report the result and any validation not run.
- Do not create a Linear issue, submit a Graphite PR, or run PR metadata
  commands unless the task clearly needs review handoff.

This is the normal speed path for small and medium coding tasks.

### PR Handoff Loop

Use this mode when the repository owner's intent is review handoff, or when the
work is clearly meant to be reviewed as a PR or stack.

In this mode:

- Use Graphite for branch, commit, submit, stack, publish, and sync.
- Run the focused validation needed for the changed files.
- Run `npm run pr:handoff -- ...` after Graphite submit.
- Run `npm run pr:ready` once before handoff to catch local metadata and
  template gaps.
- After handoff, do not poll CI or Graphite mergeability. The repository owner
  reviews the Graphite App state and merges there; if merge is blocked, they
  pass the concrete error back to the agent.

### Release/Public Loop

Use this mode for release, changelog, public launch, security, cross-repo,
branch protection, CI, or externally visible project-process work.

In this mode:

- Prefer explicit Linear tracking.
- Use Graphite stacks when there are separate reviewable layers.
- Run broader validation and documentation checks.
- Treat public docs, templates, and repository settings as product surfaces.

Hooks may block hard safety violations, remind about observed Graphite handoff
state, or signal likely validation needs. They must not replace the agent's work
mode, stack shape, validation, or implementation judgment.

## Work Classification

Default PR-bound mapping:

```txt
One trackable request
-> one Linear issue
-> one Graphite stack
-> one or more GitHub PRs
```

Use this decision order before editing:

- Fast local work: use Fast Local Loop by default when the owner asks for an
  implementation but not for PR handoff.
- Single PR: use one Graphite PR when the work has one reviewable concern, such
  as a typo, small docs patch, isolated test, or narrow bug fix.
- Stack: use multiple Graphite PRs when one outcome has several reviewable
  slices or layers.
- Multiple Linear issues: split the issue only when the request has separate
  product outcomes, owners, timelines, or acceptance criteria.

Do not create extra Linear issues merely because a Graphite stack has multiple
PRs.

## Slice Strategy

Choose how to split the work before broad edits. Graphite stacks are review and
merge structure; they do not require horizontal engineering layers.

Default to a vertical slice when the work crosses a new or uncertain boundary:

- New repo, service, package, deployment target, or runtime boundary.
- Client/server, browser/server, worker/server, or multi-repo integration.
- Collaboration, authentication, encryption, persistence, migrations, or
  external systems.
- Any change where the biggest risk is "do these parts actually connect?"

A vertical slice should prove a thin end-to-end path first. It may be incomplete
in depth, but it must run through the important boundary. Prefer this before
deepening any one layer.

Use a tracer bullet as the first vertical slice when uncertainty is high. A
tracer bullet is the smallest useful path through the system, such as:

```txt
Tabula web
-> room client config
-> external room endpoint
-> minimal room response
-> smoke or manual verification
```

For example, if `tabula-room` becomes a separate repository, the first work
should not be a complete room server. The first work should prove that Tabula can
talk to a minimal external room service end to end. Security hardening,
persistence, deployment, and protocol depth should follow after the path is
proven.

Use horizontal layers only when the integration path is already proven or the
work is mostly internal cleanup:

- Pure refactor below already-working behavior.
- Test-only, docs-only, or tooling-only changes.
- A shared contract or type cleanup that reduces later diffs.
- A migration split where each layer can be verified independently.

Good stack shapes:

```txt
High uncertainty:
PR 1: thin vertical tracer bullet
PR 2: harden protocol and data contracts
PR 3: add persistence/security/deployment depth
PR 4: tests and docs for the finished behavior

Low uncertainty:
PR 1: pure refactor or shared contract cleanup
PR 2: behavior change
PR 3: UI/tests/docs
```

Before choosing a horizontal split, ask whether reviewers can run or inspect a
meaningful behavior before the later branches land. If not, start with a
vertical slice instead.

## Start Of Work

Start by checking where you are:

```sh
npm run workflow:status
```

For Fast Local Loop, this is usually enough. Confirm the worktree is clean or
understand every existing change, then edit and run focused validation.

Start PR Handoff Loop work from trunk:

```sh
gt sync --delete-all
gt checkout --trunk
npm run workflow:status
```

Before editing:

- Confirm the worktree is clean or understand every existing change.
- Create or identify the `MTS-*` Linear issue for accepted maintainer work.
- Decide whether the work is local-only, one PR, one stack, or multiple Linear
  issues.
- Choose vertical slice, tracer bullet, or horizontal layer split before broad
  edits.

Use `npm run workflow:status` when resuming a thread, after Graphite submit, and
after merge. It summarizes the current branch, PR, metadata, checks, Graphite
stack, and next expected action.

Use `npm run workflow:doctor` for setup, workflow automation changes,
environment suspicion, or post-merge cleanup diagnostics. Do not run it as a
default step for every small implementation. It checks repo-local templates,
scripts, Graphite availability, GitHub merge settings, stale Graphite temporary
branches, label catalog drift, and local Git maintenance warnings without
submitting or merging anything. Fixes are intentionally split into explicit
commands by effect:

- `npm run workflow:doctor -- --fix-graphite-config`
- `npm run workflow:doctor -- --delete-stale-graphite-base`
- `npm run workflow:doctor -- --sync-labels`
- `npm run workflow:maintenance -- --register`

Use `npm run workflow:sync` after a PR or stack merge. It is the single
post-merge cleanup command for normal work. Internally it runs Graphite sync,
checks out trunk, prunes remote-tracking refs, runs post-merge local Git object
maintenance, runs workflow doctor, and reports workflow status.
`workflow:doctor`, `workflow:maintenance`, and `workflow:status` remain separate
because they answer different questions: doctor checks repo/tooling health,
maintenance repairs local Git object storage at safe boundaries, and status
reports the current branch and PR state.

Git object cleanup is separate from Graphite branch cleanup. Graphite owns
merged branch cleanup through `gt sync --delete-all`. Git owns unreachable local
objects. If `workflow:doctor` reports `.git/gc.log` or too many loose Git
objects, do not prune during active branch work. The repair point is the
post-merge boundary: after the PR or stack is merged, `npm run workflow:sync`
runs `npm run workflow:maintenance -- --post-merge`, which repairs local Git
object storage only when the repo is clean and on trunk.

## Command Ownership

Graphite owns PR-bound branch and PR lifecycle:

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

GitHub API and GitHub CLI are allowed only for metadata and repository hygiene
that Graphite does not own:

- `npm run pr:handoff` is the normal post-submit path. It reviews the PR title,
  writes the review body, applies label and assignee metadata, and records agent
  provenance.
- `npm run pr:title`, `npm run pr:body`, and `npm run pr:metadata` are lower
  level recovery or focused-edit commands.
- `npm run pr:ready` checks local handoff completeness: PR state, metadata,
  title, body, branch policy, and fast whitespace checks. It must not poll CI
  or Graphite mergeability as a merge gate.
- `npm run workflow:doctor -- --sync-labels` may sync GitHub labels.
- `npm run workflow:doctor -- --delete-stale-graphite-base` may delete stale
  `graphite-base/*` branches only when no PRs are open.

Do not use raw `git` or `gh` commands for Graphite-owned lifecycle operations.
In particular, do not use `git checkout -b`, `git commit`, `git push`,
`git pull`, `gt push`, `gt pull`, `gh pr create`, `gh pr ready`, `gh pr edit`,
`gh pr merge`, or direct mutating `gh api` calls against pull requests or
remote refs.

State-changing workflow commands must be serialized. Do not run Graphite
mutations, GitHub metadata mutations, Linear status updates, or remote ref
cleanup in parallel with each other or with reads that depend on their result.
Parallel reads and validation are fine after the mutation has completed.

When multiple agents work in parallel, use one Git worktree per agent session.
Do not have two agents mutate the same Graphite stack from the same worktree.

## Linear Standard

Current Linear team: `Members of Technical Staff`.
Current Linear issue key: `MTS`.
Current Linear project: `tabula-md`.

Create a Linear issue when maintainer work has durable product, architecture,
security, or implementation context.

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

Lifecycle:

- Start from trunk with `gt sync --delete-all` and `gt checkout --trunk`.
- Create a layer by editing files, then running
  `gt create <agent-or-dev-prefix>/short-kebab-slug --all -m "type(scope): summary"`.
- For selected hunks or files, use `gt add <files>`, `gt create --patch`, or
  `gt create --update` instead of staging unrelated work.
- Insert a new layer between the current branch and its child with
  `gt create --insert` when the stack already has an upstack branch.
- Create on a specific parent with `gt create --onto <branch>` when the current
  checkout is not the intended parent.
- Update a layer with `gt checkout <branch>`, edits, and
  `gt modify --all -m "type(scope): summary"` when the change still belongs to
  that layer.
- Use `gt modify --into <downstack-branch>` for focused downstack edits when
  the current checkout is upstack.
- Submit with `gt submit` for one branch or `gt submit --stack` for a stack.
- For large or risky stacks, preview before mutating remote state with
  `gt submit --dry-run` or `gt submit --confirm`.
- Request non-self reviewers at submit time with
  `gt submit --reviewers <github-login>` when reviewers are known.
- Publish an existing draft PR with `gt submit --publish --update-only`.
- Fetch a remote PR or stack with `gt get <branch-or-pr-number>`; add
  `--remote-upstack` when remote-only upstack PRs should be fetched too.
- Use `gt log short` before handoff.
- Use `gt restack`, `gt move`, `gt reorder`, `gt fold`, `gt split`,
  `gt absorb`, and `gt undo` for stack repair instead of raw Git recovery.

Graphite branch rules:

- Do not create an empty branch first.
- Make the edit, stage it, then run `gt create`.
- Pass an explicit branch name to `gt create` for PR-bound work.
- Use slash-separated ownership and kebab-case intent:
  - Agent-authored work: `<tool>/<short-slug>` for known agent tools, such as
    `codex/<short-slug>`, `claude/<short-slug>`, or `cursor/<short-slug>`.
  - New agent tools: `agent/<tool-slug>/<short-slug>` when a short top-level
    prefix would be ambiguous.
  - Human maintainer work: `dev/<github-login>/<short-slug>`.
- Keep the slug short, usually two to five words.
- Do not include date prefixes, Linear issue keys, session ids, or underscores.
- Do not rename an open Graphite PR branch just for style. GitHub PR branch
  names are immutable, and `gt rename` removes the PR association unless forced.
- Use Conventional Commit style for commit and PR titles:
  `type(scope): summary`.
- Keep Linear issue keys out of commit titles and PR titles by default.
- Treat each Graphite branch as one atomic review layer.
- Treat `graphite-base/*` as a Graphite temporary implementation branch, not as
  a work branch. Do not edit, submit, or review it directly.

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
`agent`, `collab`, `comments`, `files`, `layout`, or `ci`. Keep summaries
short, lower-case, and free of trailing periods.

For Graphite concepts and examples, use
`knowledge/workflow/graphite-pr-lifecycle.md` and
`knowledge/workflow/graphite-stack-shape.md`.

## Stack Shape

Shape the stack around the chosen slice strategy. Each branch needs one clear
review purpose and should be independently reviewable, testable, and revertible.

Use `gt modify` only when the change still belongs to the current review layer:

- Reviewer feedback on that PR.
- A bug, test, copy, or documentation adjustment needed for that PR to be
  correct.
- PR metadata, title, or body cleanup for that same layer.

Use `gt create` to add a new upstack PR when the work introduces a new
reviewable concern:

- The PR title would need to change to describe the new work.
- The PR body `Review Focus` would need multiple unrelated focus areas.
- A new command, hook policy, doc structure, runtime behavior, migration, or UI
  surface can be reviewed and tested independently.
- The change is useful but not required for the current PR's acceptance
  criteria.
- The current PR would become harder to revert cleanly.

If scope drift is discovered before submit, use `gt split`, `gt move`, or
`gt fold` to reshape the stack. If it is discovered after submit, prefer a new
upstack branch with `gt create` over repeatedly widening the open PR. Keeping the
work in the existing PR is an exception for tightly-coupled foundation cleanup
or explicit repository-owner direction; call that out in `Implementation Notes`.

Before submit, confirm:

- `gt log short` reads bottom-to-top as a coherent implementation story.
- Each branch title follows `type(scope): summary` and names the layer's
  purpose.
- Use `gt fold` for layers that are too small or too dependent to review alone.
- Use `gt split --by-file <pathspec>` for non-interactive agent-safe splits by
  file, or interactive `gt split --by-commit` / `gt split --by-hunk` when a
  human can resolve the prompts.
- Use `gt reorder`, `gt move`, or `gt restack` when dependencies are out of
  order.
- Use `gt absorb --dry-run` before `gt absorb` when staged feedback may belong
  to older downstack commits.
- Use `gt fold --close` or `gt delete --close` when reshaping already-submitted
  branches should also close their associated GitHub PRs.
- Use `gt squash` to collapse multiple commits inside one Graphite branch before
  handoff.
- Use `gt undo` before reaching for raw Git after an incorrect Graphite
  mutation.

For split/fold/reorder criteria, use
`knowledge/workflow/graphite-stack-shape.md`.

## Pull Request Standard

PR title:

```txt
type(scope): summary
```

The title must represent the final diff, not just the original task wording.
Before readiness, compare the PR title against the actual changed files, the
current commit subject, and the PR body `Summary`. If the implementation scope
drifted, update both the current commit subject and the PR title.

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

Agent-authored PRs include an additional `Agent` section inserted by
`pr:metadata`. Public contributor PRs do not need that section.

For UI changes, include screenshots or an explicit `Not visual` note. For
behavior changes, include the exact verification command or manual check. If
validation is intentionally skipped, explain why in `Not run`.

After Graphite submit, run one handoff command:

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

`pr:handoff` runs the title, body, and metadata steps in order. It is not an
automatic summarizer. The agent writes the content from the actual
implementation, validation, and remaining risk; the script applies it in the
standard template. `pr:ready` fails if body sections are missing or still
placeholder-only.

Use the lower-level commands only for focused recovery or targeted updates:

```sh
npm run pr:title -- --title "type(scope): summary"
npm run pr:body -- --summary "..." --review-focus "..." --implementation-notes "..." --validation-automated "..." --risk "..." --evidence "..."
npm run pr:metadata -- --label <Label>
```

`pr:title` is the explicit title-review checkpoint. Use the existing title if
it still describes the final diff; otherwise choose the smallest Conventional
Commit title that names the dominant change. `pr:ready` fails if the PR title
and the current commit subject disagree.

`pr:metadata` records the agent tool and session id in the PR body. It uses
explicit arguments or agent context environment variables. Agent-authored PRs
must not rely on guessed session ids. Pass the actual tool name, such as
`Codex`, `Claude Code`, `Cursor`, or another clear agent name:

```sh
npm run pr:metadata -- --label <Label> --agent "Codex" --session <session-id>
```

```sh
npm run pr:metadata -- --label <Label> --agent "Claude Code" --session <session-id>
```

Before asking the repository owner to merge, run:

```sh
gt submit --publish --update-only
npm run pr:handoff -- --title "type(scope): summary" --label <Label> ...
npm run pr:ready
```

`gt submit --publish --update-only` is the standard way to move an existing
Graphite PR from draft to ready for review without creating new PRs. Do not use
`gh pr ready` unless Graphite is unavailable and the repository owner explicitly
approves the fallback.

`pr:ready` checks local cleanliness, PR metadata, title shape, body template
content, branch naming policy, PR-title-to-commit-subject agreement, and fast
whitespace checks. It does not submit, merge, publish, poll CI, poll Graphite
mergeability, or run expensive validation.

After `pr:ready` passes, hand the PR to the repository owner with the Graphite
URL, the validation that ran, and any validation that intentionally did not run.
Do not keep watching the PR. The Graphite App is the final merge surface for
CI, mergeability, review status, and the merge button.

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
npm run pr:handoff -- --label <Label> --reviewer <github-login> ...
```

## Validation Standard

- Run the smallest validation that can catch likely regressions in the chosen
  work mode.
- Run focused unit tests after pure-function changes.
- Run `npm run knowledge:check` after changing `knowledge/**`.
- Run `npm run test:hooks` after changing `.codex/hooks/**`, workflow policy
  scripts, or agent automation checks.
- Run `npm run build` after TypeScript, import, package, or app wiring changes.
- Run `npm run test:browser` after editor, preview, right panel, file tree,
  share, or collaboration UI changes.
- Do not run `npm test` plus `npm run build` plus browser smoke by default for
  docs-only, comment-only, or narrow tooling changes. Escalate validation when
  the changed files or risk justify it.

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
order from bottom to top. The repository owner checks the final Graphite App
merge state; agents should not repeatedly poll GitHub or Graphite after
handoff. If the merge is blocked, the owner sends the specific Graphite or CI
error back to the agent.

Repository merge policy:

- `main` is the only long-lived branch.
- Do not create `dev`, `develop`, or `staging` branches for normal work.
- GitHub merge commits are disabled.
- Squash and rebase remain available.
- Open PR branches stay alive while review is active.
- Merged and closed branches should not be kept around.
- GitHub automatically deletes merged head branches.
- Do not use GitHub Merge Queue before Graphite Merge Queue is intentionally
  enabled.

After the repository owner merges a PR or stack:

```sh
npm run workflow:sync
```

During active stack merges, Graphite may create remote `graphite-base/*`
branches to keep upstack PR diffs stable while it rebases or retargets them.
Do not touch those branches while PRs are open. After the full stack is merged,
`npm run workflow:sync` has run, and there are no open PRs, any remaining
`graphite-base/*` branches are stale temporary branches. Run:

```sh
npm run workflow:doctor -- --delete-stale-graphite-base
```

to remove stale remote Graphite temporary branches instead of letting them
accumulate.

Then move the Linear issue to `Done` when the closing PR has landed and no
follow-up work remains.

## Release And Changelog

Release and changelog strategy lives in
`knowledge/runbooks/release-preparation.md`. Normal workflow work should only
touch release artifacts when the repository owner explicitly asks for release or
changelog preparation.

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

## Agent Automation

The workflow does not depend on one agent runtime. Codex, Cursor-compatible
agents, Claude Code, and future tools must all follow the same Linear,
Graphite, validation, PR metadata, merge, and cleanup rules.

This repository currently includes project-local Codex hooks in `.codex/` as
guardrails for Codex sessions. Other agents may not run those hooks. When an
agent does not run the hooks, it must manually follow the same checks by using
the scripts in this document where relevant:

```sh
npm run workflow:status
npm run pr:ready
npm run test:hooks
```

`workflow:doctor` is for setup suspicion, workflow automation changes, and
post-merge diagnostics. It is not a mandatory command for every implementation
turn.

Codex hooks reduce repeated workflow mistakes, but they do not replace agent
judgment, code review, Linear planning, Graphite stack design, or test
selection.

Codex hooks automatically help with:

- Adding short workflow context when a Codex session starts.
- Adding focused context when a prompt contains an explicit post-merge signal.
- Blocking prompts that appear to contain API keys, access tokens, or private
  key material.
- Enforcing parts of the command policy above.
- Recording likely validation needs after file changes.
- Warning, not blocking, when validation appears to be missing.
- Continuing the turn when Graphite submit happened in the current turn but
  `pr:handoff` is still missing.
- Reminding without blocking when older workflow state is pending during a later
  explanation or investigation turn.
- Continuing the turn when an explicit post-merge signal needs `workflow:sync`.
- Denying approval requests that would bypass the same blocked command policy.

Codex hooks do not automatically:

- Create Linear issues.
- Decide the right stack shape.
- Choose the correct implementation.
- Run expensive validation every time.
- Submit or merge PRs by themselves.
- Replace `pr:handoff`.
- Move Linear issues to `Done`.

Project-local hooks load only when the project `.codex/` layer is trusted. When
Codex reports changed hooks, review and trust them through the Codex hooks UI or
CLI hook review flow before expecting them to run. Claude Code and other agents
should treat `.codex/` as reference automation unless they explicitly support
Codex hook execution.
