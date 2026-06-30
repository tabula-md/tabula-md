# Tabula.md OSS + Hosted Launch TODO

최종 업데이트: 2026-06-26

이 TODO는 일부러 좁게 잡는다. 목표는 아래 네 가지다.

1. `tabula-md`가 오픈소스 Tabula app 레포로 공개될 수 있을 것.
2. `tabula-room`이 오픈소스 encrypted room server 레포로 공개될 수 있을 것.
3. 사용자가 `tabula.md`에 들어와 제품을 실제로 쓸 수 있을 것.
4. 사용자가 Markdown을 쓰고, Share를 눌러 live room link를 복사하고, 다른
   브라우저에서 같은 문서를 함께 편집할 수 있을 것.

이 문서는 전체 제품 백로그가 아니다. Tabula+, Publish, billing, accounts,
team workspace, template system, agent memory, 미래 인프라 리라이트는 여기
완료 조건에 넣지 않는다.

## 완료 정의

- [ ] `tabula-md`가 OSS Tabula app으로 공개 가능한 상태다.
- [ ] `tabula-room`이 OSS encrypted room server로 공개 가능한 상태다.
- [x] private `tabula-cloud` 레포가 있다.
- [ ] hosted `tabula.md`에서 production Tabula app이 열린다.
- [ ] hosted Share > Start session이 live room link를 만든다.
- [ ] 두 번째 브라우저가 복사된 `/#room=<roomId>,<roomKey>` 링크로 들어올 수 있다.
- [ ] 두 브라우저가 같은 Markdown 문서를 함께 편집할 수 있다.
- [ ] reload 후 encrypted room state가 복구된다.
- [ ] 로그와 문서에 room key, URL fragment, plaintext Markdown, provider
      secret, private hosted operations detail이 노출되지 않는다.

## `/goal` 실행 전에 Owner가 직접 해야 할 일

아래는 agent가 대신하기 어렵거나 계정 권한이 필요한 준비물이다.

- GitHub org 또는 owner를 확정한다.
  - `tabula-md` public repo.
  - `tabula-room` public repo.
  - `tabula-cloud` private repo.
- 빈 private `tabula-cloud` repo를 만든다.
- agent가 수정할 수 있는 local checkout을 준비한다.
  - 이 `tabula-md` repo.
  - `tabula-room` repo.
  - private `tabula-cloud` repo.
- 각 repo의 GitHub remote와 default branch를 확정한다.
- `tabula.md` DNS zone을 production DNS 계정에서 제어할 수 있는지 확인한다.
- hosted web provider 계정이 static Vite app 배포를 할 수 있는 상태인지 확인한다.
- hosted room provider 계정이 paid Node/Docker WebSocket service와 persistent
  disk를 만들 수 있는 상태인지 확인한다. v0의 hosted room은 별도 private
  구현체가 아니라 public `tabula-room` 서버를 production 설정으로 배포한다.
- hosted web provider와 hosted room provider에 쓸 deployment CLI 또는 browser
  session이 로그인되어 있는지 확인한다.
- production alert를 받을 계정/채널을 정한다.
- production secret 값을 이 repo나 issue comment에 쓰지 않는다.

## 1. Public Repo Boundary

- [ ] `tabula-md`는 OSS Tabula app repo로 유지한다.
- [ ] `tabula-room`은 OSS room server repo로 유지한다.
- [ ] `tabula-cloud`는 hosted operations용 private repo로 유지한다.
- [ ] public docs에서 경계를 설명한다.
  - [ ] `tabula-md`는 local-first Markdown workspace다.
  - [ ] `tabula-room`은 encrypted collaboration server다.
  - [ ] `tabula.md`는 공식 hosted deployment다.
  - [ ] hosted provider 선택은 public OSS docs에 두지 않는다.
- [ ] public repo가 Publish를 v0 필수 기능처럼 말하지 않는다.
- [ ] public repo가 accounts, billing, Tabula+가 v0에 있다고 말하지 않는다.

## 2. `tabula-md` OSS Readiness

- [x] `README.md`가 현재 사실과 맞는지 검토한다.
- [x] Publish-first로 읽히는 오래된 문구를 제거하거나 고친다.
- [x] local-first Markdown writing을 명확히 설명한다.
- [x] OSS build에서도 Share 표면이 보인다는 점을 설명한다.
- [x] Start session에는 `VITE_TABULA_ROOM_URL`이 필요하다는 점을 설명한다.
- [x] room service가 없으면 Start session이 unavailable이라는 점을 설명한다.
- [x] local development를 문서화한다.
  - [x] `npm install`.
  - [x] `npm run dev`.
  - [x] optional local `tabula-room`.
