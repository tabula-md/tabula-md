import { inspectFrontmatterData } from "./markdown/parse";
import type { WorkspaceKnowledgeIndex } from "./workspaceKnowledgeIndex";
import { isOkfActor } from "./workspaceOkfVersionAdapters";

export type OkfAdvancedSupportLevel =
  | "core"
  | "advanced"
  | "advanced-partial";

export type OkfAdvancedDiagnosticCode =
  | "okf_02_attester_invalid"
  | "okf_02_attester_resource_missing"
  | "okf_02_computation_missing"
  | "okf_02_computation_resource_missing"
  | "okf_02_executor_invalid"
  | "okf_02_executor_resource_missing"
  | "okf_02_parameter_duplicate"
  | "okf_02_parameters_invalid"
  | "okf_02_receipt_empty"
  | "okf_02_runtime_missing"
  | "okf_02_runtime_unsupported"
  | "okf_02_source_author_invalid"
  | "okf_02_stale_computation_in_use"
  | "okf_02_usage_window_invalid"
  | "okf_02_usage_window_missing";

export type OkfAdvancedDiagnostic = {
  code: OkfAdvancedDiagnosticCode;
  severity: "warning";
  documentId: string;
  path: string;
  value?: string;
};

export type OkfAdvancedSupportSummary = {
  level: OkfAdvancedSupportLevel;
  attestedComputationCount: number;
  supportedComputationCount: number;
  unsupportedComputationCount: number;
  unsupportedRuntimes: readonly string[];
};

export type OkfAdvancedContractReport = {
  diagnostics: readonly OkfAdvancedDiagnostic[];
  support: OkfAdvancedSupportSummary;
};

export type OkfAdvancedContractOptions = {
  availablePaths?: readonly string[];
  today?: string;
};

