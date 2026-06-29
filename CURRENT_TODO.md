# CURRENT_TODO

이 문서는 `/goal`에 전달할 현재 제품 완성도 개선 컨텍스트다.

목표: Tabula.md를 사용자가 바로 이해하고, 안전하게 공유하고, 프로덕션에서 신뢰할 수 있는 Markdown-first 협업 제품으로 다듬는다.

중요한 제품 계약:

- Tabula.md는 Markdown 파일이 먼저인 제품이다. 첫 화면을 dashboard, database, marketing page로 만들지 않는다.
- Shareable link는 read-only publish가 아니다. 현재 파일을 암호화해 저장하고, 받은 사람이 자기 로컬 작업공간으로 불러와 편집할 수 있는 snapshot/import link다.
- Publish는 나중에 Tabula+에서 제공할 read-only hosted page 기능이다. 지금 공개 제품 표면에서는 숨긴다.
- Live collaboration link는 같은 문서를 함께 편집하는 세션 링크다.
- 이상한 fallback, 옛 route, 내부 구현 설명은 제품 표면에 남기지 않는다.

## 1. 사용자 관점

### 1.1 Share UX 계약 정리

문제:

- Share 안에 Live collaboration, Shareable link, Export, Send to가 섞여 있어 사용자가 각 기능의 차이를 바로 이해하기 어렵다.
- Shareable link를 read-only처럼 설명하면 Publish와 경계가 흐려진다.

해야 할 일:

- [x] Share 첫 화면에서 두 핵심 선택지를 명확히 분리한다.
  - Live collaboration: 같이 편집하는 링크
  - Shareable link: 암호화된 복사본을 내보내는 링크
- [x] Shareable link 문구에서 read-only 표현을 제거한다.
- [x] Shareable link copy를 아래 계약에 맞춘다.
  - 제목: `Shareable link`
  - 설명: `Export an encrypted copy of this file.`
  - 버튼: `Export to link`
  - load modal: `Load from link`
  - 경고: `Loading this link will replace your current local content.`
- [x] Publish 관련 문구와 버튼은 기본 Share 표면에서 계속 숨긴다.
- [x] Share modal 뒤의 split divider, resize handle, editor chrome이 조작되지 않게 modal layer interaction을 차단한다.

완료 기준:

- [x] 사용자는 Share modal만 보고 “같이 편집”과 “복사본 링크”를 구분할 수 있다.
- [x] `read-only`라는 표현은 Publish 계열에서만 사용된다.
- [x] Share modal이 열려 있는 동안 뒤쪽 divider나 editor가 조작되지 않는다.

### 1.2 Collaboration presence 신뢰성

문제:

- 협업 중 누가 들어와 있는지, 나갔는지, 같은 파일을 보는지에 대한 피드백이 약하다.
- 하단 `Live session`, `connecting` 같은 텍스트는 제품 표면을 지저분하게 만든다.

해야 할 일:

- [x] 우측 상단 presence를 협업 상태의 단일 신뢰 표면으로 만든다.
- [x] 같은 브라우저라도 탭 2개가 같은 room에 들어오면 2명의 익명 사용자처럼 보여야 한다.
- [x] 사용자가 room에서 나가면 avatar/presence에서 제거된다.
- [x] presence 클릭 시 collaborator list를 보여준다.
- [x] 같은 파일/다른 파일 상태를 조용하게 표시한다.
- [x] 하단 status bar의 live session copy는 최소화하거나 제거한다.

완료 기준:

- [x] Excalidraw처럼 “누가 현재 세션에 있는지”가 즉시 보인다.
- [x] 사용자가 나가면 5초 이내에 presence에서 사라진다.
- [x] 하단 상태 텍스트가 협업 UX의 주 표면이 되지 않는다.

### 1.3 Theme와 Preferences 완성도

문제:

- 일부 modal/popover/panel이 theme token을 따르지 않으면 dark mode가 미완성처럼 보인다.
- Language는 앱 chrome 언어 설정이어야 하며, 문서 내용을 번역하는 기능처럼 보여서는 안 된다.

해야 할 일:

- [ ] Share modal, Preferences, Editor Controls, right panel, status bar, import/load modal의 light/dark 상태를 모두 확인한다.
- [ ] app surface CSS에서 token 없는 raw color 사용을 제거한다.
- [ ] Preferences는 작고 직접적인 popover로 유지한다.
- [ ] Language dropdown은 최소 7개 언어를 유지한다.
- [ ] 언어 선택 후 메뉴/Preferences/주요 empty state/Share 기본 문구가 같은 범위에서 반영된다.

완료 기준:

- [ ] dark mode에서 흰 modal이나 검은 active tab 같은 이질적인 표면이 없다.
- [ ] Language 설정은 저장되고 reload 후 유지된다.
- [ ] `document.documentElement.lang`이 선택 언어와 일치한다.

