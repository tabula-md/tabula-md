# AGENTS.md

## Project Overview

Tabula.md is a local-first Markdown workspace for writing, previewing,
commenting, and handing off Markdown files to people or AI agents.

Product direction:

- Keep the app Markdown-file-first.
- Do not turn the first screen into a dashboard, database, or marketing page.
- The right panel is project context: Files, Outline, Comments.
- Comments are product comments, not separate notes.
- Use `Tabula.md` for product-facing naming and `Tabula` only as internal
  shorthand.

## Workflow

- Follow `WORKFLOW.md` for work classification, Linear, Graphite, PR metadata,
  validation, merge cleanup, command policy, and Codex hook behavior.
- Treat `WORKFLOW.md` as the workflow source of truth. Do not duplicate or
  override workflow rules in this file.
- If workflow guidance conflicts, `WORKFLOW.md` wins.

## Commands

- Install: `npm install`
- Dev web app: `npm run dev`
- Dev collaboration server: `npm run server`
- Full local collaboration dev: `npm run dev:all`
- Test: `npm test`
- Hook policy test: `npm run test:hooks`
- Build: `npm run build`
- Browser smoke: `npm run test:browser`
- Workflow doctor: `npm run workflow:doctor`
- Workflow status: `npm run workflow:status`
- PR readiness: `npm run pr:ready`
- Focused browser smoke: `npm run test:browser:workspace`,
  `npm run test:browser:editor`, `npm run test:browser:layout`,
  `npm run test:browser:panels`, `npm run test:browser:collab`

## Repository Map

- `WORKFLOW.md`: standard workflow for implementation, review, and merge.
- `apps/web`: React/Vite app, Markdown editor, preview, comments, panels, local
  persistence, and collaboration client.
- `apps/collab-server`: current collaboration server prototype.
- `packages/collab-protocol`: shared collaboration route and metadata contracts.
- `docs`: supporting engineering, onboarding, and reference docs.
- `private-docs`: product planning documents.
- `private-docs/adr`: architecture decision records.

## Code Style

- Prefer existing React, hook, CSS, and pure-function patterns before adding new
  abstractions.
- Keep Markdown behavior in pure, tested modules when practical.
- Keep UI copy and component naming consistent: use "Comments", not "Notes".
- For major architecture decisions, ask the repository owner before creating or
  updating an ADR.
- When the repository owner confirms an ADR is needed, use
  `private-docs/adr/TEMPLATE.md` as the canonical source.
- Use `.ko.md` ADR files as Korean human-facing companions, not as the source of
  truth for agents.

## Testing

- Follow the validation rules in `WORKFLOW.md`.
- Add or update tests for storage migration, Markdown commands, comment anchors,
  right panel view models, and future E2EE crypto/link parsing.

## Collaboration Security

The current Hocuspocus/Yjs share path is a prototype. The target collaboration
model is Excalidraw-style E2EE rooms.

Before changing room links, share behavior, tokens, or collaboration
persistence, read `private-docs/adr/0001-e2ee-collaboration.md` and preserve
these constraints:

- Room keys stay in the URL fragment.
- Room keys are never sent to the server.
- Server storage contains ciphertext only.
- Decryption failure must not overwrite local state.
- Token issuance must not grant write access based only on `roomId`.
