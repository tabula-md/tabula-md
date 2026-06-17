# Tabula.md Team Onboarding

Status: Active
Owner: taeha
Created: 2026-06-16

Localized companion: `team-onboarding.ko.md`

This document is the first-read guide for new Tabula.md collaborators. It
explains the tools, responsibilities, and default development process without
replacing the canonical workflow docs.

Read next:

- `AGENTS.md`
- `docs/engineering-workflow.md`
- `docs/graphite-workflow.md`

## Operating Model

Tabula.md uses a founder-led, agent-heavy workflow that should still feel like a
small engineering team.

- taeha owns product direction, prioritization, review, and merge decisions.
- Linear owns work intent: what should change, why, and how to verify it.
- Graphite owns stack structure, review flow, and merge flow.
- GitHub owns repository history, PR records, CI, and branch protection.
- Agents and humans implement work in reviewable layers.

Default mapping:

```txt
One trackable request
-> one Linear issue
-> one Graphite stack
-> one or more GitHub PRs
```

Do not create extra Linear issues just because a Graphite stack has multiple
PRs. Create multiple Linear issues only when there are separate product outcomes,
owners, timelines, or acceptance criteria.

## Required Access

Before doing PR-bound work, a team member needs:

- GitHub access to `tabula-md/tabula-md`.
- Linear access to the Tabula workspace and `MTS` team/project.
- Graphite access connected to the GitHub account.
- Local Graphite CLI authenticated with GitHub.
- Node.js and npm for local development.

Optional but useful:

- Graphite App for review and merge.
- Graphite notifications or Slack integration when the team uses Slack.
- Graphite VS Code extension if the developer prefers IDE-driven stack work.

## Local Setup

Install dependencies:

```sh
npm install
```

Run the app:

```sh
npm run dev
```

Run the collaboration server:

```sh
npm run server
```

Run both:

```sh
npm run dev:all
```

Set up Graphite once:

Graphite requires at least one commit in the repository. If the repository has no
commits yet, bootstrap the initial commit once before running `gt init`.

```sh
gt auth
gt init
```

Before every PR-bound task:

```sh
gt sync
gt checkout --trunk
```

## First Task

1. Pick or create a Linear issue.
2. Confirm the issue has a clear problem, scope, acceptance criteria, and
   verification notes.
3. Split the implementation into reviewable Graphite layers before editing
   broadly.
4. Create each layer with `gt create`.
5. Submit the stack with `gt submit --stack`.
6. Put the Linear issue key in each PR title and body.
7. Run the smallest verification set that proves the change.

Example:

```sh
gt sync
gt checkout --trunk

# Layer 1
gt add <files>
gt create -m "[MTS-123] Extract comment view model"

# Layer 2
gt add <files>
gt create -m "[MTS-123] Update comments panel UI"

# Layer 3
gt add <files>
gt create -m "[MTS-123] Add comments panel coverage"

gt submit --stack
```

Use a single Graphite PR only for one-concern work such as a typo, small docs
patch, isolated test, or narrow bug fix.

## Layering Rules

Good stack layers:

- Foundation refactor before behavior change.
- Data model or storage before UI that depends on it.
- Behavior before visual polish.
- Tests with the layer they verify, unless tests cover the whole stack.
- Docs with the layer they explain, unless docs describe the whole process.

Avoid:

- One PR that mixes refactor, storage, UI, tests, and docs.
- Separate Linear issues just to mirror PR count.
- Raw `git checkout -b`, raw `git push`, or `gh pr create` for normal work.
- Compatibility paths, legacy behavior, defensive fallbacks, or alternate
  implementations unless taeha explicitly asks for them.

## Review And Merge

Review happens in Graphite App, with GitHub as the underlying PR and CI record.

- Review stacks from bottom to top.
- Each PR should be understandable on its own.
- Feedback should be applied with `gt modify` on the relevant branch.
- Re-submit affected stacks with `gt submit --stack`.
- Merge through Graphite unless taeha explicitly chooses another flow.
- Use Graphite Merge Queue only after CI, branch protection, and review flow are
  stable enough to justify it.

Linear issue closing:

- Put `Linear: MTS-123` in every related PR body.
- Put `Fixes MTS-123` only on the PR that should close the issue.
- Linear issues should move to Done after the closing PR merges and integration
  automation runs.
- Linear issues remain as completed records; they are not deleted.

## Working With Agents

When a human asks an agent to implement work, the agent has exactly three valid
responses:

- Explain why the instruction is technically wrong, product-inconsistent, or
  likely to break the project, with a concrete alternative.
- Ask for clarification if the instruction is ambiguous enough to likely produce
  the wrong result.
- Execute the instruction.

Agents must not ignore instructions, silently substitute a different workflow, or
stop at a proposal when implementation is feasible.

For multiple agents:

- Use separate Linear issues to prevent agents from touching the same surface at
  the same time.
- Keep issue scopes concrete: product surface, architecture boundary, or risk
  area.
- Avoid vague issue scopes such as "UI improvements" or "bug fixes".
- Prefer one agent per Linear issue unless taeha intentionally splits a stack
  across agents.

Good parallel issue split:

```txt
MTS-101 Markdown command layer
MTS-102 Preview renderer styling
MTS-103 Comments panel refactor
MTS-104 E2EE room crypto spike
```

Bad parallel issue split:

```txt
MTS-101 UI improvements
MTS-102 Design polish
MTS-103 Bug fixes
```

## Verification

Use the smallest verification set that proves the change:

- Pure Markdown or view-model logic: `npm test`
- TypeScript wiring, imports, package config: `npm run build`
- Editor, preview, right panel, file tree, share, or collaboration UI:
  `npm run test:browser`

Document skipped verification in the PR body with the reason.

## Before Asking For Review

Checklist:

- Linear issue is linked in PR title/body.
- Stack layers are reviewable from bottom to top.
- Each PR has one reason to exist.
- Required tests or builds passed.
- UI changes include screenshots or a clear "not visual" note.
- No hidden fallback, compatibility path, or unrelated cleanup was added.
- `gt submit --stack` has updated the full stack.

## Escalation

Ask taeha before:

- Creating or updating an ADR.
- Changing collaboration, sharing, encryption, persistence, or deployment
  architecture.
- Moving ADRs between `private-docs/adr` and public `docs/adr`.
- Enabling Graphite Merge Queue or changing GitHub branch protection.
- Adding public GitHub issue intake.
