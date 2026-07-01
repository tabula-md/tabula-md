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
- Export encrypted Snapshot links when someone needs their own local copy.
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
at it. To run local Snapshot links, run the separate JSON snapshot service. See
[`docs/self-hosting.md`](docs/self-hosting.md).

## Self-Hosting

Self-hosted deployments are static Vite builds. Serve `dist` from a static host.
Live collaboration and encrypted Snapshot links use root URL fragments such as
`/#room=<roomId>,<roomKey>` and `/#json=<jsonId>,<key>`.

Set these environment variables for the capabilities you want to enable:

- `VITE_TABULA_ROOM_URL` for **Share > Start session**.
- `VITE_TABULA_JSON_URL` for **Snapshot link**.
- `VITE_TABULA_FIREBASE_CONFIG` for encrypted live-room recovery.

Without those service URLs, the matching feature stays unavailable instead of
falling back to localhost. See
[`docs/self-hosting.md`](docs/self-hosting.md).

## Official Hosted Service

[`tabula.md`](https://tabula.md) is the managed hosted deployment of the same
OSS app pointed at the official room relay, encrypted snapshot service, and
Firebase live recovery provider.

## Contributing

Use GitHub Issues for public bug reports and feature requests.

See `CONTRIBUTING.md` for public contribution guidance and `SECURITY.md` for
private vulnerability reporting.

## Docs

See `docs/README.md` for public project docs. Maintainer workflow and durable
agent-readable context live in `WORKFLOW.md` and `knowledge/`.

## License

MIT. See `LICENSE`.
