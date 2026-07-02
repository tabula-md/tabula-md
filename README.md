# Tabula.md

Local-first Markdown workspace for files that people and coding agents can
share without leaving Markdown behind.

[Open Tabula.md](https://tabula.md) · [Docs](docs/README.md) ·
[Self-hosting](docs/self-hosting.md)

Tabula.md is a focused editor for writing, previewing, commenting, and sharing
Markdown files. It keeps Markdown as the source of truth instead of turning a
workspace into a database or proprietary document format.

<p align="center">
  <img
    src=".github/assets/tabula-product-demo.gif"
    alt="Tabula.md showing an empty workspace, Markdown editing, split preview, and project outline"
    width="960"
  />
</p>

## Status

Tabula.md is in public preview. The local Markdown workflow is usable today;
live collaboration, encrypted snapshot links, and hosted recovery are available
and will continue to harden before `1.0.0`.

## Why Tabula.md

- Write and preview GitHub Flavored Markdown in one local workspace.
- Keep files, outline, and product comments next to the editor.
- Start an encrypted live session only when collaboration is needed.
- Send encrypted Snapshot links when someone needs their own local copy.
- Preserve Markdown for handoff to teammates, repositories, and coding agents.

## Run Locally

Install dependencies:

```sh
npm install
```

Start the app:

```sh
npm run dev
```

Open `http://localhost:5173`.

## Sharing Model

Tabula.md uses URL fragments for private sharing contracts:

- Live collaboration: `/#room=<roomId>,<roomKey>`
- Snapshot import: `/#json=<jsonId>,<key>`

Room and snapshot services store or relay encrypted payloads. Room keys,
snapshot keys, plaintext Markdown, comments, and selections stay client-side.

## Optional Services

The app runs without hosted services. Configure only the capabilities you want:

| Capability | Environment variable | Service role |
| --- | --- | --- |
| Live sessions | `VITE_TABULA_ROOM_URL` | Encrypted room relay |
| Snapshot links | `VITE_TABULA_JSON_URL` | Encrypted snapshot store |
| Live-room recovery | `VITE_TABULA_FIREBASE_CONFIG` | Ciphertext-only room recovery |

Missing service URLs disable the matching feature instead of falling back to a
local or unofficial endpoint.

## Project Shape

- `tabula-app`: React/Vite app shell, editor UI, browser persistence, and
  collaboration adapters.
- `packages/tabula`: pure TypeScript core for Markdown, formatting, workspace
  models, comments, data encoding, encryption, and link contracts.
- [`tabula-room`](https://github.com/tabula-md/tabula-room): encrypted live
  collaboration relay.
- [`tabula-json`](https://github.com/tabula-md/tabula-json): encrypted immutable
  Snapshot blob store.

The managed service at [tabula.md](https://tabula.md) runs the same OSS app
against the official room relay, snapshot store, and live-room recovery
provider.

## Contributing

Use GitHub Issues for public bug reports and feature requests.

See `CONTRIBUTING.md` for contribution guidance and `SECURITY.md` for private
vulnerability reporting.

## Backed By

Tabula.md is backed by
[Marker Inc Korea](https://github.com/Marker-Inc-Korea).

## License

MIT. See `LICENSE`.
