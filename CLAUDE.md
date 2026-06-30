# CLAUDE.md

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
  validation, merge cleanup, command policy, and agent automation behavior.
- Treat `WORKFLOW.md` as the workflow source of truth. Do not duplicate or
  override workflow rules in this file.
- If workflow guidance conflicts, `WORKFLOW.md` wins.
- Claude Code may not run Codex project hooks. When hooks are unavailable,
  manually follow the same command policy and validation checks described in
  `WORKFLOW.md`.

## Commands

- Install: `npm install`
- Dev Tabula app: `npm run dev`
- Dev with local room server:
  `VITE_TABULA_ROOM_URL=http://localhost:3002 npm run dev`
- Test: `npm test`
- Hook policy test: `npm run test:hooks`
- Build: `npm run build`
- Browser smoke: `npm run test:browser`
- Workflow doctor: `npm run workflow:doctor`
- Workflow maintenance: `npm run workflow:maintenance`
- Workflow status: `npm run workflow:status`
- Workflow sync after merge: `npm run workflow:sync`
- PR handoff: `npm run pr:handoff`
- PR readiness: `npm run pr:ready`
- Focused browser smoke: `npm run test:browser:workspace`,
  `npm run test:browser:editor`, `npm run test:browser:layout`,
  `npm run test:browser:panels`, `npm run test:browser:collab`

## Repository Map

- `WORKFLOW.md`: standard workflow for implementation, review, and merge.
- `WORKFLOW.ko.md`: Korean-language version of the standard workflow.
- `knowledge/index.md`: agent-readable project knowledge map for deeper
  context; it does not replace `WORKFLOW.md`.
- `tabula-app`: React/Vite app, Markdown editor, preview, comments, panels, local
  persistence, and collaboration client.
- `tabula-room`: separate repository for the encrypted collaboration room
  server.
- `docs`: public, user-facing project documentation.
- `knowledge/architecture/collaboration-security.md`: required constraints for
  room links, share behavior, tokens, and collaboration persistence.

## Code Style

- Prefer existing React, hook, CSS, and pure-function patterns before adding new
  abstractions.
- Keep Markdown behavior in pure, tested modules when practical.
- Keep UI copy and component naming consistent: use "Comments", not "Notes".
- Read `knowledge/architecture/collaboration-security.md` before changing room
  links, share behavior, tokens, or collaboration persistence.
- Read `knowledge/index.md` when a task needs deeper product, workflow,
  architecture, repository, or release context than this file provides.
- For major architecture decisions, ask the repository owner before creating or
  updating an ADR.

## Testing

- Follow the validation rules in `WORKFLOW.md`.
- Run `npm run knowledge:check` after changing files in `knowledge/`.
- Add or update tests for storage migration, Markdown commands, comment anchors,
  right panel view models, and future E2EE crypto/link parsing.
