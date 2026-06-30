# Tabula.md

A local-first Markdown workspace for files that people and coding agents can
share safely.

Tabula.md is for writing, previewing, commenting, and sharing Markdown files
without turning them into a database or proprietary document format.

## Status

Tabula.md is in public preview. The core Markdown workflow is usable locally;
live collaboration is experimental and will continue to evolve before a stable
`1.0.0` release.

## What It Does

- Edit Markdown files in a focused local workspace.
- Preview GitHub Flavored Markdown.
- Keep project context close with files, outline, and comments panels.
- Open live sessions when collaboration is needed.
- Export encrypted copy links when someone needs their own local copy.
- Keep Markdown usable for handoff to teammates and coding agents.
- Preserve Markdown as the source of truth.

## Run

Install dependencies:

```sh
npm install
```

Start the Tabula app:

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

To run local `#json` snapshot share links, run the separate JSON service and
point the app at it:

```sh
git clone https://github.com/tabula-md/tabula-json.git ../tabula-json
cd ../tabula-json
npm install
npm run dev
```

Then, from this repository:

```sh
VITE_TABULA_JSON_URL=http://localhost:3004 npm run dev
```

## Self-Hosting

Self-hosted deployments are static Vite builds. Serve `dist` from a static
host. Live collaboration and encrypted copy links use root URL fragments such
as `/#room=<roomId>,<roomKey>` and `/#json=<jsonId>,<key>`.

Set these environment variables for the capabilities you want to enable:

- `VITE_TABULA_ROOM_URL` for **Share > Start session**.
- `VITE_TABULA_JSON_URL` for **Shareable link**.

Without those service URLs, the matching feature stays unavailable instead of
falling back to localhost. See
[`docs/live-collaboration.md`](docs/live-collaboration.md).

## Official Hosted Service

[`tabula.md`](https://tabula.md) is the managed hosted deployment of this app
pointed at the official room and encrypted snapshot services. Production
credentials, managed-service account details, provider-specific deploy settings,
and private operations runbooks do not belong in this public repository.

## Contributing

Use GitHub Issues for public bug reports and feature requests.

See `CONTRIBUTING.md` for public contribution guidance and `SECURITY.md` for
private vulnerability reporting.

## Docs

See `docs/README.md` for public project docs. Maintainer workflow and durable
agent-readable context live in `WORKFLOW.md` and `knowledge/`.

## License

MIT. See `LICENSE`.
