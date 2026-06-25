---
type: Architecture Constraint
title: Collaboration security
description: Room links, share behavior, tokens, and persistence must preserve end-to-end secrecy.
tags: [architecture, collaboration, security]
---

# Required Constraints

Before changing room links, share behavior, tokens, or collaboration
persistence, preserve these constraints:

- Room keys stay in the URL fragment.
- Room keys are never sent to the server.
- Server storage contains ciphertext only.
- Decryption failure must not overwrite local state.
- Start session must not imply durable publishing or complete revoke of already
  shared keys.
- If write tokens are added later, token issuance must not grant write access
  based only on `roomId`.

# Related

- [Share Start session contract](share-start-session-contract.md)
- [Tabula Room](/repo/tabula-room.md)
- [Vertical slice strategy](/workflow/vertical-slice-strategy.md)
