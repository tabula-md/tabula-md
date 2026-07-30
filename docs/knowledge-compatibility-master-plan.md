# Tabula Knowledge Compatibility 마스터 패치안

상태: Proposed
범위: 기존 제품 개선 PR 1–26 이후 후속 작업
계획 PR: 27–45

이 문서는 Tabula가 일반 Markdown 편집기를 넘어 Markdown, MDX, Obsidian,
OKF, LLM Wiki, Agent Skills 등 서로 다른 파일 기반 지식 체계를 안전하게
열고, 이해하고, 검증하고, 사람과 에이전트가 함께 관리할 수 있도록 만드는
후속 구현 계획이다.

핵심 결론은 다음과 같다.

> Tabula는 여러 포맷 중 하나를 선택하는 편집기가 아니라, 서로 다른
> Markdown 기반 지식 체계를 원본 손실 없이 열고, 각 문법·규약·워크플로를
> 독립적으로 감지하고 지원하는 지식 호환성 계층이어야 한다.

---

## 1. 배경과 문제 정의

현재 파일 기반 지식 생태계에는 서로 다른 종류의 개념이 모두 “포맷”이라는
말로 섞여 있다.

| 계층 | 대표 예시 | 역할 |
| --- | --- | --- |
| 문서 문법 | CommonMark, GFM, MDX | 한 파일의 내용을 작성하는 방식 |
| 링크·앱 관례 | Obsidian, Wikilink | 파일 사이 관계와 앱별 확장 |
| 지식 교환 규약 | OKF 0.1, OKF 0.2 | 폴더와 frontmatter의 공통 의미 |
| 지식 관리 방법론 | Karpathy LLM Wiki | 에이전트가 지식을 축적하고 유지하는 방식 |
| 에이전트 지침 | AGENTS.md, CLAUDE.md, SKILL.md | 에이전트가 따라야 할 작업 규칙 |
| 배포·발견 형식 | llms.txt | 외부 LLM이 지식을 발견하는 방식 |
| 검색 방식 | RAG, GraphRAG | 질문 시 관련 지식을 검색하는 방식 |
| 협업·동기화 | Git, CRDT, MCP, 로컬 폴더 sync | 여러 작업자의 변경을 공유하는 방식 |
| 정형 지식 모델 | RDF, JSON-LD, SKOS | 개념과 관계를 엄밀하게 교환하는 방식 |

이들은 서로 경쟁하는 단일 포맷이 아니다. 하나의 workspace가 동시에 다음
특성을 가질 수 있다.

```text
문법: GFM + MDX
링크 관례: Obsidian Wikilink
지식 규약: OKF 0.2
운영 방식: LLM Wiki
에이전트 지침: AGENTS.md + SKILL.md
검색: local full-text + GraphRAG
협업: Git + Tabula live room
```

따라서 Tabula는 workspace를 `plain-markdown`, `markdown-wiki`, `okf` 중
하나로만 분류해서는 안 된다. 여러 profile을 동시에 감지하고, 각 profile에
대해 서로 다른 수준의 지원을 제공해야 한다.

---

## 2. 제품 원칙

모든 후속 PR은 다음 계약을 지켜야 한다.

1. 원본 파일이 유일한 source of truth다.
2. 알 수 없는 파일, frontmatter, Markdown 문법을 삭제하거나 자동 변환하지
   않는다.
3. Workspace는 하나의 포맷이 아니라 여러 profile의 조합이다.
4. “지원”은 Preserve, Understand, Edit, Validate, Execute 단계로 구분한다.
5. OKF migration은 항상 diff 미리보기와 사용자 승인을 거친다.
6. MDX와 Skill script는 문서 열람과 코드 실행을 분리한다.
7. 검색 인덱스와 knowledge graph는 재생성 가능한 파생 데이터다.
8. 외부 파일 변경과 충돌을 조용히 덮어쓰지 않는다.
9. 구조 변경, 포맷 지원, UI 변경을 하나의 PR에 섞지 않는다.
10. 일반 Markdown 사용자는 OKF나 LLM Wiki를 몰라도 기존처럼 Tabula를
    사용할 수 있어야 한다.
