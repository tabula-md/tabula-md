---
type: Architecture Context
title: OSS and hosted service boundary
description: Repository and deployment boundary for Tabula.md, tabula-md, tabula-room, and future private operations code.
tags: [architecture, oss, hosted, deployment]
---

# Boundary

Tabula.md is one product with two public open-source components and one
official hosted deployment:

- `tabula-md`: the open-source Markdown workspace app.
- `tabula-room`: the open-source encrypted collaboration room server.
- `tabula.md`: the official hosted deployment of the Tabula app, connected to an
  operator-managed deployment of `tabula-room`.

This is intentionally similar to the Excalidraw shape: a public client repo, a
separate public room server repo, and an official hosted product surface. The
hosted product can be easier to use than self-hosting, but the OSS repos should
remain coherent and self-hostable.

# Public Repository Contracts

## Package and Runtime Boundaries

`tabula-md` has three long-lived implementation boundaries:

- `packages/tabula`: pure Tabula.md product contracts and deterministic models.
- `tabula-app`: the hosted app shell and browser runtime wiring.
- external services: room relay and encrypted JSON snapshot storage.

`packages/tabula` is the public core surface. It may contain Markdown editing
commands, text patch logic, workspace state transitions, document runtime
models, comment view models, share-link parsing, room-link parsing, room
protocol shape validation, and pure collaboration presence models. It must not
import React, CodeMirror, Yjs, Socket.IO, Vite, browser storage, or direct DOM
globals.

`tabula-app` owns React components, hooks, browser persistence, CodeMirror
extensions, Yjs/socket adapters, network clients, feature flags, and hosted
service copy. It should import core behavior through `@tabula-md/tabula` and
avoid deep imports into `packages/tabula`.

This boundary is enforced by the package boundary check and should be treated
as an architectural guardrail, not a style preference.

## `tabula-md`

The public app repo should contain:

- the React/Vite Markdown workspace;
- local-first storage behavior;
- Markdown preview, comments, files, outline, and editor UI;
- the Share surface, including Start session;
- client-side collaboration code;
- provider-neutral deployment docs for static hosting;
- `VITE_TABULA_ROOM_URL` as the room service configuration point;
- a clear unavailable state when no room service URL is configured.

The public app repo should not contain:

- the official hosted service provider choice;
- DNS account details;
- production room service URL secrets or operational credentials;
- billing or Tabula+ infrastructure;
- private deployment scripts that only apply to the managed service.

## `tabula-room`

The public room repo should contain:

- the Node room server;
- WebSocket collaboration relay behavior;
- encrypted snapshot persistence;
- Docker and local development instructions;
- CORS, payload-limit, and rate-limit configuration;
- provider-neutral production requirements;
- a clear ciphertext-only security boundary.

The public room repo should not contain:

- provider-specific hosted service credentials;
- private monitoring configuration;
- billing or account logic;
- server-side Markdown indexing, previewing, search, summarization, or
  moderation.

# Private Operations Repository

The private `tabula-cloud` repository exists for hosted operations that must not
live in the public OSS repos, such as:

- infrastructure-as-code;
- repeatable deployment scripts;
- DNS and custom-domain automation;
- hosted service environment templates;
- monitoring, alerting, and incident runbooks;
- provider-specific deployment wrappers for the public Tabula app and room server;
- billing, account, or Tabula+ service code that should not live in the OSS
  repos.

Keep hosted provider choices, production URLs, credentials, and private
operational details in `tabula-cloud` or deployment dashboards. Do not leak
them into public OSS documentation.

# Hosted Service Shape

The official hosted service should feel like this:

1. A user opens `tabula.md`.
2. The app opens directly into a local-first Markdown workspace.
3. The user can write without an account.
4. The user can open Share and start a live session.
5. The hosted build already has the official `tabula-room` service configured.
6. The copied `/#room=<roomId>,<roomKey>` link opens the same Markdown file in another
   browser.
7. The room server never receives the room key or plaintext Markdown.
8. Publish is not required for this v0 hosted experience; it belongs to
   Tabula+ later.

# Self-Hosted Shape

The self-hosted OSS path should feel like this:

1. A developer clones `tabula-md`.
2. A developer clones `tabula-room`.
3. They run `tabula-room`.
4. They set `VITE_TABULA_ROOM_URL` when building or running `tabula-md`.
5. Share > Start session works against their room server.
6. If no room service is configured, the Share surface remains visible but
   Start session explains that collaboration is unavailable.

# Related

- [Phase 1 infrastructure](phase-1-infra.md)
- [Share Start session contract](share-start-session-contract.md)
- [Collaboration security](collaboration-security.md)
- [Launch readiness](/runbooks/launch-readiness.md)
