import { inspectFrontmatterData } from "@tabula-md/tabula";

export type EditorSourceSelection = {
  anchor: number;
  head: number;
};

export type VisualFrontmatterSelectionTransition = {
  bodyOffset: number;
  sourceSelection: EditorSourceSelection;
  visualSelection: EditorSourceSelection;
};

export const getVisualFrontmatterSelectionTransition = (
  markdown: string,
  selection: EditorSourceSelection,
): VisualFrontmatterSelectionTransition | null => {
  const inspection = inspectFrontmatterData(markdown);
  if (inspection.status !== "valid" || inspection.bodyOffset <= 0) return null;

  const selectionStart = Math.min(selection.anchor, selection.head);
  if (selectionStart >= inspection.bodyOffset) return null;

  return {
    bodyOffset: inspection.bodyOffset,
    sourceSelection: selection,
    visualSelection: {
      anchor: inspection.bodyOffset,
      head: inspection.bodyOffset,
    },
  };
};

export const restoreFrontmatterSourceSelection = (
  markdown: string,
  selection: EditorSourceSelection,
): EditorSourceSelection | null => {
  const inspection = inspectFrontmatterData(markdown);
  if (inspection.status !== "valid" || inspection.bodyOffset <= 0) return null;

  const lastFrontmatterPosition = Math.max(0, inspection.bodyOffset - 1);
  return {
    anchor: Math.min(selection.anchor, lastFrontmatterPosition),
    head: Math.min(selection.head, lastFrontmatterPosition),
  };
};