11. 새로운 포맷을 추가하기 위해 기존 parser에 조건문을 계속 복사하지
    않는다.
12. 제품이 지원하지 않는 기능을 지원한다고 과장해서 표시하지 않는다.

### 지원 수준

```ts
type SupportLevel =
  | "preserve"
  | "understand"
  | "edit"
  | "validate"
  | "execute";
```

각 수준의 의미는 다음과 같다.

| 수준 | 의미 |
| --- | --- |
| Preserve | path와 원본 bytes를 손실 없이 보존한다. |
| Understand | 역할, 링크, metadata, 구조를 인식한다. |
| Edit | 적절한 편집 및 안전한 렌더링을 제공한다. |
| Validate | 해당 명세나 workflow 규칙을 검사한다. |
| Execute | 코드, Skill, computation 또는 workflow를 실행한다. |

예를 들어 MDX 지원은 다음과 같이 구체적으로 표현한다.

```text
MDX
  Preserve: yes
  Understand: partial
  Edit: source
  Validate: syntax
  Execute: no
```

---

# Phase 6. 파일 보존 계약 확립

목표는 어떤 지식 폴더를 열어도 Tabula 때문에 파일이 사라지지 않게 하는
것이다.

## PR 27. Knowledge Compatibility 용어와 지원 계약 고정

### 현재 문제

`plain-markdown`, `markdown-wiki`, `okf`가 서로 같은 종류의 포맷처럼
표현된다. “지원”이라는 표현도 파일 보존, 렌더링, 명세 검증, 코드 실행을
구분하지 않는다.

### 패치

공식 profile 분류를 추가한다.

```ts
type KnowledgeProfileKind =
  | "syntax"
  | "convention"
  | "schema"
  | "workflow"
  | "agent-instruction"
  | "delivery"
  | "retrieval";
```

예시:

```text
GFM             syntax
Obsidian        convention
OKF 0.2         schema
LLM Wiki        workflow
AGENTS.md       agent-instruction
llms.txt        delivery
GraphRAG        retrieval
```

### 완료 기준

- 모든 등록 profile이 kind와 support level을 가진다.
- 제품 copy에서 format, standard, workflow를 잘못 혼용하지 않는다.
- 이 PR은 제품 동작을 변경하지 않는다.

### 하지 않을 것

- 새로운 문법 지원
- import/export 변경
- UI 개편

---

## PR 28. Workspace Artifact 모델 도입

### 현재 문제

현재 workspace 모델은 편집 가능한 Markdown 파일 중심이다. 이미지, JSON,
MDX, 스크립트, 알 수 없는 파일을 동일한 workspace 구성원으로 안정적으로
표현하기 어렵다.

### 목표 모델

```ts
type WorkspaceArtifact = {
  id: string;
  path: string;
  kind: "document" | "asset" | "instruction" | "support";
  mediaType?: string;
  content:
    | { kind: "text"; text: string; encoding: "utf-8" }
    | { kind: "binary"; bytes: Uint8Array };
  sourceHash: string;
  editable: boolean;
};
```

Markdown 편집 상태, view mode, selection 등은 artifact 자체와 분리한다.

### 완료 기준

- 기존 Markdown workspace를 새 모델로 변환해도 동작 변화가 없다.
- text와 binary artifact를 모두 표현할 수 있다.
- unknown file을 임의의 Markdown 문서로 오인하지 않는다.
- persistence와 collaboration의 기존 문서 동작을 유지한다.

### 하지 않을 것

- 모든 파일 import
- 로컬 폴더 동기화
- binary 파일 편집

---

## PR 29. 폴더 import/export 무손실 round-trip

### 현재 문제

폴더 import는 주로 `.md`와 일부 제한된 support file만 포함한다. `.mdx`,
`.markdown`, 이미지, JSON, `.obsidian` 설정 등이 누락될 수 있다.

### 패치

다음을 workspace artifact로 보존한다.

- `.md`
- `.markdown`
- `.mdx`
- 이미지와 첨부파일
- `.json`, `.yaml`, `.yml`
- `.obsidian/`
- `AGENTS.md`, `CLAUDE.md`, `SKILL.md`
- OKF `references/` 파일
- 인식하지 못한 일반 파일

