import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import type { MarkdownPresentationDocument } from "@tabula-md/tabula";
import {
  buildEditorVisualModel,
  setEditorVisualPresentationDocument,
  type EditorVisualReplacement,
} from "./editorVisualModeModel";
import type { EditorVisualInteraction } from "./editorVisualModeInteraction";
import { getEditorVisualWorkspaceLinkRanges } from "./editorVisualModeLinks";
import type {
  EditorVisualModeCopy,
  EditorVisualModeOptions,
} from "./editorVisualModeTypes";
import { createEditorVisualReplacementDecoration } from "./editorVisualModeWidgets";

const visualSourceHighlightStyle = HighlightStyle.define([
  { tag: tags.strong, class: "cm-visual-strong" },
  { tag: tags.emphasis, class: "cm-visual-emphasis" },
  { tag: tags.strikethrough, class: "cm-visual-strikethrough" },
  { tag: tags.link, class: "cm-visual-link" },
  { tag: tags.url, class: "cm-visual-link-url" },
  {
    tag: tags.monospace,
    class: "ui-selection-aware-inline cm-visual-inline-code",
  },
  { tag: tags.keyword, class: "cm-visual-token-keyword" },
  { tag: [tags.atom, tags.bool, tags.number], class: "cm-visual-token-literal" },
  { tag: tags.string, class: "cm-visual-token-string" },
  { tag: tags.operator, class: "cm-visual-token-operator" },
  { tag: [tags.comment, tags.quote], class: "cm-visual-token-comment" },
  { tag: tags.meta, class: "cm-visual-token-meta" },
]);

export const editorVisualSourceHighlighting =
  syntaxHighlighting(visualSourceHighlightStyle);

export type EditorVisualDecorationSets = {
  decorations: DecorationSet;
  atomicRanges: DecorationSet;
  presentation: MarkdownPresentationDocument;
  replacements: readonly EditorVisualReplacement[];
};

export const buildEditorVisualDecorationSets = (
  state: EditorState,
  interaction: EditorVisualInteraction,
  copy: EditorVisualModeCopy,
  options: EditorVisualModeOptions,
  presentation: MarkdownPresentationDocument,
): EditorVisualDecorationSets => {
  setEditorVisualPresentationDocument(state, presentation);
  const model = buildEditorVisualModel(
    state,
    [{ from: 0, to: state.doc.length }],
    interaction.editing,
  );
  const lineRanges = model.lines.map(({ className, from }) =>
    Decoration.line({ class: className }).range(from));
  const hiddenRanges = model.hiddenRanges.map(({ from, to }) =>
    Decoration.replace({}).range(from, to));
  const replacementRanges = model.replacements.map((replacement) =>
    createEditorVisualReplacementDecoration(replacement, copy)
      .range(replacement.from, replacement.to));
  const workspaceLinkRanges = getEditorVisualWorkspaceLinkRanges(state, options).map(
    ({ from, status, to }) =>
      Decoration.mark({
        class: `cm-visual-workspace-link cm-visual-workspace-link-${status}`,
      }).range(from, to),
  );
  return {
    decorations: Decoration.set(
      [
        ...lineRanges,
        ...hiddenRanges,
        ...replacementRanges,
        ...workspaceLinkRanges,
      ],
      true,
    ),
    atomicRanges: Decoration.set(
      [...hiddenRanges, ...replacementRanges],
      true,
    ),
    presentation,
    replacements: model.replacements,
  };
};
