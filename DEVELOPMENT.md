# Development

This is the public development entry point for Tabula.md.

## Setup

```sh
npm install
npm run dev
```

Open `http://localhost:5173`.

## Interface Design

Read [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) before changing workspace chrome,
toolbars, menus, popovers, or project panels.

## Code Vocabulary

Use `workspace` for the full file tree, `file` for a stored Markdown node, and
`document` for the active editing projection. Product copy calls real-time
sharing a `live session`; `room` is the protocol and transport object behind
it. Use `Export link` in product surfaces and reserve `JSON` or `snapshot` for
implementation contracts.

Names should describe ownership and lifetime:

- `Model` and `ViewModel` are pure derivations.
- `Store` owns mutable state and subscriptions.
- `Controller` coordinates commands and side effects.
- `Runtime` owns a long-lived resource with an explicit lifecycle.
- `Adapter` connects a domain contract to browser, storage, or network I/O.
- `Surface` is a substantial presentational UI boundary.

Keep new modules with their product feature. Import core contracts directly
from a declared `@tabula-md/tabula` entrypoint; do not add pass-through
re-export files or broad barrels only to preserve an old local import path.

## Useful Commands

```sh
npm test
npm run build
npm run surface:check
npm run boundary:check
npm run test:browser
```

Run focused browser suites when a change only touches one product area:

```sh
npm run test:browser:workspace
npm run test:browser:editor
npm run test:browser:layout
npm run test:browser:panels
npm run test:browser:collab
npm run test:browser:json-share
```

## Services

Live collaboration and encrypted Export links use separate services:

- `tabula-room`: encrypted websocket relay.
- `tabula-json`: encrypted Export link blob store.

Firebase checkpoint storage is optional. A room relay is enough for live
collaboration while at least one participant remains connected. Configuring
Firebase adds encrypted recovery after every participant disconnects.

## Live Collaboration Architecture

A live room owns one Yjs document for the entire Markdown workspace:

- Workspace nodes store folder and document metadata.
- Each document body is a dedicated `Y.Text` inside the room document.
- Comments use Yjs relative positions so concurrent edits do not invalidate
  their anchors.
- Participant identity, cursor, viewport, and Follow state use encrypted Yjs
  Awareness and are never checkpointed.

The room runtime is the only authority for live content. React subscribes to
metadata plus the active document projection; it does not retain a second copy
of every room document. Only recently opened documents keep editor bindings and
undo history, and all of those resources are released when the room session is
disposed.

Local and Room workspaces use separate session-owned view stores. Entering a
Room never merges its nodes into the Local workspace, and Room Markdown never
enters the Local editor buffer or IndexedDB records. CodeMirror binds the active
Room document directly to its `Y.Text`; edits made while the binding is being
established are retained only as pending Room operations.

The runtime facade composes focused stores and controllers:

- `RoomCrdtStore` owns atomic tree, text, and comment commands.
- `RoomStructureStore` projects node metadata without reading Markdown bodies.
- `RoomDocumentRegistry` leases active editor bindings and bounds undo history.
- `RoomCommentsStore` resolves only subscribed document comments from Yjs
  relative anchors.
- `RoomPresenceController` owns actor, cursor, viewport, and Follow Awareness.
- `RoomSyncController` owns reliable encrypted incremental synchronization.
- `CheckpointCoordinator` reports durability separately from relay connection.

Room comments persist only Yjs relative anchors. Numeric offsets are a temporary
active-document projection for CodeMirror decorations and are never patch-mapped
as a second Room authority. Follow and per-document cursor/viewport state are
browser-tab state and are not included in checkpoints.

Room updates use the binary protocol in
`packages/tabula/src/roomBinaryProtocol.ts`. The relay receives encrypted
envelopes only. Recovery checkpoints are also encrypted before leaving the
browser, while the room key remains in the URL fragment.
