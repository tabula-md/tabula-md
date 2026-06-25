# Tabula.md OSS + Hosted Launch TODO

Last updated: 2026-06-25

This TODO is intentionally narrow. It is the work needed for:

1. `tabula-md` to be open-source ready.
2. `tabula-room` to be open-source ready.
3. `tabula.md` to be usable as the hosted product.
4. A user to open `tabula.md`, write Markdown, start Share, copy a live room
   link, and collaborate in another browser.

This is not the full product backlog. Do not add Tabula+, Publish, billing,
accounts, team workspaces, templates, agent memory, or future infrastructure
rewrites here.

## Done Definition

- [ ] `tabula-md` is ready to be public as the OSS web app.
- [ ] `tabula-room` is ready to be public as the OSS encrypted room server.
- [ ] Private `tabula-cloud` exists for hosted operations.
- [ ] Hosted `tabula.md` loads the production web app.
- [ ] Hosted Share > Start session creates a live room link.
- [ ] A second browser can join the copied `/r/:roomId#key=...` link.
- [ ] Both browsers can edit the same Markdown document.
- [ ] Reload restores encrypted room state.
- [ ] Logs and docs do not expose room keys, URL fragments, plaintext Markdown,
      provider secrets, or private hosted operations details.

## Owner Setup Before `/goal`

The repository owner should set these up directly before asking an agent to run
this TODO to completion:

- Create or confirm the GitHub org/owner that will hold:
  - `tabula-md` public repo.
  - `tabula-room` public repo.
  - `tabula-cloud` private repo.
- Create the empty private `tabula-cloud` repo.
- Make writable local checkouts available for:
  - this `tabula-md` repo.
  - the `tabula-room` repo.
  - the private `tabula-cloud` repo.
- Confirm the intended GitHub remote and default branch for each repo.
- Confirm the `tabula.md` DNS zone is controlled in the production DNS account.
- Confirm the hosted web provider account is ready for a static Vite app.
- Confirm the hosted room provider account is ready for a paid Node/Docker
  WebSocket service with persistent disk.
- Confirm the deployment CLI or browser session is logged in for the hosted web
  provider and the hosted room provider.
- Confirm which accounts are allowed to receive production alerts.
- Do not put production secrets into this repo or into issue comments.

## 1. Public Repo Boundary

- [ ] Keep `tabula-md` as the OSS web app repo.
- [ ] Keep `tabula-room` as the OSS room server repo.
- [ ] Keep `tabula-cloud` private for hosted operations.
- [ ] Ensure public docs describe the boundary:
  - [ ] `tabula-md` is the local-first Markdown workspace.
  - [ ] `tabula-room` is the encrypted collaboration server.
  - [ ] `tabula.md` is the official hosted deployment.
  - [ ] hosted provider choices live outside public OSS docs.
- [ ] Ensure no public repo claims Publish is required for v0.
- [ ] Ensure no public repo claims accounts, billing, or Tabula+ exist in v0.

## 2. `tabula-md` OSS Readiness

- [ ] Review `README.md` for current truth.
- [ ] Remove or reword stale Publish-first product claims.
- [ ] Explain local-first Markdown writing clearly.
- [ ] Explain that Share is visible in OSS builds.
- [ ] Explain that Start session requires `VITE_TABULA_ROOM_URL`.
- [ ] Explain that Start session is unavailable when no room service is
      configured.
- [ ] Document local development:
  - [ ] `npm install`.
  - [ ] `npm run dev`.
  - [ ] optional local `tabula-room`.
- [ ] Document production/self-host requirements:
  - [ ] static host with SPA fallback.
  - [ ] `VITE_TABULA_ROOM_URL`.
  - [ ] no localhost fallback in production.
- [ ] Verify public-safe files:
  - [ ] `LICENSE`.
  - [ ] `CONTRIBUTING.md`.
  - [ ] `SECURITY.md`.
  - [ ] `.env.example`.
  - [ ] `docs/live-collaboration.md`.
- [ ] Verify tracked files contain no:
  - [ ] production secrets.
  - [ ] room keys.
  - [ ] private hosted URLs beyond public product URLs.
  - [ ] local runtime data.
  - [ ] generated smoke artifacts.
- [ ] Decide whether root `package.json` stays `"private": true` to prevent
      accidental npm publishing.
- [ ] Run validation:
  - [ ] `npm test`.
  - [ ] `npm run build`.
  - [ ] `npm run knowledge:check`.
  - [ ] focused browser collaboration smoke against local `tabula-room`.

## 3. `tabula-room` OSS Readiness

- [ ] Review `tabula-room` README for current truth.
- [ ] Keep the ciphertext-only boundary prominent.
- [ ] Explain what the server does:
  - [ ] relay encrypted room messages.
  - [ ] store encrypted snapshots.
  - [ ] expose health and room metadata endpoints.
- [ ] Explain what the server does not do:
  - [ ] no room keys.
  - [ ] no plaintext Markdown.
  - [ ] no Publish.
  - [ ] no accounts.
  - [ ] no billing.
  - [ ] no permissions.
  - [ ] no server-side indexing, search, summarization, or moderation.
- [ ] Verify local quick start works from a fresh clone.
- [ ] Verify Docker quick start works.
- [ ] Verify `.env.example` documents:
  - [ ] `PORT`.
  - [ ] `TABULA_ROOM_ALLOWED_ORIGINS`.
  - [ ] `TABULA_ROOM_DATA_DIR`.
  - [ ] `TABULA_ROOM_MAX_PAYLOAD_BYTES`.
  - [ ] `TABULA_ROOM_RATE_LIMIT_PER_MINUTE`.
