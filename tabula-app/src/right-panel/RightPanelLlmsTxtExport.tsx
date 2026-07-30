import {
  planLlmsTxtExport,
  type WorkspaceKnowledgeIndex,
} from "@tabula-md/tabula";
import { Check, Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { KnowledgeCompatibilityCopy } from "../workspace/knowledgeCompatibilityLocale";

const isPrivateDocument = (
  index: WorkspaceKnowledgeIndex,
  documentId: string,
) => {
  const metadata = index.analysesByDocumentId.get(documentId)?.metadata;
  const tags = Array.isArray(metadata?.tags) ? metadata.tags : [];
  return metadata?.visibility === "private"
    || metadata?.private === true
    || tags.some((tag) =>
      typeof tag === "string" && tag.toLowerCase() === "private"
    );
};

const isDeliveryDocument = (path: string) => {
  const basename = path.split("/").at(-1)?.toLowerCase() ?? "";
  return !["agents.md", "claude.md", "index.md", "log.md", "skill.md"]
    .includes(basename);
};

export function RightPanelLlmsTxtExport({
  copy,
  index,
}: {
  copy: KnowledgeCompatibilityCopy;
  index: WorkspaceKnowledgeIndex;
}) {
  const documents = useMemo(
    () => [...index.documentsById.values()]
      .filter((document) => isDeliveryDocument(document.path))
      .sort((first, second) => first.path.localeCompare(second.path)),
    [index],
  );
  const signature = documents.map((document) => document.id).join("|");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(
      documents
        .filter((document) => !isPrivateDocument(index, document.id))
        .map((document) => document.id),
    ),
  );
  const [optionalIds, setOptionalIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const documentIds = new Set(documents.map((document) => document.id));
    setSelectedIds((current) => new Set(
      [...current].filter((documentId) => documentIds.has(documentId)),
    ));
    setOptionalIds((current) => new Set(
      [...current].filter((documentId) => documentIds.has(documentId)),
    ));
  }, [signature]);

  if (documents.length === 0) return null;
  const selected = [...selectedIds];
  const candidate = planLlmsTxtExport(index, {
    title: "Knowledge workspace",
    summary: "Curated Markdown documents for people and language models.",
    includePrivateDocumentIds: selected.filter((documentId) =>
      isPrivateDocument(index, documentId)
    ),
    sections: [
      {
        heading: "Docs",
        documentIds: selected.filter((documentId) => !optionalIds.has(documentId)),
      },
      {
        heading: "Optional",
        optional: true,
        documentIds: selected.filter((documentId) => optionalIds.has(documentId)),
      },
    ],
  });
  const excludedPrivateCount = documents.filter((document) =>
    isPrivateDocument(index, document.id) && !selectedIds.has(document.id)
  ).length;

  return (
    <section className="right-compatibility-repair-section" aria-label={copy.llmsTitle}>
      <div className="right-compatibility-section-copy">
        <h3>{copy.llmsTitle}</h3>
        <p>{copy.llmsDescription}</p>
      </div>
      <div className="right-llms-document-list">
        {documents.map((document) => {
          const selected = selectedIds.has(document.id);
          const optional = optionalIds.has(document.id);
          const privateDocument = isPrivateDocument(index, document.id);
          return (
            <div className="right-llms-document-row" key={document.id}>
              <button
                className={`right-compatibility-repair-check ${selected ? "selected" : ""}`}
                type="button"
                role="checkbox"
                aria-checked={selected}
                aria-label={`${copy.includeChange}: ${document.path}`}
                onClick={() => {
                  setSelectedIds((current) => {
                    const next = new Set(current);
                    if (next.has(document.id)) next.delete(document.id);
                    else next.add(document.id);
                    return next;
                  });
                }}
              >
                {selected && <Check size={13} aria-hidden="true" />}
              </button>
              <span>
                <strong>{index.analysesByDocumentId.get(document.id)?.title}</strong>
                <small>
                  {document.path}
                  {privateDocument ? " · private" : ""}
                </small>
              </span>
              <button
                className={optional ? "active" : ""}
                type="button"
                aria-pressed={optional}
                disabled={!selected}
                onClick={() => {
                  setOptionalIds((current) => {
                    const next = new Set(current);
                    if (next.has(document.id)) next.delete(document.id);
                    else next.add(document.id);
                    return next;
                  });
                }}
              >
                {copy.llmsOptional}
              </button>
            </div>
          );
        })}
      </div>
      <div className="right-compatibility-migration-summary" role="status">
        <span>{copy.llmsIncluded(candidate.includedDocumentIds.length)}</span>
        <span>{copy.llmsPrivateExcluded(excludedPrivateCount)}</span>
      </div>
      <div className="right-compatibility-diff">
        <div className="right-compatibility-diff-header">
          <span>{copy.llmsPreview}</span>
          <span>llms.txt</span>
        </div>
        <pre className="right-llms-preview">{candidate.markdown}</pre>
      </div>
      <div className="right-compatibility-apply-row">
        <span>{copy.llmsIncluded(candidate.includedDocumentIds.length)}</span>
        <button
          type="button"
          disabled={candidate.includedDocumentIds.length === 0}
          onClick={() => {
            const url = URL.createObjectURL(new Blob(
              [candidate.markdown],
              { type: "text/plain;charset=utf-8" },
            ));
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = "llms.txt";
            anchor.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download size={14} aria-hidden="true" />
          {copy.llmsDownload}
        </button>
      </div>
    </section>
  );
}
