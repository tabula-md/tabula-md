# Live Collaboration

Tabula.md starts as a local Markdown workspace. It joins a live room only when
the user chooses **Share > Live collaboration > Start session**.

## Workspace Rooms

Start session creates an editable invite link for the whole logical workspace:

```txt
https://tabula.md/#room=<roomId>,<roomKey>
```

There is no document-level sharing scope inside a room. Every document and
logical folder joins the room, and documents or folders created while live join
immediately. Logical folders are not watched local directories or raw
filesystem paths.

The `roomKey` remains in the URL fragment and browser. The relay and checkpoint
services never receive it or plaintext Markdown.

## Collaboration Model

One room uses one Yjs document:

- folder and document nodes share one workspace tree;
- each document id maps to its own `Y.Text`;
- comments, replies, resolved state, and anchors are CRDT data;
- each participant's active document, cursor, and selection use Awareness.

Changing documents only changes that participant's editor. It does not move
another participant to the same document.

CodeMirror binds directly to the active Y.Text. Yjs state vectors exchange only
incremental changes, and each document has its own collaborative undo manager.
The app materializes the active Y.Text into the local UI store only at document,
export, and page lifecycle boundaries instead of copying the full Markdown on
every keystroke.

## People And Agents

A person and an agent are the same kind of room participant:

- human browser: `kind: "human"`, `client: "tabula-md"`;
- local MCP agent: `kind: "agent"`, `client: "tabula-mcp"`;
- custom agent: `kind: "agent"`, `client: "custom"`.

Both directly edit the same workspace CRDT. There is no separate proposal
workflow. Stable capabilities are `presence`, `read`, and `write`.

Agents join through a connected Tabula MCP client. The supported tool flow is
`tabula_connect_room`, bounded workspace reads, and
`tabula_apply_workspace_changes`; prompts should not ask a model to implement
Yjs or the binary room protocol. A local MCP runs the room client on the
user's device. A hosted MCP is a trusted plaintext participant. In either
case, the selected model provider receives the document content the agent
reads, while the separate Room relay remains ciphertext-only.

Capabilities are cooperative client policy. A modified client holding the room
key can still forge encrypted writes; signed write tokens are not implemented.

### Presence And Inactivity

Humans and agents publish the same ephemeral Awareness state: `active`, `idle`,
or `away`. Browser participants become idle after one minute without local
activity and away as soon as the tab is hidden. Activity makes them active
again. Headless clients may publish the same states from their own execution
lifecycle.

A browser with no meaningful local or remote room activity for 15 minutes
suspends only its transport. Suspension requires a clean durable encrypted
checkpoint. The in-memory Y.Doc and editor binding remain available, so local
changes made while suspended are queued by the CRDT sync layer. Returning to
the tab or interacting with the workspace reconnects and synchronizes them.
Temporary rooms and rooms whose checkpoint is dirty or failed remain connected.
Stopping a session is still an explicit action and leaves room mode entirely.

## Encrypted Transport

`tabula-room` relays opaque encrypted envelopes. The outer envelope is version
1 with kind `room-event`. Its decrypted body is binary protocol version 2 with
only:

- `sync.message` for Yjs handshake and incremental updates;
- `sync.chunk` for bounded large messages;
- `awareness.updated` for participant presence.

The client uses 256 KiB chunks, a 16 MiB message maximum, at most 64 chunks,
four concurrent assemblies per actor, and a ten-second assembly timeout.
Malformed or incomplete packets do not mutate the workspace.

The encoded Yjs state is capped at 12 MiB, below the wire maximum. A room that
reaches that history limit must be exported and continued in a new session;
the client does not attempt unsafe in-place CRDT compaction.

Rapid local edits are merged behind one in-flight encrypted update instead of
building an unbounded promise chain. Awareness uses the same one-in-flight,
one-pending rule. The encrypted inbox accepts at most 64 envelopes and 32 MiB,
and document undo history is limited to 100 steps. Every 500 updates the client
samples encoded state size and warns before the hard limit.

## Encrypted Persistence

Start session creates and validates the workspace Y.Doc locally, then opens the
live surface and invite URL immediately. The browser encrypts a complete Yjs
state update and uploads it to a unique Firebase Storage object in the
background. Firestore stores only:

- format version;
- generation;
- blob path;
- byte length;
- update time;
- expiry time.

The Firestore pointer advances with generation compare-and-swap. On conflict,
the client merges the latest encrypted checkpoint and retries once. Successful
saves renew expiry to seven days.

Deployments must configure Firestore TTL and Firebase Storage lifecycle cleanup.
If every participant closes before the first encrypted checkpoint succeeds, a
new room may not have recoverable durable state. This is the explicit tradeoff
for entering collaboration without a storage round trip; later successful
checkpoints renew the normal seven-day expiry.

## Limits

A room supports up to 10 MiB of Markdown and comment bodies, 500 documents,
500 folders, folder depth 32, 5,000 comments, 100 replies per comment, and
10,000 characters per comment or reply.

Local workspaces use the normalized `tabula-workspace-v7` IndexedDB database.
Files, folders, comments, and view manifests are separate records, so ordinary
edits write only changed records. Room workspaces are not written into that
local project database. Markdown is never mirrored to localStorage.

## Local Development

Start the Firebase emulators:

```sh
npm run dev:firebase
```

Run a sibling `tabula-room` checkout on port 3002, then start this app with the
emulator-backed persistence path:

```sh
npm run dev:local
```

The development app uses the explicit emulator host to create a demo Firebase
config. It does not use production credentials. Export links additionally need
the local `tabula-json` service on port 3004.

Production builds never fall back to localhost. A hosted origin must configure
its relay explicitly or provide a build-time default for that origin.

## Failure Behavior

- A permanently failed Start action closes Share, returns the room workspace to
  local mode, and displays a short toast.
- A temporary disconnect after joining keeps local CRDT editing available and
  reconnects quietly.
- Wrong keys, corrupt checkpoints, and unsupported protocols never overwrite a
  local workspace.
- Expired rooms show an explicit expired state and an action to open the local
  workspace.
- Stop session copies the latest room workspace into the current normalized IndexedDB workspace and
  disconnects this client. It does not revoke the shared URL.

## Service Boundaries

- `tabula-room`: encrypted realtime relay only.
- Firebase Storage + Firestore: encrypted live checkpoint and pointer only.
- `tabula-json`: encrypted Export-link copy store only.

See [ADR 0001](adr/0001-encrypted-workspace-crdt.md) for the canonical
architecture decision.
