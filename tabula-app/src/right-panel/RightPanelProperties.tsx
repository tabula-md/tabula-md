import { useMemo } from "react";
import {
  getWorkspaceKnowledgeHealth,
  type WorkspaceKnowledgeHealthIssue,
  type WorkspaceKnowledgeIndex,
} from "@tabula-md/tabula";
import type { WorkspaceLanguage } from "../workspace/state/useWorkspacePreferences";
import { getKnowledgeCompatibilityCopy } from "../workspace/knowledgeCompatibilityLocale";
import { getKnowledgePanelCopy } from "../workspace/knowledgePanelLocale";
import {
  RightPanelPropertiesContext,
  type MetadataFocusSection,
} from "./RightPanelPropertiesContext";
import { PanelEmptyState } from "./PanelEmptyState";

type RightPanelPropertiesProps = {
  activeFileId: string;
  noDocumentCopy: string;
  index?: WorkspaceKnowledgeIndex;
  language: WorkspaceLanguage;
  focusSection?: MetadataFocusSection;
  onSelectHealthIssue: (issue: WorkspaceKnowledgeHealthIssue) => void;
};

export function RightPanelProperties({
  activeFileId,
  noDocumentCopy,
  index,
  language,
  focusSection,
  onSelectHealthIssue,
}: RightPanelPropertiesProps) {
  const knowledgeCopy = getKnowledgePanelCopy(language);
  const compatibilityCopy = getKnowledgeCompatibilityCopy(language);
  const healthReport = useMemo(
    () => index ? getWorkspaceKnowledgeHealth(index) : undefined,
    [index],
  );

  return (
    <section
      className="right-panel-properties"
      aria-label={knowledgeCopy.properties}
    >
      {activeFileId ? (
        <RightPanelPropertiesContext
          activeFileId={activeFileId}
          compatibilityCopy={compatibilityCopy}
          copy={knowledgeCopy}
          healthReport={healthReport}
          index={index}
          focusSection={focusSection}
          onSelectHealthIssue={onSelectHealthIssue}
        />
      ) : (
        <section className="right-panel-content">
          <PanelEmptyState>{noDocumentCopy}</PanelEmptyState>
        </section>
      )}
    </section>
  );
}
