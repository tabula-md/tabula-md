import { useEffect, useMemo, useState } from "react";
import {
  createWorkspaceKnowledgeIndex,
  getWorkspaceKnowledgeHealth,
  getWorkspaceKnowledgeHealthDelta,
  planWorkspaceOkfLog,
  planWorkspaceOkfConformance,
  type OkfCompatibilityReport,
  type OkfConceptRepairUpdate,
  type OkfIndexCandidate,
  type OkfWikilinkRepairUpdate,
  type WorkspaceKnowledgeBaseline,
  type WorkspaceKnowledgeHealthIssue,
  type WorkspaceKnowledgeIndex,
  type WorkspaceOkfLogCandidate,
} from "@tabula-md/tabula";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { getKnowledgeCompatibilityCopy } from "../workspace/knowledgeCompatibilityLocale";
import { getKnowledgePanelCopy } from "../workspace/knowledgePanelLocale";
import { getWorkspaceReview } from "../workspace/io/workspaceExportReviewModel";
import { getWorkspaceKnowledgeReviewEntries } from "../workspace/workspaceKnowledgeReviewQueueModel";
import { KnowledgeReviewDialog } from "./KnowledgeReviewDialog";
import { RightPanelKnowledgeCompatibility } from "./RightPanelKnowledgeCompatibility";
import { RightPanelKnowledgeContext } from "./RightPanelKnowledgeContext";
import { RightPanelKnowledgeQueue } from "./RightPanelKnowledgeQueue";
import { PanelEmptyState } from "./PanelEmptyState";

type RightPanelKnowledgeProps = {
  activeFileId: string;
  activeFileTitle: string;
  noDocumentCopy: string;
  compatibilityReport?: OkfCompatibilityReport;
  knowledgeBaseline?: WorkspaceKnowledgeBaseline;
  knowledgeCompatibilityOpenRequest: number;
  index?: WorkspaceKnowledgeIndex;
  language: WorkspaceLanguage;
  identityName: string;
  onApplyConceptRepairs: (updates: readonly OkfConceptRepairUpdate[]) => boolean;
  onApplyWikilinkRepairs: (updates: readonly OkfWikilinkRepairUpdate[]) => boolean;
  onMaterializeIndex: (candidate: OkfIndexCandidate) => boolean;
  onMaterializeLog: (candidate: WorkspaceOkfLogCandidate) => Promise<boolean>;
  onSelectFile: (fileId: string) => void;
  onSelectHealthIssue: (issue: WorkspaceKnowledgeHealthIssue) => void;
  onSetActiveFileOkfType: (conceptType: string) => boolean;
  onStartKnowledgeTracking: () => boolean;
  onVerifyKnowledgeDocument: (documentId: string, verifiedBy: string) => boolean;
};

