# Shareable Links

Shareable link creates an encrypted copy link for the active Markdown file or
workspace. It is not live collaboration and it is not Publish.

## What Export To Link Does

Export to link stores an encrypted snapshot and creates a copy/import URL:

```txt
https://tabula.md/#json=<jsonId>,<jsonKey>
```

- `jsonId` identifies the stored encrypted snapshot.
- `jsonKey` stays in the URL fragment and is used only in the browser.
- The snapshot service must not receive `jsonKey` or plaintext Markdown.
- Opening the link asks the browser to load that external snapshot into the
  local workspace.

Shareable links are for handoff. They do not create editable rooms and they do
not create public read-only pages.

## Local Development

Run the web app and a local JSON snapshot service:

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

Set the JSON service URL in the web app environment:

```sh
VITE_TABULA_JSON_URL=https://json.example.com
```

Production builds do not fall back to a local JSON service. If
`VITE_TABULA_JSON_URL` is missing, Export to link stays unavailable until a
snapshot service is configured.

The JSON service should be deployed with:

- TLS.
- Allowed origins for the web app.
- Payload limits.
- Rate limits.
- Object storage for encrypted snapshots.
- Logs and analytics that never include URL fragments, snapshot keys, or
  plaintext Markdown.

## Security Contract

The browser owns Markdown plaintext and keys. The JSON service sees snapshot
ids, ciphertext payloads, versions, and timestamps.

Do not send the URL hash, `jsonKey`, plaintext Markdown, decrypted comments, or
decrypted snapshots to the server, analytics, logs, or crash reports.
