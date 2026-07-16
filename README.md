<p align="center">
  <a href="https://tabula.md">
    <img src="https://tabula.md/favicon.svg" alt="Tabula.md" width="56" />
  </a>
</p>

<h1 align="center">Tabula.md</h1>

<p align="center">
  A local-first Markdown workspace where people and AI agents edit the same files.
  <br />
  No account or platform workspace required.
</p>

<p align="center"><a href="https://tabula.md">Open Tabula.md</a></p>

<p align="center">
  <a href="https://tabula.md" target="_blank" rel="noopener">
    <img
      src=".github/assets/tabula-product-demo.gif"
      alt="An agent and a browser editing the same Tabula.md Markdown workspace"
      width="960"
    />
  </a>
</p>

## Why Tabula.md

- Open a Markdown workspace without signing up.
- Keep Markdown files as the source of truth.
- Share the whole workspace with one encrypted room link.
- Let people and AI agents edit through the same collaboration model.

Tabula.md is in public preview. The hosted app at
[tabula.md](https://tabula.md) is the reference deployment.

## Use with an AI agent

Connect Codex:

```sh
codex mcp add tabula -- npx -y @tabula-md/mcp@latest
```

Connect Claude Code:

```sh
claude mcp add tabula -- npx -y @tabula-md/mcp@latest
```

Then create a live session in Tabula.md and give the agent the complete room
URL with a concrete task. The URL is a bearer secret: anyone with it can join
and decrypt the session, so do not put it in logs, issues, or public messages.

See [Tabula.md MCP](https://github.com/tabula-md/tabula-mcp) for Claude Desktop,
other MCP clients, and self-hosting.

## Features

- GitHub Flavored Markdown editing and preview.
- Files, outline, and comments beside the editor.
- Browser autosave and local restore.
- Dark, light, and system themes.
- Encrypted live collaboration by room link.
- Encrypted copy links for point-in-time handoff.

## How the pieces fit

```text
Person in Tabula.md ─┐
                     ├─ same encrypted live session
Agent through MCP ───┘
          │
          ├─ tabula-room: encrypted realtime relay
          └─ tabula-json: encrypted copy-link storage
```

Tabula.md is the product surface. The other repositories provide the agent
connection and encrypted infrastructure behind sharing.

## Run Locally

```sh
npm install
npm run dev
```

Open `http://localhost:5173`. Local editing works without any hosted service.
Live collaboration and copy links require their respective optional services.

See [Development](DEVELOPMENT.md) for commands and architecture.

## Related Repositories

| Repository | Role |
| --- | --- |
| [`tabula-mcp`](https://github.com/tabula-md/tabula-mcp) | Connect Codex, Claude, and other MCP clients to shared Tabula.md workspaces. |
| [`tabula-room`](https://github.com/tabula-md/tabula-room) | Encrypted realtime relay for Tabula.md live sessions. |
| [`tabula-json`](https://github.com/tabula-md/tabula-json) | Encrypted snapshot store for Tabula.md copy links. |

## Project

- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Privacy](PRIVACY.md)

## Backed By

Tabula.md is backed by
[Marker Inc Korea](https://github.com/Marker-Inc-Korea).

## License

MIT. See `LICENSE`.
