# @tabula-md/tabula

Core product contracts for Tabula.md, plus an embeddable document workbench.

```sh
npm install @tabula-md/tabula
```

Use the root package for Markdown and workspace models:

```ts
import { applyMarkdownFormat, parseRoomShareUrl } from "@tabula-md/tabula";
```

Use the workbench subpath for the reusable editor and preview:

```tsx
import { TabulaEmbeddedDocumentWorkbench } from "@tabula-md/tabula/workbench";
import "@tabula-md/tabula/workbench.css";
```

The package is browser-service agnostic. Hosts own persistence, collaboration
transport, and service configuration.

## Boundary

Keep in this package:

- Markdown text transforms and formatting commands.
- Workspace file and tab state transitions.
- Share link parsing and URL contracts.
- AES-GCM primitives through `globalThis.crypto`.
- Versioned encrypted data encoding for Export links and recovery blobs.
- Comment/status/document control view models.
- Workspace CRDT, binary room protocol, actor, envelope, sync, Awareness, and
  checkpoint code that does not require React or a concrete transport.
- Pure helpers that can be tested without the DOM, React, storage, or network.

Public imports must use a declared package export:

```ts
import { parseRoomShareUrl } from "@tabula-md/tabula";
```

Do not rely on deep source paths. The root `src/index.ts` file is the public
API list and new modules are private until they are explicitly exported there.
Both `tabula-app` and `tabula-mcp` must consume this package rather than copying
or redefining live-room contracts.

Agent clients should use the collaboration-only entrypoint so they do not load
editor and preview models:

```ts
import {
  createWorkspaceRoomCrdt,
  createWorkspaceRoomSyncController,
} from "@tabula-md/tabula/collaboration";
```

Keep outside the root import:

- React components and hooks, except for the explicit `./workbench` subpath.
- CodeMirror extensions and editor refs.
- Browser storage, file picker, clipboard, and download behavior.
- Socket.IO, fetch, hosted recovery SDKs, or browser app wiring.
- `tabula-room`, `tabula-json`, recovery provider settings, or managed
  deployment settings.
- Product surfaces that depend on a service account, billing, auth, or runtime
  environment.

## Link Contracts

Tabula has two first-class share links:

- Live collaboration: `https://tabula.md/#room=<roomId>,<roomKey>`
- Export link import: `https://tabula.md/#json=<snapshotId>,<snapshotKey>`

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

The workbench owns one document's editing UI; the host owns persistence and
collaboration transport.

## Service App Relationship

`tabula-app` is the tabula.md service app. It can choose to enable or hide
service features such as live collaboration, hosted recovery, encrypted
Export-link upload, or future Tabula+ boundaries without changing the
pure contracts here.
