import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CircleSlash2,
  CornerDownLeft,
  ExternalLink,
  File,
  GitFork,
} from "lucide-react";
import type { WorkspaceKnowledgeIndex, WorkspaceKnowledgeLink } from "@tabula-md/tabula";
import type { WorkspaceFileTabLabel } from "../workspace/workspaceDisplayTitles";
import type { WorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { PanelEmptyState } from "./PanelEmptyState";
import {
  getRightPanelLinksModel,
  type RightPanelResolvedLinkGroup,
} from "./rightPanelLinksModel";

type RightPanelLinksCopy = WorkspaceInterfaceCopy["sidePanel"]["links"];

type RightPanelLinksProps = {
  activeFileId: string;
  activeFileTitle: string;
  copy: RightPanelLinksCopy;
  fileLabels: ReadonlyMap<string, WorkspaceFileTabLabel>;
  index?: WorkspaceKnowledgeIndex;
  onSelectFile: (fileId: string) => void;
};

type LinkSectionProps<Item> = {
  icon: ReactNode;
  label: string;
  emptyMessage?: string;
  items: readonly Item[];
  getKey: (item: Item) => string;
  renderItem: (item: Item) => ReactNode;
};

const getLinkKey = (link: WorkspaceKnowledgeLink) =>
  `${link.sourceDocumentId}:${link.from}:${link.to}:${link.syntax}:${link.relation}`;

const removeMarkdownExtension = (value: string) =>
  value.replace(/\.(?:md|markdown)(?=$|#)/i, "");

const decodeLinkTarget = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const normalizePageIdentity = (value: string) =>
  removeMarkdownExtension(value)
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\s_-]+/g, "");

function LinkSection<Item>({
  icon,
  label,
  emptyMessage,
  items,
  getKey,
  renderItem,
}: LinkSectionProps<Item>) {
  if (items.length === 0 && !emptyMessage) return null;
  return (
    <section className="right-links-section" aria-label={label}>
      <h3 className="right-links-section-title">
        {icon}
        <span>{label}</span>
        <span className="right-links-count">{items.length}</span>
      </h3>
      <div className="right-links-list">
        {items.length === 0
          ? <p className="right-links-section-empty">{emptyMessage}</p>
          : items.map((item) => <div key={getKey(item)}>{renderItem(item)}</div>)}
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
  const getDocumentPresentation = (documentId: string, fragment?: string) => {
    const fileLabel = fileLabels.get(documentId);
    const documentPath =
      fileLabel?.fullPath ??
      index.documentsById.get(documentId)?.path ??
      documentId;
    const logicalPath = removeMarkdownExtension(documentPath);
    const leafName = logicalPath.split("/").at(-1) ?? logicalPath;
    const documentTitle =
      index.analysesByDocumentId.get(documentId)?.title.trim() ||
      removeMarkdownExtension(fileLabel?.displayTitle ?? leafName);
    const titleMatchesLeaf =
      normalizePageIdentity(documentTitle) === normalizePageIdentity(leafName);
    const decodedFragment = fragment ? decodeLinkTarget(fragment) : "";
    const contextPath =
      logicalPath.includes("/") || !titleMatchesLeaf
        ? logicalPath
        : "";
    const context = decodedFragment
      ? `${contextPath}#${decodedFragment}`
      : contextPath;
    return {
      title: documentTitle,
      context,
      filePath: documentPath,
    };
  };
  const renderDocumentLink = (group: RightPanelResolvedLinkGroup) => {
    const presentation = getDocumentPresentation(group.documentId, group.fragment);
    const metadata = [
      presentation.context,
      group.relation === "embed" ? copy.embed : "",
      group.mentionCount > 1 ? copy.mentions(group.mentionCount) : "",
    ].filter(Boolean);
    return (
      <button
        className="right-links-row"
        type="button"
        title={presentation.filePath}
        aria-label={copy.open(presentation.filePath)}
        onClick={() => onSelectFile(group.documentId)}
      >
        <span className="right-file-document-icon">
          <File size={16} aria-hidden="true" />
        </span>
        <span className="right-links-row-text">
          <span className="right-links-row-title">{presentation.title}</span>
          {metadata.length > 0 && (
            <span className="right-links-row-target">{metadata.join(" · ")}</span>
          )}
        </span>
      </button>
    );
  };
  const renderStaticLink = (
    link: WorkspaceKnowledgeLink,
    icon: ReactNode,
    statusLabel: string,
  ) => {
    const decodedTarget = decodeLinkTarget(link.target);
    const displayTarget =
      link.status === "external"
        ? decodedTarget
        : removeMarkdownExtension(decodedTarget);
    const label = link.label.trim();
    const title =
      label && normalizePageIdentity(label) !== normalizePageIdentity(displayTarget)
        ? label
        : displayTarget;
    const metadata = [
      title !== displayTarget ? displayTarget : "",
      link.relation === "embed" ? copy.embed : "",
      statusLabel,
    ].filter(Boolean);
    return (
      <div className="right-links-row static" title={link.target}>
        <span className="right-links-kind-icon">{icon}</span>
        <span className="right-links-row-text">
          <span className="right-links-row-title">{title}</span>
          {metadata.length > 0 && (
            <span className="right-links-row-target">{metadata.join(" · ")}</span>
          )}
        </span>
      </div>
    );
  };

  return (
    <section className="right-panel-content right-links-panel" aria-label={copy.forFile(activeFileTitle)}>
      <div className="right-links-scroll">
        <section className="right-links-section" aria-label={copy.outgoing}>
          <h3 className="right-links-section-title">
            <ArrowUpRight size={14} aria-hidden="true" />
            <span>{copy.outgoing}</span>
            <span className="right-links-count">
              {model.outgoing.length + model.external.length}
            </span>
          </h3>
          <div className="right-links-list">
            {model.outgoing.length + model.external.length === 0
              ? <p className="right-links-section-empty">{copy.outgoingNone}</p>
              : (
                <>
                  {model.outgoing.map((group) => (
                    <div key={`${group.documentId}:${group.relation}:${group.fragment ?? ""}`}>
                      {renderDocumentLink(group)}
                    </div>
                  ))}
                  {model.external.map((link) => (
                    <div key={getLinkKey(link)}>
                      {renderStaticLink(
                        link,
                        <ExternalLink size={16} aria-hidden="true" />,
                        copy.external,
                      )}
                    </div>
                  ))}
                </>
              )}
          </div>
        </section>
        <LinkSection
          icon={<CornerDownLeft size={14} aria-hidden="true" />}
          label={copy.backlinks}
          emptyMessage={copy.backlinksNone}
          items={model.backlinks}
          getKey={(group) => `${group.documentId}:${group.relation}`}
          renderItem={renderDocumentLink}
        />
        <LinkSection
          icon={<AlertTriangle size={14} aria-hidden="true" />}
          label={copy.issues}
          items={model.issues}
          getKey={getLinkKey}
          renderItem={(link) => {
            const isAmbiguous = link.status === "ambiguous";
            return (
              <div className="right-links-ambiguous-item">
                {renderStaticLink(
                  link,
                  isAmbiguous
                    ? <GitFork size={16} aria-hidden="true" />
                    : <CircleSlash2 size={16} aria-hidden="true" />,
                  isAmbiguous ? copy.ambiguous : copy.broken,
                )}
                {isAmbiguous && (
                  <>
                    <span className="right-links-candidate-count">
                      {copy.candidates(link.candidateDocumentIds?.length ?? 0)}
                    </span>
                    <div className="right-links-candidates">
                      {link.candidateDocumentIds?.map((documentId) => {
                        const presentation = getDocumentPresentation(documentId);
                        return (
                          <button
                            key={documentId}
                            className="right-links-candidate"
                            type="button"
                            title={presentation.filePath}
                            aria-label={copy.open(presentation.filePath)}
                            onClick={() => onSelectFile(documentId)}
                          >
                            <span className="right-file-document-icon">
                              <File size={16} aria-hidden="true" />
                            </span>
                            <span className="right-links-candidate-text">
                              <span>{presentation.title}</span>
                              {presentation.context && (
                                <small>{presentation.context}</small>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            );
          }}
        />
      </div>
    </section>
  );
}
