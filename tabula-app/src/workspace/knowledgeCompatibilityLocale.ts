import type {
  OkfAdvancedDiagnosticCode,
  OkfCompatibilityIssue,
  OkfCompatibilityIssueCode,
  WorkspaceKnowledgeHealthIssue,
  WorkspaceKnowledgeHealthIssueCode,
} from "@tabula-md/tabula";
import type { WorkspaceLanguage } from "./state/useWorkspacePreferences";

type KnowledgeCompatibilityMessages = {
  open: string;
  back: string;
  title: string;
  description: string;
  unchanged: string;
  unavailable: string;
  noDocuments: string;
  compatible: string;
  requiredChange: string;
  requiredChanges: string;
  portabilityWarning: string;
  portabilityWarnings: string;
  requiredSection: string;
  warningSection: string;
  openDocument: string;
  conceptTypeLabel: string;
  conceptTypePlaceholder: string;
  conceptTypeHelp: string;
  addFrontmatterAndType: string;
  setConceptType: string;
  issues: Record<OkfCompatibilityIssueCode, string>;
};

export type KnowledgeCompatibilityCopy = {
  open: string;
  back: string;
  title: string;
  description: string;
  unchanged: string;
  unavailable: string;
  noDocuments: string;
  compatible: (version: string) => string;
  okfLike: string;
  markdownOnly: string;
  futureVersion: (version: string) => string;
  migrationTitle: string;
  migrationDescription: string;
  migrationProducer: string;
  migrationChangedFiles: (count: number) => string;
  migrationManualCitations: (count: number) => string;
  migrationMissingProducers: (count: number) => string;
  migrationDeletedFiles: (count: number) => string;
  migrationDecisions: (count: number) => string;
  migrationFile: string;
  migrationApply: string;
  supportCore: string;
  supportAdvanced: (count: number) => string;
  supportAdvancedPartial: (count: number, runtimes: string) => string;
  requiredChanges: (count: number) => string;
  portabilityWarnings: (count: number) => string;
  requiredSection: string;
  warningSection: string;
  openDocument: (path: string) => string;
  conceptTypeLabel: string;
  conceptTypePlaceholder: string;
  conceptTypeHelp: string;
  addFrontmatterAndType: string;
  setConceptType: string;
  safeFixes: string;
  safeFixesDescription: string;
  includeChange: string;
  suggestedFromFolder: (type: string) => string;
  suggestedFromPath: (type: string) => string;
  typeDecisionRequired: string;
  invalidYamlRequiresManualFix: string;
  selectedChanges: (count: number) => string;
  applySelected: string;
  before: string;
  after: string;
  planChanged: string;
  portableLinks: string;
  portableLinksDescription: string;
  convertibleLinks: (count: number) => string;
  skippedLinks: (count: number) => string;
  markdownLinks: string;
  convertSelected: string;
  metadataGuidance: string;
  metadataGuidanceDescription: string;
  metadataFields: Record<"description" | "tags" | "resource", string>;
  indexes: string;
  indexesDescription: string;
  indexStates: Record<"missing" | "generated" | "curated", string>;
  indexContents: (conceptCount: number, directoryCount: number) => string;
  generatedCandidate: string;
  currentIndex: string;
  createIndex: string;
  updateGeneratedIndex: string;
  replaceCuratedIndex: string;
  replaceCuratedWarning: string;
  confirmReplace: string;
  cancel: string;
  upToDate: string;
  healthTitle: string;
  healthDescription: string;
  healthHealthy: string;
  healthAttention: (count: number) => string;
  healthNotices: (count: number) => string;
  healthAttentionSection: string;
  healthNoticeSection: string;
  healthIssue: (issue: WorkspaceKnowledgeHealthIssue) => string;
  verificationReview: string;
  verificationReviewDescription: string;
  generatedBy: string;
  generatedAt: string;
  latestVerification: string;
  unknownActor: string;
  unknownDate: string;
  evidence: string;
  verificationNeedsEvidence: string;
  verificationAttestation: string;
  changesSinceTracking: string;
  noTrackedChanges: string;
  trackingRequiredForDiff: string;
  openDocumentAction: string;
  recordVerification: (name: string) => string;
  verificationFailed: string;
  knowledgeChanges: string;
  knowledgeChangesDescription: string;
  knowledgeChangesNotTracked: string;
  startTracking: string;
  noKnowledgeChanges: string;
  trackingSince: (capturedAt: string) => string;
  changeSummary: (added: number, modified: number, deleted: number) => string;
  changeKinds: Record<"added" | "modified" | "deleted", string>;
  currentLog: string;
  generatedLog: string;
  createLog: string;
  updateLog: string;
  logBlocked: string;
  maintenanceImpact: string;
  maintenanceImpactSummary: (introduced: number, resolved: number) => string;
  noMaintenanceImpact: string;
  introducedMaintenance: string;
  resolvedMaintenance: string;
  issue: (issue: OkfCompatibilityIssue) => string;
};

type KnowledgeConformanceActionMessages = {
  safeFixes: string;
  safeFixesDescription: string;
  includeChange: string;
  suggestedFromFolder: string;
  suggestedFromPath: string;
  typeDecisionRequired: string;
  invalidYamlRequiresManualFix: string;
  selectedChanges: string;
  applySelected: string;
  before: string;
  after: string;
  planChanged: string;
  portableLinks: string;
  portableLinksDescription: string;
  convertibleLinks: string;
  skippedLinks: string;
  markdownLinks: string;
  convertSelected: string;
  metadataGuidance: string;
  metadataGuidanceDescription: string;
  metadataFields: Record<"description" | "tags" | "resource", string>;
  indexes: string;
  indexesDescription: string;
  indexStates: Record<"missing" | "generated" | "curated", string>;
  indexContents: string;
  generatedCandidate: string;
  currentIndex: string;
  createIndex: string;
  updateGeneratedIndex: string;
  replaceCuratedIndex: string;
  replaceCuratedWarning: string;
  confirmReplace: string;
  cancel: string;
  upToDate: string;
  healthTitle: string;
  healthDescription: string;
  healthHealthy: string;
  healthAttention: string;
  healthNotices: string;
  healthAttentionSection: string;
  healthNoticeSection: string;
  healthIssues: Record<WorkspaceKnowledgeHealthIssueCode, string>;
  verificationReview: string;
  verificationReviewDescription: string;
  generatedBy: string;
  generatedAt: string;
  latestVerification: string;
  unknownActor: string;
  unknownDate: string;
  evidence: string;
  verificationNeedsEvidence: string;
  verificationAttestation: string;
  changesSinceTracking: string;
  noTrackedChanges: string;
  trackingRequiredForDiff: string;
  openDocumentAction: string;
  recordVerification: string;
  verificationFailed: string;
  knowledgeChanges: string;
  knowledgeChangesDescription: string;
  knowledgeChangesNotTracked: string;
  startTracking: string;
  noKnowledgeChanges: string;
  trackingSince: string;
  changeSummary: string;
  changeKinds: Record<"added" | "modified" | "deleted", string>;
  currentLog: string;
  generatedLog: string;
  createLog: string;
  updateLog: string;
  logBlocked: string;
  maintenanceImpact: string;
  maintenanceImpactSummary: string;
  noMaintenanceImpact: string;
  introducedMaintenance: string;
  resolvedMaintenance: string;
};