export function RightPanelKnowledge({
  activeFileId,
  activeFileTitle,
  noDocumentCopy,
  compatibilityReport,
  knowledgeBaseline,
  knowledgeCompatibilityOpenRequest,
  index,
  language,
  onApplyConceptRepairs,
  onApplyWikilinkRepairs,
  onMaterializeIndex,
  onMaterializeLog,
  onSelectFile,
  onSelectHealthIssue,
  onSetActiveFileOkfType,
  onStartKnowledgeTracking,
  onVerifyKnowledgeDocument,
  identityName,
}: RightPanelKnowledgeProps) {
  const knowledgeCopy = getKnowledgePanelCopy(language);
  const compatibilityCopy = getKnowledgeCompatibilityCopy(language);
  const [workspaceReviewOpen, setWorkspaceReviewOpen] = useState(false);
  const [reviewQueueOpen, setReviewQueueOpen] = useState(false);
  const healthReport = useMemo(
    () => index ? getWorkspaceKnowledgeHealth(index) : undefined,
    [index],
  );
  const healthDelta = useMemo(
    () => {
      if (!knowledgeBaseline || !index) return undefined;
      try {
        return getWorkspaceKnowledgeHealthDelta(
          createWorkspaceKnowledgeIndex(knowledgeBaseline.documents),
          index,
        );
      } catch {
        return undefined;
      }
    },
    [index, knowledgeBaseline],
  );
  const conformancePlan = useMemo(
    () => index && compatibilityReport
      ? planWorkspaceOkfConformance(index, compatibilityReport)
      : undefined,
    [compatibilityReport, index],
  );
  const knowledgeLogCandidate = useMemo(
    () => knowledgeBaseline && index
      ? planWorkspaceOkfLog(
          knowledgeBaseline,
          [...index.documentsById.values()],
        )
      : undefined,
    [index, knowledgeBaseline],
  );
  const workspaceReview = useMemo(
    () => index
      ? getWorkspaceReview(index, {
          baseline: knowledgeBaseline,
          compatibility: compatibilityReport,
          health: healthReport,
        })
      : undefined,
    [compatibilityReport, healthReport, index, knowledgeBaseline],
  );
  const reviewEntries = useMemo(
    () => {
      if (!index) return [];
      return getWorkspaceKnowledgeReviewEntries(index, {
        ...(compatibilityReport ? { compatibility: compatibilityReport } : {}),
        ...(healthReport ? { health: healthReport } : {}),
      });
    },
    [compatibilityReport, healthReport, index],
  );

  useEffect(() => {
    if (knowledgeCompatibilityOpenRequest > 0) setWorkspaceReviewOpen(true);
  }, [knowledgeCompatibilityOpenRequest]);

  return (
    <>
      <section
        className="right-panel-knowledge"
        aria-label={knowledgeCopy.documentContext}
      >
        {workspaceReview && (
          <header
            className="right-knowledge-workspace-bar"
            role="region"
            aria-label={knowledgeCopy.workspaceContext}
          >
            <span className="right-knowledge-workspace-summary">
              <strong>
                {workspaceReview.declaredVersion
                  ? knowledgeCopy.workspaceSummary(
                      workspaceReview.declaredVersion,
                      workspaceReview.conceptCount,
                    )
                  : knowledgeCopy.knowledgeSummary(
                      workspaceReview.conceptCount,
                    )}
              </strong>
              {reviewEntries.length > 0 ? (
                <button
                  type="button"
                  className="right-knowledge-workspace-attention"
                  aria-label={knowledgeCopy.openReviewQueue(reviewEntries.length)}
                  onClick={() => setReviewQueueOpen(true)}
                >
                  {knowledgeCopy.workspaceAttention(reviewEntries.length)}
                </button>
              ) : <small>{knowledgeCopy.workspaceReady}</small>}
            </span>
            <button
              type="button"
              onClick={() => setWorkspaceReviewOpen(true)}
            >
              {knowledgeCopy.reviewWorkspace}
            </button>
          </header>
        )}
        {reviewQueueOpen ? (
          <RightPanelKnowledgeQueue
            activeFileId={activeFileId}
            compatibilityCopy={compatibilityCopy}
            copy={knowledgeCopy}
            entries={reviewEntries}
            onBack={() => setReviewQueueOpen(false)}
            onSelectFile={onSelectFile}
          />
        ) : activeFileId ? (
          <RightPanelKnowledgeContext
            activeFileId={activeFileId}
            activeFileTitle={activeFileTitle}
            compatibilityCopy={compatibilityCopy}
            copy={knowledgeCopy}
            healthReport={healthReport}
            index={index}
            onSelectHealthIssue={onSelectHealthIssue}
          />
        ) : (
          <section className="right-panel-content">
            <PanelEmptyState>{noDocumentCopy}</PanelEmptyState>
          </section>
        )}
      </section>

      {workspaceReviewOpen && (
        <KnowledgeReviewDialog
          copy={knowledgeCopy}
          changeCount={workspaceReview?.changeCount}
          maintenanceCount={workspaceReview?.maintenanceAttentionCount ?? 0}
          requiredCount={workspaceReview?.requiredChangeCount ?? 0}
          verificationCount={workspaceReview?.verificationCount ?? 0}
          onClose={() => setWorkspaceReviewOpen(false)}
        >
          <RightPanelKnowledgeCompatibility
            copy={compatibilityCopy}
            reviewTitle={knowledgeCopy.compatibilityReview}
            reviewDescription={knowledgeCopy.compatibilityReviewDescription}
            documentCount={index?.documentsById.size ?? 0}
            report={compatibilityReport}
            healthReport={healthReport}
            healthDelta={healthDelta}
            conformancePlan={conformancePlan}
            knowledgeIndex={index}
            knowledgeBaseline={knowledgeBaseline}
            knowledgeLogCandidate={knowledgeLogCandidate}
            activeFileId={activeFileId}
            onApplyConceptRepairs={onApplyConceptRepairs}
            onApplyWikilinkRepairs={onApplyWikilinkRepairs}
            onMaterializeIndex={onMaterializeIndex}
            onMaterializeLog={onMaterializeLog}
            onStartKnowledgeTracking={onStartKnowledgeTracking}
            onSelectFile={onSelectFile}
            onSelectHealthIssue={(issue) => {
              onSelectHealthIssue(issue);
              setWorkspaceReviewOpen(false);
            }}
            onSetActiveFileOkfType={onSetActiveFileOkfType}
            onVerifyKnowledgeDocument={onVerifyKnowledgeDocument}
            identityName={identityName}
            layout="workspace"
          />
        </KnowledgeReviewDialog>
      )}
    </>
  );
}
