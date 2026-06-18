# WORKFLOW.ko.md

이 파일은 `WORKFLOW.md`의 한국어 버전이다. 사람과 코딩 에이전트가
Tabula.md 작업을 계획하고, 구현하고, 제출하고, 리뷰하고, 머지하고,
정리할 때 따르는 표준이다. Codex, Cursor 호환 에이전트, Claude Code,
그 외 향후 도구 모두 같은 흐름을 따른다.

충돌이 있으면 영어 원문인 `WORKFLOW.md`가 우선한다. 규칙을 바꿀 때는 두
파일을 함께 갱신한다.

## 운영 모델

- GitHub Issues는 공개 버그 리포트와 기능 요청을 받는 채널이다.
- Linear는 maintainer가 수락한 작업을 관리한다. 무엇을 바꾸는지, 왜
  중요한지, 우선순위, 상태, 수용 기준을 기록한다.
- Graphite는 PR-bound 브랜치 생성, stack 구조, submit, review flow,
  post-merge sync를 담당한다.
- GitHub는 PR 기록, CI, 코드 리뷰 메타데이터, 머지 히스토리를 담당한다.
- Git은 로컬 히스토리를 담당한다.
- ADR은 오래 남는 아키텍처 결정을 기록한다.

Maintainer 작업은 repository owner가 명시적으로 GitHub issue 기반 흐름을
요청하지 않는 한 Linear를 사용한다.

에이전트 진입 파일은 얇게 유지한다.

- `WORKFLOW.md`: 모든 contributor와 agent가 따르는 표준 workflow.
- `WORKFLOW.ko.md`: 같은 workflow의 한국어 버전.
- `AGENTS.md`: Codex와 Cursor 호환 에이전트용 repo 지침.
- `CLAUDE.md`: Claude Code용 repo 지침.

도구별 진입 파일은 해당 도구에 필요한 context만 추가할 수 있다. 별도
workflow를 정의하면 안 된다.

## Knowledge Bundle

이 repository는 `knowledge/`를 포함한다. 이는 OKF-inspired Markdown concept
bundle이다. 작은 YAML frontmatter를 가진 Markdown 문서들로 product principle,
workflow concept, architecture constraint, repository area, runbook을 사람이
읽고 agent가 탐색할 수 있게 만든다.

이 bundle은 별도 service나 agent-specific runtime을 추가하지 않는다. 깊은
context가 필요할 때 사용한다. 실행 규칙을 override하는 용도로 쓰면 안 된다.
`WORKFLOW.md`가 workflow source of truth다.
이 bundle은 OKF-style 구조를 사용하지만 repo-specific quality check를 일반
OKF conformance check라고 주장하지 않는다.

Conventions:

- `knowledge/index.md`는 navigation entrypoint다.
- `knowledge/log.md`는 knowledge bundle 변경 기록이다.
- `knowledge/` 아래 reserved file이 아닌 모든 Markdown file은 concept
  document다.
- Concept document는 최소 `type` frontmatter를 포함한다.
- Concept 사이에는 일반 Markdown link를 사용한다.

Bundle을 수정한 뒤 실행한다.

```sh
npm run knowledge:check
```

`knowledge:check`는 permissive OKF consumer보다 의도적으로 엄격하다. 이
repository에서는 깨진 internal link를 curated context 품질 문제로 취급한다.

## Agent Contract

사람 operator가 구체적인 지시를 주면 coding agent의 유효한 반응은 세
가지뿐이다.

- 그 지시가 기술적으로 틀렸거나, 제품 방향과 맞지 않거나, 프로젝트를
  깨뜨릴 가능성이 크다면 구체적인 이유와 더 나은 대안을 설명한다.
- 지시가 모호해서 실행하면 잘못된 결과가 나올 가능성이 크다면 명확화를
  요청한다.
- 실행한다.

지시를 무시하거나, 조용히 다른 workflow로 바꾸거나, 구현 가능한데 제안만
하고 멈추지 않는다. 사람 operator가 명시적으로 요청했거나 기존 제품
계약이 요구하지 않는 한 compatibility path, legacy behavior, defensive
fallback, alternate implementation을 추가하지 않는다.

## 작업 모드

요청을 만족하는 가장 가벼운 mode를 사용한다. 모든 구현 prompt에 full PR
handoff workflow를 적용하지 않는다.

작업 모드 선택은 agent judgment이지 keyword filter가 아니다. 아래 예시는
고려할 signal이지 rule engine이 아니다. Hook은 prompt text만 보고 작업 모드를
선택하면 안 된다.

