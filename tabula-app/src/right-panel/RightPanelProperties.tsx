import type { WorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import type { ReactNode } from "react";
import { PanelEmptyState } from "./PanelEmptyState";

const HTTP_URL_PATTERN = /^https?:\/\/\S+$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:[T ][0-9:.+-]+Z?)?$/;

export const getPropertyScalarKind = (value: string) => {
  if (HTTP_URL_PATTERN.test(value)) return "url";
  if (ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value))) return "date";
  return "text";
};

const formatScalar = (value: string | number | boolean): ReactNode => {
  const text = String(value);
  if (typeof value !== "string") return text;

  const kind = getPropertyScalarKind(value);
  if (kind === "url") {
    return <a href={value} target="_blank" rel="noreferrer">{value}</a>;
  }
  if (kind === "date") return <time dateTime={value}>{value}</time>;
  return text;
};

const formatValue = (value: unknown): ReactNode => {
  if (value === null || value === undefined || value === "") return "—";
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) return formatScalar(value);
  if (Array.isArray(value)) {
    if (!value.length) return "—";
    return (
      <ul className="right-properties-array">
        {value.map((item, index) => (
          <li key={`${String(item)}-${index}`}>{formatValue(item)}</li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    return (
      <details className="right-properties-object">
        <summary>{`{${Object.keys(value).length}}`}</summary>
        <dl className="right-properties-nested">
          {Object.entries(value).map(([key, nestedValue]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{formatValue(nestedValue)}</dd>
            </div>
          ))}
        </dl>
      </details>
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