const actionCopies: Partial<Record<WorkspaceLanguage, KnowledgeConformanceActionMessages>> & {
  en: KnowledgeConformanceActionMessages;
} = {
  en: {
    safeFixes: "Review fixes",
    safeFixesDescription: "Choose the concept types to add. Nothing is applied until you review the diff.",
    includeChange: "Include this change",
    suggestedFromFolder: "Suggested from this folder: {{type}}",
    suggestedFromPath: "Suggested from the document path: {{type}}",
    typeDecisionRequired: "Choose a concept type before including this change.",
    invalidYamlRequiresManualFix: "Invalid YAML must be fixed in the document first.",
    selectedChanges: "{{count}} selected",
    applySelected: "Apply selected",
    before: "Before",
    after: "After",
    planChanged: "The workspace changed. Review the fixes again.",
    portableLinks: "Portable links",
    portableLinksDescription: "Convert only resolved page links. Broken, ambiguous, and embedded wikilinks stay unchanged.",
    convertibleLinks: "{{count}} resolved links",
    skippedLinks: "{{count}} left unchanged",
    markdownLinks: "Markdown links",
    convertSelected: "Convert selected",
    metadataGuidance: "Metadata guidance",
    metadataGuidanceDescription: "Optional fields improve retrieval and provenance but are not required for OKF compatibility.",
    metadataFields: {
      description: "description",
      tags: "tags",
      resource: "resource",
    },
    indexes: "Indexes",
    indexesDescription: "Preview indexes derived from concept metadata. Curated indexes are never replaced automatically.",
    indexStates: {
      missing: "Missing",
      generated: "Generated",
      curated: "Curated",
    },
    indexContents: "{{conceptCount}} files, {{directoryCount}} directories",
    generatedCandidate: "Generated candidate",
    currentIndex: "Current index",
    createIndex: "Create index",
    updateGeneratedIndex: "Update generated index",
    replaceCuratedIndex: "Replace curated index…",
    replaceCuratedWarning: "This replaces human-written index content with the generated candidate.",
    confirmReplace: "Replace index",
    cancel: "Cancel",
    upToDate: "Up to date",
    healthTitle: "Knowledge health",
    healthDescription: "Operational signals that do not affect OKF compatibility.",
    healthHealthy: "No maintenance signals",
    healthAttention: "{{count}} needs attention",
    healthNotices: "{{count}} notices",
    healthAttentionSection: "Needs attention",
    healthNoticeSection: "Notices",
    healthIssues: {
      stale: "Refresh after {{value}}",
      deprecated_referenced: "Deprecated concept still has {{value}} references",
      unverified_generated: "Generated content has not been verified",
      verification_outdated: "Verification predates generation at {{value}}",
      provenance_missing: "Agent-generated content has no source",
      orphan_concept: "Concept has no relationships",
      relationship_broken: "Relationship target does not exist: {{value}}",
      relationship_ambiguous: "Relationship target is ambiguous: {{value}}",
      canonical_resource_shared: "Canonical resource is shared by multiple concepts: {{value}}",
      source_id_duplicate: "Source id is duplicated: {{value}}",
      source_resource_duplicate: "Source resource is duplicated: {{value}}",
      source_reference_missing: "Citation has no matching source: {{value}}",
      source_unused: "Declared source is not cited: {{value}}",
      optional_metadata_invalid: "Optional metadata is malformed: {{value}}",
    },
    verificationReview: "Human review",
    verificationReviewDescription: "Inspect provenance and tracked changes before recording that a person verified generated knowledge.",
    generatedBy: "Generated by",
    generatedAt: "Generated at",
    latestVerification: "Latest verification",
    unknownActor: "Unknown producer",
    unknownDate: "Unknown time",
    evidence: "Evidence",
    verificationNeedsEvidence: "Add a source or canonical resource before recording verification.",
    verificationAttestation: "I compared this document with the sources listed above.",
    changesSinceTracking: "Changes since tracking",
    noTrackedChanges: "No document changes since tracking began.",
    trackingRequiredForDiff: "Start knowledge tracking to compare this document with a known baseline.",
    openDocumentAction: "Open document",
    recordVerification: "Record as {{name}}",
    verificationFailed: "The document changed. Review it again before recording verification.",
    knowledgeChanges: "Knowledge changes",
    knowledgeChangesDescription: "Review changes since this workspace was opened, then write a deterministic OKF log entry.",
    knowledgeChangesNotTracked: "Start from the current workspace to track later additions, edits, moves, and deletions.",
    startTracking: "Start tracking changes",
    noKnowledgeChanges: "No knowledge changes",
    trackingSince: "Tracking since {{date}}",
    changeSummary: "{{added}} added, {{modified}} updated, {{deleted}} removed",
    changeKinds: {
      added: "Added",
      modified: "Updated",
      deleted: "Removed",
    },
    currentLog: "Current log",
    generatedLog: "Log candidate",
    createLog: "Create log",
    updateLog: "Update log",
    logBlocked: "Fix the existing log structure before adding this entry.",
    maintenanceImpact: "Maintenance impact",
    maintenanceImpactSummary: "{{introduced}} introduced, {{resolved}} resolved",
    noMaintenanceImpact: "No maintenance signals changed",
    introducedMaintenance: "Introduced",
    resolvedMaintenance: "Resolved",
  },
  ko: {
    safeFixes: "수정 검토",
    safeFixesDescription: "추가할 concept type을 선택하세요. diff를 확인하고 적용하기 전에는 파일이 바뀌지 않습니다.",
    includeChange: "이 변경 포함",
    suggestedFromFolder: "같은 폴더 기준 제안: {{type}}",
    suggestedFromPath: "문서 경로 기준 제안: {{type}}",
    typeDecisionRequired: "변경에 포함하기 전에 concept type을 결정하세요.",
    invalidYamlRequiresManualFix: "잘못된 YAML은 먼저 문서에서 직접 수정해야 합니다.",
    selectedChanges: "{{count}}개 선택",
    applySelected: "선택 항목 적용",
    before: "변경 전",
    after: "변경 후",
    planChanged: "워크스페이스가 변경되었습니다. 수정안을 다시 검토하세요.",
    portableLinks: "이식 가능한 링크",
    portableLinksDescription: "대상이 확정된 문서 링크만 변환합니다. 깨진 링크, 모호한 링크와 embed는 그대로 둡니다.",
    convertibleLinks: "확정된 링크 {{count}}개",
    skippedLinks: "{{count}}개 유지",
    markdownLinks: "Markdown 링크",
    convertSelected: "선택 항목 변환",
    metadataGuidance: "Metadata 보완",
    metadataGuidanceDescription: "선택 항목입니다. 검색과 출처 추적에는 도움이 되지만 OKF 호환의 필수 조건은 아닙니다.",
    metadataFields: {
      description: "description",
      tags: "tags",
      resource: "resource",
    },
    indexes: "Index",
    indexesDescription: "concept metadata에서 만든 index를 먼저 확인합니다. 사람이 편집한 index는 자동으로 덮어쓰지 않습니다.",
    indexStates: {
      missing: "없음",
      generated: "생성됨",
      curated: "직접 편집됨",
    },
    indexContents: "파일 {{conceptCount}}개, 하위 폴더 {{directoryCount}}개",
    generatedCandidate: "생성 후보",
    currentIndex: "현재 index",
    createIndex: "Index 생성",
    updateGeneratedIndex: "생성된 index 갱신",
    replaceCuratedIndex: "직접 편집한 index 교체…",
    replaceCuratedWarning: "사람이 작성한 index 내용을 생성 후보로 교체합니다.",
    confirmReplace: "Index 교체",
    cancel: "취소",
    upToDate: "최신 상태",
    healthTitle: "Knowledge health",
    healthDescription: "OKF 호환 여부와 별개로 유지보수가 필요한 운영 신호입니다.",
    healthHealthy: "유지보수 신호 없음",
    healthAttention: "확인 필요 {{count}}개",
    healthNotices: "참고 {{count}}개",
    healthAttentionSection: "확인 필요",
    healthNoticeSection: "참고",
    healthIssues: {
      stale: "{{value}} 이후 갱신 필요",
      deprecated_referenced: "폐기된 concept를 아직 {{value}}곳에서 참조",
      unverified_generated: "생성된 내용을 아직 검증하지 않음",
      verification_outdated: "{{value}} 생성 이후 다시 검증해야 함",
      provenance_missing: "Agent가 생성했지만 출처가 없음",
      orphan_concept: "다른 concept와 연결되지 않음",
      relationship_broken: "관계 대상 문서가 없음: {{value}}",
      relationship_ambiguous: "관계 대상을 하나로 결정할 수 없음: {{value}}",
      canonical_resource_shared: "여러 concept가 같은 canonical resource를 사용함: {{value}}",
      source_id_duplicate: "Source id가 중복됨: {{value}}",
      source_resource_duplicate: "Source resource가 중복됨: {{value}}",
      source_reference_missing: "인용에 해당하는 source가 없음: {{value}}",
      source_unused: "등록했지만 인용하지 않은 source: {{value}}",
      optional_metadata_invalid: "선택 metadata 형식이 잘못됨: {{value}}",
    },
    verificationReview: "사람 검증",
    verificationReviewDescription: "생성된 지식의 출처와 추적된 변경을 확인한 뒤 사람의 검증 기록을 남깁니다.",
    generatedBy: "생성 주체",
    generatedAt: "생성 시각",
    latestVerification: "최근 검증",
    unknownActor: "생성 주체 알 수 없음",
    unknownDate: "시각 알 수 없음",
    evidence: "근거",
    verificationNeedsEvidence: "검증을 기록하기 전에 source 또는 canonical resource를 추가하세요.",
    verificationAttestation: "위 근거 자료와 이 문서의 내용을 직접 대조했습니다.",
    changesSinceTracking: "추적 이후 변경",
    noTrackedChanges: "변경 추적을 시작한 이후 문서 변경이 없습니다.",
    trackingRequiredForDiff: "기준 상태와 비교하려면 먼저 지식 변경 추적을 시작하세요.",
    openDocumentAction: "문서 열기",
    recordVerification: "{{name}} 이름으로 검증 기록",
    verificationFailed: "문서가 변경되었습니다. 다시 확인한 뒤 검증을 기록하세요.",
    knowledgeChanges: "지식 변경",
    knowledgeChangesDescription: "워크스페이스를 연 뒤의 변경을 검토하고, 실제 변경분으로 OKF log 항목을 만듭니다.",
    knowledgeChangesNotTracked: "현재 상태를 기준점으로 저장하면 이후 추가·수정·이동·삭제를 추적합니다.",
    startTracking: "변경 추적 시작",
    noKnowledgeChanges: "지식 변경 없음",
    trackingSince: "{{date}}부터 추적 중",
    changeSummary: "추가 {{added}}, 수정 {{modified}}, 삭제 {{deleted}}",
    changeKinds: {
      added: "추가",
      modified: "수정",
      deleted: "삭제",
    },
    currentLog: "현재 log",
    generatedLog: "Log 후보",
    createLog: "Log 생성",
    updateLog: "Log 갱신",
    logBlocked: "이 항목을 추가하려면 기존 log 구조를 먼저 수정해야 합니다.",
    maintenanceImpact: "유지보수 영향",
    maintenanceImpactSummary: "새 문제 {{introduced}}, 해결 {{resolved}}",
    noMaintenanceImpact: "변경된 유지보수 신호 없음",
    introducedMaintenance: "새로 발생",
    resolvedMaintenance: "해결됨",
  },
};