### Fast Local Loop

Repository owner가 review handoff를 요청하지 않았고 변경 자체도 handoff를
본질적으로 요구하지 않는 일반 구현 prompt의 기본 mode다.

- 변경을 구현한다.
- 건드린 파일에 맞는 focused validation을 실행한다.
- 결과와 실행하지 않은 validation을 보고한다.
- 작업이 review handoff를 명확히 요구하지 않으면 Linear issue, Graphite PR,
  PR metadata command를 만들거나 실행하지 않는다.

이 mode가 작은 작업과 중간 크기 coding task의 기본 속도 경로다.

### PR Handoff Loop

Repository owner의 의도가 review handoff이거나, 작업이 명확히 PR 또는 stack으로
review되어야 할 때 사용한다.

- Branch, commit, submit, stack, publish, sync는 Graphite를 사용한다.
- 변경 파일에 필요한 focused validation을 실행한다.
- Graphite submit 후 `npm run pr:handoff -- ...`를 실행한다.
- Handoff 전에 `npm run pr:ready`를 한 번 실행해 local metadata와 template
  gap을 잡는다.
- Handoff 후에는 CI나 Graphite mergeability를 계속 polling하지 않는다.
  Repository owner가 Graphite App 상태를 보고 merge하며, merge가 막히면
  구체적 오류를 agent에게 다시 전달한다.

### Release/Public Loop

Release, changelog, public launch, security, cross-repo, branch protection,
CI, 외부에 보이는 project process 작업에 사용한다.

- 명시적 Linear tracking을 선호한다.
- Reviewable layer가 나뉘면 Graphite stack을 사용한다.
- 더 넓은 validation과 documentation check를 실행한다.
- Public docs, templates, repository settings를 product surface로 취급한다.

Hook은 hard safety violation을 차단하거나, 관측된 Graphite handoff state를
알리거나, likely validation needs를 signal할 수 있다. 하지만 agent의 작업 모드,
stack shape, validation, implementation judgment를 대체하면 안 된다.

## 작업 분류

PR-bound 작업의 기본 매핑은 다음과 같다.

```txt
하나의 추적 가능한 요청
-> 하나의 Linear issue
-> 하나의 Graphite stack
-> 하나 이상의 GitHub PR
```

수정 전에 이 순서로 판단한다.

- Fast local work: owner가 구현을 요청했지만 PR handoff를 요청하지 않았다면
  기본적으로 Fast Local Loop를 사용한다.
- Single PR: typo, 작은 docs patch, isolated test, 좁은 bug fix처럼 하나의
  review concern이면 하나의 Graphite PR을 사용한다.
- Stack: 하나의 outcome이 여러 reviewable slice 또는 layer로 나뉘면 여러
  Graphite PR을 사용한다.
- Multiple Linear issues: product outcome, owner, timeline, acceptance
  criteria가 다를 때만 issue를 나눈다.

Graphite stack에 PR이 여러 개라고 해서 Linear issue를 불필요하게 여러 개
만들지 않는다.

## Slice Strategy

큰 수정을 시작하기 전에 작업을 어떻게 나눌지 결정한다. Graphite stack은
review와 merge 구조다. 수평적 engineering layer로 나눠야만 하는 것은
아니다.

새롭거나 불확실한 boundary를 넘는 작업은 기본적으로 vertical slice를
선택한다.

- 새 repo, service, package, deployment target, runtime boundary.
- Client/server, browser/server, worker/server, multi-repo integration.
- Collaboration, authentication, encryption, persistence, migrations,
  external systems.
- 가장 큰 위험이 "이 부분들이 실제로 연결되는가?"인 변경.

Vertical slice는 얇더라도 중요한 boundary를 end-to-end로 통과해야 한다.
한 layer를 깊게 만들기 전에 먼저 전체 경로가 연결되는지 증명한다.

불확실성이 높으면 첫 vertical slice는 tracer bullet로 시작한다. Tracer
bullet은 시스템을 통과하는 가장 작은 유용한 경로다.

```txt
Tabula web
-> room client config
-> external room endpoint
-> minimal room response
-> smoke 또는 manual verification
```

예를 들어 `tabula-room`이 별도 repo가 된다면 첫 작업은 완성된 room server가
아니다. 첫 작업은 Tabula가 최소 external room service와 end-to-end로 통신할
수 있음을 증명하는 것이다. Security hardening, persistence, deployment,
protocol depth는 경로가 증명된 뒤에 추가한다.

