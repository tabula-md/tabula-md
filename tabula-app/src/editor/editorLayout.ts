import { Compartment, type Extension } from "@codemirror/state";
import {
  EditorView,
  lineNumbers as codeMirrorLineNumbers,
} from "@codemirror/view";
import type { MarkdownSelectionActionPosition } from "../markdownEditorTypes";
import { clampEditorPosition } from "./editorTransactions";

export type EditorLayoutCompartments = {
  lineNumbers: Compartment;
  wrapping: Compartment;
};

export const createEditorLayoutCompartments = (): EditorLayoutCompartments => ({
  lineNumbers: new Compartment(),
  wrapping: new Compartment(),
});

export const createEditorLineNumbersExtension = (lineNumbers: boolean): Extension =>
  lineNumbers ? [codeMirrorLineNumbers()] : [];

export const createEditorLineWrappingExtension = (lineWrapping: boolean): Extension =>
  lineWrapping ? EditorView.lineWrapping : [];

export const getEditorSelectionActionPosition = (
  view: EditorView,
): MarkdownSelectionActionPosition | null => {
  const selection = view.state.selection.main;
  if (selection.empty) {
    return null;
  }

  const coordinates = view.coordsAtPos(selection.to);
  if (!coordinates) {
    return null;
  }

  return {
    clientX: (coordinates.left + coordinates.right) / 2,
    clientY: coordinates.top,
  };
};

export const dispatchEditorSelectionRange = (
  view: EditorView,
  from: number,
  to = from,
  options: { focus?: boolean } = {},
) => {
  const docLength = view.state.doc.length;
  const selectionFrom = clampEditorPosition(from, docLength);
  const selectionTo = clampEditorPosition(to, docLength);
  view.dispatch({
    selection: { anchor: selectionFrom, head: selectionTo },
    scrollIntoView: true,
  });

  if (options.focus) {
    view.focus();
  }
};
