---
type: Repository Area
title: Tabula JSON
description: Separate encrypted snapshot store for Tabula.md shareable copy links.
resource: https://github.com/tabula-md/tabula-json
tags: [repo, share, snapshot, e2ee]
---

# Scope

`tabula-json` is a separate open-source repository for encrypted snapshot
storage used by Shareable link.

It is not live collaboration and it is not Publish. The Tabula app talks to it
through `VITE_TABULA_JSON_URL`.

Production and self-hosted `tabula-md` builds require `VITE_TABULA_JSON_URL` for
Export to link. Production builds must not silently point encrypted snapshot
sharing at localhost.

# Boundaries

- The service sees `jsonId`, ciphertext payloads, versions, sizes, and
  timestamps.
- The service must not receive `jsonKey` or plaintext Markdown.
- The client serializes, encrypts, decrypts, and imports snapshots in the
  browser.
- Local development expects a sibling checkout at `../tabula-json` unless
  `VITE_TABULA_JSON_URL` points elsewhere.
- Hosted deployments should configure allowed origins, payload limits, rate
  limits, TLS, and object storage for encrypted snapshots.

# Related

- [Share Start session contract](/architecture/share-start-session-contract.md)
- [OSS and hosted service boundary](/architecture/oss-hosted-boundary.md)
- [Tabula app](tabula-app.md)
