<p align="center">
  <a href="https://tabula.md">
    <img src="https://tabula.md/favicon.svg" alt="Tabula.md" width="56" />
  </a>
</p>

<h1 align="center">Tabula.md</h1>

<p align="center">
  <strong>Share Markdown. Keep it Markdown.</strong>
  <br />
  Open a folder, share one link, and edit together—without accounts, repositories, or platform migration.
</p>

<p align="center"><a href="https://tabula.md">Open Tabula.md</a></p>

<p align="center">
  <a href="https://tabula.md" target="_blank" rel="noopener">
    <img
      src=".github/assets/tabula-product-demo.gif"
      alt="A Markdown folder becoming a live Tabula.md room that two people edit together"
      width="960"
    />
  </a>
</p>

## Why Tabula.md

- Import a Markdown folder into the browser without signing up.
- Keep the workspace portable as Markdown files.
- Share the whole workspace with one encrypted room link.
- Edit together in the browser, or invite an AI agent from its own tools.

Tabula.md is in public preview. The hosted app at
[tabula.md](https://tabula.md) is the reference deployment.

Opening a folder imports its Markdown files into this browser. Tabula.md does
not modify or stay synchronized with the original folder; export a document or
workspace when you want the files back on disk.

## Use with an AI agent

Give Codex or another agent a live room link and a concrete task. It joins the
same workspace, reads the files, and writes Markdown back while you watch.

<p align="center">
  <a href="https://tabula.md" target="_blank" rel="noopener">
    <img
      src=".github/assets/tabula-agent-demo.gif"
      alt="Codex joining a live Tabula.md room, reading three Markdown files, and creating risks.md"
      width="960"
    />
  </a>
</p>

For agent-guided setup, paste this into Claude Code, Codex, or another
shell-capable agent:

```text
Set up Tabula MCP for this client by following every step at:
https://tabula.md/agent-install.txt
```

Or configure a supported local client directly.

Connect Codex:

```sh
codex mcp add tabula -- npx -y @tabula-md/mcp@latest
```

Connect Claude Code:

```sh
claude mcp add tabula -- npx -y @tabula-md/mcp@latest
```

After connecting, create a live session in Tabula.md and give the agent the
complete room URL with a concrete task. The URL is a bearer secret: anyone with
it can join and decrypt the session, so do not put it in logs, issues, or public
messages.

Local MCP keeps its plaintext working state on your device. A hosted MCP is a
trusted room participant and can read the room content shared with it.

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

- [Documentation](docs/README.md)
- [Live collaboration](docs/live-collaboration.md)
- [Export links](docs/shareable-links.md)
- [Self-hosting](docs/self-hosting.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Privacy](PRIVACY.md)

## Backed By

Tabula.md is backed by
[Marker Inc Korea](https://github.com/Marker-Inc-Korea).

## License

MIT. See `LICENSE`.
