import { StateEffect, StateField, type EditorState, type Extension } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import type { MarkdownCommentAnchor, MarkdownEditorInterfaceCopy } from "../markdownEditorTypes";

const buildCommentDecorations = (
  state: EditorState,
  commentAnchors: MarkdownCommentAnchor[],
  activeCommentId: string | null | undefined,
  copy: Pick<MarkdownEditorInterfaceCopy, "activeComment" | "openComment">,
) => {
  const docLength = state.doc.length;
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
            "data-tooltip": anchor.id === activeCommentId ? copy.activeComment : copy.openComment,
          },
        }).range(anchor.start, anchor.end),
      );

  return Decoration.set(ranges, true);
};

type CommentAnchorDecorationState = {
  commentAnchors: MarkdownCommentAnchor[];
  activeCommentId: string | null | undefined;
  copy: Pick<MarkdownEditorInterfaceCopy, "activeComment" | "openComment">;
};

export const setCommentAnchorDecorations = StateEffect.define<CommentAnchorDecorationState>();

export const commentAnchorDecorationField = StateField.define({
  create: () => Decoration.none,
  update(current, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setCommentAnchorDecorations)) {
        return buildCommentDecorations(
          transaction.state,
          effect.value.commentAnchors,
          effect.value.activeCommentId,
          effect.value.copy,
        );
      }
    }
    return current.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const createCommentAnchorExtension = (
  _commentAnchors: MarkdownCommentAnchor[] = [],
  _activeCommentId: string | null | undefined,
  _copy: Pick<MarkdownEditorInterfaceCopy, "activeComment" | "openComment">,
  onOpenComment?: (commentId: string) => void,
): Extension => {
  return [
  commentAnchorDecorationField,
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
};