Horizontal layer는 integration path가 이미 증명되었거나 작업이 대부분 내부
정리일 때 사용한다.

- 이미 동작하는 behavior 아래의 pure refactor.
- Test-only, docs-only, tooling-only changes.
- 이후 diff를 줄이는 shared contract 또는 type cleanup.
- 각 layer를 독립적으로 검증할 수 있는 migration split.

좋은 stack shape 예시:

```txt
High uncertainty:
PR 1: thin vertical tracer bullet
PR 2: harden protocol and data contracts
PR 3: add persistence/security/deployment depth
PR 4: tests and docs for the finished behavior

Low uncertainty:
PR 1: pure refactor or shared contract cleanup
PR 2: behavior change
PR 3: UI/tests/docs
```

Horizontal split을 고르기 전에 reviewer가 뒤 branch가 없어도 의미 있는
behavior를 실행하거나 검토할 수 있는지 확인한다. 아니라면 vertical slice로
시작한다.

## 작업 시작

먼저 현재 위치를 확인한다.

```sh
npm run workflow:status
```

Fast Local Loop에서는 보통 이것으로 충분하다. Worktree가 clean한지 확인하거나
기존 변경을 모두 이해한 뒤 수정하고 focused validation을 실행한다.

PR Handoff Loop 작업은 trunk에서 시작한다.

```sh
gt sync --delete-all
gt checkout --trunk
npm run workflow:status
```

수정 전 확인한다.

- Worktree가 clean한지 확인하거나 기존 변경을 모두 이해한다.
- Accepted maintainer work라면 `MTS-*` Linear issue를 만들거나 찾는다.
- Local-only, one PR, one stack, multiple Linear issues 중 무엇인지 결정한다.
- 넓은 수정 전에 vertical slice, tracer bullet, horizontal layer 중 어떤
  split을 쓸지 결정한다.

Thread를 재개할 때, Graphite submit 후, merge 후에는
`npm run workflow:status`를 사용한다. 현재 branch, PR, metadata, checks,
Graphite stack, 다음 expected action을 요약한다.

Workflow setup, workflow automation 변경, 환경 이상, post-merge cleanup
진단이 필요하면 `npm run workflow:doctor`를 사용한다. 모든 작은 구현의 기본
단계로 실행하지 않는다. 이 명령은 repo-local template, scripts, Graphite
availability, GitHub merge settings, stale Graphite temporary branches, label
catalog drift, local Git maintenance warning을 검사한다. submit이나 merge는
하지 않는다.

Fix는 effect별 명시적 명령으로 나뉜다.

```sh
npm run workflow:doctor -- --fix-graphite-config
npm run workflow:doctor -- --delete-stale-graphite-base
npm run workflow:doctor -- --sync-labels
npm run workflow:maintenance -- --register
```

PR이나 stack이 merge된 뒤에는 `npm run workflow:sync`를 사용한다. 정상
작업에서 post-merge cleanup은 이 명령 하나로 처리한다. 내부적으로 Graphite
sync, trunk checkout, Git remote-tracking prune, post-merge local Git object
maintenance, workflow doctor, workflow status를 순서대로 실행한다.
`workflow:doctor`, `workflow:maintenance`, `workflow:status`는 질문이 다르기
때문에 별도 명령으로도 유지한다. Doctor는 repo/tooling health를 검사하고,
maintenance는 안전한 경계에서 local Git object storage를 정리하며, status는
현재 branch와 PR state를 보고한다.

Git object cleanup은 Graphite branch cleanup과 별개다. Graphite는
`gt sync --delete-all`로 merged branch cleanup을 담당한다. Git은 unreachable
local objects를 담당한다. `workflow:doctor`가 `.git/gc.log`나 너무 많은
loose Git objects를 보고해도 active branch 작업 중에는 prune하지 않는다.
정리 시점은 post-merge boundary다. PR 또는 stack이 merge된 뒤
`npm run workflow:sync`가 `npm run workflow:maintenance -- --post-merge`를
실행하고, repo가 clean이고 trunk 위에 있을 때만 local Git object storage를
정리한다.

## Command Ownership

Graphite는 PR-bound branch와 PR lifecycle을 담당한다.