보안상 열거나 실행하면 안 되는 파일도 삭제하지 않고 opaque artifact로
보존한다.

### 테스트 fixture

```text
mixed-workspace/
  README.md
  guide.markdown
  page.mdx
  AGENTS.md
  .obsidian/app.json
  references/query.sql
  references/attester.py
  images/diagram.png
  custom.unknown
```

### 완료 기준

- import 후 export한 각 파일의 path와 bytes가 원본과 같다.
- 크기 제한이나 브라우저 제한으로 제외된 파일을 명시한다.
- ignored file을 조용히 버리지 않는다.
- 기존 Markdown import 동작을 유지한다.

---

# Phase 7. 실제 로컬 폴더 연결

목표는 브라우저에 복사된 workspace와 실제 로컬 폴더를 명확히 구분하고,
지원 환경에서는 실제 파일을 source of truth로 사용할 수 있게 하는 것이다.

## PR 30. Workspace Source Adapter 분리

### 현재 문제

브라우저 저장 사본, 가져온 archive, 실제 로컬 폴더, collaboration room이
동일한 종류의 workspace처럼 취급된다. 동기화를 직접 추가하면 persistence,
collaboration, filesystem 책임이 뒤섞일 가능성이 크다.

### 목표 모델

```ts
type WorkspaceSource =
  | BrowserCopySource
  | LiveFolderSource
  | ImportedArchiveSource
  | CollaborationRoomSource;
```

```ts
interface WorkspaceSourceAdapter {
  readSnapshot(): Promise<WorkspaceSnapshot>;
  getCapabilities(): WorkspaceSourceCapabilities;
  writeChanges?(changes: ArtifactChange[]): Promise<WriteResult>;
  checkExternalChanges?(): Promise<ExternalChangeResult>;
}
```

### 완료 기준

- 기존 브라우저 사본은 `BrowserCopySource`로 동작한다.
- UI가 workspace source 종류를 구별할 수 있다.
- 기존 import와 autosave 동작은 바뀌지 않는다.
- source adapter가 editor UI 상태를 직접 소유하지 않는다.

---

## PR 31. Live Folder write-through 저장

### 목표

지원 브라우저에서 사용자가 명시적으로 선택한 폴더를 실제 source of
truth로 사용할 수 있게 한다.

### 동작

- 파일 편집을 실제 로컬 파일에 반영
- 새 파일과 폴더 생성 반영
- rename 반영
- delete는 별도 확인
- 권한이 사라지면 상태 표시
- 미지원 환경에서는 기존 import/export 유지

### 완료 기준

- Tabula 편집 후 외부 편집기에서 변경을 확인할 수 있다.
- 쓰기 실패 시 문서 내용을 잃지 않는다.
- 사용자가 선택하지 않은 폴더에는 접근하지 않는다.
- 파일 저장 상태와 브라우저 persistence 상태를 구별한다.

---

## PR 32. 외부 변경 감지와 충돌 검토

### 목표

Codex, Cursor, VS Code 등이 같은 파일을 바꿨을 때 Tabula가 변경을 안전하게
처리한다.

### 규칙

- Tabula에 미저장 변경이 없으면 외부 변경을 reload한다.
- 양쪽 모두 변경됐으면 diff를 표시한다.
- 자동 overwrite를 금지한다.
- 사용자는 외부 버전, Tabula 버전, 수동 merge 중 하나를 선택할 수 있다.
- 파일 move와 delete도 conflict event로 취급한다.

### 완료 기준

```text
Tabula edits only       → disk write
External edits only     → safe refresh
Both edit differently   → conflict review
External delete         → deletion review
External rename         → path review
```

- 충돌 중에도 양쪽 원문을 모두 보존한다.
- conflict UI가 collaboration merge와 filesystem merge를 혼동하지 않는다.

---

# Phase 8. Composable Workspace Profile

목표는 하나의 workspace가 여러 문법, 규약, workflow를 동시에 가질 수 있게
하는 것이다.

## PR 33. 단일 format enum을 Profile Set으로 교체

### 현재 문제

현재 profile은 하나의 주 format과 제한된 conventions 목록을 반환한다.
LLM Wiki, AGENTS.md, MDX, llms.txt, OKF가 함께 존재하는 경우를 충분히
표현하지 못한다.