- [x] production/self-host requirement를 문서화한다.
  - [x] SPA fallback을 지원하는 static host.
  - [x] `VITE_TABULA_ROOM_URL`.
  - [x] production에서 localhost fallback 없음.
- [x] public-safe 파일을 확인한다.
  - [x] `LICENSE`.
  - [x] `CONTRIBUTING.md`.
  - [x] `SECURITY.md`.
  - [x] `.env.example`.
  - [x] `docs/live-collaboration.md`.
- [x] tracked files에 아래가 없는지 확인한다.
  - [x] production secrets.
  - [x] room keys.
  - [x] public product URL이 아닌 private hosted URL.
  - [x] local runtime data.
  - [x] generated smoke artifacts.
- [x] GitHub repo는 public이어도 accidental npm publish를 막기 위해
      root `package.json`의 `"private": true`를 유지할지 결정한다.
- [x] 검증을 실행한다.
  - [x] `npm test`.
  - [x] `npm run build`.
  - [x] `npm run knowledge:check`.
  - [x] local `tabula-room`을 붙인 focused browser collaboration smoke.

## 3. `tabula-room` OSS Readiness

- [x] `tabula-room` README가 현재 사실과 맞는지 검토한다.
- [x] ciphertext-only boundary를 가장 중요한 원칙으로 보여준다.
- [x] server가 하는 일을 설명한다.
  - [x] encrypted room message relay.
  - [x] encrypted snapshot storage.
  - [x] health and room metadata endpoints.
- [x] server가 하지 않는 일을 설명한다.
  - [x] room key 수신 없음.
  - [x] plaintext Markdown 수신 없음.
  - [x] Publish 없음.
  - [x] accounts 없음.
  - [x] billing 없음.
  - [x] permissions 없음.
  - [x] server-side indexing/search/summarization/moderation 없음.
- [ ] fresh clone에서 local quick start가 동작하는지 확인한다.
- [ ] Docker quick start가 동작하는지 확인한다.
- [x] `.env.example`가 아래를 문서화하는지 확인한다.
  - [x] `PORT`.
  - [x] `TABULA_ROOM_ALLOWED_ORIGINS`.
  - [x] `TABULA_ROOM_DATA_DIR`.
  - [x] `TABULA_ROOM_MAX_PAYLOAD_BYTES`.
  - [x] `TABULA_ROOM_RATE_LIMIT_PER_MINUTE`.
- [x] public production docs는 provider-neutral하게 둔다.
  - [x] WebSocket-capable Node host.
  - [x] persistent encrypted snapshot storage.
  - [x] TLS.
  - [x] origin allowlist.
  - [x] payload limits.
  - [x] rate limits.
  - [x] `/health` monitoring.
- [ ] `tabula-room`에서 검증을 실행한다.
  - [x] `npm test`.
  - [x] `npm run build`.
  - [ ] `npm run test:docker`.

## 4. `tabula-cloud` Private Repo

- [x] private repo 기본 구조를 만든다.
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
- [x] repo boundary를 명시한다.
  - [x] public app code는 `tabula-md`에 둔다.
  - [x] public room server code는 `tabula-room`에 둔다.
  - [x] private hosted operations는 `tabula-cloud`에 둔다.
- [x] v0 hosted stack을 private하게 문서화한다.
  - [x] static web hosting provider.
  - [x] DNS/TLS provider.
  - [x] room service provider.
  - [x] persistent disk path.
  - [x] production web URL.
  - [x] production room URL.
- [x] production env example을 만들되 실제 secret 값은 넣지 않는다.
- [x] rollback instructions를 추가한다.
- [x] alert ownership and escalation notes를 추가한다.

## 5. Hosted Web Deployment

- [ ] `tabula-md`에서 hosted static Tabula app project를 만든다.
- [ ] build를 설정한다.
  - [ ] build command: `npm run build`.
  - [ ] output directory: `dist`.
  - [ ] repo와 맞는 Node version.
- [ ] client route용 SPA fallback을 설정한다.
  - [ ] `/#room=<roomId>,<roomKey>`.
  - [ ] future client routes.