const advancedIssuesEn: Record<OkfAdvancedDiagnosticCode, string> = {
  okf_02_attester_invalid: "Add a valid attester resource",
  okf_02_attester_resource_missing: "Restore the attester resource: {{value}}",
  okf_02_computation_missing: "Add a computation file or an inline Computation code block",
  okf_02_computation_resource_missing: "Restore the computation file: {{value}}",
  okf_02_executor_invalid: "Add a valid executor resource",
  okf_02_executor_resource_missing: "Restore the executor resource: {{value}}",
  okf_02_parameter_duplicate: "Use each parameter name once: {{value}}",
  okf_02_parameters_invalid: "Use typed parameters with name, type, and required",
  okf_02_receipt_empty: "Declare at least one receipt field",
  okf_02_runtime_missing: "Declare the computation runtime",
  okf_02_runtime_unsupported: "Runtime is structurally readable but not supported: {{value}}",
  okf_02_source_author_invalid: "Use an OKF actor identity for the source author: {{value}}",
  okf_02_stale_computation_in_use: "Refresh this stale computation; {{value}} concepts still use it",
  okf_02_usage_window_invalid: "Use a valid usage_window date range",
  okf_02_usage_window_missing: "Add usage_window to frame usage_count",
};

const enIssues: Record<OkfCompatibilityIssueCode, string> = {
  ...advancedIssuesEn,
  concept_frontmatter_missing: "Add YAML frontmatter",
  concept_frontmatter_invalid: "Fix invalid YAML frontmatter",
  concept_type_missing: "Add a non-empty type",
  concept_type_invalid: "Make type a string",
  reserved_frontmatter_invalid: "Fix invalid YAML frontmatter",
  reserved_frontmatter_not_allowed: "Remove frontmatter from this reserved file",
  root_index_version_invalid: "Set okf_version in the root index.md",
  root_index_extra_metadata: "Keep only okf_version in the root index.md",
  unsupported_okf_version: "Unsupported OKF version: {{value}}",
  index_structure_invalid: "Add an H1 section to this index",
  log_structure_invalid: "Add an H1 title and dated H2 entries to this log",
  log_date_invalid: "Use YYYY-MM-DD for the log date: {{value}}",
  log_dates_out_of_order: "Put the newest log date first",
  nonstandard_markdown_extension: "Rename this file to use the .md extension",
  wikilink_syntax: "Use Markdown links for OKF portability",
  okf_01_timestamp_invalid: "Use an ISO 8601 timestamp",
  okf_02_actor_invalid: "Use an OKF actor identity: {{value}}",
  okf_02_generated_invalid: "Use valid generated.by and generated.at values",
  okf_02_sources_invalid: "Fix invalid sources metadata",
  okf_02_stale_after_invalid: "Use YYYY-MM-DD for stale_after: {{value}}",
  okf_02_status_invalid: "Use draft, stable, or deprecated for status: {{value}}",
  okf_02_verified_invalid: "Use valid verified.by and verified.at values",
};