### 목표 모델

```ts
type WorkspaceProfile = {
  syntaxes: SyntaxProfile[];
  conventions: ConventionProfile[];
  schemas: SchemaProfile[];
  workflows: WorkflowProfile[];
  agentInstructions: AgentInstructionProfile[];
  deliveries: DeliveryProfile[];
};
```

예시:

```ts
{
  syntaxes: ["gfm", "mdx"],
  conventions: ["obsidian"],
  schemas: [{ id: "okf", version: "0.1" }],
  workflows: ["llm-wiki"],
  agentInstructions: ["agents-md", "agent-skills"],
  deliveries: ["llms-txt"],
}
```

### 완료 기준

- 기존 plain Markdown 감지 결과를 유지한다.
- OKF와 Obsidian을 동시에 표시할 수 있다.
- OpenWiki producer와 OKF version을 별도로 표현한다.
- profile 간 배타 관계를 강제하지 않는다.

---

## PR 34. Profile Detector Registry

### 목표

새 profile을 추가할 때 거대한 import 함수에 조건문을 계속 추가하지 않게
한다.

### 인터페이스

```ts
interface WorkspaceProfileDetector {
  id: string;
  detect(input: WorkspaceInspection): ProfileDetectionResult;
}
```

각 detector는 다음을 반환한다.

```ts
{
  confidence: "declared" | "strong" | "heuristic";
  evidence: ProfileEvidence[];
  diagnostics: ProfileDiagnostic[];
}
```

### Detector 범위

- GFM
- MDX
- Obsidian
- OKF
- OpenWiki
- LLM Wiki
- AGENTS.md
- Agent Skills
- llms.txt

### 원칙

- 명시적 선언과 추측을 구별한다.
- 폴더명 하나만으로 표준이라고 단정하지 않는다.
- detector는 파일을 변경하지 않는다.
- detector 실패가 workspace 열기 실패로 이어지지 않는다.

---

## PR 35. Workspace Profile UI

### 목표

사용자가 Tabula가 현재 폴더를 어떻게 이해했는지 확인할 수 있게 한다.

### UI 예시

```text
Workspace profile

Syntax
  GitHub Flavored Markdown
  MDX · 3 files · Source editing

Conventions
  Obsidian links
  24 Wikilinks · 2 embeds

Knowledge schema
  OKF 0.1 · Declared in index.md
  Migration to 0.2 available

Workflow
  LLM Wiki pattern detected
  raw/ and wiki/ roles found
```

### 원칙

- badge만 나열하지 않고 evidence를 제공한다.
- Detected, Declared, Heuristic을 구별한다.
- profile이 없다고 오류 처리하지 않는다.
- ordinary Markdown이 정상적인 기본 상태다.

---

# Phase 9. 문법과 지식 규약 지원

## PR 36. Markdown Syntax 및 Extension Registry

### 목표

GFM, Wikilink, Tabula component, 기타 확장을 하나의 Markdown 표준처럼
취급하지 않는다.

### 모델

```ts
type MarkdownCapability =
  | "commonmark"
  | "gfm-table"
  | "gfm-task-list"
  | "frontmatter"
  | "footnote"
  | "math"
  | "mermaid"
  | "wikilink"
  | "embed"
  | "callout"
  | "tabs"
  | "accordion";
```

### 패치

- 파일별 사용 capability 감지
- Visual과 Preview renderer 지원 여부 표시
- export portability 경고
- `.markdown`을 일반 Markdown 문서로 편집
- Tabula extension과 표준 Markdown 기능을 구별

### 완료 기준

- Tabula extension을 GFM이라고 잘못 표시하지 않는다.
- extension별 source range와 diagnostics를 제공한다.
- 알 수 없는 문법도 source에서 보존한다.

---

## PR 37. 안전한 MDX 지원

### 1차 지원 범위

- `.mdx` import/export
- Source 편집
- frontmatter, heading, Markdown link 인덱싱
- JSX component range 감지
- import/export statement 감지
- 안전한 preview fallback

### 렌더링 원칙

