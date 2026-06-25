# Tabula.md

The default document format for humans and agents.

Tabula.md is a local-first Markdown workspace for writing, previewing,
commenting, and sharing Markdown documents without turning them into a database
or proprietary document format.

## Status

Tabula.md is in public preview. The core Markdown workflow is usable locally;
live collaboration is experimental and will continue to evolve before a stable
`1.0.0` release.

## What It Does

- Edit Markdown files in a focused local workspace.
- Preview GitHub Flavored Markdown.
- Keep project context close with files, outline, and comments panels.
- Open shareable live sessions when collaboration is needed.
- Keep Markdown usable for handoff to teammates and AI agents.
- Preserve Markdown as the source of truth.

## Run

Install dependencies:

```sh
npm install
```

Start the web app:

```sh
npm run dev
```

Then open `http://localhost:5173`.

To run local live collaboration, run the separate room server and point the app
at it:

```sh
git clone https://github.com/tabula-md/tabula-room.git ../tabula-room
cd ../tabula-room
npm install
npm run dev
```

Then, from this repository:

```sh
VITE_TABULA_ROOM_URL=http://localhost:3002 npm run dev
```

Production and self-hosted builds require `VITE_TABULA_ROOM_URL` for
**Share > Collaborate > Start session**. Without it, live collaboration is
unavailable instead of falling back to localhost. See
[`docs/live-collaboration.md`](docs/live-collaboration.md).

## Contributing

Use GitHub Issues for public bug reports and feature requests.

See `CONTRIBUTING.md` for public contribution guidance and `SECURITY.md` for
private vulnerability reporting.

## Docs

See `docs/README.md` for public project docs. Maintainer workflow and durable
agent-readable context live in `WORKFLOW.md` and `knowledge/`.

## License

MIT. See `LICENSE`.
