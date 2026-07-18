import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import type { MarkdownHeading } from "@tabula-md/tabula";
import type { WorkspaceInterfaceCopy } from "../workspace/workspaceInterfaceLocale";
import { PanelEmptyState } from "./PanelEmptyState";

type RightPanelOutlineCopy = WorkspaceInterfaceCopy["sidePanel"]["outline"];

type RightPanelOutlineProps = {
  activeFileTitle: string;
  activeHeadingIndex?: number;
  outlineHeadings: MarkdownHeading[];
  collapsedHeadingIds: Set<string>;
  copy: RightPanelOutlineCopy;
  onToggleHeadingCollapsed: (headingId: string) => void;
  onCollapseAllHeadings: (headingIds: Iterable<string>) => void;
  onExpandAllHeadings: () => void;
  onGoToOutlineHeading: (heading: MarkdownHeading, index: number) => void;
};

export const getOutlineHeadingId = (heading: MarkdownHeading) =>
  `${heading.sourceLineIndex}:${heading.depth}:${heading.text}`;

export const getCollapsibleOutlineHeadingIds = (headings: MarkdownHeading[]) =>
  headings.flatMap((heading, index) =>
    headings[index + 1] && headings[index + 1].depth > heading.depth
      ? [getOutlineHeadingId(heading)]
      : [],
  );

const getVisibleOutlineRows = (headings: MarkdownHeading[], collapsedHeadingIds: Set<string>) => {
  const rows: Array<{
    heading: MarkdownHeading;
    index: number;
    id: string;
    hasChildren: boolean;
    isCollapsed: boolean;
  }> = [];
  let hiddenDescendantDepth: number | null = null;

  headings.forEach((heading, index) => {
    if (hiddenDescendantDepth !== null && heading.depth <= hiddenDescendantDepth) {
      hiddenDescendantDepth = null;
    }

    if (hiddenDescendantDepth !== null && heading.depth > hiddenDescendantDepth) {
      return;
    }

    const id = getOutlineHeadingId(heading);
    const hasChildren = Boolean(headings[index + 1] && headings[index + 1].depth > heading.depth);
    const isCollapsed = collapsedHeadingIds.has(id);

    rows.push({
      heading,
      index,
      id,
      hasChildren,
      isCollapsed,
    });

    if (hasChildren && isCollapsed) {
      hiddenDescendantDepth = heading.depth;
    }
  });

  return rows;
};

export function RightPanelOutline({
  activeFileTitle,
  activeHeadingIndex,
  outlineHeadings,
  collapsedHeadingIds,
  copy,
  onToggleHeadingCollapsed,
  onCollapseAllHeadings,
  onExpandAllHeadings,
  onGoToOutlineHeading,
}: RightPanelOutlineProps) {
  const outlineRows = getVisibleOutlineRows(outlineHeadings, collapsedHeadingIds);
  const collapsibleHeadingIds = getCollapsibleOutlineHeadingIds(outlineHeadings);
  const allHeadingsCollapsed = collapsibleHeadingIds.length > 0
    && collapsibleHeadingIds.every((headingId) => collapsedHeadingIds.has(headingId));

  return (
    <section className={`right-panel-content right-outline-panel ${collapsibleHeadingIds.length > 0 ? "with-toolbar" : ""}`}>
      {collapsibleHeadingIds.length > 0 && (
        <div className="right-outline-toolbar">
          <button
            className="right-panel-toolbar-button"
            type="button"
            aria-label={allHeadingsCollapsed ? copy.expandAll : copy.collapseAll}
            data-tooltip={allHeadingsCollapsed ? copy.expandAll : copy.collapseAll}
            onClick={() => {
              if (allHeadingsCollapsed) onExpandAllHeadings();
              else onCollapseAllHeadings(collapsibleHeadingIds);
            }}
          >
            {allHeadingsCollapsed
              ? <ChevronsUpDown size={16} />
              : <ChevronsDownUp size={16} />}
          </button>
        </div>
      )}
      <div className="right-outline-scroll">
        {outlineRows.length === 0 && <PanelEmptyState>{copy.none}</PanelEmptyState>}
        {outlineRows.length > 0 && (
          <ol className="right-outline-list" aria-label={copy.forFile(activeFileTitle)}>
            {outlineRows.map(({ heading, index, id, hasChildren, isCollapsed }) => (
              <li key={id}>
                <div className={`right-row right-outline-row ${activeHeadingIndex === index ? "active" : ""}`}>
                  {hasChildren ? (
                    <button
                      className="right-outline-toggle"
                      type="button"
                      data-tooltip={isCollapsed ? copy.expand : copy.collapse}
                      aria-label={isCollapsed ? copy.expand : copy.collapse}
                      aria-expanded={!isCollapsed}
                      onClick={() => onToggleHeadingCollapsed(id)}
                    >
                      {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    </button>
                  ) : (
                    <span className="right-outline-toggle-spacer" aria-hidden="true" />
                  )}
                  <button
                    className="right-outline-link"
                    type="button"
                    style={{ paddingLeft: `${Math.max(0, heading.depth - 1) * 12}px` }}
                    aria-current={activeHeadingIndex === index ? "location" : undefined}
                    onClick={() => onGoToOutlineHeading(heading, index)}
                  >
                    <span className="right-row-label">{heading.text}</span>
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