- 임의 JavaScript 실행 금지
- 등록된 component만 렌더링
- unknown component는 source 또는 placeholder로 표시
- expression 평가 금지
- 외부 network import 금지

### 완료 기준

- MDX 파일을 열었다가 저장해도 JSX가 손상되지 않는다.
- 악성 expression이 실행되지 않는다.
- Markdown 내부 링크가 Knowledge graph에 포함된다.

### 하지 않을 것

- 범용 MDX runtime
- npm dependency 자동 설치
- arbitrary React component 실행

---

## PR 38. OKF 0.1/0.2 Versioned Validator

### 현재 문제

Tabula는 OKF 0.1과 0.2를 인식하지만 하나의 compatibility 경로가 두 버전을
대부분 함께 처리한다.

### 목표 구조

```ts
interface OkfVersionAdapter {
  version: "0.1" | "0.2";
  detect(bundle: WorkspaceInspection): Detection;
  validate(bundle: WorkspaceInspection): OkfReport;
  inspect(document: WorkspaceArtifact): OkfConceptModel;
}
```

### OKF 0.1

- `timestamp`
- 본문 `# Citations`
- concept `type`
- `index.md`, `log.md`

### OKF 0.2

- `generated`
- `sources`
- `verified`
- `status`
- `stale_after`
- actor convention
- source와 footnote 연결

### 완료 기준

- 선언 버전에 따라 올바른 diagnostics가 발생한다.
- 선언 없는 bundle은 OKF-like로만 표시한다.
- 알 수 없는 미래 version은 best-effort로 열고 보존한다.
- unknown frontmatter는 항상 유지한다.

---

## PR 39. OKF 0.1 → 0.2 명시적 Migration

### 변환 범위

- `timestamp` → `generated.at`
- producer 정보 입력 또는 선택
- `# Citations` → `sources`
- 가능한 citation ID와 footnote 생성
- root `okf_version` 변경
- 기존 unknown metadata 보존

### UX 예시

```text
Migration preview

12 files will change
3 citations require manual source IDs
2 timestamps have no producer identity
0 files will be deleted
```

### 완료 기준

- 자동 migration을 금지한다.
- 부분 migration이 가능하다.
- migration 전후 diff를 제공한다.
- 실패 시 원본을 유지한다.
- 이미 0.2인 bundle에는 적용하지 않는다.

---

## PR 40. OKF 0.2 고급 계약 지원

### 범위

- `usage_window`
- source credibility signals
- actor convention validation
- `Attested Computation`
- `runtime`
- `parameters`
- `computation`
- `executor`
- `attester`

### 중요한 경계

이 PR은 computation을 실행하지 않는다. 계약이 구조적으로 유효한지만
검사한다.

### 검사 예시

- `type: Attested Computation`인데 runtime이 없음
- parameters에 중복 name 존재
- computation file이 없음
- executor 또는 attester resource가 깨짐
- receipt contract가 비어 있음
- stale computation을 다른 concept이 사용 중

### 완료 기준

- OKF 0.2 core와 advanced 지원 수준을 UI에서 구별한다.
- 실행하지 않고 구조, 링크, freshness를 진단한다.
- 알 수 없는 runtime을 오류로 거부하지 않고 unsupported 상태로 표시한다.

---

# Phase 10. LLM Wiki와 에이전트 지식 운영

## PR 41. LLM Wiki Workflow Profile

### 정의

LLM Wiki는 고정 포맷이 아니라 workflow profile이다.

### 감지 대상

- raw source 영역
- agent-maintained wiki 영역
- schema 또는 steering 문서
- `index.md`
- `log.md`
- ingest, query, lint 관례

폴더명이 다를 수 있으므로 명시적 규칙과 heuristic을 구별한다.

### UI 역할

```text
Source material
  raw/articles/paper.pdf
  Never modified by agents

Compiled knowledge
  wiki/concepts/attention.md
  Agent-maintained

Workflow rules
  AGENTS.md
```

### Knowledge Health 확장

- raw source가 wiki에서 참조되지 않음
- wiki claim에 provenance가 없음
- orphan concept
- stale synthesis
- contradictory claim 후보
- index 또는 log 누락
- schema에 정의된 역할 위반

### 하지 않을 것

