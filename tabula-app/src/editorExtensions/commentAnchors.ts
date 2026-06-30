import { type Extension } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { MarkdownCommentAnchor } from "../markdownEditorTypes";

export const createCommentAnchorExtension = (
  commentAnchors: MarkdownCommentAnchor[] = [],
  activeCommentId?: string | null,
  onOpenComment?: (commentId: string) => void,
): Extension => [
  EditorView.decorations.of((view) => {
    const docLength = view.state.doc.length;
    const ranges = commentAnchors
      .map((anchor) => ({
        ...anchor,
        start: Math.max(0, Math.min(anchor.start, docLength)),
        end: Math.max(0, Math.min(anchor.end, docLength)),
      }))
      .filter((anchor) => anchor.end > anchor.start)
      .sort((a, b) => a.start - b.start || a.end - b.end)
      .map((anchor) =>
        Decoration.mark({
          class: anchor.id === activeCommentId ? "cm-comment-mark active" : "cm-comment-mark",
          attributes: {
            "data-comment-id": anchor.id,
            title: anchor.id === activeCommentId ? "Active comment" : "Open comment",
          },
        }).range(anchor.start, anchor.end),
      );

    return Decoration.set(ranges, true);
  }),
  EditorView.domEventHandlers({
    click(event) {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      const commentMark =
        target.closest<HTMLElement>(".cm-comment-mark") ?? target.querySelector<HTMLElement>(".cm-comment-mark");
      const commentId = commentMark?.dataset.commentId;
      if (!commentId || !onOpenComment) {
        return false;
      }

      event.preventDefault();
      onOpenComment(commentId);
      return true;
    },
  }),
];