const SUPPORTED_RUNTIMES = new Set([
  "bigquery",
  "dbt",
  "looker",
  "postgres",
  "python",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const getText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const isIsoDate = (value: unknown) => {
  const text = getText(value);
  if (!text || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === text;
};

const isUsageWindow = (value: unknown) =>
  isRecord(value)
  && isIsoDate(value.from)
  && isIsoDate(value.to)
  && String(value.from) <= String(value.to);

const isExternalResource = (value: string) =>
  /^[a-z][a-z0-9+.-]*:/i.test(value);

const resolveResourcePath = (sourcePath: string, resource: string) => {
  if (isExternalResource(resource)) return null;
  const sourceDirectory = sourcePath.split("/").slice(0, -1);
  const segments = resource.startsWith("/")
    ? []
    : [...sourceDirectory];
  for (const segment of resource.replace(/^\/+/, "").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") {
      if (segments.length === 0) return undefined;
      segments.pop();
    } else {
      segments.push(segment);
    }
  }
  return segments.join("/");
};

const hasInlineComputation = (body: string) => {
  const heading = /^#\s+Computation\s*$/im.exec(body);
  if (!heading) return false;
  const contentStart = heading.index + heading[0].length;
  const nextHeading = /^#\s+/m.exec(body.slice(contentStart));
  const section = body.slice(
    contentStart,
    nextHeading ? contentStart + nextHeading.index : undefined,
  );
  return /(?:^|\n)(?:```|~~~| {4}\S)/.test(section);
};

const createDiagnostic = (
  documentId: string,
  path: string,
  code: OkfAdvancedDiagnosticCode,
  value?: string,
): OkfAdvancedDiagnostic => ({
  code,
  severity: "warning",
  documentId,
  path,
  ...(value ? { value } : {}),
});

const resourceExists = (
  sourcePath: string,
  resource: unknown,
  availablePaths: ReadonlySet<string>,
) => {
  const text = getText(resource);
  if (!text) return false;
  const resolved = resolveResourcePath(sourcePath, text);
  return resolved === null || (typeof resolved === "string" && availablePaths.has(resolved));
};

export const validateOkf02AdvancedContracts = (
  index: WorkspaceKnowledgeIndex,
  options: OkfAdvancedContractOptions = {},
): OkfAdvancedContractReport => {
  const availablePaths = new Set(
    options.availablePaths ?? [...index.documentsById.values()].map(
      (document) => document.path,
    ),
  );
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const diagnostics: OkfAdvancedDiagnostic[] = [];
  const unsupportedRuntimes = new Set<string>();
  let attestedComputationCount = 0;
  let supportedComputationCount = 0;

  for (const document of index.documentsById.values()) {
    const inspection = inspectFrontmatterData(document.markdown);
    if (inspection.status !== "valid") continue;
    const { metadata } = inspection;

    if (
      typeof metadata.usage_window !== "undefined"
      && !isUsageWindow(metadata.usage_window)
    ) {
      diagnostics.push(createDiagnostic(
        document.id,
        document.path,
        "okf_02_usage_window_invalid",
      ));
    }
    if (Array.isArray(metadata.sources)) {
      for (const source of metadata.sources) {
        if (!isRecord(source)) continue;
        if (typeof source.author !== "undefined" && !isOkfActor(source.author)) {
          diagnostics.push(createDiagnostic(
            document.id,
            document.path,
            "okf_02_source_author_invalid",
            String(source.author),
          ));
        }
        if (
          typeof source.usage_window !== "undefined"
          && !isUsageWindow(source.usage_window)
        ) {
          diagnostics.push(createDiagnostic(
            document.id,
            document.path,
            "okf_02_usage_window_invalid",
          ));
        }
        if (
          typeof source.usage_count !== "undefined"
          && typeof source.usage_window === "undefined"
          && typeof metadata.usage_window === "undefined"
        ) {
          diagnostics.push(createDiagnostic(
            document.id,
            document.path,
            "okf_02_usage_window_missing",
          ));
        }
      }
    }

    if (metadata.type !== "Attested Computation") continue;
    attestedComputationCount += 1;
    const runtime = getText(metadata.runtime);
    if (!runtime) {
      diagnostics.push(createDiagnostic(
        document.id,
        document.path,
        "okf_02_runtime_missing",
      ));
    } else if (!SUPPORTED_RUNTIMES.has(runtime.toLowerCase())) {
      unsupportedRuntimes.add(runtime);
      diagnostics.push(createDiagnostic(
        document.id,
        document.path,
        "okf_02_runtime_unsupported",
        runtime,
      ));
    } else {
      supportedComputationCount += 1;
    }

    if (typeof metadata.parameters !== "undefined") {
      if (
        !Array.isArray(metadata.parameters)
        || !metadata.parameters.every((parameter) =>
          isRecord(parameter)
          && Boolean(getText(parameter.name))
          && Boolean(getText(parameter.type))
          && typeof parameter.required === "boolean"
        )
      ) {
        diagnostics.push(createDiagnostic(
          document.id,
          document.path,
          "okf_02_parameters_invalid",
        ));
      } else {
        const names = metadata.parameters.map((parameter) =>
          getText((parameter as Record<string, unknown>).name)!
        );
        const duplicate = names.find((name, index) => names.indexOf(name) !== index);
        if (duplicate) {
          diagnostics.push(createDiagnostic(
            document.id,
            document.path,
            "okf_02_parameter_duplicate",
            duplicate,
          ));
        }
      }
    }

    if (typeof metadata.computation !== "undefined") {
      if (!resourceExists(document.path, metadata.computation, availablePaths)) {
        diagnostics.push(createDiagnostic(
          document.id,
          document.path,
          "okf_02_computation_resource_missing",
          String(metadata.computation),
        ));
      }
    } else if (!hasInlineComputation(inspection.body)) {
      diagnostics.push(createDiagnostic(
        document.id,
        document.path,
        "okf_02_computation_missing",
      ));
    }

    if (typeof metadata.executor !== "undefined") {
      if (!isRecord(metadata.executor) || !getText(metadata.executor.resource)) {
        diagnostics.push(createDiagnostic(
          document.id,
          document.path,
          "okf_02_executor_invalid",
        ));
      } else if (
        !resourceExists(document.path, metadata.executor.resource, availablePaths)
      ) {
        diagnostics.push(createDiagnostic(
          document.id,
          document.path,
          "okf_02_executor_resource_missing",
          String(metadata.executor.resource),
        ));
      }
      if (
        !isRecord(metadata.executor)
        || !Array.isArray(metadata.executor.receipt)
        || metadata.executor.receipt.length === 0
        || !metadata.executor.receipt.every((field) => Boolean(getText(field)))
      ) {
        diagnostics.push(createDiagnostic(
          document.id,
          document.path,
          "okf_02_receipt_empty",
        ));
      }
    }

    if (typeof metadata.attester !== "undefined") {
      if (!isRecord(metadata.attester) || !getText(metadata.attester.resource)) {
        diagnostics.push(createDiagnostic(
          document.id,
          document.path,
          "okf_02_attester_invalid",
        ));
      } else if (
        !resourceExists(document.path, metadata.attester.resource, availablePaths)
      ) {
        diagnostics.push(createDiagnostic(
          document.id,
          document.path,
          "okf_02_attester_resource_missing",
          String(metadata.attester.resource),
        ));
      }
    }

    if (
      isIsoDate(metadata.stale_after)
      && String(metadata.stale_after) <= today
    ) {
      const consumerCount = index.backlinksByDocumentId.get(document.id)?.length ?? 0;
      if (consumerCount > 0) {
        diagnostics.push(createDiagnostic(
          document.id,
          document.path,
          "okf_02_stale_computation_in_use",
          String(consumerCount),
        ));
      }
    }
  }

  const unsupportedComputationCount =
    attestedComputationCount - supportedComputationCount;
  return {
    diagnostics,
    support: {
      level: attestedComputationCount === 0
        ? "core"
        : unsupportedComputationCount > 0
          ? "advanced-partial"
          : "advanced",
      attestedComputationCount,
      supportedComputationCount,
      unsupportedComputationCount,
      unsupportedRuntimes: [...unsupportedRuntimes].sort(),
    },
  };
};
