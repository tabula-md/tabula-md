import type {
  OkfIndexCandidate,
  WorkspaceOkfConformancePlan,
} from "@tabula-md/tabula";
import { Check, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import type { KnowledgeCompatibilityCopy } from "../workspace/knowledgeCompatibilityLocale";

export function RightPanelOkfIndexes({
  copy,
  onMaterialize,
  plan,
}: {
  copy: KnowledgeCompatibilityCopy;
  onMaterialize: (candidate: OkfIndexCandidate) => boolean;
  plan: WorkspaceOkfConformancePlan;
}) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<"current" | "candidate">("candidate");
  const [confirmingPath, setConfirmingPath] = useState<string | null>(null);
  const [applyFailed, setApplyFailed] = useState(false);
  const candidateSignature = plan.indexes
    .map((candidate) => `${candidate.path}:${candidate.state}:${candidate.changed}`)
    .join("|");

  useEffect(() => {
    setSelectedPath((current) =>
      current && plan.indexes.some((candidate) => candidate.path === current)
        ? current
        : null
    );
    setConfirmingPath(null);
    setApplyFailed(false);
  }, [candidateSignature]);

  if (plan.indexes.length === 0) return null;
  const selectedCandidate = plan.indexes.find(
    (candidate) => candidate.path === selectedPath,
  );
  const selectCandidate = (candidate: OkfIndexCandidate) => {
    setSelectedPath(candidate.path);
    setPreviewSource(
      candidate.state === "curated" && candidate.currentMarkdown
        ? "current"
        : "candidate",
    );
    setConfirmingPath(null);
    setApplyFailed(false);
  };
  const materialize = (candidate: OkfIndexCandidate) => {
    if (onMaterialize(candidate)) {
      setConfirmingPath(null);
      setApplyFailed(false);
    } else {
      setApplyFailed(true);
    }
  };
  const renderPreview = (candidate: OkfIndexCandidate) => (
    <div className="right-compatibility-index-preview">
      {candidate.currentMarkdown && (
        <div className="right-compatibility-index-preview-tabs">
          <button
            className={previewSource === "current" ? "active" : ""}
            type="button"
            aria-pressed={previewSource === "current"}
            onClick={() => setPreviewSource("current")}
          >
            {copy.currentIndex}
          </button>
          <button
            className={previewSource === "candidate" ? "active" : ""}
            type="button"
            aria-pressed={previewSource === "candidate"}
            onClick={() => setPreviewSource("candidate")}
          >
            {copy.generatedCandidate}
          </button>
        </div>
      )}
      {!candidate.currentMarkdown && (
        <p className="right-compatibility-index-preview-label">
          {copy.generatedCandidate}
        </p>
      )}
      <pre>
        {previewSource === "current" && candidate.currentMarkdown
          ? candidate.currentMarkdown
          : candidate.markdown}
      </pre>
      <div className="right-compatibility-index-action">
        {candidate.state === "missing" && (
          <button type="button" onClick={() => materialize(candidate)}>
            {copy.createIndex}
          </button>
        )}
        {candidate.state === "generated" && candidate.changed && (
          <button type="button" onClick={() => materialize(candidate)}>
            {copy.updateGeneratedIndex}
          </button>
        )}
        {candidate.state === "generated" && !candidate.changed && (
          <span>
            <Check size={13} aria-hidden="true" />
            {copy.upToDate}
          </span>
        )}
        {candidate.state === "curated" && confirmingPath !== candidate.path && (
          <button
            className="danger"
            type="button"
            onClick={() => setConfirmingPath(candidate.path)}
          >
            {copy.replaceCuratedIndex}
          </button>
        )}
      </div>
      {candidate.state === "curated" && confirmingPath === candidate.path && (
        <div className="right-compatibility-index-confirm">
          <p>{copy.replaceCuratedWarning}</p>
          <div>
            <button
              type="button"
              onClick={() => setConfirmingPath(null)}
            >
              {copy.cancel}
            </button>
            <button
              className="danger"
              type="button"
              onClick={() => materialize(candidate)}
            >
              {copy.confirmReplace}
            </button>
          </div>
        </div>
      )}
      {applyFailed && (
        <p className="right-compatibility-inline-error">{copy.planChanged}</p>
      )}
    </div>
  );

  return (
    <section className="right-compatibility-index-section" aria-label={copy.indexes}>
      <div className="right-compatibility-section-copy">
        <h3>
          <span>{copy.indexes}</span>
          <span>{plan.indexes.length}</span>
        </h3>
        <p>{copy.indexesDescription}</p>
      </div>
      <div className="right-compatibility-index-list">
        {plan.indexes.map((candidate) => (
          <div className="right-compatibility-index-item" key={candidate.path}>
            <button
              className={candidate.path === selectedPath ? "active" : ""}
              type="button"
              aria-pressed={candidate.path === selectedPath}
              onClick={() => selectCandidate(candidate)}
            >
              <FileText size={14} aria-hidden="true" />
              <span>
                <strong>{candidate.path}</strong>
                <small>
                  {copy.indexContents(candidate.conceptCount, candidate.directoryCount)}
                </small>
              </span>
              <em>
                {copy.indexStates[candidate.state]}
                {candidate.state === "generated" && !candidate.changed && (
                  <Check size={12} aria-label={copy.upToDate} />
                )}
              </em>
            </button>
            {selectedCandidate?.path === candidate.path && renderPreview(candidate)}
          </div>
        ))}
      </div>
    </section>
  );
}
