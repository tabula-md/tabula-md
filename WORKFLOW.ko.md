# WORKFLOW.ko.md

이 파일은 이 repository의 간결한 실행 계약이다. 사람과 coding agent 모두에
적용된다. 다른 workflow 문서와 충돌하면 이 파일이 우선한다.

깊은 배경이 필요할 때만 `knowledge/index.md`를 본다. 모든 작업이 전체 배경
문서를 읽어야 하는 것은 아니다.

## Purpose

작업을 작고 review 가능하게 유지하고, 실제 상태와 planning 상태가 어긋나지 않게
한다. Core workflow는 작업을 어떻게 shape할지 설명하고, repository-specific tool은
아래 adapter로 둔다.

## Principles

- 가장 작은 useful outcome을 낸다.
- 하나의 slice에는 하나의 reviewable concern만 둔다.
- 작업이 넓거나 불확실하면 구현 전에 나눈다.
- Public review surface는 깨끗하게 유지한다.
- Planning state는 실제 상태를 따라간다.
- 변경된 surface를 검증한다.

## The Loop

모든 요청에 같은 loop를 적용한다.

1. Intake: user-visible outcome과 review expectation을 식별한다.
2. Shape: 직접 답변, local-only, review slice 하나, slice sequence 중 하나로 정한다.
3. Slice: 넓은 작업은 구현 전에 분리한다.
4. Build: 현재 slice만 구현하고 incidental cleanup은 피한다.
5. Validate: likely regression을 잡는 가장 작은 check를 실행한다.
6. Handoff: local work를 보고하거나 ready review slice를 제출한다.

Hook은 빠진 작업을 signal할 수 있지만 shape를 대신 고르지 않는다.

## Slice Rules

Slice는 독립 review로 이해 가능해야 한다. 하나의 slice를 이해하기 위해 전체
sequence가 필요하다면 다르게 나눈다.

아래 중 하나라도 해당하면 여러 slice를 선호한다.

- 변경이 약 250 meaningful changed lines 또는 25 files를 넘을 가능성이 있다.
- Refactor와 behavior change가 섞인다.
- Mechanical/noisy edit과 meaningful product 또는 logic edit이 섞인다.
- Risk profile이 다른 변경이 섞인다.
- Owner가 broad product analysis, multiple issues, large patch를 요청한다.

상황에 맞게 slice pattern을 고른다.

- Component: 독립적으로 review 가능한 subsystem별로 나눈다.
- Iterative: 첫 useful improvement를 먼저 올리고 refinement를 이어간다.
- Refactor/change: structure-only cleanup을 behavior change보다 먼저 land한다.
- Mechanical/noise: generated, moved, renamed, bulk style 변경을 분리한다.
- Risk: low-risk prep을 risky behavior 또는 performance work보다 먼저 land한다.

Size budget:

- 약 250 meaningful lines 또는 25 files: warning으로 shape를 다시 확인한다.
- 약 800 lines: split을 강하게 선호한다.
- 약 1200 lines: 해당 slice에 더 이상 변경을 추가하지 않는다.

Ready slice는 준비되는 즉시 review로 보낸다. 전체 sequence가 끝날 때까지 bottom
layer open을 기다리지 않는다.

넓은 작업은 구현 전에 짧은 Stack Plan을 쓴다.

1. `<title>` — 이 slice가 왜 독립 review 가능한지.
2. `<title>` — 이전 slice에서 무엇에 의존하는지.
3. `<title>` — validation이 무엇에 집중해야 하는지.

자세한 설명은 `knowledge/workflow/vertical-slice-strategy.md`와
`knowledge/workflow/graphite-stack-shape.md`에 있다.

## Open Review Rule

이미 open PR이 있는 branch에서 작업할 때는 새 edit을 coding 전에 분류한다.

- 같은 review concern: 현재 slice를 수정한다.
- 의존적인 follow-up concern: 새 upstack slice를 만든다.
- 무관한 concern: 멈추고 묻거나 context를 바꾼다.

현재 branch라는 이유만으로 open PR을 키우지 않는다. 변경이 review에서 두 번째
질문을 만들면 다음 slice를 만든다.

## Review Surfaces

- Branch는 planning-ticket key가 아니라 semantic work name을 사용한다.
- Pull request는 public review artifact다: problem, change, validation, risk.
- Issue tracker는 private planning state다: priority, owner, status, links.
- Ticket key를 branch name, PR title, public PR body에 넣지 않는다.
- PR과 tracker issue 연결은 Resources/attachments를 사용한다.
- 실제 상태가 바뀔 때 planning state도 옮긴다: started, in review, merged.

