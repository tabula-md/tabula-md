import { useState, type ReactNode } from "react";
import { ArrowUpRight, ChevronDown, CornerDownLeft } from "lucide-react";
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
import type { RightPanelLinkSection } from "./useRightPanelCollapseState";

type RightPanelLinksCopy = WorkspaceInterfaceCopy["sidePanel"]["links"];

type RightPanelLinksProps = {
  activeFileId: string;
  activeFileTitle: string;
  collapsedSections: ReadonlySet<RightPanelLinkSection>;
  copy: RightPanelLinksCopy;
  fileLabels: ReadonlyMap<string, WorkspaceFileTabLabel>;
  index?: WorkspaceKnowledgeIndex;
  onFocusLinkSource: (link: WorkspaceKnowledgeLink) => void;
  onResolveAmbiguousLink: (
    link: WorkspaceKnowledgeLink,
    targetPath: string,
  ) => boolean;
  onSelectFile: (fileId: string) => void;
  onToggleSection: (section: RightPanelLinkSection) => void;
};

type LinkSectionProps<Item> = {
  collapsed: boolean;
  icon: ReactNode;
  label: string;
  emptyMessage: string;
  items: readonly Item[];
  getKey: (item: Item) => string;
  onToggle: () => void;
  renderItem: (item: Item) => ReactNode;
  toggleLabel: string;
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
  collapsed,
  icon,
  label,
  emptyMessage,
  items,
  getKey,
  onToggle,
  renderItem,
  toggleLabel,
}: LinkSectionProps<Item>) {
  return (
    <section className="right-links-section" aria-label={label}>
      <h3 className="right-links-section-title">
        <button
          className="right-links-section-toggle"
          type="button"
          aria-expanded={!collapsed}
          aria-label={toggleLabel}
          onClick={onToggle}
        >
          <span className="right-links-section-direction">{icon}</span>
          <span>{label}</span>
          <span className="right-links-count">{items.length}</span>
          <ChevronDown
            className={`right-links-section-chevron ${collapsed ? "collapsed" : ""}`}
            size={14}
            aria-hidden="true"
          />
        </button>
      </h3>
      {!collapsed && (
        <div className="right-links-list">
          {items.length === 0
            ? <p className="right-links-section-empty">{emptyMessage}</p>
            : items.map((item) => <div key={getKey(item)}>{renderItem(item)}</div>)}
        </div>
      )}
    </section>
  );
}

export function RightPanelLinks({
  activeFileId,
  activeFileTitle,
  collapsedSections,
  copy,
  fileLabels,
  index,
  onFocusLinkSource,
  onResolveAmbiguousLink,
  onSelectFile,
  onToggleSection,
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
    title: string,
    context: string,
    action?: ReactNode,
  ) => (
    <>
      <span className="right-links-row-text">
        <span className="right-links-row-title">{title}</span>
        <span className="right-links-row-target">{context}</span>
      </span>
      {action && <span className="right-links-row-action">{action}</span>}
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
          presentation.title,
          presentation.context,
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
              presentation.title,
              presentation.context,
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
            presentation.title,
            presentation.context,
            copy.notFound,
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
              presentation.title,
              presentation.context,
              copy.matchCount(link.candidateDocumentIds?.length ?? 0),
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
          presentation.title,
          presentation.context,
          copy.notFound,
        )}
      </button>
    );
  };

  return (
    <section className="right-panel-content right-links-panel" aria-label={copy.forFile(activeFileTitle)}>
      <div className="right-links-scroll">
        <LinkSection
          collapsed={collapsedSections.has("outgoing")}
          icon={<ArrowUpRight size={14} aria-hidden="true" />}
          label={copy.outgoing}
          emptyMessage={copy.outgoingNone}
          items={model.outgoing}
          getKey={(group) => group.key}
          onToggle={() => onToggleSection("outgoing")}
          renderItem={renderOutgoingTarget}
          toggleLabel={
            collapsedSections.has("outgoing")
              ? copy.expandSection(copy.outgoing)
              : copy.collapseSection(copy.outgoing)
          }
        />
        <LinkSection
          collapsed={collapsedSections.has("backlinks")}
          icon={<CornerDownLeft size={14} aria-hidden="true" />}
          label={copy.backlinks}
          emptyMessage={copy.backlinksNone}
          items={model.backlinks}
          getKey={(group) => group.documentId}
          onToggle={() => onToggleSection("backlinks")}
          renderItem={renderDocumentLink}
          toggleLabel={
            collapsedSections.has("backlinks")
              ? copy.expandSection(copy.backlinks)
              : copy.collapseSection(copy.backlinks)
          }
        />
      </div>
    </section>
  );
}
