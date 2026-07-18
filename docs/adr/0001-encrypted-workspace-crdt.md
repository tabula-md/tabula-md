# ADR 0001: Encrypted Workspace CRDT

Date: 2026-07-10
Updated: 2026-07-16
Status: Accepted
Owner: taeha

Localized companion: `0001-encrypted-workspace-crdt.ko.md`

## Context

The first collaboration implementation combined per-document Yjs state with
JSON room events and local workspace projections. That made concurrent tree
changes, reconnects, checkpoints, and lifecycle cleanup harder to reason about.
It also created duplicate full-text paths that could waste memory and network
bandwidth.

Tabula.md needs one collaboration model for people and agents, multiple
Markdown documents, folders, comments, presence, late join, and recovery. The
room relay must remain unable to read any workspace content.

## Decision

- One live room owns one `Y.Doc`.
- `tabula.nodes` stores the logical folder/document tree, `tabula.documents`
  stores one `Y.Text` per document, and `tabula.comments` stores comments and
  replies. One Yjs transaction represents a workspace structure change.
- Active document, cursor, selection, actor, and transient participant state
  live in Yjs Awareness, not persistent workspace state.
- Human and agent participants use the same `RoomActor` and direct-edit path.
  Their only semantic distinction is `kind`. The stable capabilities are
  `presence`, `read`, and `write`; these are official-client policy, not
  cryptographic authorization.
- The external encrypted envelope remains version 1 with kind `room-event` and
  the room key remains in the URL fragment. Its decrypted payload is binary
  protocol version 2, with only `sync.message`, `sync.chunk`, and
  `awareness.updated` packets.
- State-vector sync and incremental Yjs updates are binary. Packets are chunked
  at 256 KiB, bounded to 16 MiB and 64 chunks, and incomplete assemblies expire
  after 10 seconds.
- `WorkspaceRoomRuntime` exclusively owns the Y.Doc, Awareness, transport,
  checkpoint adapter, undo managers, listeners, timers, and chunk buffers.
  Disconnect is abortable and idempotent.
- Firebase Storage stores unique encrypted checkpoint blobs. Firestore stores
  only a generation-CAS pointer with format version, blob path, byte length,
  update time, and seven-day expiry. Neither receives the room key or plaintext.
- `tabula-room` remains a ciphertext relay. `tabula-json` stores encrypted
  Export links only and is not live room persistence.
- A room is the whole logical Tabula workspace. There is no per-document
  include/exclude state and no browser-private branch inside a live room. New
  documents and folders join the room immediately.
- Start session is optimistic: the client creates and validates the local
  Y.Doc, attaches room metadata, changes the URL, and opens the live surface
  immediately. Relay connection and the first encrypted Firebase checkpoint
  continue in the background. A permanent connection failure materializes the
  current room state locally and leaves the local workspace usable.
- Existing room/checkpoint and browser database formats are intentionally
  incompatible. The app uses one normalized `tabula-workspace-v7` IndexedDB
  schema and does not read legacy databases or full-workspace localStorage
  fallbacks.
- Folder membership is explicit so empty folders participate in the room.
- Encoded Yjs state is capped at 12 MiB below the 16 MiB wire limit. The client
  requires a new session instead of compacting a live Y.Doc and invalidating
  peer state vectors.
- Reliable Yjs updates and Awareness updates each keep at most one encrypted
  send in flight and one merged pending update. The encrypted inbox is bounded
  to 64 envelopes and 32 MiB. Per-document undo history is bounded to 100
  stack items.

## Consequences

- Concurrent text and tree changes converge through one CRDT instead of
  application-defined CRUD events.
- A remote participant changing documents cannot change another participant's
  active editor.
- Checkpoints are complete Yjs state, so deleted items retain CRDT tombstones
  and stale peers cannot recreate them by replaying old state.
- Live memory includes the Y.Doc plus a bounded UI projection. A room is capped
  at 10 MiB of Markdown/comment bodies, 500 documents, 500 folders, depth 32,
  5,000 comments, and 12 MiB of encoded CRDT state.
- Local workspaces survive refresh through normalized, record-level IndexedDB
  writes. A `#room` workspace is recovered only from its encrypted checkpoint
  and never merged with the stored local workspace.
- The client samples encoded CRDT state after every 500 updates and warns
  before the hard wire limit. Automatic in-place compaction is deliberately
  excluded because an offline peer can still hold a valid old state vector;
  replacing the Y.Doc would either lose that peer's edits or require an epoch
  bridge that is outside this protocol.
- Anyone holding the bearer room URL can technically construct encrypted write
  traffic. Strong signed capabilities or write tokens require a future ADR.
- Firebase TTL and Storage lifecycle policies are deployment obligations; this
  repository documents but does not provision them.
- Closing every participant before the first encrypted checkpoint succeeds can
  leave a newly created room without recoverable durable state. The immediate
  collaboration start is an explicit product tradeoff; durability state remains
  visible to the client runtime and later successful checkpoints renew expiry.

## Alternatives Considered

- JSON `RoomEvent` document CRUD and text events: rejected because they
  duplicate CRDT semantics and require ordering/reconciliation logic.
- One Y.Doc per document plus separate workspace state: rejected because tree,
  comments, checkpointing, and cross-document changes would not be atomic.
- Persisting live checkpoints in `tabula-room` or `tabula-json`: rejected to
  keep the relay and Export-link store narrowly scoped.
- Proposal-only agent edits: rejected because human and agent actors are peers
  on the same direct-edit contract.
- Waiting for the first durable checkpoint before entering the room: rejected
  because storage latency made the primary collaboration action feel blocked.
  The client instead exposes durability after the local room exists.
- Automatic live Y.Doc compaction: rejected because offline peers can return
  with old state vectors. A safe epoch bridge would require a new coordinated
  protocol and durable old-epoch reconciliation.

## Acceptance Criteria

- People and agents can directly edit different documents in one room and
  converge after reconnect.
- Create, rename, move, delete, comments, replies, and resolved state converge.
- The active document remains local Awareness state.
- The room key never leaves the URL fragment/client, and all relay/checkpoint
  content is ciphertext.
- Late join and refresh recover from an encrypted generation-CAS checkpoint.
- Start session changes to the live surface without waiting for relay or
  checkpoint round trips.
- Repeated connect/disconnect releases sockets, Yjs objects, listeners, timers,
  undo managers, and chunk buffers.
- Rapid edits and cursor changes remain bounded while encryption is slow, and
  a frozen browser page converges after resuming.
