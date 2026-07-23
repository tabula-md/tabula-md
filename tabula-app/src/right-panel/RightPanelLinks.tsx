import { useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CornerDownLeft,
  ExternalLink,
  File,
  FileQuestion,
  FileX2,
} from "lucide-react";
import type { WorkspaceKnowledgeIndex, WorkspaceKnowledgeLink } from "@tabula-md/tabula";
import { classifyMarkdownHref } from "../preview/markdownHref";
import type { WorkspaceFileTabLabel } from "../workspace/workspaceDisplayTitles";
import type { WorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { PanelEmptyState } from "./PanelEmptyState";
import {
  getRightPanelLinksModel,
  type RightPanelDocumentLinkGroup,
  type RightPanelLinkTargetGroup,
} from "./rightPanelLinksModel";

type RightPanelLinksCopy = WorkspaceInterfaceCopy["sidePanel"]["links"];

type RightPanelLinksProps = {
  activeFileId: string;
  activeFileTitle: string;
  copy: RightPanelLinksCopy;
  fileLabels: ReadonlyMap<string, WorkspaceFileTabLabel>;
  index?: WorkspaceKnowledgeIndex;
  onFocusLinkSource: (link: WorkspaceKnowledgeLink) => void;
  onResolveAmbiguousLink: (
    link: WorkspaceKnowledgeLink,
    targetPath: string,
  ) => boolean;
  onSelectFile: (fileId: string) => void;
};

type LinkSectionProps<Item> = {
  icon: ReactNode;
  label: string;
  emptyMessage: string;
  items: readonly Item[];
  getKey: (item: Item) => string;
  renderItem: (item: Item) => ReactNode;
};

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
  onFocusLinkSource,
  onResolveAmbiguousLink,
  onSelectFile,
}: RightPanelLinksProps) {
  const [resolvingLinkKey, setResolvingLinkKey] = useState<string | null>(null);

  if (!index) {
    return (
      <section className="right-panel-content right-links-panel">
        <PanelEmptyState>{copy.unavailable}</PanelEmptyState>
      </section>
    );
  }

  const model = getRightPanelLinksModel(index, activeFileId);
  const getDocumentPresentation = (documentId: string) => {
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
    return {
      title: documentTitle,
      context: logicalPath,
      filePath: documentPath,
    };
  };
  const renderRowContents = (
    icon: ReactNode,
    title: string,
    context: string,
    iconClassName = "right-links-kind-icon",
  ) => (
    <>
      <span className={iconClassName}>{icon}</span>
      <span className="right-links-row-text">
        <span className="right-links-row-title">{title}</span>
        <span className="right-links-row-target">{context}</span>
      </span>
    </>
  );
  const renderDocumentLink = (group: RightPanelDocumentLinkGroup) => {
    const presentation = getDocumentPresentation(group.documentId);
    return (
      <button
        className="right-links-row"
        type="button"
        title={presentation.filePath}
        aria-label={copy.open(presentation.filePath)}
        onClick={() => onSelectFile(group.documentId)}
      >
        {renderRowContents(
          <File size={16} aria-hidden="true" />,
          presentation.title,
          presentation.context,
          "right-file-document-icon",
        )}
      </button>
    );
  };
  const getTargetPresentation = (link: WorkspaceKnowledgeLink) => {
    const target = decodeLinkTarget(link.targetPath ?? link.target);
    const logicalTarget = link.status === "external"
      ? target
      : removeMarkdownExtension(target);
    const label = link.label.trim();
    const title =
      label && normalizePageIdentity(label) !== normalizePageIdentity(logicalTarget)
        ? label
        : logicalTarget.split("/").at(-1) || logicalTarget;
    return {
      title,
      context: logicalTarget,
    };
  };
  const renderAmbiguousResolver = (link: WorkspaceKnowledgeLink) => (
    <div
      className="right-links-resolver"
      role="group"
      aria-label={copy.chooseAmbiguous(
        link.candidateDocumentIds?.length ?? 0,
        link.target,
      )}
    >
      {link.candidateDocumentIds?.map((documentId) => {
        const presentation = getDocumentPresentation(documentId);
        return (
          <button
            key={documentId}
            className="right-links-row right-links-resolver-option"
            type="button"
            title={presentation.filePath}
            aria-label={copy.resolveWith(presentation.filePath)}
            onClick={() => {
              if (onResolveAmbiguousLink(link, presentation.filePath)) {
                setResolvingLinkKey(null);
              }
            }}
          >
            {renderRowContents(
              <File size={16} aria-hidden="true" />,
              presentation.title,
              presentation.context,
              "right-file-document-icon",
            )}
          </button>
        );
      })}
    </div>
  );
  const renderOutgoingTarget = (group: RightPanelLinkTargetGroup) => {
    if (group.status === "resolved" && group.documentId) {
      return renderDocumentLink({
        documentId: group.documentId,
        links: group.links,
      });
    }

    const link = group.link;
    const presentation = getTargetPresentation(link);
    if (group.status === "external") {
      const classifiedHref = classifyMarkdownHref(link.target);
      if (classifiedHref.href) {
        return (
          <a
            className="right-links-row"
            href={classifiedHref.href}
            target={classifiedHref.openInNewTab ? "_blank" : undefined}
            rel={classifiedHref.openInNewTab ? "noreferrer noopener" : undefined}
            title={link.target}
            aria-label={copy.openExternal(presentation.title)}
          >
            {renderRowContents(
              <ExternalLink size={16} aria-hidden="true" />,
              presentation.title,
              presentation.context,
            )}
          </a>
        );
      }
      return (
        <button
          className="right-links-row"
          type="button"
          title={link.target}
          aria-label={copy.goToBroken(presentation.title)}
          onClick={() => onFocusLinkSource(link)}
        >
          {renderRowContents(
            <FileX2 size={16} aria-hidden="true" />,
            presentation.title,
            presentation.context,
          )}
        </button>
      );
    }

    if (group.status === "ambiguous") {
      const isResolving = resolvingLinkKey === group.key;
      return (
        <div className="right-links-target-with-resolver">
          <button
            className="right-links-row"
            type="button"
            title={link.target}
            aria-label={copy.chooseAmbiguous(
              link.candidateDocumentIds?.length ?? 0,
              presentation.title,
            )}
            aria-expanded={isResolving}
            onClick={() => setResolvingLinkKey(isResolving ? null : group.key)}
          >
            {renderRowContents(
              <FileQuestion size={16} aria-hidden="true" />,
              presentation.title,
              presentation.context,
            )}
          </button>
          {isResolving && renderAmbiguousResolver(link)}
        </div>
      );
    }

    return (
      <button
        className="right-links-row"
        type="button"
        title={link.target}
        aria-label={copy.goToBroken(presentation.title)}
        onClick={() => onFocusLinkSource(link)}
      >
        {renderRowContents(
          <FileX2 size={16} aria-hidden="true" />,
          presentation.title,
          presentation.context,
        )}
      </button>
    );
  };

  return (
    <section className="right-panel-content right-links-panel" aria-label={copy.forFile(activeFileTitle)}>
      <div className="right-links-scroll">
        <LinkSection
          icon={<ArrowUpRight size={14} aria-hidden="true" />}
          label={copy.outgoing}
          emptyMessage={copy.outgoingNone}
          items={model.outgoing}
          getKey={(group) => group.key}
          renderItem={renderOutgoingTarget}
        />
        <LinkSection
          icon={<CornerDownLeft size={14} aria-hidden="true" />}
          label={copy.backlinks}
          emptyMessage={copy.backlinksNone}
          items={model.backlinks}
          getKey={(group) => group.documentId}
          renderItem={renderDocumentLink}
        />
      </div>
    </section>
  );
}