## 2. PM 관점

### 2.1 제품 가치 제안 좁히기

문제:

- Markdown editor, local-first, collaboration, agent handoff, shareable link, publish가 한꺼번에 보이면 초기 제품 가설이 흐려진다.

해야 할 일:

- [ ] 공개 제품의 기본 가치 제안을 아래 한 문장으로 정리한다.
  - `A local-first Markdown workspace for files that people and coding agents can share safely.`
- [ ] 지금 보이는 제품 표면은 아래 must-have로 제한한다.
  - Markdown 파일 생성/열기/저장
  - Edit/Split/Preview
  - Live collaboration
  - Shareable encrypted copy link
  - Local agent handoff
- [ ] Templates, Agent panel, Publish, Tabula+는 준비되지 않은 상태에서는 숨긴다.

완료 기준:

- [ ] 첫 사용자가 30초 안에 “Markdown 파일을 쓰고 공유하는 도구”라고 이해할 수 있다.
- [ ] 구현되지 않은 미래 기능이 제품 표면에서 약속처럼 보이지 않는다.

### 2.2 Share / Publish / Export / Send to 경계

문제:

- Shareable link와 Publish가 섞이면 가격 정책과 제품 기능 경계가 흐려진다.

해야 할 일:

- [ ] Share link 탭은 Live collaboration과 Shareable link만 다룬다.
- [ ] Export 탭은 로컬 파일 이동만 다룬다.
  - Markdown `.md`
  - Project archive `.zip`
  - 향후 PDF/HTML은 실제 구현 전까지 숨김
- [ ] Send to 탭은 agent handoff만 다룬다.
  - local coding agent prompt
  - project/file scope
  - copy prompt
- [ ] Publish는 Tabula+ 기능으로 별도 milestone까지 숨김.

완료 기준:

- [ ] 각 탭의 목적이 한 문장으로 설명 가능하다.
- [ ] Publish 없이도 Share 제품 경험이 완결된다.

### 2.3 Activation 지표 준비

문제:

- 사용자가 실제 가치를 경험했는지 측정할 기준이 없다.

해야 할 일:

- [ ] 초기 activation event를 정의한다.
  - created/opened file
  - edited 30+ seconds
  - started live session
  - second user joined session
  - exported shareable link
  - loaded shareable link
  - returned within 7 days
- [ ] OSS와 hosted service 모두에서 개인정보를 과하게 수집하지 않는 방식으로 이벤트 경계를 정한다.
- [ ] analytics는 제품 출시 전 별도 opt-in/hosted-only 정책을 문서화한다.

완료 기준:

- [ ] PMF 실험에서 봐야 할 5~7개 핵심 지표가 정의되어 있다.
- [ ] OSS 빌드에는 hosted service용 추적이 섞이지 않는다.

## 3. CTO 관점

### 3.1 Share view model 분리

문제:

- Share UI는 live room, json snapshot, export, send, future publish gate까지 연결되는 중심 컴포넌트다.
- 상태 판단과 UI rendering이 섞이면 회귀가 계속 생긴다.

해야 할 일:

- [ ] `shareViewModel.ts`를 만든다.
- [ ] 아래 상태를 pure function으로 계산한다.
  - visible tabs
  - active tab availability
  - primary button label
  - disabled reason
  - current link display
  - shareable link status
  - live session status
- [ ] ShareControls는 view model을 받아 렌더링에 집중하게 한다.
- [ ] unit test로 Shareable link/read-only/Publish 문구 경계를 고정한다.

완료 기준:

- [ ] Shareable link를 read-only라고 표시하는 회귀가 테스트로 잡힌다.
- [ ] Publish를 숨긴 상태에서 Share modal이 정상 동작한다.

### 3.2 Collaboration correctness

문제:

- Enter, Backspace, 줄 병합, 긴 문단 편집, undo/redo, remote update가 조금이라도 틀리면 협업 제품으로 신뢰하기 어렵다.

해야 할 일:

- [ ] CodeMirror transaction과 Yjs update 연결을 점검한다.
- [ ] React state 왕복으로 인해 remote update가 local selection/undo stack/line break를 깨지 않게 한다.
- [ ] 두 브라우저 smoke를 추가한다.
  - Enter sync
  - Backspace sync
  - line merge sync
  - long paragraph edit sync
  - reload restore
- [ ] 뒤로가기/앞으로가기가 다른 사람의 편집 history를 undo하지 않도록 한다.

완료 기준:

- [ ] 두 브라우저에서 Markdown text가 byte-level로 일치한다.
- [ ] remote edit가 local cursor와 undo stack을 망가뜨리지 않는다.

### 3.3 Link contract 단일화

문제:

