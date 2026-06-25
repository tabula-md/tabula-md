---
type: Architecture Contract
title: Share Start session contract
description: Product and security contract for turning a local Markdown file into an encrypted live collaboration room.
tags: [architecture, collaboration, security, product]
---

# Contract

`Share > Collaborate > Start session` turns the active local Markdown file into
an encrypted live editing room. It does not publish the file, create a durable
public page, or move the whole project into the cloud.

# Product Semantics

- Scope: the active Markdown file only.
- Default state: local-only until the user starts a session.
- Session state: live editable room for people with the invite link.
- Durable handoff: handled by Publish, not by Start session.
- Stop session: disconnects this browser from the room and returns the file to
  local editing. It must not claim to revoke already shared plaintext or keys.

The user-facing distinction is:

- **Start session**: live co-editing.
- **Publish**: read-only public snapshot.

# URL Contract

Live session links use:

```txt
https://tabula.md/r/<roomId>#key=<roomKey>
```

- `roomId` is public routing metadata.
- `roomKey` is client-only secret material.
- The key stays in the URL fragment and is never sent to the server.
- Client analytics, crash reports, logs, and WebSocket payloads must strip or
  avoid the full fragment.

# Collaboration Runtime

Tabula.md v1 keeps the collaboration runtime focused:

- CodeMirror remains the Markdown source editor.
- Yjs is the live text merge layer.
- Web Crypto encrypts Yjs updates, presence, and snapshots before relay or
  storage.
- `tabula-room` relays or stores ciphertext envelopes only.
- Dexie is the preferred next local persistence layer for workspace files,
  metadata, comments, settings, and migration away from single-key
  `localStorage`.

Automerge is not the v1 collaboration dependency. It can be reconsidered only
through a separate spike or decision record if Yjs cannot satisfy the product
contract.

# Hosted And Open Source Boundary

The open-source repositories and hosted service share the same contract:

- `tabula-md`: open-source web app and self-hostable client.
- `tabula-room`: open-source encrypted room relay/server.
- `tabula.md`: managed deployment of the same web app pointed at the managed
  room service.

Hosted builds may provide a default `VITE_TABULA_ROOM_URL`. Self-hosted builds
must be able to point at their own room server. If no room server is configured,
Start session should show a clear unavailable state rather than silently
falling back to insecure behavior.

# Persistence Boundary

Encrypted room snapshots may be used for room recovery, but Start session
should not promise permanent document hosting. Product language must stay clear:

- local files remain the user's editable source.
- live rooms are for collaboration.
- published pages are durable read-only outputs.

# Not In V1

- Project-wide live collaboration.
- Account-based membership.
- Billing and plan limits.
- Strong cryptographic revoke.
- Server-side Markdown indexing, preview, search, or agent processing of live
  room content.

# Related

- [E2EE collaboration model](e2ee-collaboration.md)
- [Collaboration security](collaboration-security.md)
- [Phase 1 infrastructure](phase-1-infra.md)
- [User workflows](/product/user-workflows.md)
