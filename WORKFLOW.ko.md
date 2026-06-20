# WORKFLOW.ko.md

이 파일은 이 repository의 간결한 실행 계약이다. 사람과 coding agent 모두에
적용된다. 다른 workflow 문서와 충돌하면 이 파일이 우선한다.

깊은 배경이 필요할 때만 `knowledge/index.md`를 본다. 모든 작업이 전체 배경
문서를 읽어야 하는 것은 아니다.

## 기본값

요청을 만족하는 가장 가벼운 mode를 사용한다.

### Fast Local Loop

일반 구현 요청의 기본값이다.

- 요청한 변경을 구현한다.
- 변경 파일에 맞는 focused validation을 실행한다.
- 무엇을 바꿨고 어떤 validation을 실행했거나 생략했는지 보고한다.
- Review handoff 의도가 없으면 Linear issue, Graphite PR, PR metadata를 만들지
  않는다.

### PR Handoff Loop

Owner가 PR, Graphite, review handoff를 요청했거나 작업 자체가 PR/stack review를
명확히 필요로 할 때 사용한다.

- Branch, commit, submit, stack, publish, sync는 Graphite를 사용한다.
- Handoff 전 focused validation을 실행한다.
- Graphite submit 후 `npm run pr:handoff -- ...`를 한 번 실행한다.
- Owner에게 넘기기 전에 `npm run pr:ready`를 한 번 실행한다.
- Handoff 후 CI나 Graphite mergeability를 polling하지 않는다. Owner가 Graphite
  App에서 review/merge하고, 막히면 구체적 오류를 agent에게 넘긴다.

### Release/Public Loop

Release, changelog, public launch, security, CI, repository settings, cross-repo
Tabula 작업에 사용한다.

- 명시적 Linear tracking을 선호한다.
- Reviewable layer가 나뉘면 Graphite stack을 사용한다.
- 더 넓은 validation과 docs check를 실행한다.
- Public docs, templates, CI, repository settings를 product surface로 취급한다.

Mode 선택은 agent judgment다. Keyword filter가 아니다. Hook은 빠진 작업을
signal할 수 있지만 mode를 대신 고르지 않는다.

## Work Shape

- Accepted trackable request 하나는 보통 Linear issue 하나, Graphite stack 하나,
  GitHub PR 하나 이상으로 간다.
- Reviewable concern이 하나면 PR 하나를 사용한다.
- Outcome에 dependent review layer가 여러 개면 stack을 사용한다.
- New runtime, repo, persistence, encryption, collaboration, auth, external
  system boundary를 넘으면 vertical slice를 선호한다.
- Graphite stack이 여러 PR이라고 Linear issue를 불필요하게 쪼개지 않는다.

자세한 설명은 `knowledge/workflow/vertical-slice-strategy.md`와
`knowledge/workflow/graphite-stack-shape.md`에 있다.

## Graphite

PR-bound branch와 PR lifecycle은 Graphite가 담당한다.

- Trunk 시작: `gt sync --delete-all`, `gt checkout --trunk`.
- Edit 후 새 branch: `gt create <branch> --all -m "type(scope): summary"`.
- 현재 review layer 수정: `gt modify --all -m "type(scope): summary"`.
- PR 하나 submit: `gt submit`.
- Stack submit: `gt submit --stack`.
- 기존 draft publish: `gt submit --publish --update-only`.
- Raw Git recovery 전에 `gt restack`, `gt move`, `gt reorder`, `gt fold`,
  `gt split`, `gt undo`를 먼저 고려한다.

정상 PR 작업에는 raw `git commit`, raw `git push`, `git checkout -b`,
`git pull`, `gh pr create`, `gh pr ready`, `gh pr merge`를 사용하지 않는다.

자세한 설명은 `knowledge/workflow/graphite-pr-lifecycle.md`에 있다.

## PR Handoff

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

## Validation

Regression을 잡을 수 있는 가장 작은 validation set을 실행한다.

- Knowledge 변경: `npm run knowledge:check`.
- Hook/workflow automation 변경: `npm run test:hooks`.
- TypeScript, package, app wiring 변경: `npm run build`.
- Pure Markdown/comment/storage/view-model logic: `npm test`.
- Browser UI, editor, preview, panel, file tree, share, collaboration UI:
  가능하면 focused browser suite, 아니면 `npm run test:browser`.
- PR handoff 전: `git diff --check`.

Docs-only 변경은 PR body에 이유를 적으면 app tests나 build를 생략할 수 있다.

## Merge Cleanup

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
