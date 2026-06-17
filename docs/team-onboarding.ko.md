# Tabula.md 팀 온보딩

상태: Active
Owner: taeha
작성일: 2026-06-16

원본: `team-onboarding.md`

이 문서는 새 Tabula.md collaborator가 처음 읽는 가이드다. Canonical workflow
문서를 대체하지 않고, 어떤 도구를 왜 쓰며 첫 작업을 어떻게 끝내는지 설명한다.

다음 문서도 읽는다:

- `AGENTS.md`
- `docs/engineering-workflow.md`
- `docs/graphite-workflow.md`

## 운영 모델

Tabula.md는 founder-led, agent-heavy workflow를 쓰지만 작은 engineering team처럼
운영한다.

- taeha는 product direction, prioritization, review, merge decision을 담당한다.
- Linear는 work intent를 담당한다. 무엇을 왜 바꾸는지, 어떻게 검증하는지다.
- Graphite는 stack structure, review flow, merge flow를 담당한다.
- GitHub는 repository history, PR record, CI, branch protection을 담당한다.
- Agent와 human은 reviewable layer 단위로 구현한다.

기본 매핑:

```txt
One trackable request
-> one Linear issue
-> one Graphite stack
-> one or more GitHub PRs
```

Graphite stack에 PR이 여러 개 있다고 Linear issue를 여러 개 만들지 않는다.
Product outcome, owner, timeline, acceptance criteria가 다를 때만 Linear issue를
나눈다.

## 필요한 접근 권한

PR-bound work를 하기 전에 필요하다:

- `tabula-md/tabula-md` GitHub access.
- Tabula workspace와 `MTS` team/project Linear access.
- GitHub account와 연결된 Graphite access.
- GitHub로 인증된 local Graphite CLI.
- Local development용 Node.js와 npm.

있으면 좋은 것:

- Review와 merge를 위한 Graphite App.
- 팀이 Slack을 쓰면 Graphite notification 또는 Slack integration.
- IDE 기반 stack 작업을 선호하면 Graphite VS Code extension.

## 로컬 설정

Dependency 설치:

```sh
npm install
```

앱 실행:

```sh
npm run dev
```

Collaboration server 실행:

```sh
npm run server
```

둘 다 실행:

```sh
npm run dev:all
```

Graphite 최초 설정:

Graphite는 repository에 최소 하나의 commit이 있어야 한다. Repository에 아직
commit이 없다면 `gt init` 전에 initial commit을 한 번 bootstrap한다.

```sh
gt auth
gt init
```

PR-bound task 시작 전:

```sh
gt sync
gt checkout --trunk
```

## 첫 작업

1. Linear issue를 선택하거나 만든다.
2. Issue에 problem, scope, acceptance criteria, verification note가 있는지 확인한다.
3. 넓게 수정하기 전에 implementation을 reviewable Graphite layer로 나눈다.
4. 각 layer를 `gt create`로 만든다.
5. `gt submit --stack`으로 stack을 제출한다.
6. 각 PR title/body에 Linear issue key를 넣는다.
7. 변경을 증명하는 최소 verification을 실행한다.

예시:

```sh
gt sync
gt checkout --trunk

# Layer 1
gt add <files>
gt create -m "[MTS-123] Extract comment view model"

# Layer 2
gt add <files>
gt create -m "[MTS-123] Update comments panel UI"

# Layer 3
gt add <files>
gt create -m "[MTS-123] Add comments panel coverage"

gt submit --stack
```

Typo, 작은 docs patch, isolated test, 좁은 bug fix처럼 하나의 concern으로
닫히는 작업에만 single Graphite PR을 쓴다.

## Layering 규칙

좋은 stack layer:

- Behavior change 전에 foundation refactor.
- 의존하는 UI보다 먼저 data model 또는 storage.
- Visual polish보다 먼저 behavior.
- 해당 layer를 검증하는 test는 같은 layer에 둔다. 전체 stack을 검증하면
  별도 layer로 둔다.
