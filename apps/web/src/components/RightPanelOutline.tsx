import { ChevronDown, ChevronRight } from "lucide-react";
import type { MarkdownHeading } from "../markdown";

type RightPanelOutlineProps = {
  activeFileTitle: string;
  outlineHeadings: MarkdownHeading[];
  collapsedHeadingIds: Set<string>;
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
  outlineHeadings,
  collapsedHeadingIds,
  onToggleHeadingCollapsed,
  onGoToOutlineHeading,
}: RightPanelOutlineProps) {
  const outlineRows = getVisibleOutlineRows(outlineHeadings, collapsedHeadingIds);

  return (
    <section className="right-panel-content">
      {outlineRows.length > 0 && (
        <ol className="right-outline-list" aria-label={`Outline for ${activeFileTitle}`}>
          {outlineRows.map(({ heading, index, id, hasChildren, isCollapsed }) => (
            <li key={id}>
              <div className="right-row right-outline-row">
                {hasChildren ? (
                  <button
                    className="right-outline-toggle"
                    type="button"
                    title={isCollapsed ? "Expand section" : "Collapse section"}
                    aria-label={isCollapsed ? "Expand section" : "Collapse section"}
                    aria-expanded={!isCollapsed}
                    onClick={() => onToggleHeadingCollapsed(id)}
                  >
                    {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                  </button>
                ) : (
                  <span className="right-outline-toggle-spacer" aria-hidden="true" />
                )}
                <button
                  className="right-outline-link"
                  type="button"
                  onClick={() => onGoToOutlineHeading(heading, index)}
                >
                  <span className="right-outline-depth" aria-hidden="true">
                    {"#".repeat(heading.depth)}
                  </span>
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