const detectionCopies: Record<
  WorkspaceLanguage,
  { okfLike: string; markdownOnly: string; futureVersion: string }
> = {
  en: {
    okfLike: "OKF-like Markdown (no version declared)",
    markdownOnly: "Markdown workspace (OKF not declared)",
    futureVersion: "OKF {{version}} opened in best-effort mode",
  },
  ko: {
    okfLike: "OKF 유사 Markdown (버전 선언 없음)",
    markdownOnly: "Markdown 워크스페이스 (OKF 선언 없음)",
    futureVersion: "OKF {{version}}를 최선 지원 모드로 열었습니다",
  },
  ja: {
    okfLike: "OKF 形式に近い Markdown（バージョン宣言なし）",
    markdownOnly: "Markdown ワークスペース（OKF 宣言なし）",
    futureVersion: "OKF {{version}} をベストエフォートモードで開きました",
  },
  zh: {
    okfLike: "类似 OKF 的 Markdown（未声明版本）",
    markdownOnly: "Markdown 工作区（未声明 OKF）",
    futureVersion: "已以尽力支持模式打开 OKF {{version}}",
  },
  es: {
    okfLike: "Markdown similar a OKF (sin versión declarada)",
    markdownOnly: "Espacio Markdown (OKF no declarado)",
    futureVersion: "OKF {{version}} abierto en modo de compatibilidad parcial",
  },
  fr: {
    okfLike: "Markdown de type OKF (sans version déclarée)",
    markdownOnly: "Espace Markdown (OKF non déclaré)",
    futureVersion: "OKF {{version}} ouvert en mode de compatibilité partielle",
  },
  de: {
    okfLike: "OKF-ähnliches Markdown (keine Version deklariert)",
    markdownOnly: "Markdown-Workspace (OKF nicht deklariert)",
    futureVersion: "OKF {{version}} im Best-Effort-Modus geöffnet",
  },
};

type KnowledgeMigrationMessages = {
  title: string;
  description: string;
  producer: string;
  changedFiles: string;
  manualCitations: string;
  missingProducers: string;
  deletedFiles: string;
  decisions: string;
  file: string;
  apply: string;
  supportCore: string;
  supportAdvanced: string;
  supportAdvancedPartial: string;
};

const migrationCopies: Record<WorkspaceLanguage, KnowledgeMigrationMessages> = {
  en: {
    title: "Migration preview",
    description: "Review an explicit OKF 0.1 → 0.2 migration. Nothing changes until you apply selected files.",
    producer: "Producer identity",
    changedFiles: "{{count}} files changed",
    manualCitations: "{{count}} citations need source IDs",
    missingProducers: "{{count}} files need a producer",
    deletedFiles: "{{count}} files deleted",
    decisions: "{{count}} decisions needed",
    file: "Migration change",
    apply: "Apply migration",
    supportCore: "OKF 0.2 core",
    supportAdvanced: "OKF 0.2 advanced · {{count}} computations",
    supportAdvancedPartial: "OKF 0.2 advanced · {{count}} unsupported ({{runtimes}})",
  },
  ko: {
    title: "마이그레이션 미리보기",
    description: "OKF 0.1 → 0.2 변경을 검토합니다. 선택한 파일에 명시적으로 적용하기 전에는 아무것도 바뀌지 않습니다.",
    producer: "생산자 식별자",
    changedFiles: "변경 파일 {{count}}개",
    manualCitations: "출처 ID 결정 필요 {{count}}개",
    missingProducers: "생산자 입력 필요 {{count}}개",
    deletedFiles: "삭제 파일 {{count}}개",
    decisions: "수동 결정 {{count}}개",
    file: "마이그레이션 변경",
    apply: "마이그레이션 적용",
    supportCore: "OKF 0.2 core",
    supportAdvanced: "OKF 0.2 advanced · computation {{count}}개",
    supportAdvancedPartial: "OKF 0.2 advanced · 미지원 {{count}}개 ({{runtimes}})",
  },
  ja: {
    title: "移行プレビュー",
    description: "OKF 0.1 → 0.2 の移行を確認します。選択したファイルを適用するまで変更されません。",
    producer: "生成者 ID",
    changedFiles: "{{count}} 件のファイルを変更",
    manualCitations: "{{count}} 件の引用にソース ID が必要",
    missingProducers: "{{count}} 件のファイルに生成者が必要",
    deletedFiles: "{{count}} 件のファイルを削除",
    decisions: "{{count}} 件の判断が必要",
    file: "移行変更",
    apply: "移行を適用",
    supportCore: "OKF 0.2 core",
    supportAdvanced: "OKF 0.2 advanced · {{count}} computations",
    supportAdvancedPartial: "OKF 0.2 advanced · {{count}} unsupported ({{runtimes}})",
  },
  zh: {
    title: "迁移预览",
    description: "检查 OKF 0.1 → 0.2 迁移。应用所选文件前不会发生任何更改。",
    producer: "生成者标识",
    changedFiles: "更改 {{count}} 个文件",
    manualCitations: "{{count}} 条引用需要来源 ID",
    missingProducers: "{{count}} 个文件需要生成者",
    deletedFiles: "删除 {{count}} 个文件",
    decisions: "需要 {{count}} 项决定",
    file: "迁移更改",
    apply: "应用迁移",
    supportCore: "OKF 0.2 core",
    supportAdvanced: "OKF 0.2 advanced · {{count}} computations",
    supportAdvancedPartial: "OKF 0.2 advanced · {{count}} unsupported ({{runtimes}})",
  },
  es: {
    title: "Vista previa de migración",
    description: "Revisa la migración explícita de OKF 0.1 → 0.2. Nada cambia hasta aplicar los archivos seleccionados.",
    producer: "Identidad del productor",
    changedFiles: "{{count}} archivos modificados",
    manualCitations: "{{count}} citas necesitan ID de fuente",
    missingProducers: "{{count}} archivos necesitan productor",
    deletedFiles: "{{count}} archivos eliminados",
    decisions: "{{count}} decisiones pendientes",
    file: "Cambio de migración",
    apply: "Aplicar migración",
    supportCore: "OKF 0.2 core",
    supportAdvanced: "OKF 0.2 advanced · {{count}} computations",
    supportAdvancedPartial: "OKF 0.2 advanced · {{count}} unsupported ({{runtimes}})",
  },
  fr: {
    title: "Aperçu de la migration",
    description: "Vérifiez la migration explicite OKF 0.1 → 0.2. Rien ne change avant l’application des fichiers sélectionnés.",
    producer: "Identité du producteur",
    changedFiles: "{{count}} fichiers modifiés",
    manualCitations: "{{count}} citations nécessitent un ID de source",
    missingProducers: "{{count}} fichiers nécessitent un producteur",
    deletedFiles: "{{count}} fichiers supprimés",
    decisions: "{{count}} décisions nécessaires",
    file: "Modification de migration",
    apply: "Appliquer la migration",
    supportCore: "OKF 0.2 core",
    supportAdvanced: "OKF 0.2 advanced · {{count}} computations",
    supportAdvancedPartial: "OKF 0.2 advanced · {{count}} unsupported ({{runtimes}})",
  },
  de: {
    title: "Migrationsvorschau",
    description: "Prüft die explizite Migration von OKF 0.1 → 0.2. Erst beim Anwenden ausgewählter Dateien werden Änderungen geschrieben.",
    producer: "Erzeugerkennung",
    changedFiles: "{{count}} Dateien geändert",
    manualCitations: "{{count}} Zitate benötigen Quellen-IDs",
    missingProducers: "{{count}} Dateien benötigen einen Erzeuger",
    deletedFiles: "{{count}} Dateien gelöscht",
    decisions: "{{count}} Entscheidungen erforderlich",
    file: "Migrationsänderung",
    apply: "Migration anwenden",
    supportCore: "OKF 0.2 core",
    supportAdvanced: "OKF 0.2 advanced · {{count}} computations",
    supportAdvancedPartial: "OKF 0.2 advanced · {{count}} unsupported ({{runtimes}})",
  },
};

