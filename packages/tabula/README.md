# @tabula-md/tabula

Core product contracts for Tabula.md.

This package is intentionally small and browser-service agnostic. It contains
pure models for Markdown editing, workspace files, document controls, comments,
status labels, live room links, encrypted JSON snapshot links, and the pure
parts of collaboration presence. It also owns the product data and room
envelope contracts used by JSON Snapshot links and live recovery. The Tabula
app in `tabula-app` wires these contracts to React, CodeMirror, local storage,
collaboration transports, Firebase, and network services.

## Boundary

Keep in this package:

- Markdown text transforms and formatting commands.
- Workspace file and tab state transitions.
- Share link parsing and URL contracts.
- AES-GCM primitives through `globalThis.crypto`.
- Versioned encrypted data encoding for Snapshot links and recovery blobs.
- Comment/status/document control view models.
- Collaboration envelope, session, collaborator, and presence models that do
  not require a transport.
- Pure helpers that can be tested without the DOM, React, storage, or network.

Public imports must go through the package root:

```ts
import { parseRoomShareUrl } from "@tabula-md/tabula";
```

Do not rely on deep source paths. The root `src/index.ts` file is the public
API list and new modules are private until they are explicitly exported there.

Keep outside this package:

- React components and hooks.
- CodeMirror extensions and editor refs.
- Browser storage, file picker, clipboard, and download behavior.
- Socket.IO, fetch, Yjs transactions, Firebase SDKs, or browser app wiring.
- `tabula-room`, `tabula-json`, Firebase project settings, Cloudflare, Render,
  or production deployment settings.
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
  applyMarkdownFormat,
  encodeEncryptedData,
  generateEncryptionKey,
  createJsonShareUrl,
  parseRoomShareUrl,
} from "@tabula-md/tabula";

const room = parseRoomShareUrl("https://tabula.md/#room=abc,secret");
const snapshotUrl = createJsonShareUrl("https://tabula.md", "abc", "secret");

const nextText = applyMarkdownFormat(
  "hello",
  { from: 0, to: 5 },
  "bold",
).text;

const key = await generateEncryptionKey();
const encrypted = await encodeEncryptedData(new TextEncoder().encode("# Draft"), key);
```

Subpath exports are available for lower-level integrations:

```ts
import { encryptData } from "@tabula-md/tabula/data/encryption";
import { createRoomEnvelope } from "@tabula-md/tabula/room";
```

## Service App Relationship

`tabula-app` is the tabula.md service app. It can choose to enable or hide
service features such as live collaboration, Firebase recovery, encrypted
snapshot upload, Send to..., or future Tabula+ boundaries without changing the
pure contracts here.
