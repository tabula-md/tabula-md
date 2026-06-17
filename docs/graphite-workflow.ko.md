# Tabula.md Graphite 워크플로우

상태: Active
Owner: taeha
작성일: 2026-06-16
공식 문서 확인일: 2026-06-17

원본: `graphite-workflow.md`

이 문서는 Tabula.md 팀이 Graphite를 어떻게 쓰는지 정의한다. 기준은
공식 Graphite 문서 인덱스인 `https://graphite.com/docs/llms.txt`다.

## 원칙

- Linear는 계획된 작업, 우선순위, issue 상태의 source of truth다.
- GitHub는 PR, CI, code review, merge history의 source of truth다.
- Graphite는 로컬 PR lifecycle, stack 구조, stacked review의 기준 도구다.
- Git은 실제 commit graph의 source of truth다.
- `gt`를 PR-bound branch 생성과 업데이트의 필수 방식으로 쓴다.
- PR-bound work는 stack-first가 기본이다. 특히 agent-authored 또는
  vibe-coded session처럼 한 prompt가 여러 영역을 건드릴 수 있을 때 그렇다.
- Work가 하나의 reviewable concern으로 좁게 닫힐 때만 single Graphite PR을
  쓴다.
- 한 Linear issue나 한 agent session에 여러 독립 review layer가 있으면
  Graphite stack을 쓴다.
- Graphite branch 하나는 atomic changeset으로 보고, 보통 commit 하나로
  유지한다.
- Graphite를 쓸 때는 빈 Git branch를 먼저 만들지 않는다. 먼저 수정하고
  stage한 뒤 `gt create`를 실행한다.

## Agent 운영 계약

Graphite는 Tabula.md의 PR-bound work에서 필수다. Agent는 branch, PR, stack,
merge 작업을 만들거나 수정하거나 제출하기 전에 이 문서를 source of truth로
읽어야 한다.

단위 구분:

- Linear issue: work intent.
- Graphite stack: review와 merge 구조.
- GitHub PR: stack 안의 구체적인 review layer 하나.
- Git commit: 실제 변경 이력.

하나의 product/engineering outcome에 여러 implementation layer가 필요하면
Linear issue 하나에 여러 Graphite PR이 붙을 수 있다. PR 개수를 맞추기 위해
Linear issue를 추가로 만들지 않는다.

필수 행동:

- Branch, PR, stack, merge 작업 전에 이 문서를 읽는다.
- Stack-first를 기본으로 한다. 넓은 수정을 시작하기 전에 review layer를 먼저
  잡는다.
- 작은 작업에도 Graphite를 쓴다. 단, 하나의 reviewable concern일 때만 single
  Graphite PR이 허용된다.
- 한 session에서 branch를 두 개 이상 만들면 `gt submit --stack`을 쓴다.
- Refactor, storage, behavior, UI, tests, docs를 분리해 리뷰할 수 있는데도
  한 branch에 뭉치지 않는다.
- PR 제목과 본문에 Linear issue key를 유지한다.
- Graphite가 막히면 raw GitHub/Git flow로 조용히 우회하지 말고 blocker를
  보고한다.

일반 Tabula PR 작업에서 쓰지 말아야 할 것:

- `git checkout -b`
- PR publish 방식으로 raw `git push` 사용
- `gh pr create`
- Primary work tracker로 GitHub Issues 사용
- Graphite Merge Queue를 쓰기로 한 뒤 GitHub Merge Queue 사용

허용 예외:

- taeha가 non-Graphite fallback을 명시적으로 요청한다.
- Repository에 initial commit이 아직 없다. Graphite는 첫 commit 전에는
  initialize할 수 없으므로 repository bootstrap을 한 번 처리한 뒤 Graphite
  flow로 돌아간다.
- 작업이 완전히 local이고 branch, commit, PR, merge handoff가 필요 없다.

