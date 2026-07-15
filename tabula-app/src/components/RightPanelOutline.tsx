import { ChevronDown, ChevronRight } from "lucide-react";
import type { MarkdownHeading } from "@tabula-md/tabula";
import type { WorkspaceInterfaceCopy } from "../workspaceInterfaceLocale";
import { PanelEmptyState } from "./right-panel/PanelEmptyState";

type RightPanelOutlineCopy = WorkspaceInterfaceCopy["sidePanel"]["outline"];

type RightPanelOutlineProps = {
  activeFileTitle: string;
  activeHeadingIndex?: number;
  outlineHeadings: MarkdownHeading[];
  collapsedHeadingIds: Set<string>;
  copy: RightPanelOutlineCopy;
  onToggleHeadingCollapsed: (headingId: string) => void;
  onGoToOutlineHeading: (heading: MarkdownHeading, index: number) => void;
};

const getOutlineHeadingId = (heading: MarkdownHeading) =>
  `${heading.sourceLineIndex}:${heading.depth}:${heading.text}`;

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
  onGoToOutlineHeading,
}: RightPanelOutlineProps) {
  const outlineRows = getVisibleOutlineRows(outlineHeadings, collapsedHeadingIds);

  return (
    <section className="right-panel-content">
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
    </section>
  );
}
