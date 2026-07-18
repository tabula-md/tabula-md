# AGENTS.md

## Project Overview

Tabula.md is a local-first Markdown workspace for writing, previewing,
commenting, and handing off Markdown files to people or AI agents.

Product guardrails:

- Keep the app Markdown-file-first.
- Do not turn the first screen into a dashboard, database, or marketing page.
- Treat the right panel as project context: Files, Outline, Comments.
- Comments are product comments, not a separate notes system.
- Use `Tabula.md` in product copy and `Tabula` only as internal shorthand.

## Workflow

- Follow `WORKFLOW.md` for scope, validation, and Graphite usage.
- Keep one reviewable concern per pull request.
- Use a stack only when changes are genuinely dependent.

## Commands

- Install: `npm install`
- Develop: `npm run dev`
- Develop with a local room server:
  `VITE_TABULA_ROOM_URL=http://localhost:3002 npm run dev`
- Test: `npm test`
- Build: `npm run build`
- Browser smoke: `npm run test:browser`
- Focused browser smoke: `npm run test:browser:workspace`,
  `npm run test:browser:editor`, `npm run test:browser:layout`,
  `npm run test:browser:panels`, `npm run test:browser:collab`

## Repository Map

- `tabula-app`: React/Vite app, editor, preview, comments, local persistence,
  and collaboration client.
- `packages/tabula`: reusable Markdown workspace and collaboration primitives.
- `tabula-room`: encrypted collaboration room server.
- `docs`: public user and architecture documentation.
- `scripts`: repository checks and browser smoke suites.

## Engineering Guidelines

- Prefer existing React, hook, CSS, and pure-function patterns before adding
  abstractions.
- Keep Markdown behavior in pure, tested modules when practical.
- Keep product copy and component naming consistent: use "Comments", not
  "Notes".
- Preserve the rule that room URLs are bearer secrets. Do not log them or send
  them to plaintext processors.
- Ask the repository owner before recording a major architecture decision.

## Testing

- Follow the validation rules in `WORKFLOW.md`.
- Add or update focused tests for storage migrations, Markdown commands,
  comment anchors, right-panel view models, room links, and collaboration
  persistence when those surfaces change.
