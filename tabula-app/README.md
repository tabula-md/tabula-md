# Tabula.md Hosted App Shell

`tabula-app` is the hosted Tabula.md web application shell. It owns the React UI,
browser persistence, CodeMirror integration, collaboration adapters, and JSON
snapshot API client used by the deployed service.

Core Markdown and workspace behavior belongs in `packages/tabula` and should be
imported through the package public API. Hosted service URLs, feature flags, and
service-specific copy are centralized in `src/serviceConfig.ts`.

## Local Development

```sh
npm run dev
```

To run against a local room server:

```sh
VITE_TABULA_ROOM_URL=http://localhost:3002 npm run dev
```
