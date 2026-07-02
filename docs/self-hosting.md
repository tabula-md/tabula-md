# Self-Hosting Tabula.md

Tabula.md is a static app plus optional service backends. The app keeps
Markdown plaintext and encryption keys in the browser. Services receive routing
metadata and ciphertext only.

```mermaid
flowchart LR
  user["Browser: Tabula app"] --> app["tabula-md static app"]
  app --> core["packages/tabula pure contracts"]
  app --> room["tabula-room websocket relay"]
  app --> json["tabula-json encrypted snapshot store"]
  app --> firebase["Firebase Firestore live recovery"]
  json --> objectStorage["private object storage for encrypted #json blobs"]
```

## Local App

Install and run this repository:

```sh
npm install
npm run dev
```

Open `http://localhost:5173`.

## Live Collaboration

Run the room server in a sibling checkout:

```sh
git clone https://github.com/tabula-md/tabula-room.git ../tabula-room
cd ../tabula-room
npm install
npm run dev
```

Then run the Tabula app with the room URL:

```sh
VITE_TABULA_ROOM_URL=http://localhost:3002 npm run dev
```

Live collaboration links use:

```txt
https://your-app.example/#room=<roomId>,<roomKey>
```

The room server is relay-only. It should never receive `roomKey`, plaintext
Markdown, or durable recovery snapshots.

To enable durable live-room recovery, configure Firebase in the Tabula app. The
browser encrypts recovery state before writing it to Firestore:

```sh
VITE_TABULA_FIREBASE_CONFIG='{"apiKey":"...","authDomain":"...","projectId":"...","appId":"..."}' \
VITE_TABULA_ROOM_URL=http://localhost:3002 \
npm run dev
```

Without Firebase, existing peers can still initialize newly joined peers during
the current live session, but a room cannot recover after every browser tab has
closed.

## Snapshot Links

Run the JSON snapshot store in a sibling checkout:

```sh
git clone https://github.com/tabula-md/tabula-json.git ../tabula-json
cd ../tabula-json
npm install
npm run dev
```

Then run the Tabula app with the JSON URL:

```sh
VITE_TABULA_JSON_URL=http://localhost:3004 npm run dev
```

Snapshot links use:

```txt
https://your-app.example/#json=<snapshotId>,<snapshotKey>
```

The JSON service stores encrypted snapshot blobs. It should never receive
`snapshotKey` or plaintext Markdown.

For production, run `tabula-json` as a Node service with a private storage
backend. The bucket or volume should not be public; the `tabula-json` HTTP API
is the read/write boundary.

## Production Build

Build the static app:

```sh
VITE_TABULA_ROOM_URL=https://rooms.example.com \
VITE_TABULA_JSON_URL=https://json.example.com \
VITE_TABULA_FIREBASE_CONFIG='{"apiKey":"...","authDomain":"...","projectId":"...","appId":"..."}' \
npm run build
```

Serve `dist` from a static host. Configure the room and JSON services with:

- TLS.
- Allowed origins for the app domain.
- Payload limits.
- Rate limits.
- Firebase Firestore rules for encrypted live recovery, if recovery is enabled.
- Private storage for JSON snapshot blobs.
- Logs that exclude URL fragments, keys, and plaintext Markdown.

If `VITE_TABULA_ROOM_URL` or `VITE_TABULA_JSON_URL` is missing, the matching
Share action remains unavailable instead of falling back to localhost. If
`VITE_TABULA_FIREBASE_CONFIG` is missing, live collaboration still works while
peers are connected, but hosted recovery is disabled.