- [ ] `tabula.md`를 연결한다.
- [ ] production environment를 설정한다.
  - [ ] `VITE_TABULA_ROOM_URL`이 hosted room service를 가리킨다.
  - [ ] v0에서는 production `VITE_TABULA_PUBLISH_URL`이 필수이면 안 된다.
  - [ ] localhost room fallback이 없어야 한다.
- [ ] hosted app이 로드되는지 확인한다.
- [ ] Write mode가 동작하는지 확인한다.
- [ ] Preview mode가 동작하는지 확인한다.
- [ ] local draft가 refresh 후 살아남는지 확인한다.
- [ ] Share surface가 보이는지 확인한다.

## 6. Hosted Room Deployment

- [ ] `tabula-room`에서 paid Node/Docker WebSocket service를 만든다.
- [ ] build/start를 설정한다.
  - [ ] build command: `npm install && npm run build`.
  - [ ] start command: `npm start`.
  - [ ] `tabula-room`과 맞는 Node version.
- [ ] encrypted snapshot용 persistent disk를 붙인다.
- [ ] disk를 `TABULA_ROOM_DATA_DIR`에서 쓰는 path에 mount한다.
- [ ] production environment를 설정한다.
  - [ ] `PORT`.
  - [ ] `TABULA_ROOM_ALLOWED_ORIGINS`에 hosted web origin 포함.
  - [ ] `TABULA_ROOM_DATA_DIR`.
  - [ ] `TABULA_ROOM_MAX_PAYLOAD_BYTES=1048576`.
  - [ ] `TABULA_ROOM_RATE_LIMIT_PER_MINUTE=600`.
- [ ] hosted room domain을 연결한다.
- [ ] TLS를 확인한다.
- [ ] `/health`를 확인한다.
- [ ] hosted app에서 WebSocket connection이 되는지 확인한다.
- [ ] encrypted snapshot이 restart 후에도 살아남는지 확인한다.
- [ ] logs에 아래가 없는지 확인한다.
  - [ ] `roomKey`.
  - [ ] URL fragments.
  - [ ] plaintext Markdown.
  - [ ] 임시 local debugging을 제외한 full encrypted envelopes.
- [ ] v0 이후로 미룰 scaling 작업을 명확히 분리한다.
  - [ ] Redis-backed horizontal room scaling.
  - [ ] object storage or database-backed encrypted snapshots.
  - [ ] multi-region room routing.

## 7. End-To-End Hosted Smoke

- [ ] hosted `tabula.md`를 연다.
- [ ] 첫 화면이 Markdown workspace처럼 느껴지는지 확인한다.
- [ ] Markdown을 작성하거나 수정한다.
- [ ] saved/local state가 이해 가능한지 확인한다.
- [ ] Share를 연다.
- [ ] Start session을 누른다.
- [ ] invite link를 복사한다.
- [ ] 두 번째 브라우저나 profile에서 invite link를 연다.
- [ ] 두 번째 브라우저가 같은 document에 join하는지 확인한다.
- [ ] 두 브라우저에서 모두 입력한다.
- [ ] 두 브라우저를 reload한다.
- [ ] encrypted room state가 복구되는지 확인한다.
- [ ] missing-key link를 테스트한다.
- [ ] wrong-key link를 테스트한다.
- [ ] room service를 끄거나 비활성화했을 때 unavailable state가 명확한지
      확인한다.
- [ ] failed room recovery가 local content를 덮어쓰지 않는지 확인한다.
- [ ] manual evidence를 남긴다.
  - [ ] hosted app URL.
  - [ ] room health response.
  - [ ] two-browser collaboration result.
  - [ ] unavailable-state result.

## 8. Final OSS Release Check

- [ ] `tabula-md` public repo visibility를 안전하게 바꿀 수 있는지 확인한다.
- [ ] `tabula-room` public repo visibility를 안전하게 바꿀 수 있는지 확인한다.
- [ ] `tabula-cloud`는 private으로 남아 있는지 확인한다.
- [ ] public docs는 provider-neutral한지 확인한다.
- [ ] private hosted provider detail은 `tabula-cloud`에만 있는지 확인한다.
- [ ] security reporting path가 동작하는지 확인한다.
- [ ] issue templates가 security issue를 public으로 유도하지 않는지 확인한다.
- [ ] launch language를 확인한다.
  - [ ] public preview.
  - [ ] local-first by default.
  - [ ] live collaboration is experimental.
  - [ ] no account required.
  - [ ] Publish/Tabula+ not included in v0.

## 이 TODO의 범위 밖

아래는 지금 완료 조건이 아니다.

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