- 특정 LLM provider 강제
- 모든 LLM Wiki에 고정 폴더 구조 강제
- agent 변경 자동 승인

---

## PR 42. AGENTS.md, CLAUDE.md, Agent Skills 지원

### AGENTS.md

- 디렉터리별 scope 계산
- 현재 문서에 적용되는 instruction 표시
- 상위와 하위 instruction 충돌 후보 표시
- agent가 instruction 파일을 변경하면 중요 변경으로 강조

### CLAUDE.md

- 일반 steering document로 보존
- vendor-specific 문서임을 표시
- AGENTS.md와 다르더라도 삭제하거나 자동 통합하지 않음

### Agent Skills

- `SKILL.md` frontmatter validation
- name과 description 검사
- references, scripts, assets 경로 검사
- progressive disclosure 구조 표시

### 보안 경계

- Skill script는 기본적으로 실행하지 않는다.
- 문서 편집 권한과 script 실행 권한을 분리한다.
- 외부에서 가져온 Skill에 신뢰 상태를 표시한다.

### 완료 기준

- 현재 파일에 어떤 AGENTS.md가 적용되는지 확인할 수 있다.
- 깨진 Skill reference를 진단한다.
- instruction 변경이 일반 문구 변경에 묻히지 않는다.

---

## PR 43. llms.txt Delivery Adapter

### 역할

llms.txt는 workspace 저장 포맷이 아니라 외부 LLM에게 배포하는 목차
포맷으로 취급한다.

### 기능

- 기존 `llms.txt` validation
- workspace에서 `llms.txt` 생성
- section별 문서 선택
- Optional section 지원
- broken link와 external link 확인
- 공개하면 안 되는 private 문서 검토

### 완료 기준

- export 전 포함 문서 목록을 확인할 수 있다.
- 민감한 문서를 자동으로 공개하지 않는다.
- 생성된 llms.txt가 workspace source를 변경하지 않는다.
- 기존 사용자 작성 llms.txt를 자동 덮어쓰지 않는다.

---

# Phase 11. 파생 검색과 정형 지식 교환

이 단계는 실제 사용자 검증 이후 진행한다. 앞 단계보다 우선하지 않는다.

## PR 44. Derived Knowledge Index Adapter 경계

### 목표

full-text, BM25, vector, GraphRAG를 문서 모델과 분리한다.

```ts
interface KnowledgeIndexAdapter {
  build(snapshot: WorkspaceSnapshot): Promise<DerivedIndex>;
  update?(changes: ArtifactChange[]): Promise<DerivedIndexDelta>;
  query(query: KnowledgeQuery): Promise<KnowledgeResult[]>;
}
```

### 원칙

- index는 언제든 삭제하고 재생성할 수 있다.
- index가 Markdown 원본을 변경하지 않는다.
- 모든 결과가 source artifact와 source range를 가진다.
- search provider 교체가 editor에 영향을 주지 않는다.
- embedding과 graph cache는 collaboration source가 아니다.

---

## PR 45. JSON-LD/SKOS Import·Export Adapter

### 1차 범위

- OKF concept → JSON-LD export
- Markdown link → graph edge
- `resource` → canonical URI
- type과 tag 관계 변환
- SKOS concept scheme export
- JSON-LD import preview

### 원칙

- Markdown이 계속 source of truth다.
- RDF store를 새로운 필수 저장소로 도입하지 않는다.
- 변환 손실과 mapping 결과를 미리 표시한다.
- round-trip이 불가능한 관계를 명시한다.

---

## 3. 구현 순서와 의존 관계

```text
PR 27
  ↓
PR 28 → PR 29
  ↓
PR 30 → PR 31 → PR 32
  ↓
PR 33 → PR 34 → PR 35
  ↓
PR 36 → PR 37
  ↓
PR 38 → PR 39 → PR 40
  ↓
PR 41 → PR 42 → PR 43
  ↓
PR 44 → PR 45
```

병렬 가능한 범위:

- PR 36과 PR 38은 PR 34 이후 병렬로 진행할 수 있다.
- PR 41과 PR 42는 Profile 모델 완료 후 병렬로 진행할 수 있다.
- PR 43은 PR 29 완료 후 독립적으로 개발할 수 있다.
- PR 44와 PR 45는 앞 단계 사용자 검증 이후 진행한다.