- room/json link는 보안과 제품 이해의 핵심 계약이다.
- fallback, 옛 route, 예외적 URL shape가 남으면 운영과 지원이 어려워진다.

해야 할 일:

- [ ] Live collaboration canonical link:
  - `https://tabula.md/#room=<roomId>,<roomKey>`
- [ ] Shareable snapshot canonical link:
  - `https://tabula.md/#json=<snapshotId>,<snapshotKey>`
- [ ] `/r/:roomId#key=...` 같은 옛 route/fallback을 제거한다.
- [ ] key 없는 URL은 과한 error UI 대신 조용하고 명확한 load failure로 처리한다.
- [ ] docs, smoke, code parser가 같은 계약을 공유하게 한다.

완료 기준:

- [ ] URL parser가 한 곳에 있고 테스트된다.
- [ ] 제품 표면에 내부 보안 설명이 과하게 드러나지 않는다.

### 3.4 Production smoke

문제:

- 로컬 smoke만으로는 `tabula.md`, `rooms.tabula.md`, `json.tabula.md` 통합 문제를 잡지 못한다.

해야 할 일:

- [ ] production smoke를 별도 suite로 만든다.
- [ ] 아래 흐름을 검증한다.
  - `tabula.md` load
  - Start session
  - invite link 생성
  - 두 번째 browser join
  - Enter/edit sync
  - reload restore
  - Export to link
  - Load from `#json`
- [ ] production smoke는 destructive data를 남기지 않게 test room/test snapshot naming을 둔다.

완료 기준:

- [ ] 배포 후 실제 도메인에서 협업과 shareable link가 검증된다.
- [ ] Product Hunt/HN/X 유입 전에 수동 QA만 믿지 않아도 된다.

### 3.5 Theme token discipline

문제:

- surface CSS에 raw color가 들어가면 dark mode 회귀가 반복된다.

해야 할 일:

- [ ] app surface CSS에서 raw `#ffffff`, `#1f1f1f`, `#555555` 등을 금지하는 lint 또는 smoke check를 추가한다.
- [ ] 허용 예외는 `base.css` token 정의, syntax highlighting, avatar color 정도로 제한한다.
- [ ] modal/popover/panel/status surface는 반드시 token을 사용한다.

완료 기준:

- [ ] 새 UI surface를 추가해도 light/dark 기본 대비가 깨지지 않는다.
- [ ] raw color 회귀가 CI에서 잡힌다.

### 3.6 OSS / hosted service 경계

문제:

- OSS repo와 hosted service 설정이 섞이면 공개 후 사용자가 혼란스러워진다.

해야 할 일:

- [ ] `tabula-md`: app source와 self-host 가능한 env example만 둔다.
- [ ] `tabula-room`: live collaboration relay server로 문서화한다.
- [ ] `tabula-json`: encrypted snapshot store로 문서화한다.
- [ ] hosted `tabula.md` 운영 secrets, Cloudflare account config, private deploy docs는 공개 repo에 넣지 않는다.
- [ ] README에는 “how to self-host”와 “how tabula.md is hosted”를 분리해서 쓴다.

완료 기준:

- [ ] OSS 사용자는 자기 인프라로 실행할 수 있다.
- [ ] hosted service 운영 세부 정보는 공개 repo에 새지 않는다.

## 4. 추천 작업 순서

- [ ] 1. Share copy/contract 정리
- [ ] 2. Share view model 분리
- [ ] 3. Collaboration correctness smoke 추가
- [ ] 4. Presence UX 최소 완성
- [ ] 5. Link parser/canonical URL 정리
- [ ] 6. Production smoke 추가
- [ ] 7. Theme raw color guard 추가
- [ ] 8. OSS/hosted docs 정리

## 5. 검증 명령

각 패치 후 변경 범위에 맞춰 최소 검증을 실행한다.

- Unit:
  - [ ] `npm test`
- Build:
  - [ ] `npm run build`
- Browser smoke:
  - [ ] `npm run test:browser:workspace`
  - [ ] `npm run test:browser:panels`
  - [ ] `npm run test:browser:collab`
  - [ ] `npm run test:browser:json-share`
- Diff hygiene:
  - [ ] `git diff --check`
- PR readiness:
  - [ ] `npm run pr:ready`

## 6. 완료 정의

- [ ] 사용자가 Share modal에서 live collaboration과 encrypted copy link를 혼동하지 않는다.
- [ ] Publish는 숨겨져 있고, read-only hosted page 기능으로만 남는다.
- [ ] 두 브라우저 협업 편집이 Enter/Backspace/긴 문단/줄 병합에서 정확하다.
- [ ] presence가 실제 접속자 상태와 맞다.
- [ ] theme가 주요 surface에서 깨지지 않는다.
- [ ] production 도메인 smoke가 통과한다.
- [ ] OSS repo와 hosted service 경계가 문서와 코드에서 일관된다.
