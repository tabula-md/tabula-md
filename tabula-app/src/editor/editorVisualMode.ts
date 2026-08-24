import { StateField, type Transaction } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";
import {
  buildEditorVisualDecorationSets,
  editorVisualSourceHighlighting,
  type EditorVisualDecorationSets,
} from "./editorVisualModeDecorations";
import {
  createEditorVisualNavigationExtension,
  editorVisualPointerSelectionExtensions,
  type EditorVisualInteraction,
  updateEditorVisualInteraction,
} from "./editorVisualModeInteraction";
import {
  EDITOR_VISUAL_CURSOR_SAFE_MARGIN,
  editorVisualViewportPlugin,
} from "./editorVisualViewport";
import { createVisualFrontmatterProtectionExtension } from "./editorVisualFrontmatter";
import {
  getMarkdownPresentationDocument,
  type MarkdownPresentationChange,
  updateMarkdownPresentationDocument,
} from "../markdownPresentationCache";
import type {
  EditorVisualModeCopy,
  EditorVisualModeOptions,
} from "./editorVisualModeTypes";

export type { EditorVisualModeCopy } from "./editorVisualModeTypes";
export { getEditorVisualWorkspaceLinkRanges } from "./editorVisualModeLinks";

const getSinglePresentationChange = (
  transaction: Transaction,
): MarkdownPresentationChange | null => {
  let change: MarkdownPresentationChange | null = null;
  let changeCount = 0;
  transaction.changes.iterChangedRanges((fromA, toA, fromB, toB) => {
    changeCount += 1;
    change = { fromA, fromB, toA, toB };
  });
  return changeCount === 1 ? change : null;
};

export const createEditorVisualModeExtension = (
  copy: EditorVisualModeCopy,
  options: EditorVisualModeOptions = {},
) => {
  const interactionField = StateField.define<EditorVisualInteraction>({
    create() {
      return { editing: null, stopped: null };
    },
    update: updateEditorVisualInteraction,
  });
  const decorationField = StateField.define<EditorVisualDecorationSets>({
    create(state) {
      const presentation = getMarkdownPresentationDocument(
        state.doc.toString(),
      );
      return buildEditorVisualDecorationSets(
        state,
        state.field(interactionField),
        copy,
        options,
        presentation,
      );
    },
    update(value, transaction) {
      const previousEditing =
        transaction.startState.field(interactionField, false)?.editing ?? null;
      const nextEditing =
        transaction.state.field(interactionField, false)?.editing ?? null;
      const previousStopped =
        transaction.startState.field(interactionField, false)?.stopped ?? null;
      const nextStopped =
        transaction.state.field(interactionField, false)?.stopped ?? null;
      const editingChanged =
        previousEditing?.from !== nextEditing?.from ||
        previousEditing?.to !== nextEditing?.to;
      const stoppedChanged =
        previousStopped?.from !== nextStopped?.from ||
        previousStopped?.to !== nextStopped?.to ||
        previousStopped?.forward !== nextStopped?.forward ||
        previousStopped?.goalColumn !== nextStopped?.goalColumn;
      const selectionChanged =
        !transaction.startState.selection.eq(transaction.state.selection);
      if (
        !transaction.docChanged &&
        !editingChanged &&
        !stoppedChanged &&
        !selectionChanged
      ) {
        return value;
      }
      const presentation = transaction.docChanged
        ? updateMarkdownPresentationDocument(
            value.presentation,
            transaction.state.doc.toString(),
            getSinglePresentationChange(transaction),
          )
        : value.presentation;
      return buildEditorVisualDecorationSets(
        transaction.state,
        transaction.state.field(interactionField),
        copy,
        options,
        presentation,
      );
    },
    provide: (field) => [
      EditorView.decorations.from(field, (value) => value.decorations),
      EditorView.atomicRanges.of((view) =>
        view.state.field(field, false)?.atomicRanges ?? Decoration.none),
    ],
  });
  const navigationExtension = createEditorVisualNavigationExtension(
    interactionField,
    (state) => state.field(decorationField).replacements,
  );

  return [
    EditorView.editorAttributes.of({ class: "cm-visual-editor" }),
    createVisualFrontmatterProtectionExtension(),
    EditorView.cursorScrollMargin.of({
      x: 5,
      y: EDITOR_VISUAL_CURSOR_SAFE_MARGIN,
    }),
    editorVisualSourceHighlighting,
    ...editorVisualPointerSelectionExtensions,
    editorVisualViewportPlugin,
    interactionField,
    navigationExtension,
    decorationField,
  ];
};
