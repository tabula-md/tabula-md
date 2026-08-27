import { CircleCheck } from "lucide-react";
import type { WorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import {
  getWorkspaceKnowledgeReviewDocuments,
  type WorkspaceKnowledgeBrowseModel,
  type WorkspaceKnowledgeFilters,
  type WorkspaceKnowledgeReviewKind,
} from "../workspace/workspaceKnowledgeBrowseModel";
import type { WorkspaceSearchIndexEntry } from "../workspace/workspaceSearchIndex";

type WorkspaceChecksPanelProps = {
  activeFileId: string;
  copy: WorkspaceInterfaceCopy["sidePanel"]["checks"];
  entries: readonly WorkspaceSearchIndexEntry[];
  knowledgeIndexPending: boolean;
  model: WorkspaceKnowledgeBrowseModel;
  onSelectFile: (fileId: string) => void;
};

const noFilters: WorkspaceKnowledgeFilters = { fields: {} };

export function WorkspaceChecksPanel({
  activeFileId,
  copy,
  entries,
  knowledgeIndexPending,
  model,
  onSelectFile,
}: WorkspaceChecksPanelProps) {
  const documents = getWorkspaceKnowledgeReviewDocuments(entries, model, "", noFilters);
  const labels: Record<WorkspaceKnowledgeReviewKind, string> = {
    freshness: copy.freshness,
    trust: copy.trust,
    links: copy.links,
    sources: copy.sources,
    metadata: copy.metadata,
    structure: copy.structure,
  };

  return (
    <section className="left-panel-checks" aria-label={copy.label}>
      {!model.reviewReady && knowledgeIndexPending && (
        <p className="left-panel-checks-state">{copy.loading}</p>
      )}
      {model.reviewReady && documents.length === 0 && (
        <p className="left-panel-checks-state healthy">
          <CircleCheck size={14} aria-hidden="true" />
          <span>{copy.healthy}</span>
        </p>
      )}
      {documents.map(({ entry, review }) => {
        const primaryKind = review.primaryKind;
        return (
          <button
            key={entry.fileId}
            className={`left-panel-check${entry.fileId === activeFileId ? " active" : ""}`}
            type="button"
            aria-label={`${entry.title ?? entry.displayPath} · ${labels[primaryKind]}`}
            onClick={() => onSelectFile(entry.fileId)}
          >
            <span>
              <strong>{entry.title}</strong>
              <small>{labels[primaryKind]}</small>
            </span>
          </button>
        );
      })}
    </section>
  );
}