## Repository Tooling

### Graphite

PR-bound branch와 PR lifecycle은 Graphite가 담당한다.

- Trunk 시작: `gt sync --delete-all`, `gt checkout --trunk`.
- Edit 후 새 branch: `gt create <branch> --all -m "type(scope): summary"`.
- 현재 review layer 수정: `gt modify --all -m "type(scope): summary"`.
- PR 하나 submit: `gt submit`.
- Stack submit: `gt submit --stack`.
- 기존 draft publish: `gt submit --publish --update-only`.
- Raw Git recovery 전에 `gt restack`, `gt move`, `gt reorder`, `gt fold`,
  `gt split`, `gt absorb`, `gt undo`를 먼저 고려한다.

정상 PR 작업에는 raw `git commit`, raw `git push`, `git checkout -b`,
`git pull`, `gh pr create`, `gh pr ready`, `gh pr merge`를 사용하지 않는다.

자세한 설명은 `knowledge/workflow/graphite-pr-lifecycle.md`에 있다.

### Linear

Linear는 이 repository의 private planning surface다.

- PR-bound Linear 작업을 시작하면 issue를 `In Progress`로 옮긴다.
- Graphite submit, `pr:handoff`, `pr:ready`가 끝나면 PR이 Linear Resources에
  보이는지 확인하고 issue를 `In Review`로 옮긴다.
- Closing PR이 land되고 required follow-up이 끝났을 때만 issue를 `Done`으로
  옮긴다.

Outcome 하나가 여러 review slice를 가진다는 이유만으로 Linear issue를 쪼개지
않는다.

### PR Handoff

Graphite submit 후 다음 명령 하나를 실행한다.

```sh
npm run pr:handoff -- \
  --title "type(scope): summary" \
  --label <Label> \
  --summary "<what changed and why>" \
  --review-focus "<what the reviewer should inspect>" \
  --implementation-notes "<important decision, tradeoff, or none with reason>" \
  --validation-automated "<command or check that ran>" \
  --validation-manual "<manual check, if any>" \
  --validation-not-run "<skipped validation and reason, if any>" \
  --risk "<remaining risk>" \
  --evidence "<screenshot/video link or Not visual.>"
```

`pr:handoff`는 review artifact를 작성하고, `.github/labels.json`의 type label
하나를 적용하며, 기본 assignee로 `taehalim`을 붙이고, 가능하면 agent provenance를
기록한다. 자동 요약기가 아니며, 내용은 agent가 실제 구현과 검증에 기반해 쓴다.

Handoff 전에 `npm run pr:ready`를 한 번 실행한다. 이 명령은 local handoff
completeness만 확인한다. Submit, merge, CI polling, Graphite mergeability
polling, expensive validation은 하지 않는다.

### Validation

Regression을 잡을 수 있는 가장 작은 validation set을 실행한다.

- Knowledge 변경: `npm run knowledge:check`.
- Hook/workflow automation 변경: `npm run test:hooks`.
- TypeScript, package, app wiring 변경: `npm run build`.
- Pure Markdown/comment/storage/view-model logic: `npm test`.
- Browser UI, editor, preview, panel, file tree, share, collaboration UI:
  가능하면 focused browser suite, 아니면 `npm run test:browser`.
- PR handoff 전: `git diff --check`.

Docs-only 변경은 PR body에 이유를 적으면 app tests나 build를 생략할 수 있다.

### Merge Cleanup

Owner가 Graphite App에서 merge한다. Merge 후:

```sh
npm run workflow:sync
```

Open PR이 없고 sync 후 stale `graphite-base/*` branch가 남으면:

```sh
npm run workflow:doctor -- --delete-stale-graphite-base
```

Closing PR이 land되었고 required follow-up이 없을 때만 Linear issue를 `Done`으로
옮긴다.

## Command Policy

- 수동 source edit은 `apply_patch`를 사용한다.
- Hook은 Graphite lifecycle mistake와 shell source write를 차단한다.
- Hook은 `rm -rf`를 차단하지 않는다. Shell cleanup은 agent judgment에 맡긴다.
- User work를 버릴 수 있는 destructive Git command는 owner가 명시적으로 요청하지
  않으면 차단한다.
- `workflow:doctor`는 setup 의심, workflow automation 변경, post-merge diagnostics
  용도다. 모든 작업에서 필수로 실행하지 않는다.

자세한 설명은 `knowledge/workflow/codex-hooks.md`에 있다.
