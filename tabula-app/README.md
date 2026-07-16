# Tabula.md App Shell

`tabula-app` is the Tabula.md web application shell. It owns the React UI,
browser persistence, CodeMirror integration, collaboration adapters, optional
live recovery wiring, and Export link API client.

Core Markdown, encryption, data encoding, and room envelope behavior belongs in
`packages/tabula` and should be imported through the package public API. Service
URLs, feature flags, and service-specific copy are centralized in
`src/serviceConfig.ts`.

The public repository keeps the app source and public runtime contracts. The
official hosted service is configured outside this package and is not required
for local development.

## Local Development

```sh
npm run dev
```

To run against a local room server:

```sh
VITE_TABULA_ROOM_URL=http://localhost:3002 npm run dev
```

Firebase is optional. Without it, live collaboration works through the relay
while at least one participant remains connected. Set
`VITE_TABULA_FIREBASE_CONFIG` to a Firebase Web SDK config JSON string to enable
encrypted checkpoint recovery after every participant disconnects.