- Branch creation and commits: `gt create`.
- Updating a branch after feedback: `gt modify`.
- Stack navigation: `gt checkout`, `gt up`, `gt down`, `gt top`, `gt bottom`.
- Stack shape: `gt move`, `gt reorder`, `gt fold`, `gt split`, `gt absorb`.
- Sync and restack: `gt sync`, `gt restack`.
- PR creation, PR updates, draft publishing: `gt submit`.
- Recovery from a bad Graphite mutation: `gt undo`.

GitHub API와 GitHub CLI는 Graphite가 담당하지 않는 metadata와 repository
hygiene에만 사용한다.

- `npm run pr:handoff`: Graphite submit 후 PR title 검토, review body 작성,
  label과 assignee metadata 적용, agent provenance 기록을 한 번에 수행하는
  표준 경로.
- `npm run pr:title`, `npm run pr:body`, `npm run pr:metadata`: focused recovery
  또는 targeted update용 낮은 수준 명령.
- `npm run pr:ready`: local handoff completeness 확인. PR state, metadata,
  title, body, branch policy, whitespace만 확인하며 CI나 Graphite
  mergeability를 merge gate처럼 polling하지 않는다.
- `npm run workflow:doctor -- --sync-labels`: GitHub labels sync.
- `npm run workflow:doctor -- --delete-stale-graphite-base`: open PR이 없을 때
  stale `graphite-base/*` branches 삭제.

Graphite-owned lifecycle에는 raw `git`이나 `gh`를 사용하지 않는다. 특히
다음을 사용하지 않는다.

- `git checkout -b`
- `git commit`
- `git push`
- `git pull`
- `gh pr create`
- `gh pr ready`
- `gh pr edit`
- `gh pr merge`
- PR이나 remote ref를 직접 변경하는 mutating `gh api`

State-changing workflow command는 직렬로 실행한다. Graphite mutation, GitHub
metadata mutation, Linear status update, remote ref cleanup을 서로 병렬로
실행하지 않는다. Mutation 완료 후의 parallel reads와 validation은 괜찮다.

여러 agent가 병렬로 일할 때는 agent session마다 하나의 Git worktree를
사용한다. 두 agent가 같은 worktree에서 같은 Graphite stack을 동시에
변경하지 않는다.

## Linear Standard

현재 Linear team: `Members of Technical Staff`.
현재 Linear issue key: `MTS`.
현재 Linear project: `tabula-md`.

Maintainer work가 오래 남는 product, architecture, security, implementation
context를 가진다면 Linear issue를 만든다.

필수 issue states:

- `Backlog`
- `Todo`
- `In Progress`
- `In Review`
- `Done`

State transitions:

- 구현을 시작하면 `In Progress`.
- Graphite PR 또는 stack을 submit하면 `In Review`.
- Closing PR이 land되고 follow-up이 없으면 `Done`.

필수 type labels:

- `Bug`: 의도한 behavior가 깨졌거나 regression이 있다.
- `Feature`: 새로운 user-facing capability.
- `Improvement`: 기존 capability를 더 좋게 만든다.
- `Refactor`: behavior change 없는 내부 코드 개선.
- `Infra`: build, CI, deploy, tooling, environment work.
- `Docs`: documentation, specs, ADRs, written process.
- `Chore`: 다른 type에 맞지 않는 maintenance.
- `Spike`: 구현 전 research 또는 investigation.

기본적으로 type label은 정확히 하나만 사용한다. `Design`, `Security` 같은
domain label은 피하고 title, description, project, priority, linked ADR에
담는다.

Linear issue를 만들 때는 `.linear/ISSUE_TEMPLATE.md`를 사용한다. Repo-local
template이 agent의 source of truth다. Linear UI template은 사람을 위한 보조
도구다.

## Graphite Standard

이 repo의 정상 PR 작업에는 Graphite가 필수다. Repository owner가 명시적으로
fallback을 요청하지 않는 한 raw Git, GitHub CLI, GitHub Issues로 대체하지
않는다.

허용되는 예외:

- Repository owner가 non-Graphite fallback을 명시적으로 요청한다.
- Repository에 initial commit이 아직 없다. Bootstrap을 한 번 하고 Graphite로
  돌아온다.
- 작업이 purely local이고 branch, commit, PR, merge handoff가 필요 없다.

Graphite가 unavailable, unauthenticated, uninitialized, blocked 상태라면
가능한 safe local edits는 진행하고, submission이 blocked임을 명확히 보고한다.

Lifecycle:

- Trunk에서 시작한다: `gt sync --delete-all`, `gt checkout --trunk`.
- Layer 생성은 파일 수정, `gt add <files>`, 그리고
  `gt create <agent-or-dev-prefix>/short-kebab-slug -m "type(scope): summary"`로
  한다.
