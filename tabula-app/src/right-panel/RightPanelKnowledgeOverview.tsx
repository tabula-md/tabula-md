import {
  getOkfDocumentAttentionSignals,
  type OkfDocumentAttentionSignal,
  type WorkspaceKnowledgeIndex,
  type WorkspaceKnowledgePosture,
} from "@tabula-md/tabula";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import type { KnowledgePanelCopy } from "../workspace/knowledgePanelLocale";

export function RightPanelKnowledgeOverview({
  activeFileId,
  copy,
  index,
  onSelectFile,
  posture,
}: {
  activeFileId: string;
  copy: KnowledgePanelCopy;
  index: WorkspaceKnowledgeIndex;
  onSelectFile: (fileId: string) => void;
  posture: WorkspaceKnowledgePosture;
}) {
  const [selectedSignal, setSelectedSignal] =
    useState<OkfDocumentAttentionSignal | null>(null);
  const signals = ([
    {
      count: posture.reviewDueCount,
      label: copy.reviewDue,
      signal: "review-due",
    },
    {
      count: posture.unverifiedCount,
      label: copy.unverified,
      signal: "unverified",
    },
    {
      count: posture.invalidReviewDateCount,
      label: copy.invalidReviewDate,
      signal: "invalid-review-date",
    },
    {
      count: posture.deprecatedCount,
      label: copy.deprecated,
      signal: "deprecated",
    },
    {
      count: posture.draftCount,
      label: copy.draft,
      signal: "draft",
    },
    {
      count: posture.unscheduledCount,
      label: copy.noReviewDate,
      signal: "review-unscheduled",
    },
  ] satisfies Array<{
    count: number;
    label: string;
    signal: OkfDocumentAttentionSignal;
  }>).filter((signal) => signal.count > 0);
  const selectedDocuments = useMemo(() => {
    if (!selectedSignal) return [];
    return [...index.analysesByDocumentId.entries()]
      .filter(([, analysis]) =>
        getOkfDocumentAttentionSignals(analysis).includes(selectedSignal))
      .map(([documentId, analysis]) => ({
        documentId,
        path: analysis.path,
        title: analysis.title,
      }))
      .sort((first, second) => first.path.localeCompare(second.path));
  }, [index, selectedSignal]);
  const selectedLabel = signals.find(
    ({ signal }) => signal === selectedSignal,
  )?.label;

  return (
    <section
      className="right-knowledge-overview"
      aria-label={copy.needsAttention}
    >
      <header>
        <h2>{copy.needsAttention}</h2>
        <p>{copy.conceptCount(posture.conceptCount)}</p>
      </header>
      {signals.length === 0 ? (
        <p className="right-knowledge-overview-empty">
          {copy.noWorkspaceAttention}
        </p>
      ) : (
        <div className="right-knowledge-attention-list">
          {signals.map((signal) => {
            const selected = signal.signal === selectedSignal;
            const DisclosureIcon = selected ? ChevronDown : ChevronRight;
            return (
              <Fragment key={signal.signal}>
                <button
                  aria-expanded={selected}
                  className="right-knowledge-attention-summary"
                  data-attention-signal={signal.signal}
                  type="button"
                  onClick={() => setSelectedSignal(
                    selected ? null : signal.signal,
                  )}
                >
                  <DisclosureIcon size={14} aria-hidden="true" />
                  <span>{signal.label}</span>
                  <strong>{signal.count}</strong>
                </button>
                {selected && selectedLabel && (
                  <div
                    className="right-knowledge-attention-documents"
                    role="region"
                    aria-label={copy.documentsForAttention(selectedLabel)}
                  >
                    {selectedDocuments.map((document) => (
                      <button
                        aria-current={
                          document.documentId === activeFileId
                            ? "page"
                            : undefined
                        }
                        className="right-knowledge-attention-document"
                        key={document.documentId}
                        type="button"
                        onClick={() => onSelectFile(document.documentId)}
                      >
                        <FileText size={14} aria-hidden="true" />
                        <span>
                          <strong>{document.title}</strong>
                          <small>{document.path}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      )}
    </section>
  );
}