const copies: Record<WorkspaceLanguage, KnowledgeCompatibilityMessages> = {
  en: {
    open: "Check knowledge base compatibility",
    back: "Back to workspace files",
    title: "Knowledge base compatibility",
    description: "Checks this Markdown workspace against the Open Knowledge Format.",
    unchanged: "The check is read-only. Files change only when you choose an action.",
    unavailable: "Resolve file path conflicts to run this check.",
    noDocuments: "No Markdown documents to check",
    compatible: "Compatible with OKF {{version}}",
    requiredChange: "{{count}} required change",
    requiredChanges: "{{count}} required changes",
    portabilityWarning: "{{count}} portability warning",
    portabilityWarnings: "{{count}} portability warnings",
    requiredSection: "Required changes",
    warningSection: "Portability warnings",
    openDocument: "Open {{path}}",
    conceptTypeLabel: "Concept type",
    conceptTypePlaceholder: "policy, runbook, decision",
    conceptTypeHelp: "Use a stable category that people and agents can reuse.",
    addFrontmatterAndType: "Add frontmatter and type",
    setConceptType: "Set concept type",
    issues: enIssues,
  },
  ko: {
    open: "지식베이스 호환성 검사",
    back: "워크스페이스 파일로 돌아가기",
    title: "지식베이스 호환성",
    description: "현재 Markdown 워크스페이스를 Open Knowledge Format 기준으로 검사합니다.",
    unchanged: "검사 자체는 읽기 전용이며, 액션을 선택할 때만 파일이 변경됩니다.",
    unavailable: "파일 경로 충돌을 해결하면 검사를 실행할 수 있습니다.",
    noDocuments: "검사할 Markdown 문서가 없습니다",
    compatible: "OKF {{version}} 호환",
    requiredChange: "필수 수정 {{count}}개",
    requiredChanges: "필수 수정 {{count}}개",
    portabilityWarning: "이식성 경고 {{count}}개",
    portabilityWarnings: "이식성 경고 {{count}}개",
    requiredSection: "필수 수정",
    warningSection: "이식성 경고",
    openDocument: "{{path}} 열기",
    conceptTypeLabel: "Concept type",
    conceptTypePlaceholder: "policy, runbook, decision",
    conceptTypeHelp: "사람과 agent가 반복해서 사용할 수 있는 일관된 분류를 입력하세요.",
    addFrontmatterAndType: "Frontmatter와 type 추가",
    setConceptType: "Concept type 설정",
    issues: {
      ...advancedIssuesEn,
      concept_frontmatter_missing: "YAML frontmatter 추가",
      concept_frontmatter_invalid: "잘못된 YAML frontmatter 수정",
      concept_type_missing: "비어 있지 않은 type 추가",
      concept_type_invalid: "type을 문자열로 변경",
      reserved_frontmatter_invalid: "잘못된 YAML frontmatter 수정",
      reserved_frontmatter_not_allowed: "예약 파일에서 frontmatter 제거",
      root_index_version_invalid: "루트 index.md에 okf_version 설정",
      root_index_extra_metadata: "루트 index.md에는 okf_version만 유지",
      unsupported_okf_version: "지원하지 않는 OKF 버전: {{value}}",
      index_structure_invalid: "index에 H1 섹션 추가",
      log_structure_invalid: "log에 H1 제목과 날짜별 H2 항목 추가",
      log_date_invalid: "log 날짜를 YYYY-MM-DD로 변경: {{value}}",
      log_dates_out_of_order: "최신 log 날짜를 먼저 배치",
      nonstandard_markdown_extension: "파일 확장자를 .md로 변경",
      wikilink_syntax: "OKF 이식성을 위해 Markdown 링크 사용",
      okf_01_timestamp_invalid: "timestamp를 ISO 8601 형식으로 변경",
      okf_02_actor_invalid: "OKF actor 형식 사용: {{value}}",
      okf_02_generated_invalid: "generated.by와 generated.at 값 수정",
      okf_02_sources_invalid: "잘못된 sources 메타데이터 수정",
      okf_02_stale_after_invalid: "stale_after를 YYYY-MM-DD로 변경: {{value}}",
      okf_02_status_invalid: "status에 draft, stable 또는 deprecated 사용: {{value}}",
      okf_02_verified_invalid: "verified.by와 verified.at 값 수정",
    },
  },
  ja: {
    open: "ナレッジベースの互換性を確認",
    back: "ワークスペースファイルに戻る",
    title: "ナレッジベースの互換性",
    description: "この Markdown ワークスペースを Open Knowledge Format に照らして確認します。",
    unchanged: "確認自体は読み取り専用です。操作を選んだ場合のみファイルが変更されます。",
    unavailable: "ファイルパスの競合を解消すると確認できます。",
    noDocuments: "確認する Markdown ドキュメントがありません",
    compatible: "OKF {{version}} と互換",
    requiredChange: "必須の変更 {{count}} 件",
    requiredChanges: "必須の変更 {{count}} 件",
    portabilityWarning: "移植性の警告 {{count}} 件",
    portabilityWarnings: "移植性の警告 {{count}} 件",
    requiredSection: "必須の変更",
    warningSection: "移植性の警告",
    openDocument: "{{path}} を開く",
    conceptTypeLabel: "Concept type",
    conceptTypePlaceholder: "policy, runbook, decision",
    conceptTypeHelp: "人と agent が再利用できる一貫した分類を入力してください。",
    addFrontmatterAndType: "Frontmatter と type を追加",
    setConceptType: "Concept type を設定",
    issues: {
      ...advancedIssuesEn,
      concept_frontmatter_missing: "YAML frontmatter を追加",
      concept_frontmatter_invalid: "不正な YAML frontmatter を修正",
      concept_type_missing: "空でない type を追加",
      concept_type_invalid: "type を文字列に変更",
      reserved_frontmatter_invalid: "不正な YAML frontmatter を修正",
      reserved_frontmatter_not_allowed: "予約ファイルから frontmatter を削除",
      root_index_version_invalid: "ルート index.md に okf_version を設定",
      root_index_extra_metadata: "ルート index.md は okf_version のみにする",
      unsupported_okf_version: "未対応の OKF バージョン: {{value}}",
      index_structure_invalid: "index に H1 セクションを追加",
      log_structure_invalid: "log に H1 タイトルと日付別 H2 項目を追加",
      log_date_invalid: "log の日付を YYYY-MM-DD にする: {{value}}",
      log_dates_out_of_order: "最新の log 日付を先頭にする",
      nonstandard_markdown_extension: "拡張子を .md に変更",
      wikilink_syntax: "OKF の移植性のため Markdown リンクを使用",
      okf_01_timestamp_invalid: "timestamp を ISO 8601 形式にする",
      okf_02_actor_invalid: "OKF actor 形式を使用: {{value}}",
      okf_02_generated_invalid: "generated.by と generated.at を修正",
      okf_02_sources_invalid: "不正な sources メタデータを修正",
      okf_02_stale_after_invalid: "stale_after を YYYY-MM-DD にする: {{value}}",
      okf_02_status_invalid: "status は draft、stable、deprecated のいずれかにする: {{value}}",
      okf_02_verified_invalid: "verified.by と verified.at を修正",
    },
  },
  zh: {
    open: "检查知识库兼容性",
    back: "返回工作区文件",
    title: "知识库兼容性",
    description: "按照 Open Knowledge Format 检查此 Markdown 工作区。",
    unchanged: "检查本身为只读；只有选择操作时才会更改文件。",
    unavailable: "解决文件路径冲突后即可运行检查。",
    noDocuments: "没有可检查的 Markdown 文档",
    compatible: "兼容 OKF {{version}}",
    requiredChange: "{{count}} 项必需修改",
    requiredChanges: "{{count}} 项必需修改",
    portabilityWarning: "{{count}} 项可移植性警告",
    portabilityWarnings: "{{count}} 项可移植性警告",
    requiredSection: "必需修改",
    warningSection: "可移植性警告",
    openDocument: "打开 {{path}}",
    conceptTypeLabel: "Concept type",
    conceptTypePlaceholder: "policy, runbook, decision",
    conceptTypeHelp: "请输入可供人员和 agent 重复使用的稳定分类。",
    addFrontmatterAndType: "添加 frontmatter 和 type",
    setConceptType: "设置 concept type",
    issues: {
      ...advancedIssuesEn,
      concept_frontmatter_missing: "添加 YAML frontmatter",
      concept_frontmatter_invalid: "修复无效的 YAML frontmatter",
      concept_type_missing: "添加非空 type",
      concept_type_invalid: "将 type 改为字符串",
      reserved_frontmatter_invalid: "修复无效的 YAML frontmatter",
      reserved_frontmatter_not_allowed: "从保留文件中移除 frontmatter",
      root_index_version_invalid: "在根 index.md 中设置 okf_version",
      root_index_extra_metadata: "根 index.md 中只保留 okf_version",
      unsupported_okf_version: "不支持的 OKF 版本：{{value}}",
      index_structure_invalid: "为 index 添加 H1 章节",
      log_structure_invalid: "为 log 添加 H1 标题和按日期分组的 H2 条目",
      log_date_invalid: "将 log 日期改为 YYYY-MM-DD：{{value}}",
      log_dates_out_of_order: "将最新 log 日期放在最前",
      nonstandard_markdown_extension: "将文件扩展名改为 .md",
      wikilink_syntax: "为确保 OKF 可移植性，请使用 Markdown 链接",
      okf_01_timestamp_invalid: "将 timestamp 改为 ISO 8601 格式",
      okf_02_actor_invalid: "使用 OKF actor 格式：{{value}}",
      okf_02_generated_invalid: "修复 generated.by 和 generated.at",
      okf_02_sources_invalid: "修复无效的 sources 元数据",
      okf_02_stale_after_invalid: "将 stale_after 改为 YYYY-MM-DD：{{value}}",
      okf_02_status_invalid: "status 使用 draft、stable 或 deprecated：{{value}}",
      okf_02_verified_invalid: "修复 verified.by 和 verified.at",
    },
  },
  es: {
    open: "Comprobar compatibilidad de la base de conocimiento",
    back: "Volver a los archivos del espacio",
    title: "Compatibilidad de la base de conocimiento",
    description: "Comprueba este espacio Markdown con Open Knowledge Format.",
    unchanged: "La comprobación es de solo lectura. Los archivos solo cambian al elegir una acción.",
    unavailable: "Resuelve los conflictos de rutas para ejecutar la comprobación.",
    noDocuments: "No hay documentos Markdown que comprobar",
    compatible: "Compatible con OKF {{version}}",
    requiredChange: "{{count}} cambio obligatorio",
    requiredChanges: "{{count}} cambios obligatorios",
    portabilityWarning: "{{count}} aviso de portabilidad",
    portabilityWarnings: "{{count}} avisos de portabilidad",
    requiredSection: "Cambios obligatorios",
    warningSection: "Avisos de portabilidad",
    openDocument: "Abrir {{path}}",
    conceptTypeLabel: "Tipo de concepto",
    conceptTypePlaceholder: "policy, runbook, decision",
    conceptTypeHelp: "Usa una categoría estable que personas y agentes puedan reutilizar.",
    addFrontmatterAndType: "Añadir frontmatter y type",
    setConceptType: "Definir el tipo de concepto",
    issues: {
      ...advancedIssuesEn,
      concept_frontmatter_missing: "Añadir frontmatter YAML",
      concept_frontmatter_invalid: "Corregir el frontmatter YAML no válido",
      concept_type_missing: "Añadir un type no vacío",
      concept_type_invalid: "Convertir type en una cadena",
      reserved_frontmatter_invalid: "Corregir el frontmatter YAML no válido",
      reserved_frontmatter_not_allowed: "Quitar el frontmatter de este archivo reservado",
      root_index_version_invalid: "Definir okf_version en el index.md raíz",
      root_index_extra_metadata: "Conservar solo okf_version en el index.md raíz",
      unsupported_okf_version: "Versión de OKF no compatible: {{value}}",
      index_structure_invalid: "Añadir una sección H1 a este index",
      log_structure_invalid: "Añadir un título H1 y entradas H2 fechadas al log",
      log_date_invalid: "Usar YYYY-MM-DD para la fecha del log: {{value}}",
      log_dates_out_of_order: "Poner primero la fecha más reciente del log",
      nonstandard_markdown_extension: "Cambiar la extensión del archivo a .md",
      wikilink_syntax: "Usar enlaces Markdown para la portabilidad de OKF",
      okf_01_timestamp_invalid: "Usar una marca de tiempo ISO 8601",
      okf_02_actor_invalid: "Usar una identidad de actor OKF: {{value}}",
      okf_02_generated_invalid: "Corregir generated.by y generated.at",
      okf_02_sources_invalid: "Corregir los metadatos sources no válidos",
      okf_02_stale_after_invalid: "Usar YYYY-MM-DD en stale_after: {{value}}",
      okf_02_status_invalid: "Usar draft, stable o deprecated en status: {{value}}",
      okf_02_verified_invalid: "Corregir verified.by y verified.at",
    },
  },
  fr: {
    open: "Vérifier la compatibilité de la base de connaissances",
    back: "Revenir aux fichiers de l’espace",
    title: "Compatibilité de la base de connaissances",
    description: "Vérifie cet espace Markdown selon l’Open Knowledge Format.",
    unchanged: "La vérification est en lecture seule. Les fichiers ne changent que si vous choisissez une action.",
    unavailable: "Résolvez les conflits de chemins pour lancer la vérification.",
    noDocuments: "Aucun document Markdown à vérifier",
    compatible: "Compatible avec OKF {{version}}",
    requiredChange: "{{count}} modification requise",
    requiredChanges: "{{count}} modifications requises",
    portabilityWarning: "{{count}} avertissement de portabilité",
    portabilityWarnings: "{{count}} avertissements de portabilité",
    requiredSection: "Modifications requises",
    warningSection: "Avertissements de portabilité",
    openDocument: "Ouvrir {{path}}",
    conceptTypeLabel: "Type de concept",
    conceptTypePlaceholder: "policy, runbook, decision",
    conceptTypeHelp: "Utilisez une catégorie stable et réutilisable par les personnes et les agents.",
    addFrontmatterAndType: "Ajouter le frontmatter et le type",
    setConceptType: "Définir le type de concept",
    issues: {
      ...advancedIssuesEn,
      concept_frontmatter_missing: "Ajouter un frontmatter YAML",
      concept_frontmatter_invalid: "Corriger le frontmatter YAML invalide",
      concept_type_missing: "Ajouter un type non vide",
      concept_type_invalid: "Définir type comme chaîne",
      reserved_frontmatter_invalid: "Corriger le frontmatter YAML invalide",
      reserved_frontmatter_not_allowed: "Supprimer le frontmatter de ce fichier réservé",
      root_index_version_invalid: "Définir okf_version dans le index.md racine",
      root_index_extra_metadata: "Ne garder que okf_version dans le index.md racine",
      unsupported_okf_version: "Version OKF non prise en charge : {{value}}",
      index_structure_invalid: "Ajouter une section H1 à cet index",
      log_structure_invalid: "Ajouter un titre H1 et des entrées H2 datées au log",
      log_date_invalid: "Utiliser YYYY-MM-DD pour la date du log : {{value}}",
      log_dates_out_of_order: "Placer la date de log la plus récente en premier",
      nonstandard_markdown_extension: "Utiliser l’extension .md pour ce fichier",
      wikilink_syntax: "Utiliser des liens Markdown pour la portabilité OKF",
      okf_01_timestamp_invalid: "Utiliser un horodatage ISO 8601",
      okf_02_actor_invalid: "Utiliser une identité d’acteur OKF : {{value}}",
      okf_02_generated_invalid: "Corriger generated.by et generated.at",
      okf_02_sources_invalid: "Corriger les métadonnées sources invalides",
      okf_02_stale_after_invalid: "Utiliser YYYY-MM-DD pour stale_after : {{value}}",
      okf_02_status_invalid: "Utiliser draft, stable ou deprecated pour status : {{value}}",
      okf_02_verified_invalid: "Corriger verified.by et verified.at",
    },
  },
  de: {
    open: "Kompatibilität der Wissensbasis prüfen",
    back: "Zurück zu den Workspace-Dateien",
    title: "Kompatibilität der Wissensbasis",
    description: "Prüft diesen Markdown-Workspace gegen das Open Knowledge Format.",
    unchanged: "Die Prüfung ist schreibgeschützt. Dateien ändern sich nur nach Auswahl einer Aktion.",
    unavailable: "Lösen Sie Pfadkonflikte, um die Prüfung auszuführen.",
    noDocuments: "Keine Markdown-Dokumente zum Prüfen",
    compatible: "Kompatibel mit OKF {{version}}",
    requiredChange: "{{count}} erforderliche Änderung",
    requiredChanges: "{{count}} erforderliche Änderungen",
    portabilityWarning: "{{count}} Portabilitätswarnung",
    portabilityWarnings: "{{count}} Portabilitätswarnungen",
    requiredSection: "Erforderliche Änderungen",
    warningSection: "Portabilitätswarnungen",
    openDocument: "{{path}} öffnen",
    conceptTypeLabel: "Konzepttyp",
    conceptTypePlaceholder: "policy, runbook, decision",
    conceptTypeHelp: "Verwenden Sie eine stabile Kategorie, die Menschen und Agents wiederverwenden können.",
    addFrontmatterAndType: "Frontmatter und type hinzufügen",
    setConceptType: "Konzepttyp festlegen",
    issues: {
      ...advancedIssuesEn,
      concept_frontmatter_missing: "YAML-Frontmatter hinzufügen",
      concept_frontmatter_invalid: "Ungültiges YAML-Frontmatter korrigieren",
      concept_type_missing: "Einen nicht leeren type hinzufügen",
      concept_type_invalid: "type als Zeichenfolge angeben",
      reserved_frontmatter_invalid: "Ungültiges YAML-Frontmatter korrigieren",
      reserved_frontmatter_not_allowed: "Frontmatter aus dieser reservierten Datei entfernen",
      root_index_version_invalid: "okf_version in der root index.md setzen",
      root_index_extra_metadata: "In der root index.md nur okf_version behalten",
      unsupported_okf_version: "Nicht unterstützte OKF-Version: {{value}}",
      index_structure_invalid: "Diesem index einen H1-Abschnitt hinzufügen",
      log_structure_invalid: "Dem log einen H1-Titel und datierte H2-Einträge hinzufügen",
      log_date_invalid: "Für das log-Datum YYYY-MM-DD verwenden: {{value}}",
      log_dates_out_of_order: "Das neueste log-Datum zuerst setzen",
      nonstandard_markdown_extension: "Die Dateiendung in .md ändern",
      wikilink_syntax: "Für OKF-Portabilität Markdown-Links verwenden",
      okf_01_timestamp_invalid: "Einen ISO-8601-Zeitstempel verwenden",
      okf_02_actor_invalid: "Eine OKF-Akteurkennung verwenden: {{value}}",
      okf_02_generated_invalid: "generated.by und generated.at korrigieren",
      okf_02_sources_invalid: "Ungültige sources-Metadaten korrigieren",
      okf_02_stale_after_invalid: "Für stale_after YYYY-MM-DD verwenden: {{value}}",
      okf_02_status_invalid: "Für status draft, stable oder deprecated verwenden: {{value}}",
      okf_02_verified_invalid: "verified.by und verified.at korrigieren",
    },
  },
};

