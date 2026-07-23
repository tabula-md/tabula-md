import type { ReactNode } from "react";
import {
  ArrowUpRight,
  CircleSlash2,
  CornerDownLeft,
  ExternalLink,
  FileText,
  GitFork,
} from "lucide-react";
import type { WorkspaceKnowledgeIndex, WorkspaceKnowledgeLink } from "@tabula-md/tabula";
import type { WorkspaceFileTabLabel } from "../workspace/workspaceDisplayTitles";
import type { WorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { PanelEmptyState } from "./PanelEmptyState";
import { getRightPanelLinksModel } from "./rightPanelLinksModel";

type RightPanelLinksCopy = WorkspaceInterfaceCopy["sidePanel"]["links"];

type RightPanelLinksProps = {
  activeFileId: string;
  activeFileTitle: string;
  copy: RightPanelLinksCopy;
  fileLabels: ReadonlyMap<string, WorkspaceFileTabLabel>;
  index?: WorkspaceKnowledgeIndex;
  onSelectFile: (fileId: string) => void;
};

type LinkSectionProps = {
  icon: ReactNode;
  label: string;
  links: readonly WorkspaceKnowledgeLink[];
  renderLink: (link: WorkspaceKnowledgeLink) => ReactNode;
};

const getLinkKey = (link: WorkspaceKnowledgeLink) =>
  `${link.sourceDocumentId}:${link.from}:${link.to}:${link.syntax}:${link.relation}`;

function LinkSection({ icon, label, links, renderLink }: LinkSectionProps) {
  if (links.length === 0) return null;
  return (
    <section className="right-links-section" aria-label={label}>
      <h3 className="right-links-section-title">
        {icon}
        <span>{label}</span>
        <span className="right-links-count">{links.length}</span>
      </h3>
      <div className="right-links-list">
        {links.map((link) => <div key={getLinkKey(link)}>{renderLink(link)}</div>)}
      </div>
    </section>
  );
}

export function RightPanelLinks({
  activeFileId,
  activeFileTitle,
  copy,
  fileLabels,
  index,
  onSelectFile,
}: RightPanelLinksProps) {
  if (!index) {
    return (
      <section className="right-panel-content right-links-panel">
        <PanelEmptyState>{copy.unavailable}</PanelEmptyState>
      </section>
    );
  }

  const model = getRightPanelLinksModel(index, activeFileId);
  const getDocumentLabel = (documentId: string) =>
    fileLabels.get(documentId)?.fullPath ?? index.documentsById.get(documentId)?.path ?? documentId;
  const renderDocumentLink = (
    link: WorkspaceKnowledgeLink,
    documentId: string,
  ) => {
    const documentLabel = getDocumentLabel(documentId);
    return (
      <button
        className="right-links-row"
        type="button"
        aria-label={copy.open(documentLabel)}
        onClick={() => onSelectFile(documentId)}
      >
        <FileText size={15} aria-hidden="true" />
        <span className="right-links-row-text">
          <span className="right-links-row-title">{documentLabel}</span>
          <span className="right-links-row-target">{link.target}</span>
        </span>
      </button>
    );
  };
  const renderStaticLink = (link: WorkspaceKnowledgeLink) => (
    <div className="right-links-row static" title={link.target}>
      <span className="right-links-row-text">
        <span className="right-links-row-title">{link.label || link.target}</span>
        <span className="right-links-row-target">{link.target}</span>
      </span>
    </div>
  );

  return (
    <section className="right-panel-content right-links-panel" aria-label={copy.forFile(activeFileTitle)}>
      {!model.hasLinks && <PanelEmptyState>{copy.none}</PanelEmptyState>}
      {model.hasLinks && (
        <div className="right-links-scroll">
          <LinkSection
            icon={<ArrowUpRight size={14} aria-hidden="true" />}
            label={copy.outgoing}
            links={model.outgoing}
            renderLink={(link) => link.targetDocumentId
              ? renderDocumentLink(link, link.targetDocumentId)
              : renderStaticLink(link)}
          />
          <LinkSection
            icon={<CornerDownLeft size={14} aria-hidden="true" />}
            label={copy.backlinks}
            links={model.backlinks}
            renderLink={(link) => renderDocumentLink(link, link.sourceDocumentId)}
          />
          <LinkSection
            icon={<CircleSlash2 size={14} aria-hidden="true" />}
            label={copy.broken}
            links={model.broken}
            renderLink={renderStaticLink}
          />
          <LinkSection
            icon={<GitFork size={14} aria-hidden="true" />}
            label={copy.ambiguous}
            links={model.ambiguous}
            renderLink={(link) => (
              <div className="right-links-ambiguous-item">
                {renderStaticLink(link)}
                <span className="right-links-candidate-count">
                  {copy.candidates(link.candidateDocumentIds?.length ?? 0)}
                </span>
                <div className="right-links-candidates">
                  {link.candidateDocumentIds?.map((documentId) => {
                    const documentLabel = getDocumentLabel(documentId);
                    return (
                      <button
                        key={documentId}
                        className="right-links-candidate"
                        type="button"
                        aria-label={copy.open(documentLabel)}
                        onClick={() => onSelectFile(documentId)}
                      >
                        {documentLabel}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          />
          <LinkSection
            icon={<ExternalLink size={14} aria-hidden="true" />}
            label={copy.external}
            links={model.external}
            renderLink={renderStaticLink}
          />
        </div>
      )}
    </section>
  );
}
