import type { ReactNode } from "react";
import {
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
  items,
  getKey,
  renderItem,
}: LinkSectionProps<Item>) {
  if (items.length === 0) return null;
  return (
    <section className="right-links-section" aria-label={label}>
      <h3 className="right-links-section-title">
        {icon}
        <span>{label}</span>
        <span className="right-links-count">{items.length}</span>
      </h3>
      <div className="right-links-list">
        {items.map((item) => <div key={getKey(item)}>{renderItem(item)}</div>)}
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
  const renderStaticLink = (link: WorkspaceKnowledgeLink) => {
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
    ].filter(Boolean);
    return (
      <div className="right-links-row static" title={link.target}>
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
      {!model.hasLinks && <PanelEmptyState>{copy.none}</PanelEmptyState>}
      {model.hasLinks && (
        <div className="right-links-scroll">
          <LinkSection
            icon={<ArrowUpRight size={14} aria-hidden="true" />}
            label={copy.outgoing}
            items={model.outgoing}
            getKey={(group) =>
              `${group.documentId}:${group.relation}:${group.fragment ?? ""}`}
            renderItem={renderDocumentLink}
          />
          <LinkSection
            icon={<CornerDownLeft size={14} aria-hidden="true" />}
            label={copy.backlinks}
            items={model.backlinks}
            getKey={(group) => `${group.documentId}:${group.relation}`}
            renderItem={renderDocumentLink}
          />
          <LinkSection
            icon={<CircleSlash2 size={14} aria-hidden="true" />}
            label={copy.broken}
            items={model.broken}
            getKey={getLinkKey}
            renderItem={renderStaticLink}
          />
          <LinkSection
            icon={<GitFork size={14} aria-hidden="true" />}
            label={copy.ambiguous}
            items={model.ambiguous}
            getKey={getLinkKey}
            renderItem={(link) => (
              <div className="right-links-ambiguous-item">
                {renderStaticLink(link)}
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
                        <span>{presentation.title}</span>
                        {presentation.context && (
                          <small>{presentation.context}</small>
                        )}
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
            items={model.external}
            getKey={getLinkKey}
            renderItem={renderStaticLink}
          />
        </div>
      )}
    </section>
  );
}