- [ ] Verify public production docs are provider-neutral:
  - [ ] WebSocket-capable Node host.
  - [ ] persistent encrypted snapshot storage.
  - [ ] TLS.
  - [ ] origin allowlist.
  - [ ] payload limits.
  - [ ] rate limits.
  - [ ] `/health` monitoring.
- [ ] Run validation in `tabula-room`:
  - [ ] `npm test`.
  - [ ] `npm run build`.
  - [ ] `npm run test:docker`.

## 4. `tabula-cloud` Private Repo

- [ ] Add initial private repo structure:
  - [ ] `README.md`.
  - [ ] `docs/architecture.md`.
  - [ ] `docs/hosted-service-plan.md`.
  - [ ] `docs/web-deployment.md`.
  - [ ] `docs/room-deployment.md`.
  - [ ] `docs/launch-checklist.md`.
  - [ ] `docs/smoke-test.md`.
  - [ ] `docs/rollback.md`.
  - [ ] `env/tabula-md.production.example`.
  - [ ] `env/tabula-room.production.example`.
- [ ] State the repo boundary:
  - [ ] public app code stays in `tabula-md`.
  - [ ] public room server code stays in `tabula-room`.
  - [ ] private hosted operations live in `tabula-cloud`.
- [ ] Document the v0 hosted stack privately:
  - [ ] static web hosting provider.
  - [ ] DNS/TLS provider.
  - [ ] room service provider.
  - [ ] persistent disk path.
  - [ ] production web URL.
  - [ ] production room URL.
- [ ] Add production env examples without secret values.
- [ ] Add rollback instructions.
- [ ] Add alert ownership and escalation notes.

## 5. Hosted Web Deployment

- [ ] Create the hosted static web app project from `tabula-md`.
- [ ] Configure build:
  - [ ] build command: `npm run build`.
  - [ ] output directory: `dist`.
  - [ ] Node version compatible with the repo.
- [ ] Configure SPA fallback for client routes:
  - [ ] `/r/:roomId`.
  - [ ] any future client route.
- [ ] Connect `tabula.md`.
- [ ] Configure production environment:
  - [ ] `VITE_TABULA_ROOM_URL` points to the hosted room service.
  - [ ] no production `VITE_TABULA_PUBLISH_URL` requirement for v0.
  - [ ] no localhost room fallback.
- [ ] Verify hosted app loads.
- [ ] Verify Write mode works.
- [ ] Verify Preview mode works.
- [ ] Verify local drafts survive refresh.
- [ ] Verify Share surface is visible.

## 6. Hosted Room Deployment

- [ ] Create a paid Node/Docker WebSocket service from `tabula-room`.
- [ ] Attach persistent disk for encrypted snapshots.
- [ ] Mount disk at the path used by `TABULA_ROOM_DATA_DIR`.
- [ ] Configure production environment:
  - [ ] `PORT`.
  - [ ] `TABULA_ROOM_ALLOWED_ORIGINS` includes the hosted web origin.
  - [ ] `TABULA_ROOM_DATA_DIR`.
  - [ ] `TABULA_ROOM_MAX_PAYLOAD_BYTES=1048576`.
  - [ ] `TABULA_ROOM_RATE_LIMIT_PER_MINUTE=600`.
- [ ] Connect hosted room domain.
- [ ] Verify TLS.
- [ ] Verify `/health`.
- [ ] Verify WebSocket connection from hosted app.
- [ ] Verify encrypted snapshot survives restart.
- [ ] Verify logs do not contain:
  - [ ] `roomKey`.
  - [ ] URL fragments.
  - [ ] plaintext Markdown.
  - [ ] full encrypted envelopes unless explicitly needed for temporary local
        debugging.

## 7. End-To-End Hosted Smoke

- [ ] Open hosted `tabula.md`.
- [ ] Confirm first screen feels like a Markdown workspace.
- [ ] Create or edit Markdown.
- [ ] Confirm saved/local state is understandable.
- [ ] Open Share.
- [ ] Start session.
- [ ] Copy invite link.
- [ ] Open invite link in a second browser or profile.
- [ ] Confirm the second browser joins the same document.
- [ ] Type in both browsers.
- [ ] Reload both browsers.
- [ ] Confirm encrypted room state restores.
- [ ] Test missing-key link.
- [ ] Test wrong-key link.
- [ ] Stop or disable room service and confirm unavailable state is clear.
- [ ] Confirm local content is not overwritten by failed room recovery.
- [ ] Capture manual evidence:
  - [ ] hosted app URL.
  - [ ] room health response.
  - [ ] two-browser collaboration result.
  - [ ] unavailable-state result.

## 8. Final OSS Release Check

- [ ] Confirm `tabula-md` public repo visibility can be changed safely.
- [ ] Confirm `tabula-room` public repo visibility can be changed safely.
- [ ] Confirm `tabula-cloud` remains private.
- [ ] Confirm public docs are provider-neutral.
- [ ] Confirm private hosted provider details are only in `tabula-cloud`.
- [ ] Confirm security reporting path works.
- [ ] Confirm issue templates do not route security issues publicly.
- [ ] Confirm launch language:
  - [ ] public preview.
  - [ ] local-first by default.
  - [ ] live collaboration is experimental.
  - [ ] no account required.
  - [ ] Publish/Tabula+ not included in v0.

## Out Of Scope For This TODO

These are intentionally not completion blockers:

- Publish.
- Tabula+.
- Accounts.
- Billing.
- Team workspaces.
- Private publishing.
- Redis-backed room scaling.
- Object storage or database-backed room snapshots.
- Alternative managed room runtime.
- Full permission system.
- Agent Memory as a real product surface.
- Templates as a real standardized document system.
- Command palette.
- Automerge migration.
- Mobile-first editing.
