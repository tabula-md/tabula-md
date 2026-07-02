# Snapshot Links

Snapshot link creates an encrypted copy/import URL for the active Markdown file
or workspace. It is not live collaboration and it is not Publish.

## What Create Snapshot Link Does

Create snapshot link stores an encrypted snapshot and creates a copy/import URL:

```txt
https://tabula.md/#json=<jsonId>,<jsonKey>
```

- `jsonId` identifies the stored encrypted snapshot.
- `jsonKey` stays in the URL fragment and is used only in the browser.
- The snapshot service must not receive `jsonKey` or plaintext Markdown.
- Opening the link asks the browser to load that external snapshot into the
  local workspace.

Snapshot links are for handoff. They do not create editable rooms and they do
not create public read-only pages.

## Local Development

Run the Tabula app and a local JSON snapshot service:

```sh
git clone https://github.com/tabula-md/tabula-json.git ../tabula-json
cd ../tabula-json
npm install
npm run dev
```

Then, from this repository:

```sh
VITE_TABULA_JSON_URL=http://localhost:3004 npm run dev
```

## Hosted Or Self-Hosted Deployments

Set the JSON service URL in the Tabula app environment:

```sh
VITE_TABULA_JSON_URL=https://json.example.com
```

Production builds do not fall back to a local JSON service. If
`VITE_TABULA_JSON_URL` is missing, Create snapshot link stays unavailable until
a snapshot service is configured.

The JSON service should be deployed with:

- TLS.
- Allowed origins for the Tabula app.
- Payload limits.
- Rate limits.
- Object storage for encrypted snapshots.
- Logs and analytics that never include URL fragments, snapshot keys, or
  plaintext Markdown.

## `tabula-json` Client Contract

The Tabula app treats `VITE_TABULA_JSON_URL` as the base URL for an encrypted
snapshot store. The current client contract is:

```txt
GET  /health
POST /api/v2/post/
GET  /api/v2/:snapshotId
```

`POST /api/v2/post/` receives an `application/octet-stream` body containing the
encrypted snapshot blob. It returns JSON:

```json
{
  "id": "snapshot_id",
  "data": "https://json.example.com/api/v2/snapshot_id"
}
```

The `data` URL must match the configured store URL and generated id. The Tabula
app then creates the import URL locally:

```txt
https://tabula.md/#json=<snapshotId>,<snapshotKey>
```

`GET /api/v2/:snapshotId` returns the same encrypted octet-stream blob or `404`
when the snapshot is missing. The service never receives `snapshotKey` because
it stays in the URL fragment.

## Security Contract

The browser owns Markdown plaintext and keys. The JSON service sees snapshot
ids, ciphertext payloads, versions, and timestamps.

Do not send the URL hash, `jsonKey`, plaintext Markdown, decrypted comments, or
decrypted snapshots to the server, analytics, logs, or crash reports.