- 기존 layer 수정은 `gt checkout <branch>`, 파일 수정, `gt add <files>`,
  `gt modify`로 한다.
- Submit은 단일 branch면 `gt submit`, stack이면 `gt submit --stack`.
- 기존 draft PR을 ready로 바꿀 때는 `gt submit --publish --update-only`.
- Handoff 전 `gt log short`를 확인한다.
- Stack repair는 raw Git 대신 `gt restack`, `gt move`, `gt reorder`,
  `gt fold`, `gt split`, `gt absorb`, `gt undo`를 사용한다.

Graphite branch rules:

- 빈 branch를 먼저 만들지 않는다.
- 수정하고 stage한 뒤 `gt create`를 실행한다.
- PR-bound work는 `gt create`에 explicit branch name을 넘긴다.
- Slash-separated ownership과 kebab-case intent를 사용한다.
  - Agent-authored work: known agent tool은 `<tool>/<short-slug>`, 예:
    `codex/<short-slug>`, `claude/<short-slug>`, `cursor/<short-slug>`.
  - 새 agent tool: top-level prefix가 모호하면
    `agent/<tool-slug>/<short-slug>`.
  - Human maintainer work: `dev/<github-login>/<short-slug>`.
- Slug는 짧게 유지한다. 보통 두 단어에서 다섯 단어.
- Date prefix, Linear issue key, session id, underscore를 넣지 않는다.
- 열린 Graphite PR branch를 스타일 때문에 rename하지 않는다. GitHub PR branch
  name은 immutable이고 `gt branch rename`은 PR association을 제거한다.
- Commit과 PR title은 Conventional Commit style을 사용한다:
  `type(scope): summary`.
- Linear issue key는 commit title과 PR title에 기본적으로 넣지 않는다.
- 각 Graphite branch는 하나의 atomic review layer로 취급한다.
- `graphite-base/*`는 Graphite temporary implementation branch다. 직접 수정,
  submit, review하지 않는다.

Allowed title types:

- `feat`: user-facing capability.
- `fix`: bug fix.
- `docs`: documentation, specs, ADRs, written process.
- `refactor`: behavior change 없는 internal improvement.
- `test`: test-only change.
- `build`: build system 또는 dependency change.
- `ci`: CI configuration 또는 automation.
- `chore`: 다른 type에 맞지 않는 maintenance.
- `perf`: performance improvement.
- `style`: formatting-only change.
- `revert`: revert of prior change.

Scope는 review에 도움이 될 때 사용한다. 예: `editor`, `preview`, `workflow`,
`agent`, `collab`, `comments`, `files`, `layout`, `ci`. Summary는 짧고
lower-case이며 마침표를 붙이지 않는다.

Graphite 개념과 예시는 `knowledge/workflow/graphite-pr-lifecycle.md`와
`knowledge/workflow/graphite-stack-shape.md`를 사용한다.

## Stack Shape

Stack은 선택한 slice strategy에 맞게 만든다. 각 branch는 하나의 clear review
purpose를 가져야 하고, independently reviewable, testable, revertible해야 한다.

`gt modify`는 변경이 여전히 현재 review layer에 속할 때만 사용한다.

- 해당 PR의 reviewer feedback 반영.
- 해당 PR을 correct하게 만들기 위한 bug, test, copy, documentation adjustment.
- 같은 layer의 PR metadata, title, body cleanup.

새 reviewable concern이 생기면 `gt create`로 upstack PR을 추가한다.

- 새 work를 설명하려면 PR title이 바뀌어야 한다.
- PR body `Review Focus`가 서로 무관한 focus area 여러 개를 가져야 한다.
- 새 command, hook policy, doc structure, runtime behavior, migration, UI
  surface가 독립적으로 review/test 가능하다.
- 해당 변경이 useful하지만 현재 PR acceptance criteria에 필수는 아니다.
- 현재 PR을 clean하게 revert하기 어려워진다.

Scope drift를 submit 전에 발견하면 `gt split`, `gt move`, `gt fold`로 stack
shape를 고친다. Submit 후 발견하면 열린 PR을 계속 넓히기보다 `gt create`로 새
upstack branch를 만드는 것을 선호한다. Existing PR에 유지하는 것은 tightly-coupled
foundation cleanup이거나 repository owner의 명시 방향이 있을 때의 예외이며, 이때는
`Implementation Notes`에 이유를 남긴다.

