# AGENTS.md

## Project Overview

Tabula.md is a local-first Markdown workspace for writing, previewing, commenting, and handing off Markdown files to people or AI agents.

Product direction:

- Keep the app Markdown-file-first.
- Do not turn the first screen into a dashboard, database, or marketing page.
- The right panel is project context: Files, Outline, Comments.
- Comments are product comments, not separate notes.
- Use `Tabula.md` for product-facing naming and `Tabula` only as internal shorthand.
- The user is taeha.

## Commands

- Install: `npm install`
- Dev web app: `npm run dev`
- Dev collaboration server: `npm run server`
- Full local collaboration dev: `npm run dev:all`
- Test: `npm test`
- Hook policy test: `npm run test:hooks`
- Build: `npm run build`
- Browser smoke: `npm run test:browser`
- Focused browser smoke: `npm run test:browser:workspace`, `npm run test:browser:editor`, `npm run test:browser:layout`, `npm run test:browser:panels`, `npm run test:browser:collab`

## Work Tracking

- Use Linear key `MTS` for trackable work unless taeha changes the Linear team key.
- GitHub Issues are not the default tracker; use Linear unless taeha explicitly asks otherwise.
- Linear issues are work-intent units: what needs to change and why.
- Graphite stacks are review/merge units: how the work is split into reviewable layers.
- GitHub PRs are the concrete layer records created and updated by Graphite.
- Graphite is mandatory for PR-bound work. Read `docs/graphite-workflow.md` before creating, updating, submitting, or merging PR branches.
- Default to stack-first work: `gt sync`, `gt checkout --trunk`, edit one reviewable layer, `gt create -am "[MTS-123] Layer title"`, repeat per layer, then `gt submit --stack`.
- Use a single Graphite PR only when the work is narrowly scoped to one reviewable concern.
- Split broad agent sessions into Graphite layers by concern, such as foundation refactor, data model/storage, behavior, UI, tests, and docs.
- Do not use raw `git checkout -b`, `git push`, or `gh pr create` for normal Tabula PR work.
- If Graphite CLI is missing, unauthenticated, uninitialized, or blocked by repo state, report the blocker instead of inventing a non-Graphite workflow.
- Use PR titles like `[MTS-123] Short title`.
- Include `Linear: MTS-123` in PR bodies.
- Include `Fixes MTS-123` in PR bodies when the PR closes a Linear issue.
- Do not put `Fixes MTS-123` on every PR in a Graphite stack; only the closing PR should close the issue.
- Follow `docs/graphite-workflow.md` for Graphite-specific commands, stack rules, and merge queue policy.
- Follow `docs/engineering-workflow.md` for the canonical workflow.

## Instruction Handling

When taeha gives a concrete instruction, agents have exactly three valid
responses:

- Explain why the instruction is technically wrong, product-inconsistent, or
  likely to break the project, with a concrete reason and a better alternative.
- Ask for clarification if the instruction is ambiguous enough that execution
  would likely produce the wrong result.
- Execute the instruction.

Do not ignore the instruction, silently substitute a different workflow, or
leave the work at a proposal when implementation is feasible.
Do not add compatibility paths, legacy behavior, defensive fallbacks, or alternate
implementations unless taeha explicitly asks for them or the existing product
contract already requires them.

## Repository Map

- `apps/web`: React/Vite app, Markdown editor, preview, comments, panels, local persistence, collaboration client.
- `apps/collab-server`: current collaboration server prototype.
- `packages/collab-protocol`: shared collaboration route and metadata contracts.
- `docs`: repo-visible engineering workflow and future public architecture docs.
- `docs/team-onboarding.md`: first-read guide for new collaborators.
- `docs/graphite-workflow.md`: canonical Graphite CLI, stack, Linear, and merge queue workflow.
- `private-docs`: product planning documents.
- `private-docs/adr`: architecture decision records.

## Code Style

- Prefer existing React, hook, CSS, and pure-function patterns before adding new abstractions.
- Keep Markdown behavior in pure, tested modules when practical.
- Keep UI copy and component naming consistent: use "Comments", not "Notes".
- For major architecture decisions, ask taeha before creating or updating an ADR.
- When taeha confirms an ADR is needed, use `private-docs/adr/TEMPLATE.md` for the canonical source.
- Use `.ko.md` ADR files as Korean human-facing companions, not as the source of truth for agents.

## Testing

- Run focused unit tests after pure-function changes.
- Run `npm run test:hooks` after changing `.codex/hooks/**`.
- Run `npm run build` after TypeScript, import, or app wiring changes.
- Run `npm run test:browser` after editor, preview, right panel, file tree, share, or collaboration UI changes.
- Add or update tests for storage migration, Markdown commands, comment anchors, right panel view models, and future E2EE crypto/link parsing.

## Collaboration Security

The current Hocuspocus/Yjs share path is a prototype. The target collaboration model is Excalidraw-style E2EE rooms.

Before changing room links, share behavior, tokens, or collaboration persistence, read:

- `private-docs/adr/0001-e2ee-collaboration.md`

Security constraints for the redesign:

- Room keys stay in the URL fragment.
- Room keys are never sent to the server.
- Server storage contains ciphertext only.
- Decryption failure must not overwrite local state.
- Token issuance must not grant write access based only on `roomId`.