`gt`가 없거나, 인증되지 않았거나, 초기화되지 않았거나, repository state로
막히면 agent는 필요한 local code/document edit은 계속할 수 있다. 다만 최종
handoff에서는 Graphite submission이 왜 막혔는지 명확히 말해야 한다.

## 설정

Graphite는 repository에 최소 하나의 commit이 있어야 한다. Repository에 아직
commit이 없다면 `gt init` 전에 initial commit을 한 번 bootstrap한다.

Initial commit이 생긴 뒤 개발자 machine마다 한 번 설정한다:

```sh
gt auth
gt init
```

## 기본 Stack-First 흐름

일반 PR-bound work, 특히 한 요청에서 많은 관련 변경이 나올 수 있는
agent-authored session은 이 흐름을 따른다.

```sh
gt sync
gt checkout --trunk

# Layer 1: smallest stable foundation
gt add <files>
gt create -m "[MTS-123] Add foundation layer"

# Layer 2: behavior or wiring
gt add <files>
gt create -m "[MTS-123] Wire behavior layer"

# Layer 3: UI, tests, docs, or follow-up layer
gt add <files>
gt create -m "[MTS-123] Add reviewable follow-up layer"

gt log short
gt submit --stack
# 현재 branch의 PR에 적용된다. Stack에서는 PR마다 반복한다.
npm run pr:metadata -- --label <Label>
```

Layering 규칙:

- Reviewable concern 하나당 Graphite branch 하나를 만든다.
- Pure refactor는 behavior change 아래에 둔다.
- Data model 또는 storage change는 그 위에 의존하는 UI change보다 아래에
  둔다.
- Test는 해당 layer를 검증해 branch가 self-contained해지면 같은 branch에
  둔다. 여러 이전 layer를 덮는 test면 별도 layer로 나눈다.
- Docs는 해당 branch 설명이면 같은 branch에 둔다. 전체 stack이나 operating
  process를 문서화하면 분리한다.
- 한 session이 여러 product surface를 건드리면 shared foundation이 먼저
  필요하지 않은 한 surface별로 나눈다.

Branch 하나에 feedback을 반영할 때:

```sh
gt checkout <branch>
# edit files
gt add <files>
gt modify
gt submit --stack
```

수정된 파일을 모두 포함해도 될 때:

```sh
gt modify -a
gt submit --stack
```

Stack merge 이후:

```sh
gt sync
```

## Single PR 예외 흐름

Typo fix, isolated test, 작은 docs patch, 좁은 bug fix처럼 하나의 reviewable
concern으로 닫히는 작업에만 single Graphite PR을 쓴다.

```sh
gt sync
gt checkout --trunk
# edit files
gt add <files>
gt create -m "[MTS-123] Short title"
gt submit
npm run pr:metadata -- --label <Label>
```

PR 제목:

```txt
[MTS-123] Short title
```

PR 본문:

```txt
Linear: MTS-123
```

Linear issue를 닫아야 하는 PR에만 `Fixes MTS-123`를 쓴다.

## GitHub PR 메타데이터

Graphite가 GitHub pull request를 만들고 업데이트하지만, Tabula.md는 submit
이후 GitHub PR metadata를 명시적으로 붙인다.

각 `gt submit` 이후 실행한다:

```sh
npm run pr:metadata -- --label <Label>
```

Solo project 기본값:

- Assignee: `taehalim`.
- Label: `.github/labels.json`에서 agent가 선택한 type label 하나. `Bug`,
  `Feature`, `Improvement`, `Refactor`, `Infra`, `Docs`, `Chore`, `Spike`.
- Reviewer: self-review request는 하지 않는다. GitHub는 PR author에게 review
  request를 보낼 수 없으므로 taeha-authored solo PR은 assignee ownership으로
  표시한다.
- Checks: `.github/workflows/ci.yml`의 GitHub Actions가 PR check를 만든다.

Agent는 `.github/labels.json`의 label 이름과 설명을 읽고 PR 맥락에 맞는
label을 고른다. Metadata script는 file-path rule로 label을 추론하지 않는다.
선택 가능한 label을 확인하려면:

```sh
npm run pr:metadata -- --list-labels
```

별도 reviewer가 생기면 submit 시점에 요청한다:

```sh
gt submit --reviewers <github-login>
```

또는 submit 이후 metadata script로 요청한다:

```sh
npm run pr:metadata -- --label <Label> --reviewer <github-login>
```

Stacked work에서는 submit된 각 PR branch마다 metadata를 적용한다. 명시적인
PR number도 넘길 수 있다:

```sh
npm run pr:metadata -- --pr <number> --label <Label>
```

Single PR feedback 반영:

```sh
gt checkout <branch>
# edit files
gt add <files>
gt modify
gt submit
```

수정된 파일을 모두 포함해도 될 때:

```sh
gt modify -a
gt submit
```

PR merge 이후:

```sh
gt sync
```

## Stack 후보

Stack-first가 기본이다. 아래 항목은 거의 한 PR로 뭉치면 안 된다.

좋은 후보:

- E2EE collaboration 재설계.
- Storage 또는 sync migration.
- Editor engine 변경.
- Markdown command 또는 preview architecture 변경.
- Cloudflare runtime 또는 deployment architecture.
- 큰 UI panel 재구성.

예시:

```sh
gt sync
gt checkout --trunk

# Layer 1: foundation
gt add <files>
gt create -m "[MTS-200] Add encrypted room primitives"

# Layer 2: storage or API wiring
gt add <files>
gt create -m "[MTS-200] Store encrypted room snapshots"

# Layer 3: UI or migration layer
gt add <files>
gt create -m "[MTS-200] Replace share flow with encrypted rooms"

gt log short
gt submit --stack
```

Stack 규칙:

- 가장 아래 PR은 가장 작은 stable foundation이어야 한다.
- 각 PR은 독립적으로 테스트를 통과해야 한다.
- 각 PR은 존재 이유가 하나여야 한다.
- 한 issue에 속한 stack이면 모든 PR 제목에 같은 Linear issue prefix를 쓴다.
- 아래에서 위로 리뷰 가능해질 때까지 draft PR을 선호한다.
- Graphite merge tooling이 stack을 처리하지 않는 한 아래에서 위로 merge한다.

중간 branch에 리뷰를 반영할 때:

```sh
gt checkout <branch>
# edit files
gt add <files>
gt modify
gt submit --stack
```

`gt modify` 이후 Graphite가 dependent branch를 restack한다. GitHub와
Graphite에 최신 diff와 순서를 반영하려면 stack을 다시 submit한다.

## Stack 판단 기준

이 기준은 stack을 만들기 전, `gt submit --stack` 전, review feedback 이후
작업 모양이 달라졌을 때 적용한다.

Layer를 분리해 유지할 때:

- Branch 목적을 reviewer가 한 문장으로 설명할 수 있다.
- Branch가 독립적으로 build/test 가능하다.
- Branch를 되돌려도 무관한 작업이 같이 사라지지 않는다.
- 주변 layer와 reviewer, risk profile, product surface, architecture
  boundary가 다르다.
- 뒤 layer가 의존하는 foundation을 만든다.

Layer를 다른 branch에 fold할 때:

- Branch가 바로 아래나 위 branch와 함께 있을 때만 의미가 있다.
- 별도 PR의 review 비용이 추가되는 clarity보다 크다.
- Copy, CSS, fixture, test 조정처럼 특정 implementation layer만 검증하는
  작은 변경이다.
- 따로 리뷰하면 reviewer가 한 PR 안에 있어야 할 context를 다시 조립해야
  한다.
- Branch 단독으로 의미 있는 verification을 통과하기 어렵다.

Branch를 더 split할 때:

- Refactor, behavior, UI, tests, docs, migration이 섞여 있고 분리 리뷰가
  가능하다.
- 실패 원인을 한 종류의 변경으로 좁히기 어렵다.
- Revert하면 필요한 것보다 많은 product behavior가 사라진다.
- 서로 무관한 이유로 여러 reviewer가 필요하다.
- 큰 cleanup 안에 risky change가 숨어 있다.