Submit 전 확인:

- `gt log short`가 bottom-to-top으로 coherent implementation story처럼 읽힌다.
- 각 branch title이 `type(scope): summary` 형식이고 layer purpose를 말한다.
- 너무 작거나 의존적인 layer는 `gt fold`를 사용한다.
- 여러 review concern이 섞인 branch는 `gt split`을 사용한다.
- Dependency order가 틀리면 `gt reorder`, `gt move`, `gt restack`을 사용한다.
- Staged feedback이 older downstack commit에 속하면 `gt absorb`를 사용한다.
- 잘못된 Graphite mutation 후 raw Git으로 가기 전에 `gt undo`를 사용한다.

Split/fold/reorder 기준은 `knowledge/workflow/graphite-stack-shape.md`를
사용한다.

## Pull Request Standard

PR title:

```txt
type(scope): summary
```

Title은 최초 task wording이 아니라 최종 diff를 대표해야 한다. Readiness 전에 PR
title을 실제 changed files, current commit subject, PR body `Summary`와 비교한다.
Implementation scope가 drift됐다면 current commit subject와 PR title을 함께
업데이트한다.

좋은 예:

```txt
feat(editor): add split preview mode
fix(layout): keep rail position stable
docs(workflow): define repository workflow
chore(agent): add workflow state hooks
ci: verify pull requests
```

Linear linkage:

- Graphite/Linear integration을 visible source of truth로 선호한다.
- Graphite UI가 이미 Linear issue나 stack을 보여주면 이를 반복하기 위해
  `Links` section을 추가하지 않는다.
- Integration이 issue를 붙이지 못했다면 Graphite issue tracker sidebar에서
  issue를 추가하거나 link에 필요한 최소 body reference만 넣는다.
- Linear issue를 닫아야 하는 PR에만 `Fixes MTS-123`를 넣는다.
- Stack의 모든 PR에 `Fixes MTS-123`를 넣지 않는다.

PR body shape:

```md
## Summary

-

## Review Focus

-

## Implementation Notes

-

## Validation

- Automated:
- Manual:
- Not run:

## Risk

-

## Evidence

- Screenshots/video:
```

PR body는 Graphite에서 work를 reviewable하게 만들기 위한 artifact다. Outcome,
review focus, non-obvious implementation choice, validation, remaining risk를
설명해야 한다. File diff만 반복하는 flat changelog가 되면 안 된다.

`Implementation Notes`는 meaningful decision, tradeoff, stack/layer context,
alternative가 review에 도움이 될 때만 사용한다. 모든 작은 PR에 억지로 넣지
않는다.

Agent-authored PR은 `pr:metadata`가 추가하는 `Agent` section을 포함한다. Public
contributor PR은 이 section이 필요 없다.

UI 변경은 screenshot 또는 명시적인 `Not visual` note를 포함한다. Behavior
change는 정확한 verification command나 manual check를 포함한다. Validation을
의도적으로 생략했다면 `Not run`에 이유를 쓴다.

Graphite submit 후 handoff command 하나를 실행한다.

```sh
npm run pr:handoff -- \
  --title "type(scope): summary" \
  --label <Label> \
  --summary "<무엇을 왜 바꿨는지>" \
  --review-focus "<reviewer가 집중해서 볼 부분>" \
  --implementation-notes "<중요한 판단, tradeoff, 또는 없다는 이유>" \
  --validation-automated "<실행한 command나 check>" \
  --validation-manual "<manual check가 있으면 기록>" \
  --validation-not-run "<생략한 validation과 이유가 있으면 기록>" \
  --risk "<remaining risk>" \
  --evidence "<screenshot/video link 또는 Not visual.>"
```

`pr:handoff`는 title, body, metadata 단계를 순서대로 처리한다. Automatic
summarizer가 아니다. Agent가 실제 implementation, validation, remaining risk를
보고 내용을 작성하고, script는 이를 표준 template에 반영한다. Body section이
없거나 placeholder-only면 `pr:ready`가 실패한다.

낮은 수준 명령은 focused recovery 또는 targeted update에만 사용한다.

```sh
npm run pr:title -- --title "type(scope): summary"
npm run pr:body -- --summary "..." --review-focus "..." --implementation-notes "..." --validation-automated "..." --risk "..." --evidence "..."
npm run pr:metadata -- --label <Label>
```