const formatMessage = (
  template: string,
  values: Record<string, string | number>,
) => Object.entries(values).reduce(
  (result, [key, value]) => result.split(`{{${key}}}`).join(String(value)),
  template,
);

export const getKnowledgeCompatibilityCopy = (
  language: WorkspaceLanguage,
): KnowledgeCompatibilityCopy => {
  const copy = copies[language];
  const actions = actionCopies[language] ?? actionCopies.en;
  const detectionCopy = detectionCopies[language];
  const migrationCopy = migrationCopies[language];
  return {
    open: copy.open,
    back: copy.back,
    title: copy.title,
    description: copy.description,
    unchanged: copy.unchanged,
    unavailable: copy.unavailable,
    noDocuments: copy.noDocuments,
    compatible: (version) => formatMessage(copy.compatible, { version }),
    okfLike: detectionCopy.okfLike,
    markdownOnly: detectionCopy.markdownOnly,
    futureVersion: (version) =>
      formatMessage(detectionCopy.futureVersion, { version }),
    migrationTitle: migrationCopy.title,
    migrationDescription: migrationCopy.description,
    migrationProducer: migrationCopy.producer,
    migrationChangedFiles: (count) =>
      formatMessage(migrationCopy.changedFiles, { count }),
    migrationManualCitations: (count) =>
      formatMessage(migrationCopy.manualCitations, { count }),
    migrationMissingProducers: (count) =>
      formatMessage(migrationCopy.missingProducers, { count }),
    migrationDeletedFiles: (count) =>
      formatMessage(migrationCopy.deletedFiles, { count }),
    migrationDecisions: (count) =>
      formatMessage(migrationCopy.decisions, { count }),
    migrationFile: migrationCopy.file,
    migrationApply: migrationCopy.apply,
    supportCore: migrationCopy.supportCore,
    supportAdvanced: (count) =>
      formatMessage(migrationCopy.supportAdvanced, { count }),
    supportAdvancedPartial: (count, runtimes) =>
      formatMessage(migrationCopy.supportAdvancedPartial, { count, runtimes }),
    requiredChanges: (count) => formatMessage(
      count === 1 ? copy.requiredChange : copy.requiredChanges,
      { count },
    ),
    portabilityWarnings: (count) => formatMessage(
      count === 1 ? copy.portabilityWarning : copy.portabilityWarnings,
      { count },
    ),
    requiredSection: copy.requiredSection,
    warningSection: copy.warningSection,
    openDocument: (path) => formatMessage(copy.openDocument, { path }),
    conceptTypeLabel: copy.conceptTypeLabel,
    conceptTypePlaceholder: copy.conceptTypePlaceholder,
    conceptTypeHelp: copy.conceptTypeHelp,
    addFrontmatterAndType: copy.addFrontmatterAndType,
    setConceptType: copy.setConceptType,
    safeFixes: actions.safeFixes,
    safeFixesDescription: actions.safeFixesDescription,
    includeChange: actions.includeChange,
    suggestedFromFolder: (type) => formatMessage(actions.suggestedFromFolder, { type }),
    suggestedFromPath: (type) => formatMessage(actions.suggestedFromPath, { type }),
    typeDecisionRequired: actions.typeDecisionRequired,
    invalidYamlRequiresManualFix: actions.invalidYamlRequiresManualFix,
    selectedChanges: (count) => formatMessage(actions.selectedChanges, { count }),
    applySelected: actions.applySelected,
    before: actions.before,
    after: actions.after,
    planChanged: actions.planChanged,
    portableLinks: actions.portableLinks,
    portableLinksDescription: actions.portableLinksDescription,
    convertibleLinks: (count) => formatMessage(actions.convertibleLinks, { count }),
    skippedLinks: (count) => formatMessage(actions.skippedLinks, { count }),
    markdownLinks: actions.markdownLinks,
    convertSelected: actions.convertSelected,
    metadataGuidance: actions.metadataGuidance,
    metadataGuidanceDescription: actions.metadataGuidanceDescription,
    metadataFields: actions.metadataFields,
    indexes: actions.indexes,
    indexesDescription: actions.indexesDescription,
    indexStates: actions.indexStates,
    indexContents: (conceptCount, directoryCount) =>
      language === "ko"
        ? formatMessage(actions.indexContents, { conceptCount, directoryCount })
        : `${conceptCount} ${conceptCount === 1 ? "file" : "files"}, ${
            directoryCount
          } ${directoryCount === 1 ? "directory" : "directories"}`,
    generatedCandidate: actions.generatedCandidate,
    currentIndex: actions.currentIndex,
    createIndex: actions.createIndex,
    updateGeneratedIndex: actions.updateGeneratedIndex,
    replaceCuratedIndex: actions.replaceCuratedIndex,
    replaceCuratedWarning: actions.replaceCuratedWarning,
    confirmReplace: actions.confirmReplace,
    cancel: actions.cancel,
    upToDate: actions.upToDate,
    healthTitle: actions.healthTitle,
    healthDescription: actions.healthDescription,
    healthHealthy: actions.healthHealthy,
    healthAttention: (count) => formatMessage(actions.healthAttention, { count }),
    healthNotices: (count) => formatMessage(actions.healthNotices, { count }),
    healthAttentionSection: actions.healthAttentionSection,
    healthNoticeSection: actions.healthNoticeSection,
    healthIssue: (issue) => formatMessage(actions.healthIssues[issue.code], {
      value: issue.value ?? "",
    }),
    verificationReview: actions.verificationReview,
    verificationReviewDescription: actions.verificationReviewDescription,
    generatedBy: actions.generatedBy,
    generatedAt: actions.generatedAt,
    latestVerification: actions.latestVerification,
    unknownActor: actions.unknownActor,
    unknownDate: actions.unknownDate,
    evidence: actions.evidence,
    verificationNeedsEvidence: actions.verificationNeedsEvidence,
    verificationAttestation: actions.verificationAttestation,
    changesSinceTracking: actions.changesSinceTracking,
    noTrackedChanges: actions.noTrackedChanges,
    trackingRequiredForDiff: actions.trackingRequiredForDiff,
    openDocumentAction: actions.openDocumentAction,
    recordVerification: (name) => formatMessage(actions.recordVerification, { name }),
    verificationFailed: actions.verificationFailed,
    knowledgeChanges: actions.knowledgeChanges,
    knowledgeChangesDescription: actions.knowledgeChangesDescription,
    knowledgeChangesNotTracked: actions.knowledgeChangesNotTracked,
    startTracking: actions.startTracking,
    noKnowledgeChanges: actions.noKnowledgeChanges,
    trackingSince: (capturedAt) => formatMessage(actions.trackingSince, {
      date: capturedAt.slice(0, 10),
    }),
    changeSummary: (added, modified, deleted) => formatMessage(
      actions.changeSummary,
      { added, modified, deleted },
    ),
    changeKinds: actions.changeKinds,
    currentLog: actions.currentLog,
    generatedLog: actions.generatedLog,
    createLog: actions.createLog,
    updateLog: actions.updateLog,
    logBlocked: actions.logBlocked,
    maintenanceImpact: actions.maintenanceImpact,
    maintenanceImpactSummary: (introduced, resolved) => formatMessage(
      actions.maintenanceImpactSummary,
      { introduced, resolved },
    ),
    noMaintenanceImpact: actions.noMaintenanceImpact,
    introducedMaintenance: actions.introducedMaintenance,
    resolvedMaintenance: actions.resolvedMaintenance,
    issue: (issue) => formatMessage(copy.issues[issue.code], {
      value: issue.value ?? "",
    }),
  };
};
