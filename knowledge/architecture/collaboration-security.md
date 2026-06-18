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
- Token issuance must not grant write access based only on `roomId`.

# Related

- [Collaboration protocol](/repo/collab-protocol.md)
- [Vertical slice strategy](/workflow/vertical-slice-strategy.md)
