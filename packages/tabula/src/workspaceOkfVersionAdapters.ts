import { inspectFrontmatterData } from "./markdown/parse";
import type { WorkspaceArtifact } from "./workspaceArtifact";
import type {
  WorkspaceKnowledgeIndex,
  WorkspaceSourceDocument,
} from "./workspaceKnowledgeIndex";

export type OkfVersion = "0.1" | "0.2";
export type OkfBundleDetectionKind =
  | "declared"
  | "future"
  | "none"
  | "okf-like";

export type OkfVersionDetection = {
  kind: OkfBundleDetectionKind;
  declaredVersion?: string;
  version?: OkfVersion;
};

export type WorkspaceInspection = {
  index: WorkspaceKnowledgeIndex;
  documents: readonly WorkspaceSourceDocument[];
};

export type OkfVersionDiagnosticSeverity = "error" | "warning";
export type OkfVersionDiagnosticCode =
  | "okf_01_timestamp_invalid"
  | "okf_02_actor_invalid"
  | "okf_02_generated_invalid"
  | "okf_02_sources_invalid"
  | "okf_02_stale_after_invalid"
  | "okf_02_status_invalid"
  | "okf_02_verified_invalid";

export type OkfVersionDiagnostic = {
  code: OkfVersionDiagnosticCode;
  severity: OkfVersionDiagnosticSeverity;
  documentId: string;
  path: string;
  value?: string;
};

export type OkfSourceFootnoteLink = {
  sourceId: string;
  referenceCount: number;
  definitionPresent: boolean;
};

export type OkfConceptModel = {
  documentId: string;
  path: string;
  version: OkfVersion;
  metadata: Readonly<Record<string, unknown>>;
  unknownMetadataKeys: readonly string[];
  hasCitationsSection: boolean;
  sourceFootnoteLinks: readonly OkfSourceFootnoteLink[];
};

export type OkfVersionReport = {
  version: OkfVersion;
  diagnostics: readonly OkfVersionDiagnostic[];
  concepts: readonly OkfConceptModel[];
};

