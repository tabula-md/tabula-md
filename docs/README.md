# Project Docs

This directory is for public, user-facing project documentation.

Start here:

- [README](../README.md) - product overview and local run commands.
- [Live collaboration](live-collaboration.md) - Start session, room server, and
  hosted/self-hosted environment setup.
- [Shareable links](shareable-links.md) - encrypted copy links, JSON snapshot
  service, and hosted/self-hosted environment setup.
- [Contributing](../CONTRIBUTING.md) - public issue and pull request guidance.
- [Security](../SECURITY.md) - private vulnerability reporting.
- [Changelog](../CHANGELOG.md) - user-facing release notes.

## Repository Boundary

Tabula.md has three public open-source components:

- `tabula-md` is the local-first Markdown workspace web app.
- `tabula-room` is the encrypted collaboration room server.
- `tabula-json` is the encrypted snapshot store for shareable copy links.

`tabula.md` is the official hosted deployment of those components. Hosted
provider choices, production credentials, and private operations details do not
belong in the public OSS repos.

Maintainer workflow, agent instructions, architecture context, and internal
runbooks live outside this directory:

- [WORKFLOW](../WORKFLOW.md) - execution rules for maintainers and agents.
- [Knowledge bundle](../knowledge/index.md) - durable project context for
  maintainers and coding agents.
