import type { EditorScrollPosition } from "@tabula-md/tabula";

export type EditorViewportAnchor = EditorScrollPosition;

export type SplitPreviewMode =
  | { kind: "editor-follow"; latestEditorPosition: EditorScrollPosition }
  | { kind: "preview-free" };

export type MarkdownPreviewHandle = {
  followEditorPosition: (position: EditorScrollPosition) => void;
  getViewportLineAnchor: () => EditorScrollPosition | null;
};
