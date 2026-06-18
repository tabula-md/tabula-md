---
type: Repository Area
title: Web app
description: React and Vite app for the Markdown editor, preview, panels, comments, local persistence, and collaboration client.
resource: repo:/apps/web
tags: [repo, web, editor]
---

# Scope

`apps/web` contains the user-facing Tabula.md workspace:

- Markdown editing and preview.
- Toolbar, rail, status, and empty-state layout.
- Files, Outline, and Comments panel surfaces.
- Local persistence and collaboration client wiring.

# Review Notes

Run `npm run build` after TypeScript, import, package, or app wiring changes.
Run focused browser smoke after editor, preview, panel, file tree, share, or
collaboration UI changes.

# Related

- [Markdown-file-first product direction](/product/markdown-file-first.md)
- [Tabula Room](tabula-room.md)
