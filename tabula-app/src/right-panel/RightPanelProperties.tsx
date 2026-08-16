import type { WorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import type { ReactNode } from "react";
import { PanelEmptyState } from "./PanelEmptyState";

const formatValue = (value: unknown): ReactNode => {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (Array.isArray(value)) {
    return value.length ? value.map((item) => formatValue(item)).join(", ") : "—";
  }
  if (typeof value === "object") {
    return (
      <dl className="right-properties-nested">
        {Object.entries(value).map(([key, nestedValue]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{formatValue(nestedValue)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  return String(value);
};

export function RightPanelProperties({
  activeFileId,
  index,
  noDocumentCopy,
  emptyCopy,
}: {
  activeFileId: string;
  index?: WorkspaceKnowledgeIndex;
  noDocumentCopy: string;
  emptyCopy: string;
}) {
  const metadata = index?.analysesByDocumentId.get(activeFileId)?.metadata;
  const entries = Object.entries(metadata ?? {});

  return (
    <section className="right-properties" aria-label="Metadata">
      {!activeFileId ? <PanelEmptyState>{noDocumentCopy}</PanelEmptyState> :
        !entries.length ? <PanelEmptyState>{emptyCopy}</PanelEmptyState> : (
          <dl className="right-properties-list">
            {entries.map(([key, value]) => (
              <div className="right-properties-row" key={key}>
                <dt>{key}</dt>
                <dd>{formatValue(value)}</dd>
              </div>
            ))}
          </dl>
        )}
    </section>
  );
}
