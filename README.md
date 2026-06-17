# Tabula.md

An instant Markdown collaboration prototype.

Open the app and edit Markdown immediately. A default `README.md` tab is always
available, and additional tabs can be created with `+`. The active tab stays local
until you use `Share -> Start session`, which turns that tab into a live Yjs room
and creates a shareable `/r/:roomId#key=...` URL.

Markdown frontmatter is kept in the editor and shown as metadata in preview mode.

## Architecture

Tabula.md now keeps the product boundaries separate while staying in one repo:

```txt
apps/web
  Markdown project UI, tabs, preview, comments, libraries, and collab client adapter

apps/collab-server
  Hocuspocus/Yjs room server, WebSocket sync, persistence, snapshots, and recovery metadata

packages/collab-protocol
  Shared route helpers and room metadata contract
```

This mirrors the production direction used by tools like Excalidraw: the web app
owns the user experience, while the live collaboration service has its own
runtime boundary.

## Run

Install dependencies:

```sh
npm install
```

Start the collaboration server:

```sh
npm run server
```

The collaboration server is powered by Hocuspocus and stores room state under
`.tabula-collab/` by default.

The local server also exposes a development token endpoint at `/collab/token`.
The web app uses it to request a signed short-lived room token before opening a
Hocuspocus connection. In production, keep the token validation path but move
token issuance behind your authenticated app backend.

The current live collaboration path is a prototype. The intended production
direction is an Excalidraw-style end-to-end encrypted room model where the room
key stays in the URL fragment and the server only relays or stores ciphertext.
See `private-docs/adr/0001-e2ee-collaboration.md` for the decision record.

Useful collaboration environment variables:

```sh
COLLAB_TOKEN_SECRET=change-me
COLLAB_TOKEN_TTL_SECONDS=3600
COLLAB_REQUIRE_TOKEN=true
COLLAB_ENABLE_DEV_TOKEN_ENDPOINT=true
COLLAB_ALLOWED_ORIGINS=http://localhost:5174
COLLAB_MAX_PAYLOAD_BYTES=2097152
COLLAB_CONNECTION_RATE_LIMIT_PER_MINUTE=120
COLLAB_UPDATE_RATE_LIMIT_PER_MINUTE=600
COLLAB_TOKEN_RATE_LIMIT_PER_MINUTE=120
```

Start the web app in another terminal:

```sh
npm run dev
```

Then open `http://localhost:5173`.

## Workflow

Tabula.md uses Linear for trackable work, Graphite for mandatory stack-first PR
workflow, GitHub for PR records and CI, and Git for history. See
`docs/team-onboarding.md`, `docs/engineering-workflow.md`, and
`docs/graphite-workflow.md` for issue, stack, PR, and review conventions.
