# Live Collaboration

Tabula.md starts as a local Markdown workspace. A file joins a live room only
when the user chooses **Share > Collaborate > Start session**.

## What Start Session Does

Start session creates an editable invite link for the active Markdown file:

```txt
https://tabula.md/#room=<roomId>,<roomKey>
```

- `roomId` identifies the room.
- `roomKey` stays in the URL fragment and is used only in the browser.
- The room server must not receive `roomKey` or plaintext Markdown.
- The room server relays encrypted updates only; durable recovery is handled by
  the app's Firebase recovery provider.

Start session is live collaboration. It does not create a public read-only page
or upload a publishable copy of the document.

## Local Development

Run the Tabula app and a local room server:

```sh
git clone https://github.com/tabula-md/tabula-room.git ../tabula-room
cd ../tabula-room
npm install
npm run dev
```

Then, from this repository:

```sh
cp .env.example .env.local
npm run dev
```

The default `.env.example` points the Tabula app at `http://localhost:3002`.

## Hosted Or Self-Hosted Deployments

Set the room service URL in the Tabula app environment:

```sh
VITE_TABULA_ROOM_URL=https://rooms.example.com
VITE_TABULA_FIREBASE_CONFIG='{"apiKey":"...","authDomain":"...","projectId":"...","appId":"..."}'
```

Production builds do not fall back to a local room server. The Share surface may
still be visible, but if `VITE_TABULA_ROOM_URL` is missing, Start session is
unavailable until a room server is configured.

The room service should be deployed with:

- TLS.
- Allowed origins for the Tabula app.
- Payload limits.
- Rate limits.
- Logs and analytics that never include URL fragments, room keys, or plaintext
  Markdown.

Firebase recovery should be deployed with Firestore rules that allow only
ciphertext room documents under `rooms/{roomId}`. The app stores `formatVersion`,
`stateVersion`, `iv`, `ciphertext`, and a server timestamp; it never stores
`roomKey`, plaintext Markdown, comments, selections, or decrypted Yjs state.

## Security Contract

The browser owns Markdown plaintext and keys. The room server sees room ids,
connection events, ciphertext envelopes, IVs, versions, and timestamps.
Firestore sees encrypted recovery state only.

Do not send the URL hash, `roomKey`, plaintext Markdown, decrypted comments, or
decrypted snapshots to the server, analytics, logs, or crash reports.
