---
type: Runbook
title: Launch readiness
description: Beta readiness criteria for the no-login, link-first Markdown collaboration workspace.
tags: [launch, beta, readiness]
---

# Launch Definition

The beta is ready when Tabula.md is usable as a no-login, link-first Markdown
collaboration workspace and common failure modes are understandable.

# Product Readiness

- First screen feels like a Markdown workspace.
- Empty state opens directly into useful Markdown actions, not a dashboard.
- First-run README explains local-first writing, Live collaboration, and
  Snapshot links without marketing-page copy.
- Write and Preview modes are polished enough for long-form Markdown.
- Tabs, new document flow, and document identity are understandable.
- Workspace menu, Preferences, Share, Import, Export, and Send to... copy use
  final product language.
- Share and Live state are clear: Live collaboration is `#room`, Snapshot link
  is `#json`, and Publish is not in the v0 Share surface.
- Agent export produces useful Markdown output.
- Light, dark, and system themes have been checked.
- Mobile and narrow desktop viewports keep the editor, tabs, right panel, and
  Share modal usable.

# Collaboration Readiness

- User A can start a live session.
- User B can join by link without account setup.
- Both users can type simultaneously.
- Presence appears without dominating the UI.
- Reloading a live room restores document content through encrypted Firebase
  recovery.

# Data Trust

- Local drafts survive refresh.
- Live rooms persist beyond relay memory through encrypted Firebase recovery.
- Users can tell whether a document is local or live.
- Users can recover or copy content when collaboration fails.
- Runtime data such as `.tabula-room` and `.tabula-room-smoke` is not
  committed.

# Infrastructure Readiness

- `tabula-room` has passing CI and accurate public README instructions.
- The Tabula app build points to the deployed Room URL with
  `VITE_TABULA_ROOM_URL`.
- The Tabula app build points to the deployed JSON snapshot URL with
  `VITE_TABULA_JSON_URL`.
- The Tabula app build includes `VITE_TABULA_FIREBASE_CONFIG` for encrypted
  live recovery.
- Production Start session has been checked without `VITE_TABULA_ROOM_URL` and
  shows a clear unavailable state instead of localhost fallback.
- The Room server has allowed origins, payload limits, rate limits, and no
  durable snapshot data directory. Hosted `rooms.tabula.md` runs the public
  relay behind nginx with pm2 restart supervision.
- Firebase Firestore rules allow only ciphertext room recovery documents.
- The JSON snapshot service has allowed origins, payload limits, rate limits,
  Google App Engine deployment, and a private Google Cloud Storage bucket for
  encrypted object storage.
- Server logs and tests do not receive `roomKey` or plaintext Markdown.
- Server logs and tests do not receive `snapshotKey` or plaintext Markdown.

# Environment Checklist

- `VITE_TABULA_ROOM_URL=https://rooms.tabula.md`
- `VITE_TABULA_JSON_URL=https://json.tabula.md`
- `VITE_TABULA_FIREBASE_CONFIG={...}`
- App allowed origin configured in room service.
- App allowed origin configured in JSON snapshot service.
- Firebase room recovery storage is enabled and rules are deployed.
- `rooms.tabula.md` VM nginx and pm2 are configured.
- `json.tabula.md` App Engine deployment is configured.
- JSON snapshot storage uses a private Google Cloud Storage bucket.
- Error logs redact URL fragments and ciphertext keys.

# Test Readiness

- `npm test` passes.
- `npm run test:browser` passes.
- `npm run build` passes.
- Local two-browser sync smoke passes.
- Deployed app plus deployed Room sync smoke passes.
- Deployed app plus deployed JSON Snapshot link smoke passes.
- `npm run test:browser:production:launch` passes before launch.

# Deployment Checklist

- Build the static app with production service URLs.
- Deploy the app to the static host.
- Deploy or confirm the room service.
- Deploy or confirm the JSON snapshot service.
- Verify `https://tabula.md`, `https://rooms.tabula.md`, and
  `https://json.tabula.md` health manually before running browser smoke.
- Run `npm run test:browser:production:launch`.
- Keep Graphite stack merged and synced before launch announcement.

# Rollback

- Revert the app deployment to the previous static build.
- Keep room and JSON services running unless the incident is service-specific.
- If a service deploy caused the incident, roll back that service first and
  rerun the matching production browser smoke.
- If encrypted snapshot or room data is suspected corrupt, stop writes before
  deleting or migrating data.
- Post a short incident note with the failing flow, rollback time, and follow-up
  owner.

# Related

- [Roadmap](/product/roadmap.md)
- [Phase 1 infrastructure](/architecture/phase-1-infra.md)
