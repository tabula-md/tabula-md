import { useEffect, useMemo, useState } from "react";
import {
  type OkfCompatibilityReport,
  type OkfConceptRepairUpdate,
  type OkfIndexCandidate,
  type OkfWikilinkRepairUpdate,
  type WorkspaceKnowledgeBaseline,
  type WorkspaceKnowledgeHealthDelta,
  type WorkspaceKnowledgeHealthIssue,
  type WorkspaceKnowledgeHealthReport,
  type WorkspaceKnowledgeIndex,
  type WorkspaceOkfConformancePlan,
  type WorkspaceOkfLogCandidate,
} from "@tabula-md/tabula";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import type { KnowledgeCompatibilityCopy } from "../workspace/knowledgeCompatibilityLocale";
import { getKnowledgePanelCopy } from "../workspace/knowledgePanelLocale";
import { KnowledgeReviewDialog } from "./KnowledgeReviewDialog";
import { RightPanelKnowledgeCompatibility } from "./RightPanelKnowledgeCompatibility";
import {
  KNOWLEDGE_VERIFICATION_ISSUE_CODES,
} from "./RightPanelKnowledgeVerification";
import { RightPanelKnowledgeContext } from "./RightPanelKnowledgeContext";
import { PanelEmptyState } from "./PanelEmptyState";

type RightPanelKnowledgeProps = {
  activeFileId: string;
  activeFileTitle: string;
  noDocumentCopy: string;
  compatibilityCopy: KnowledgeCompatibilityCopy;
  compatibilityReport?: OkfCompatibilityReport;
  conformancePlan?: WorkspaceOkfConformancePlan;
  healthDelta?: WorkspaceKnowledgeHealthDelta;
  healthReport?: WorkspaceKnowledgeHealthReport;
  knowledgeBaseline?: WorkspaceKnowledgeBaseline;
  knowledgeCompatibilityOpenRequest: number;
  knowledgeLogCandidate?: WorkspaceOkfLogCandidate;
  index?: WorkspaceKnowledgeIndex;
  language: WorkspaceLanguage;
  identityName: string;
  onApplyConceptRepairs: (updates: readonly OkfConceptRepairUpdate[]) => boolean;
  onApplyWikilinkRepairs: (updates: readonly OkfWikilinkRepairUpdate[]) => boolean;
  onMaterializeIndex: (candidate: OkfIndexCandidate) => boolean;
  onMaterializeLog: (candidate: WorkspaceOkfLogCandidate) => boolean;
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
  compatibilityCopy,
  compatibilityReport,
  conformancePlan,
  healthDelta,
  healthReport,
  knowledgeBaseline,
  knowledgeCompatibilityOpenRequest,
  knowledgeLogCandidate,
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
  const [exportPreflightOpen, setExportPreflightOpen] = useState(false);
  const verificationCount = useMemo(() => new Set(
    healthReport?.issues
      .filter((issue) => KNOWLEDGE_VERIFICATION_ISSUE_CODES.has(issue.code))
      .map((issue) => issue.documentId) ?? [],
  ).size, [healthReport]);

  useEffect(() => {
    if (knowledgeCompatibilityOpenRequest > 0) setExportPreflightOpen(true);
  }, [knowledgeCompatibilityOpenRequest]);

  return (
    <>
      {activeFileId ? (
        <section
          className="right-panel-knowledge"
          aria-label={knowledgeCopy.documentContext}
        >
          <RightPanelKnowledgeContext
            activeFileId={activeFileId}
            activeFileTitle={activeFileTitle}
            compatibilityCopy={compatibilityCopy}
            copy={knowledgeCopy}
            healthReport={healthReport}
            index={index}
            onSelectHealthIssue={onSelectHealthIssue}
          />
        </section>
      ) : (
        <section className="right-panel-content">
          <PanelEmptyState>{noDocumentCopy}</PanelEmptyState>
        </section>
      )}

      {exportPreflightOpen && (
        <KnowledgeReviewDialog
          copy={knowledgeCopy}
          maintenanceCount={healthReport?.attentionCount ?? 0}
          requiredCount={compatibilityReport?.errorCount ?? 0}
          verificationCount={verificationCount}
          onClose={() => setExportPreflightOpen(false)}
        >
          <RightPanelKnowledgeCompatibility
            copy={compatibilityCopy}
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
              setExportPreflightOpen(false);
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
