import {
  exportWorkspaceJsonLd,
  exportWorkspaceSkosConceptScheme,
  previewJsonLdImport,
  type JsonLdImportPreview,
  type KnowledgeInterchangeExport,
  type WorkspaceKnowledgeIndex,
} from "@tabula-md/tabula";
import { Download, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import type { KnowledgeCompatibilityCopy } from "../workspace/knowledgeCompatibilityLocale";

const createExport = (
  index: WorkspaceKnowledgeIndex,
  baseIri: string,
  format: "json-ld" | "skos",
) => {
  if (!baseIri.trim()) return null;
  try {
    return format === "skos"
      ? exportWorkspaceSkosConceptScheme(index, { baseIri })
      : exportWorkspaceJsonLd(index, { baseIri });
  } catch {
    return null;
  }
};

const downloadExport = (
  result: KnowledgeInterchangeExport,
  filename: string,
) => {
  const url = URL.createObjectURL(new Blob(
    [result.json],
    { type: `${result.mediaType};charset=utf-8` },
  ));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export function RightPanelKnowledgeInterchange({
  copy,
  index,
}: {
  copy: KnowledgeCompatibilityCopy;
  index: WorkspaceKnowledgeIndex;
}) {
  const [baseIri, setBaseIri] = useState("");
  const [format, setFormat] = useState<"json-ld" | "skos">("json-ld");
  const [importPreview, setImportPreview] =
    useState<JsonLdImportPreview | null>(null);
  const result = useMemo(
    () => createExport(index, baseIri, format),
    [baseIri, format, index],
  );

  return (
    <section
      className="right-compatibility-repair-section"
      aria-label={copy.interchangeTitle}
    >
      <div className="right-compatibility-section-copy">
        <h3>{copy.interchangeTitle}</h3>
        <p>{copy.interchangeDescription}</p>
      </div>
      <label className="right-interchange-base">
        <span>{copy.interchangeBaseIri}</span>
        <input
          type="url"
          value={baseIri}
          placeholder="https://example.com/knowledge/"
          spellCheck={false}
          onChange={(event) => setBaseIri(event.target.value)}
        />
      </label>
      <div
        className="right-interchange-formats"
        role="group"
        aria-label={copy.interchangeFormat}
      >
        <button
          className={format === "json-ld" ? "active" : ""}
          type="button"
          aria-pressed={format === "json-ld"}
          onClick={() => setFormat("json-ld")}
        >
          JSON-LD
        </button>
        <button
          className={format === "skos" ? "active" : ""}
          type="button"
          aria-pressed={format === "skos"}
          onClick={() => setFormat("skos")}
        >
          SKOS
        </button>
      </div>
      <div className="right-compatibility-migration-summary" role="status">
        <span>
          {copy.interchangeMapped(result?.mappings.length ?? 0)}
        </span>
        <span>
          {copy.interchangeLosses(result?.losses.length ?? 0)}
        </span>
      </div>
      {result && (
        <div className="right-interchange-preview">
          {result.mappings.slice(0, 4).map((mapping) => (
            <small key={mapping.documentId}>
              {mapping.path} → {mapping.canonicalIri}
            </small>
          ))}
          {[...new Set(result.losses.map((loss) => loss.code))]
            .slice(0, 4)
            .map((code) => (
              <small className="loss" key={code}>
                {code.replaceAll("_", " ")}
              </small>
            ))}
        </div>
      )}
      <div className="right-compatibility-apply-row">
        <span>
          {result
            ? copy.interchangePartial
            : copy.interchangeBaseRequired}
        </span>
        <button
          type="button"
          disabled={!result}
          onClick={() => {
            if (!result) return;
            downloadExport(
              result,
              format === "skos"
                ? "knowledge.skos.jsonld"
                : "knowledge.jsonld",
            );
          }}
        >
          <Download size={14} aria-hidden="true" />
          {copy.interchangeDownload}
        </button>
      </div>
      <div className="right-interchange-import">
        <div>
          <strong>{copy.interchangeImport}</strong>
          <small>{copy.interchangeImportDescription}</small>
        </div>
        <label className="right-interchange-upload">
          <Upload size={14} aria-hidden="true" />
          {copy.interchangeChooseFile}
          <input
            type="file"
            accept=".json,.jsonld,application/json,application/ld+json"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) {
                setImportPreview(null);
                return;
              }
              void file.text().then((source) => {
                setImportPreview(previewJsonLdImport(source));
              }).catch(() => {
                setImportPreview(previewJsonLdImport("{"));
              });
            }}
          />
        </label>
      </div>
      {importPreview && (
        <div className="right-interchange-preview" role="status">
          <strong>
            {importPreview.valid
              ? copy.interchangeImportMapped(importPreview.candidates.length)
              : copy.interchangeImportInvalid}
          </strong>
          <span>{copy.interchangeLosses(importPreview.losses.length)}</span>
          {importPreview.candidates.slice(0, 5).map((candidate) => (
            <small key={candidate.sourceNodeId}>
              {candidate.proposedPath} ← {candidate.sourceNodeId}
            </small>
          ))}
          <p>{copy.interchangeNoWrite}</p>
        </div>
      )}
    </section>
  );
}
