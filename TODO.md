# Tabula.md OSS + Hosted Launch TODO

Last updated: 2026-06-29

This TODO is intentionally narrow. It is the work needed for:

1. `tabula-md` to be open-source ready.
2. `tabula-room` to be open-source ready.
3. `tabula-json` to be open-source ready.
4. `tabula.md` to be usable as the hosted product.
5. A user to open `tabula.md`, write Markdown, start Share, copy a live room
   link, and collaborate in another browser.
6. A user to export an encrypted snapshot link and open it in another browser.

This is not the full product backlog. Do not add Tabula+, Publish, billing,
accounts, team workspaces, templates, agent memory, or future infrastructure
rewrites here.

## Done Definition

- [ ] `tabula-md` is ready to be public as the OSS Tabula app.
- [ ] `tabula-room` is ready to be public as the OSS encrypted room server.
- [ ] `tabula-json` is ready to be public as the OSS encrypted snapshot store.
- [x] Private `tabula-cloud` exists for hosted operations.
- [ ] Hosted `tabula.md` loads the production Tabula app.
- [ ] Hosted Share > Start session creates a live room link.
- [ ] A second browser can join the copied `/#room=<roomId>,<roomKey>` link.
- [ ] Both browsers can edit the same Markdown document.
- [ ] Reload restores encrypted room state.
- [ ] Hosted Share > Export to link creates a `/#json=<jsonId>,<key>` link.
- [ ] A second browser can open the snapshot link as a replace/import flow.
- [ ] Logs and docs do not expose room keys, URL fragments, plaintext Markdown,
      provider secrets, or private hosted operations details.

## Owner Setup Before `/goal`

The repository owner should set these up directly before asking an agent to run
this TODO to completion:

- Create or confirm the GitHub org/owner that will hold:
  - `tabula-md` public repo.
  - `tabula-room` public repo.
  - `tabula-json` public repo.
  - `tabula-cloud` private repo.
- Create the empty private `tabula-cloud` repo.
- Make writable local checkouts available for:
  - this `tabula-md` repo.
  - the `tabula-room` repo.
  - the `tabula-json` repo.
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

- [x] Keep `tabula-md` as the OSS Tabula app repo.
- [x] Keep `tabula-room` as the OSS room server repo.
- [x] Keep `tabula-json` as the OSS encrypted snapshot store repo.
- [x] Keep `tabula-cloud` private for hosted operations.
- [x] Ensure public docs describe the boundary:
  - [x] `tabula-md` is the local-first Markdown workspace.
  - [x] `tabula-room` is the encrypted collaboration server.
  - [x] `tabula-json` is the encrypted snapshot store for `#json` links.
  - [x] `tabula.md` is the official hosted deployment.
  - [x] hosted provider choices live outside public OSS docs.
- [x] Ensure no public repo claims Publish is required for v0.
- [x] Ensure no public repo claims accounts, billing, or Tabula+ exist in v0.

## 2. `tabula-md` OSS Readiness

- [x] Review `README.md` for current truth.
- [x] Remove or reword stale Publish-first product claims.
- [x] Explain local-first Markdown writing clearly.
- [x] Explain that Share is visible in OSS builds.
- [x] Explain that Start session requires `VITE_TABULA_ROOM_URL`.
- [x] Explain that Start session is unavailable when no room service is
      configured.
- [x] Document local development:
  - [x] `npm install`.
  - [x] `npm run dev`.
  - [x] optional local `tabula-room`.
- [x] Document production/self-host requirements:
  - [x] static host with SPA fallback.
  - [x] `VITE_TABULA_ROOM_URL`.
  - [x] no localhost fallback in production.
- [x] Verify public-safe files:
  - [x] `LICENSE`.
  - [x] `CONTRIBUTING.md`.
  - [x] `SECURITY.md`.
  - [x] `.env.example`.
  - [x] `docs/live-collaboration.md`.
- [x] Verify tracked files contain no:
  - [x] production secrets.
  - [x] room keys.
  - [x] private hosted URLs beyond public product URLs.
  - [x] local runtime data.
  - [x] generated smoke artifacts.
- [x] Decide whether root `package.json` stays `"private": true` to prevent
      accidental npm publishing.
- [x] Run validation:
  - [x] `npm test`.
  - [x] `npm run build`.
  - [x] `npm run knowledge:check`.
  - [x] focused browser collaboration smoke against local `tabula-room`.

## 3. `tabula-room` OSS Readiness

- [x] Review `tabula-room` README for current truth.
- [x] Keep the ciphertext-only boundary prominent.
- [x] Explain what the server does:
  - [x] relay encrypted room messages.
  - [x] store encrypted snapshots.
  - [x] expose health and room metadata endpoints.
- [x] Explain what the server does not do:
  - [x] no room keys.
  - [x] no plaintext Markdown.
  - [x] no Publish.
  - [x] no accounts.
  - [x] no billing.
  - [x] no permissions.
  - [x] no server-side indexing, search, summarization, or moderation.
- [x] Verify local quick start works from a fresh clone.
- [ ] Verify Docker quick start works.
- [x] Verify `.env.example` documents:
  - [x] `PORT`.
  - [x] `TABULA_ROOM_ALLOWED_ORIGINS`.
  - [x] `TABULA_ROOM_DATA_DIR`.
  - [x] `TABULA_ROOM_MAX_PAYLOAD_BYTES`.
  - [x] `TABULA_ROOM_RATE_LIMIT_PER_MINUTE`.
- [x] Verify public production docs are provider-neutral:
  - [x] WebSocket-capable Node host.
  - [x] persistent encrypted snapshot storage.
  - [x] TLS.
  - [x] origin allowlist.
  - [x] payload limits.
  - [x] rate limits.
  - [x] `/health` monitoring.