---

## 4. Release 단위

### Release A — Nothing Lost

PR 27–32

어떤 폴더를 열더라도 파일이 사라지지 않고, 실제 로컬 폴더와 연결하며,
외부 agent 변경과 충돌을 안전하게 처리한다.

### Release B — Tabula Understands the Workspace

PR 33–37

Tabula가 GFM, MDX, Obsidian 등의 조합을 감지하고 사용자에게 근거와 지원
수준을 설명한다.

### Release C — Trustworthy OKF

PR 38–40

OKF 0.1과 0.2를 정확히 구별하고, 안전하게 migration하며, 고급 0.2 계약을
검사한다.

### Release D — Agent-Maintained Knowledge

PR 41–43

LLM Wiki, AGENTS.md, Agent Skills, llms.txt를 지식 운영 관점에서 지원한다.

### Release E — Interoperability

PR 44–45

검색 엔진과 정형 knowledge graph를 source of truth에서 분리한 adapter로
제공한다.

---

## 5. 반드시 피해야 할 구현

- Workspace를 하나의 format enum으로 다시 축소
- 파일을 열기 위해 알 수 없는 frontmatter를 제거
- OKF 0.1 문서를 조용히 0.2로 변경
- MDX preview를 위해 arbitrary JavaScript 실행
- Skill 문서를 열었다는 이유로 script 실행
- 외부 변경을 mtime만 보고 자동 overwrite
- GraphRAG나 vector database를 source of truth로 사용
- LLM Wiki에 고정 폴더명 강제
- Obsidian plugin 문법을 일반 Markdown으로 잘못 선언
- 한 PR에서 artifact model, local sync, UI, OKF migration을 함께 변경
- 새로운 parser를 surface마다 복사
- profile detector 실패로 workspace 전체 열기 실패
- 공개용 llms.txt에 private 문서를 자동 포함

---

## 6. 최종 성공 기준

전체 작업이 완료되면 다음이 성립해야 한다.

1. `.md`, `.markdown`, `.mdx`, 이미지, JSON, script 등 폴더 파일이 손실
   없이 왕복한다.
2. Workspace가 단일 format이 아니라 profile 조합으로 표현된다.
3. OKF 0.1, OKF 0.2, Obsidian, OpenWiki, LLM Wiki를 서로 혼동하지 않는다.
4. 사용자가 각 profile의 감지 근거와 지원 수준을 확인할 수 있다.
5. MDX와 Skill script가 사용자 승인 없이 실행되지 않는다.
6. OKF migration은 항상 diff를 거친다.
7. 외부 agent가 로컬 파일을 변경해도 Tabula가 조용히 덮어쓰지 않는다.
8. raw source와 agent-generated wiki의 역할이 구분된다.
9. AGENTS.md와 Skill 변경이 중요한 제어 변경으로 검토된다.
10. RAG, GraphRAG, JSON-LD는 Markdown을 대체하지 않고 adapter로 동작한다.
11. ordinary Markdown 사용자는 새로운 지식 규약을 몰라도 기존처럼 사용할
    수 있다.
12. Tabula의 차별점이 “또 다른 Markdown 편집기”가 아니라 “이질적인 파일
    기반 지식을 사람과 에이전트가 안전하게 유지하는 workspace”로
    명확해진다.

---

## 7. 참고 명세와 원문

- [CommonMark Specification](https://spec.commonmark.org/)
- [GitHub Flavored Markdown Specification](https://github.github.com/gfm/)
- [MDX: What is MDX?](https://mdxjs.com/docs/what-is-mdx/)
- [Obsidian Internal Links](https://obsidian.md/help/links)
- [Open Knowledge Format 0.2](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
- [Karpathy LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [AGENTS.md](https://agents.md/)
- [Agent Skills Specification](https://agentskills.io/specification)
- [llms.txt](https://llmstxt.org/)
- [Microsoft GraphRAG](https://microsoft.github.io/graphrag/)
- [W3C RDF 1.2 Primer](https://www.w3.org/TR/rdf12-primer/)
- [W3C SKOS Reference](https://www.w3.org/TR/skos-reference/)
