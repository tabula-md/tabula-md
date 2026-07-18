# Project Docs

This directory is for public, user-facing project documentation.

Start here:

- [README](../README.md) - product overview and local run commands.
- [Live collaboration](live-collaboration.md) - workspace rooms, room server,
  and hosted/self-hosted environment setup.
- [Export links](shareable-links.md) - encrypted `#json` Export links,
  service, and hosted/self-hosted environment setup.
- [Self-hosting](self-hosting.md) - local app, room relay, encrypted room
  persistence, JSON Export link store, and production build wiring.
- [Contributing](../CONTRIBUTING.md) - public issue and pull request guidance.
- [Security](../SECURITY.md) - private vulnerability reporting.

## Repository Boundary

Tabula.md has three public open-source components:

- `tabula-md` is the local-first Markdown workspace Tabula app.
- `tabula-room` is the encrypted collaboration room relay.
- Firebase Storage stores encrypted live room checkpoint blobs; Firestore
  stores their generation pointers and expiry metadata.
- `tabula-json` is the encrypted blob store for Export links.

`tabula.md` is the official hosted deployment of those components. Hosted
provider choices, production credentials, and private operations details do not
belong in the public OSS repos.