- [ ] Run validation in `tabula-room`:
  - [x] `npm test`.
  - [x] `npm run build`.
  - [ ] `npm run test:docker`.

## 4. `tabula-cloud` Private Repo

- [x] Add initial private repo structure:
  - [x] `README.md`.
  - [x] `docs/architecture.md`.
  - [x] `docs/hosted-service-plan.md`.
  - [x] `docs/web-deployment.md`.
  - [x] `docs/room-deployment.md`.
  - [x] `docs/launch-checklist.md`.
  - [x] `docs/smoke-test.md`.
  - [x] `docs/rollback.md`.
  - [x] `env/tabula-md.production.example`.
  - [x] `env/tabula-room.production.example`.
- [x] State the repo boundary:
  - [x] public app code stays in `tabula-md`.
  - [x] public room server code stays in `tabula-room`.
  - [x] private hosted operations live in `tabula-cloud`.
- [x] Document the v0 hosted stack privately:
  - [x] static web hosting provider.
  - [x] DNS/TLS provider.
  - [x] room service provider.
  - [x] persistent disk path.
  - [x] production web URL.
  - [x] production room URL.
- [x] Add production env examples without secret values.
- [x] Add rollback instructions.
- [x] Add alert ownership and escalation notes.

## 4A. `tabula-json` OSS Readiness

- [ ] Review `tabula-json` README for current truth.
- [ ] Keep the opaque ciphertext-only boundary prominent.
- [ ] Explain what the server does:
  - [ ] accept encrypted snapshot bytes.
  - [ ] store them under a generated id.
  - [ ] return encrypted snapshot bytes by id.
  - [ ] expose `/health`.
- [ ] Explain what the server does not do:
  - [ ] no decryption keys.
  - [ ] no plaintext Markdown.
  - [ ] no live collaboration.
  - [ ] no Publish.
  - [ ] no accounts.
  - [ ] no permissions.
- [ ] Verify `.env.example` or README documents:
  - [ ] `PORT`.
  - [ ] `TABULA_JSON_ALLOWED_ORIGINS`.
  - [ ] `TABULA_JSON_STORAGE_DRIVER`.
  - [ ] R2 account, bucket, access key, secret key, and prefix variables.
  - [ ] `TABULA_JSON_MAX_PAYLOAD_BYTES`.
  - [ ] `TABULA_JSON_RATE_LIMIT_PER_MINUTE`.
- [ ] Verify retention policy is explicit:
  - [ ] snapshot links are durable unless the product contract changes.
  - [ ] R2 lifecycle rules should not expire objects by default.
- [ ] Run validation in `tabula-json`:
  - [ ] `npm test`.
  - [ ] `npm run build`.

## 5. Hosted Web Deployment

- [ ] Create the hosted static Tabula app project from `tabula-md`.
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
  - [ ] `VITE_TABULA_JSON_URL` points to the hosted snapshot store.
  - [ ] no production `VITE_TABULA_PUBLISH_URL` requirement for v0.
  - [ ] no localhost room fallback.
- [ ] Verify hosted app loads.
- [ ] Verify Write mode works.
- [ ] Verify Preview mode works.
- [ ] Verify local drafts survive refresh.
- [ ] Verify Share surface is visible.

## 6. Hosted Room Deployment

- [ ] Create a paid Node/Docker WebSocket service from the public `tabula-room`
      repository.
- [ ] Configure build/start:
  - [ ] build command: `npm install && npm run build`.
  - [ ] start command: `npm start`.
  - [ ] Node version compatible with `tabula-room`.
- [ ] Attach persistent disk for encrypted snapshots.
- [ ] Mount the disk at the path used by `TABULA_ROOM_DATA_DIR`.
- [ ] Configure production policy:
  - [ ] hosted web origin allowlist.
  - [ ] maximum encrypted payload size.
  - [ ] per-minute rate limit.
  - [ ] encrypted snapshot disk path.
- [ ] Connect hosted room domain.
- [ ] Verify TLS.
- [ ] Verify `/health`.
- [ ] Verify WebSocket connection from hosted app.
- [ ] Verify encrypted snapshot survives service restart/redeploy.
- [ ] Verify logs do not contain:
  - [ ] `roomKey`.
  - [ ] URL fragments.
  - [ ] plaintext Markdown.
  - [ ] full encrypted envelopes unless explicitly needed for temporary local
        debugging.
- [ ] Park future scaling work outside v0:
  - [ ] Redis-backed horizontal room scaling.
  - [ ] object storage or database-backed encrypted snapshots.
  - [ ] multi-region room routing.

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
- [ ] Export a snapshot link.
- [ ] Open the snapshot link in a second browser or profile.
- [ ] Confirm the app asks before replacing a non-empty workspace.
- [ ] Confirm the opened snapshot content matches the exported file.
- [ ] Confirm `json.tabula.md` requests do not include the `#json` key.
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
- [x] Confirm `tabula-cloud` remains private.
- [x] Confirm public docs are provider-neutral.
- [x] Confirm private hosted provider details are only in `tabula-cloud`.
- [x] Confirm security reporting path works.
- [x] Confirm issue templates do not route security issues publicly.
- [x] Confirm launch language:
  - [x] public preview.
  - [x] local-first by default.
  - [x] live collaboration is experimental.
  - [x] no account required.
  - [x] Publish/Tabula+ not included in v0.

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
- Alternative OSS room runtime.
- Full permission system.
- Agent Memory as a real product surface.
- Templates as a real standardized document system.
- Command palette.
- Automerge migration.
- Mobile-first editing.
