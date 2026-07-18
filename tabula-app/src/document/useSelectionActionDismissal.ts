import { useEffect } from "react";
import type { MarkdownSelectionActionPosition } from "./markdownEditorTypes";

type UseSelectionActionDismissalOptions = {
  selectionActionPosition: MarkdownSelectionActionPosition | null;
  setSelectionActionPosition: (
    position: MarkdownSelectionActionPosition | null,
  ) => void;
};

export function useSelectionActionDismissal({
  selectionActionPosition,
  setSelectionActionPosition,
}: UseSelectionActionDismissalOptions) {
  useEffect(() => {
    if (!selectionActionPosition) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          ".selection-comment-popover, .cm-annotationGutter, .cm-comment-mark, .preview-comment-mark",
        )
      ) {
        return;
      }

      setSelectionActionPosition(null);
    };

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      window.removeEventListener("pointerdown", handlePointerDown, true);
  }, [selectionActionPosition, setSelectionActionPosition]);
}