- 해당 layer를 설명하는 docs는 같은 layer에 둔다. 전체 process를 설명하면
  별도 layer로 둔다.

피한다:

- Refactor, storage, UI, tests, docs가 섞인 한 PR.
- PR 개수에 맞추기 위한 Linear issue 분리.
- 일반 작업에서 raw `git checkout -b`, raw `git push`, `gh pr create`.
- taeha가 명시적으로 요청하지 않은 compatibility path, legacy behavior,
  defensive fallback, alternate implementation.

## Review And Merge

Review는 Graphite App에서 한다. GitHub는 underlying PR과 CI record다.

- Stack은 아래에서 위로 리뷰한다.
- 각 PR은 독립적으로 이해 가능해야 한다.
- Feedback은 관련 branch에서 `gt modify`로 반영한다.
- 영향받은 stack은 `gt submit --stack`으로 다시 제출한다.
- taeha가 다른 흐름을 명시적으로 선택하지 않는 한 Graphite로 merge한다.
- Graphite Merge Queue는 CI, branch protection, review flow가 충분히 안정된
  이후에만 쓴다.

Linear issue closing:

- 관련된 모든 PR body에 `Linear: MTS-123`를 넣는다.
- Issue를 닫는 PR에만 `Fixes MTS-123`를 넣는다.
- Closing PR이 merge되고 integration automation이 실행되면 Linear issue가 Done으로
  이동해야 한다.
- Linear issue는 삭제되지 않고 completed record로 남는다.

## Agent와 일하기

Human이 agent에게 구현을 지시하면 agent가 할 수 있는 유효한 반응은 세 가지뿐이다.

- 지시가 기술적으로 틀렸거나 product-inconsistent하거나 프로젝트를 깨뜨릴
  가능성이 높으면 구체적인 대안을 설명한다.
- 지시가 애매해서 잘못된 결과를 만들 가능성이 높으면 clarification을 요청한다.
- 지시를 실행한다.

Agent는 지시를 무시하거나, 다른 workflow로 조용히 바꾸거나, 구현 가능한데
제안에서 멈추면 안 된다.

여러 agent를 쓸 때:

- Agent들이 같은 surface를 동시에 건드리지 않도록 Linear issue를 분리한다.
- Issue scope는 product surface, architecture boundary, risk area 기준으로
  구체화한다.
- "UI improvements", "bug fixes"처럼 모호한 issue scope는 피한다.
- taeha가 의도적으로 stack을 나누지 않는 한 Linear issue 하나당 agent 하나를
  선호한다.

좋은 병렬 issue 분리:

```txt
MTS-101 Markdown command layer
MTS-102 Preview renderer styling
MTS-103 Comments panel refactor
MTS-104 E2EE room crypto spike
```

나쁜 병렬 issue 분리:

```txt
MTS-101 UI improvements
MTS-102 Design polish
MTS-103 Bug fixes
```

## Verification

변경을 증명하는 가장 작은 verification set을 쓴다:

- Pure Markdown 또는 view-model logic: `npm test`
- TypeScript wiring, imports, package config: `npm run build`
- Editor, preview, right panel, file tree, share, collaboration UI:
  `npm run test:browser`

생략한 verification은 PR body에 이유와 함께 적는다.

## Review 요청 전 체크리스트

- Linear issue가 PR title/body에 연결되어 있다.
- Stack layer가 아래에서 위로 reviewable하다.
- 각 PR의 존재 이유가 하나다.
- 필요한 test나 build가 통과했다.
- UI 변경은 screenshot 또는 명확한 "not visual" note가 있다.
- 숨은 fallback, compatibility path, unrelated cleanup이 없다.
- `gt submit --stack`으로 전체 stack을 업데이트했다.

## Escalation

아래는 taeha에게 먼저 확인한다:

- ADR 생성 또는 수정.
- Collaboration, sharing, encryption, persistence, deployment architecture 변경.
- ADR을 `private-docs/adr`와 public `docs/adr` 사이에서 이동.
- Graphite Merge Queue 활성화 또는 GitHub branch protection 변경.
- Public GitHub issue intake 추가.