`pr:title`은 명시적인 title-review checkpoint다. 기존 title이 최종 diff를 여전히
설명하면 그대로 사용한다. 아니면 dominant change를 말하는 가장 작은 Conventional
Commit title을 고른다. PR title과 current commit subject가 다르면 `pr:ready`가
실패한다.

`pr:metadata`는 PR body에 agent tool과 session id를 기록한다. Explicit arguments
또는 agent context environment variables를 사용한다. Agent-authored PR은 guessed
session id에 의존하면 안 된다. 실제 tool name을 넘긴다.

```sh
npm run pr:metadata -- --label <Label> --agent "Codex" --session <session-id>
npm run pr:metadata -- --label <Label> --agent "Claude Code" --session <session-id>
npm run pr:metadata -- --label <Label> --agent "Cursor" --session <session-id>
```

Repository owner에게 merge review를 요청하기 전에 실행한다.

```sh
gt submit --publish --update-only
npm run pr:handoff -- --title "type(scope): summary" --label <Label> ...
npm run pr:ready
```

`gt submit --publish --update-only`는 기존 Graphite PR을 새 PR 생성 없이 draft에서
ready로 옮기는 표준 방법이다. Graphite가 unavailable이고 repository owner가
fallback을 명시적으로 승인하지 않는 한 `gh pr ready`를 사용하지 않는다.

`pr:ready`는 local cleanliness, PR metadata, title shape, body template content,
branch naming policy, PR-title-to-commit-subject agreement, whitespace checks를
확인한다. Submit, merge, publish, CI polling, Graphite mergeability polling,
expensive validation은 하지 않는다.

`pr:ready`가 통과하면 Graphite URL, 실행한 validation, 의도적으로 생략한
validation을 repository owner에게 넘긴다. 이후 agent는 PR을 계속 감시하지
않는다. CI, mergeability, review status, merge button은 Graphite App이 최종
merge surface다.

Commit history는 간결하게 유지한다.

```txt
type(scope): summary (#123)
```

PR body가 review artifact다. Squash merge commit body는 비워서 `main`을
쉽게 훑을 수 있게 유지한다.

Repository squash settings:

- Squash title: pull request title.
- Squash message: blank.

Solo-project defaults:

- Assignee: `taehalim`.
- Reviewer: self-authored solo PR에서는 생략한다. GitHub는 self-review request를
  허용하지 않는다.
- Label: PR context에 맞는 `.github/labels.json`의 type label 하나.

Agent는 hard-coded file path rule이 아니라 label name과 description을 보고
label을 고른다.

Selectable labels 확인:

```sh
npm run pr:metadata -- --list-labels
```

다른 reviewer가 있으면 submit time이나 metadata로 요청한다.

```sh
gt submit --reviewers <github-login>
npm run pr:handoff -- --label <Label> --reviewer <github-login> ...
```

## Validation Standard

- 선택한 작업 mode에서 likely regression을 잡을 수 있는 가장 작은 validation을
  실행한다.
- Pure-function 변경 후에는 focused unit tests를 실행한다.
- `knowledge/**` 변경 후에는 `npm run knowledge:check`를 실행한다.
- `.codex/hooks/**`, workflow policy scripts, agent automation checks를
  변경하면 `npm run test:hooks`를 실행한다.
- TypeScript, import, package, app wiring 변경 후에는 `npm run build`를
  실행한다.
- Editor, preview, right panel, file tree, share, collaboration UI 변경 후에는
  `npm run test:browser`를 실행한다.
- Docs-only, comment-only, 좁은 tooling 변경에 기본적으로 `npm test`,
  `npm run build`, browser smoke를 모두 실행하지 않는다. Changed files와 risk가
  정당화할 때 validation을 넓힌다.

Focused browser smoke aliases:

```sh
npm run test:browser:workspace
npm run test:browser:editor
npm run test:browser:layout
npm run test:browser:panels
npm run test:browser:collab
```

## Merge And Cleanup

정상 PR과 stack merge는 Graphite UI를 사용한다. Stack layer는 dependency order,
즉 bottom to top으로 merge한다. 최종 merge state는 repository owner가
Graphite App에서 확인한다. Agent는 handoff 후 GitHub나 Graphite를 반복 polling
하지 않는다. Merge가 막히면 owner가 구체적 Graphite 또는 CI 오류를 agent에게
전달한다.

Repository merge policy:

