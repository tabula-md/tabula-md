# @tabula-md/tabula

Core product contracts for Tabula.md.

This package is intentionally small and browser-service agnostic. It contains
pure models for Markdown editing, workspace files, document controls, comments,
status labels, live room links, encrypted JSON snapshot links, and the pure
parts of collaboration presence. The Tabula app in `tabula-app` wires these
contracts to React, CodeMirror, local storage, collaboration transports, and
network services.

## Boundary

Keep in this package:

- Markdown text transforms and formatting commands.
- Workspace file and tab state transitions.
- Share link parsing and URL contracts.
- Comment/status/document control view models.
- Collaboration envelope, session, collaborator, and presence models that do
  not require a transport.
- Pure helpers that can be tested without the DOM, React, storage, or network.

Keep outside this package:

- React components and hooks.
- CodeMirror extensions and editor refs.
- Browser storage, file picker, clipboard, and download behavior.
- Socket.IO, fetch, Yjs transactions, or browser crypto wiring.
- `tabula-room`, `tabula-json`, Cloudflare, Render, or production deployment
  settings.
- Product surfaces that depend on a service account, billing, auth, or runtime
  environment.

## Link Contracts

Tabula has two first-class share links:

- Live collaboration: `https://tabula.md/#room=<roomId>,<roomKey>`
- Encrypted snapshot import: `https://tabula.md/#json=<snapshotId>,<snapshotKey>`

The key stays in the URL hash so it is client-only. Servers receive the object
identifier, not the decryption key.

## Example

```ts
import {
  parseRoomShareUrl,
  parseJsonShareUrl,
  applyMarkdownFormatCommand,
} from "@tabula-md/tabula";

const room = parseRoomShareUrl("https://tabula.md/#room=abc,secret");
const snapshot = parseJsonShareUrl("https://tabula.md/#json=abc,secret");

const nextText = applyMarkdownFormatCommand({
  command: "bold",
  text: "hello",
  selectionStart: 0,
  selectionEnd: 5,
}).text;
```

## Service App Relationship

`tabula-app` is the tabula.md service app. It can choose to enable or hide service
features such as live collaboration, encrypted snapshot upload, Send to..., or
future Tabula+ boundaries without changing the pure contracts here.
