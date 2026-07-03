# Development

This is the public development entry point for Tabula.md.

## Setup

```sh
npm install
npm run dev
```

Open `http://localhost:5173`.

## Useful Commands

```sh
npm test
npm run build
npm run surface:check
npm run boundary:check
npm run test:browser
```

Run focused browser suites when a change only touches one product area:

```sh
npm run test:browser:workspace
npm run test:browser:editor
npm run test:browser:layout
npm run test:browser:panels
npm run test:browser:collab
npm run test:browser:json-share
```

## Services

Live collaboration and encrypted snapshot links use separate services:

- `tabula-room`: encrypted websocket relay.
- `tabula-json`: encrypted snapshot blob store.