- `main`이 유일한 long-lived branch다.
- 정상 작업에 `dev`, `develop`, `staging` branch를 만들지 않는다.
- GitHub merge commits는 disabled다.
- Squash와 rebase는 available로 둔다.
- Review 중인 open PR branch는 유지한다.
- Merged/closed branch는 유지하지 않는다.
- GitHub는 merged head branch를 자동 삭제한다.
- Graphite Merge Queue를 의도적으로 활성화하기 전에는 GitHub Merge Queue를
  사용하지 않는다.

Repository owner가 PR이나 stack을 merge한 뒤:

```sh
npm run workflow:sync
```

Active stack merge 중 Graphite는 upstack PR diff를 안정화하기 위해 remote
`graphite-base/*` branches를 만들 수 있다. Open PR이 있는 동안 이 branch를
건드리지 않는다. 전체 stack이 merge되고, `npm run workflow:sync`가 실행되었고,
open PR이 없다면 남은 `graphite-base/*` branches는 stale temporary branch다.
다음 명령으로 제거한다.

```sh
npm run workflow:doctor -- --delete-stale-graphite-base
```

그 다음 closing PR이 land되었고 follow-up이 없으면 Linear issue를 `Done`으로
옮긴다.

## Release And Changelog

Release와 changelog strategy는 `knowledge/runbooks/release-preparation.md`에
있다. 정상 workflow 작업에서는 repository owner가 release 또는 changelog
준비를 명시적으로 요청할 때만 release artifacts를 수정한다.

## Command Policy

이 repository의 정상 PR 작업에는 다음을 사용하지 않는다.

- `git checkout -b`
- `git switch -c`
- `git branch <new-branch>`
- `git commit`
- raw `git push` as PR publishing mechanism
- `gt sync` 대신 `git pull`
- Graphite restack/sync flow 대신 `git merge`
- `gh pr create`
- `gh pr merge`
- 사람 operator가 명시적으로 요청하지 않은 destructive cleanup
- `apply_patch`가 적절한 상황에서 source file을 shell redirection이나 ad-hoc
  script로 수동 작성

안전한 local inspection command는 괜찮다.

- `git status`
- `git diff`
- `git show`
- `git log`
- `git stash`
- `git add`
- `git rev-parse`

## Agent Automation

Workflow는 특정 agent runtime에 의존하지 않는다. Codex, Cursor 호환 에이전트,
Claude Code, future tools 모두 같은 Linear, Graphite, validation, PR metadata,
merge, cleanup 규칙을 따른다.

현재 repo에는 Codex session을 위한 project-local Codex hooks가 `.codex/`에 있다.
다른 agent는 이 hook을 실행하지 않을 수 있다. Hook이 없는 agent는 관련될 때
이 문서의 script를 사용해 같은 check를 수동으로 따라야 한다.

```sh
npm run workflow:status
npm run pr:ready
npm run test:hooks
```

`workflow:doctor`는 setup suspicion, workflow automation 변경, post-merge
diagnostics용이다. 모든 implementation turn의 필수 명령이 아니다.

Codex hooks는 반복 workflow 실수를 줄이지만 agent judgment, code review, Linear
planning, Graphite stack design, test selection을 대체하지 않는다.

Codex hooks가 자동으로 돕는 것:

- Codex session 시작 시 짧은 workflow context 추가.
- Prompt에 명시적 post-merge signal이 있을 때 focused context 추가.
- API key, access token, private key material처럼 보이는 prompt 차단.
- 위 command policy 일부 적용.
- File changes 뒤 likely validation needs 기록.
- Validation이 빠진 것처럼 보이면 block하지 않고 warning.
- Current turn에서 Graphite submit이 발생했는데 `pr:handoff`가 빠져 있으면
  turn continuation.
- 나중의 설명/조사 turn에서 오래된 workflow state가 남아 있으면 block하지 않고
  reminder만 표시.
- 명시적 post-merge signal에 `workflow:sync`가 필요하면 turn continuation.
- 같은 blocked command policy를 우회하는 approval request 거절.

Codex hooks가 자동으로 하지 않는 것:

- Linear issue 생성.
- 올바른 stack shape 결정.
- 올바른 implementation 선택.
- 매번 expensive validation 실행.
- PR submit 또는 merge.
- `pr:handoff` 대체.
- Linear issue를 `Done`으로 이동.

Project-local hooks는 project `.codex/` layer가 trusted일 때만 load된다. Codex가
changed hooks를 보고하면 Codex hooks UI 또는 CLI hook review flow에서 review와
trust를 진행해야 한다. Claude Code와 다른 agent는 Codex hook execution을
명시적으로 지원하지 않는 한 `.codex/`를 reference automation으로 취급한다.