export interface OkfVersionAdapter {
  version: OkfVersion;
  detect(bundle: WorkspaceInspection): OkfVersionDetection;
  validate(bundle: WorkspaceInspection): OkfVersionReport;
  inspect(document: WorkspaceArtifact): OkfConceptModel;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const getText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const isIsoDate = (value: string) => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

const isIsoTimestamp = (value: string) =>
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && !Number.isNaN(Date.parse(value));

export const isOkfActor = (value: unknown) => {
  const actor = getText(value);
  if (!actor || /\s/.test(actor)) return false;
  if (/^(?:human|process):[^:]+$/.test(actor)) return true;
  return /^[^/]+\/[^/]+$/.test(actor);
};

const getDeclaredVersion = (bundle: WorkspaceInspection) => {
  const rootIndex = bundle.documents.find((document) => document.path === "index.md");
  if (!rootIndex) return undefined;
  const inspection = inspectFrontmatterData(rootIndex.markdown);
  if (inspection.status !== "valid") return undefined;
  return getText(inspection.metadata.okf_version);
};

const getDetection = (
  bundle: WorkspaceInspection,
  version: OkfVersion,
): OkfVersionDetection => {
  const declaredVersion = getDeclaredVersion(bundle);
  return declaredVersion === version
    ? { kind: "declared", declaredVersion, version }
    : declaredVersion
      ? { kind: "future", declaredVersion }
      : { kind: "none" };
};

const getFootnoteLinks = (
  body: string,
  metadata: Readonly<Record<string, unknown>>,
): OkfSourceFootnoteLink[] => {
  const sourceIds = Array.isArray(metadata.sources)
    ? metadata.sources.flatMap((source) => {
        const id = isRecord(source) ? getText(source.id) : undefined;
        return id ? [id] : [];
      })
    : [];
  return sourceIds.map((sourceId) => {
    const escapedId = sourceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const references = body.match(new RegExp(`\\[\\^${escapedId}\\](?!:)`, "g")) ?? [];
    return {
      sourceId,
      referenceCount: references.length,
      definitionPresent: new RegExp(`^\\[\\^${escapedId}\\]:`, "m").test(body),
    };
  });
};

const inspectConcept = (
  version: OkfVersion,
  documentId: string,
  path: string,
  markdown: string,
  knownMetadataKeys: ReadonlySet<string>,
): OkfConceptModel => {
  const inspection = inspectFrontmatterData(markdown);
  const metadata = inspection.status === "valid" ? inspection.metadata : {};
  const body = inspection.status === "valid" ? inspection.body : markdown;
  return {
    documentId,
    path,
    version,
    metadata,
    unknownMetadataKeys: Object.keys(metadata)
      .filter((key) => !knownMetadataKeys.has(key))
      .sort(),
    hasCitationsSection: /^#\s+Citations\s*$/im.test(body),
    sourceFootnoteLinks: getFootnoteLinks(body, metadata),
  };
};

const artifactText = (artifact: WorkspaceArtifact) =>
  artifact.content.kind === "text" ? artifact.content.text : "";

const createDiagnostic = (
  document: WorkspaceSourceDocument,
  code: OkfVersionDiagnosticCode,
  value?: string,
): OkfVersionDiagnostic => ({
  code,
  severity: "warning",
  documentId: document.id,
  path: document.path,
  ...(value ? { value } : {}),
});

const OKF_01_KEYS = new Set([
  "description",
  "resource",
  "tags",
  "timestamp",
  "title",
  "type",
]);

const OKF_02_KEYS = new Set([
  "attester",
  "computation",
  "description",
  "executor",
  "generated",
  "parameters",
  "resource",
  "runtime",
  "sources",
  "stale_after",
  "status",
  "tags",
  "title",
  "type",
  "usage_window",
  "verified",
]);

const getConceptDocuments = (bundle: WorkspaceInspection) =>
  bundle.documents.filter((document) => {
    const basename = document.path.split("/").at(-1);
    return document.path.endsWith(".md")
      && basename !== "index.md"
      && basename !== "log.md";
  });

const validateActorEvent = (value: unknown) =>
  isRecord(value)
  && isOkfActor(value.by)
  && Boolean(getText(value.at) && isIsoTimestamp(getText(value.at)!));

const validateSources = (value: unknown) =>
  Array.isArray(value)
  && value.every((source) =>
    isRecord(source)
    && Boolean(getText(source.resource))
    && (typeof source.id === "undefined" || Boolean(getText(source.id)))
    && (
      typeof source.usage_count === "undefined"
      || (
        typeof source.usage_count === "number"
        && Number.isFinite(source.usage_count)
        && source.usage_count >= 0
      )
    )
    && (
      typeof source.last_modified === "undefined"
      || Boolean(getText(source.last_modified) && isIsoDate(getText(source.last_modified)!))
    )
    && (typeof source.author === "undefined" || isOkfActor(source.author))
  );

const okf01Adapter: OkfVersionAdapter = {
  version: "0.1",
  detect: (bundle) => getDetection(bundle, "0.1"),
  inspect: (artifact) => inspectConcept(
    "0.1",
    artifact.id,
    artifact.path,
    artifactText(artifact),
    OKF_01_KEYS,
  ),
  validate: (bundle) => {
    const diagnostics: OkfVersionDiagnostic[] = [];
    const concepts = getConceptDocuments(bundle).map((document) => {
      const inspection = inspectFrontmatterData(document.markdown);
      if (
        inspection.status === "valid"
        && typeof inspection.metadata.timestamp !== "undefined"
      ) {
        const timestamp = getText(inspection.metadata.timestamp);
        if (!timestamp || !isIsoTimestamp(timestamp)) {
          diagnostics.push(createDiagnostic(
            document,
            "okf_01_timestamp_invalid",
            String(inspection.metadata.timestamp),
          ));
        }
      }
      return inspectConcept(
        "0.1",
        document.id,
        document.path,
        document.markdown,
        OKF_01_KEYS,
      );
    });
    return { version: "0.1", diagnostics, concepts };
  },
};

const okf02Adapter: OkfVersionAdapter = {
  version: "0.2",
  detect: (bundle) => getDetection(bundle, "0.2"),
  inspect: (artifact) => inspectConcept(
    "0.2",
    artifact.id,
    artifact.path,
    artifactText(artifact),
    OKF_02_KEYS,
  ),
  validate: (bundle) => {
    const diagnostics: OkfVersionDiagnostic[] = [];
    const concepts = getConceptDocuments(bundle).map((document) => {
      const inspection = inspectFrontmatterData(document.markdown);
      if (inspection.status !== "valid") {
        return inspectConcept(
          "0.2",
          document.id,
          document.path,
          document.markdown,
          OKF_02_KEYS,
        );
      }
      const { metadata } = inspection;
      if (
        typeof metadata.generated !== "undefined"
        && !validateActorEvent(metadata.generated)
      ) {
        diagnostics.push(createDiagnostic(document, "okf_02_generated_invalid"));
      }
      if (isRecord(metadata.generated) && !isOkfActor(metadata.generated.by)) {
        diagnostics.push(createDiagnostic(
          document,
          "okf_02_actor_invalid",
          String(metadata.generated.by ?? ""),
        ));
      }
      if (typeof metadata.verified !== "undefined") {
        const values = Array.isArray(metadata.verified)
          ? metadata.verified
          : [metadata.verified];
        if (values.length === 0 || !values.every(validateActorEvent)) {
          diagnostics.push(createDiagnostic(document, "okf_02_verified_invalid"));
        }
        for (const value of values) {
          if (isRecord(value) && !isOkfActor(value.by)) {
            diagnostics.push(createDiagnostic(
              document,
              "okf_02_actor_invalid",
              String(value.by ?? ""),
            ));
          }
        }
      }
      if (
        typeof metadata.sources !== "undefined"
        && !validateSources(metadata.sources)
      ) {
        diagnostics.push(createDiagnostic(document, "okf_02_sources_invalid"));
      }
      if (
        typeof metadata.status !== "undefined"
        && !["draft", "stable", "deprecated"].includes(String(metadata.status))
      ) {
        diagnostics.push(createDiagnostic(
          document,
          "okf_02_status_invalid",
          String(metadata.status),
        ));
      }
      if (typeof metadata.stale_after !== "undefined") {
        const staleAfter = getText(metadata.stale_after);
        if (!staleAfter || !isIsoDate(staleAfter)) {
          diagnostics.push(createDiagnostic(
            document,
            "okf_02_stale_after_invalid",
            String(metadata.stale_after),
          ));
        }
      }
      return inspectConcept(
        "0.2",
        document.id,
        document.path,
        document.markdown,
        OKF_02_KEYS,
      );
    });
    return { version: "0.2", diagnostics, concepts };
  },
};

export const OKF_VERSION_ADAPTERS = Object.freeze([
  okf01Adapter,
  okf02Adapter,
] as const);

export const createWorkspaceOkfInspection = (
  index: WorkspaceKnowledgeIndex,
): WorkspaceInspection => ({
  index,
  documents: [...index.documentsById.values()],
});

export const detectWorkspaceOkfVersion = (
  bundle: WorkspaceInspection,
): OkfVersionDetection => {
  const declaredVersion = getDeclaredVersion(bundle);
  if (declaredVersion) {
    const adapter = OKF_VERSION_ADAPTERS.find(
      (candidate) => candidate.version === declaredVersion,
    );
    return adapter
      ? { kind: "declared", declaredVersion, version: adapter.version }
      : { kind: "future", declaredVersion };
  }
  const okfLike = bundle.documents.some((document) => {
    const basename = document.path.split("/").at(-1);
    if (basename === "index.md" || basename === "log.md") return false;
    const inspection = inspectFrontmatterData(document.markdown);
    return inspection.status === "valid"
      && ["type", "timestamp", "generated", "verified", "sources"]
        .some((key) => typeof inspection.metadata[key] !== "undefined");
  });
  return { kind: okfLike ? "okf-like" : "none" };
};

export const getOkfVersionAdapter = (
  version: string | undefined,
): OkfVersionAdapter | undefined =>
  OKF_VERSION_ADAPTERS.find((adapter) => adapter.version === version);
