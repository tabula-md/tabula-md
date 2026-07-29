import { StateField } from "@codemirror/state";
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
import type {
  EditorVisualModeCopy,
  EditorVisualModeOptions,
} from "./editorVisualModeTypes";

export type { EditorVisualModeCopy } from "./editorVisualModeTypes";
export { getEditorVisualWorkspaceLinkRanges } from "./editorVisualModeLinks";

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
      return buildEditorVisualDecorationSets(
        state,
        state.field(interactionField),
        copy,
        options,
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
      return buildEditorVisualDecorationSets(
        transaction.state,
        transaction.state.field(interactionField),
        copy,
        options,
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