Stack을 reorder할 때:

- 나중 branch가 앞 branch에서 이미 의존하는 primitive, contract, data shape을
  만든다.
- Pure refactor를 behavior change 아래에 두면 뒤 diff가 줄어든다.
- Test나 docs가 아직 downstack에 없는 behavior를 설명한다.

Submit 전 체크리스트:

- `gt log short`로 stack이 아래에서 위로 자연스러운 implementation story인지
  확인한다.
- 모든 branch title이 Linear key로 시작하고 layer의 실제 목적을 말하는지
  확인한다.
- 모든 branch가 독립적으로 review, test, revert 가능한지 확인한다.
- 너무 작거나 독립 리뷰가 어려운 layer는 `gt fold`한다.
- 여러 review concern이 섞인 branch는 `gt split`한다.
- Dependency 순서가 틀렸으면 `gt reorder`, `gt move`, `gt restack`을 쓴다.
- Stack 모양이 review story와 맞을 때만 `gt submit --stack`을 실행한다.

Merge 판단:

- Agent는 기본적으로 stack을 merge하지 않는다.
- taeha 또는 maintainer가 명시적으로 요청했고, review 상태가 적절하고, CI가
  통과했고, Linear closure semantics가 맞고, Graphite UI 또는 merge queue가
  선택된 merge authority일 때만 merge한다.
- Graphite가 stack 또는 merge queue flow를 소유할 때 raw GitHub control로
  merge하지 않는다.

## Linear, GitHub, Graphite 연결

Linear가 issue source of truth다. GitHub Issues는 Tabula.md의 기본 tracker가
아니다.

필수 연결 규칙:

- 모든 PR 제목에 issue key를 넣는다: `[MTS-123] Short title`.
- PR 본문에 issue key를 넣는다: `Linear: MTS-123`.
- issue를 닫는 PR에만 `Fixes MTS-123`를 쓴다.
- Stack에 PR이 여러 개라면 중간 PR은 issue를 참조만 하고 닫지 않는다.

선택 설정:

- Linear GitHub integration을 켜면 PR 제목, branch, commit, closing word로
  issue 상태를 자동화할 수 있다.
- GitHub autolink에서 `MTS-` prefix를 설정하면 GitHub와 Graphite 표면에서
  issue key가 클릭 가능해진다.
- Graphite Linear integration은 플랜이 지원하면 켠다. Graphite PR 화면에서
  Linear issue를 보고, 연결하고, 만들 수 있다.

## Merge Queue

Graphite Merge Queue는 Tabula.md의 시작점이 아니다. CI, branch protection,
일반 PR review가 안정된 뒤 도입한다.

도입할 만한 시점:

- trunk가 자주 깨져서 직접 merge가 rebase 또는 CI churn을 만든다.
- 여러 개발자나 agent가 병렬로 PR을 merge한다.
- stacked PR이 흔하고 stack correctness를 merge 단계에서 보장해야 한다.
- 오래 걸리는 check 때문에 사람이 merge 타이밍을 맞추는 비용이 커진다.

도입 시 규칙:

- Graphite Merge Queue가 merge authority가 된다.
- GitHub Merge Queue는 끈다.
- GitHub branch protection은 Graphite queue check를 요구해야 한다.
- Graphite GitHub app이 protected branch를 업데이트할 수 있어야 한다.
- Linear issue 상태는 PR 제목, PR 본문, commit, Linear GitHub integration으로
  계속 연결한다.

## 하지 말아야 할 것

- Graphite를 PR publish 도구로만 사후에 붙이지 않는다.
- 빈 branch를 먼저 만들고 나중에 Graphite에 끼워 맞추지 않는다.
- 한 stack layer에 무관한 작업을 숨기지 않는다.
- Stack의 모든 PR에 `Fixes MTS-123`를 넣지 않는다.
- CI와 branch protection이 준비되기 전에 Graphite Merge Queue를 켜지 않는다.
