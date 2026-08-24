import {
  Annotation,
  EditorState,
  Prec,
  Transaction,
  type Extension,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
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

/**
 * Marks a deliberate metadata edit made outside the visual body editor.
 * Visual mode otherwise treats valid frontmatter as a protected source range.
 */
export const allowVisualFrontmatterChange = Annotation.define<boolean>();

const transactionTouchesVisualFrontmatter = (transaction: Transaction) => {
  const inspection = inspectFrontmatterData(transaction.startState.doc.toString());
  if (inspection.status !== "valid" || inspection.bodyOffset <= 0) return false;

  let touchesFrontmatter = false;
  transaction.changes.iterChangedRanges((fromA) => {
    if (fromA < inspection.bodyOffset) touchesFrontmatter = true;
  });
  return touchesFrontmatter;
};

const normalizeEmptyVisualBodyInput = (transaction: Transaction) => {
  if (!transaction.isUserEvent("input")) return null;
  const source = transaction.startState.doc.toString();
  const inspection = inspectFrontmatterData(source);
  if (
    inspection.status !== "valid" ||
    inspection.body.length > 0 ||
    inspection.bodyOffset !== source.length ||
    source.endsWith("\n")
  ) {
    return null;
  }

  let insertedText = "";
  let isBodyInsertion = false;
  let changeCount = 0;
  transaction.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    changeCount += 1;
    if (fromA === inspection.bodyOffset && toA === inspection.bodyOffset) {
      insertedText = inserted.sliceString(0, inserted.length, "\n");
      isBodyInsertion = insertedText.length > 0;
    }
  });
  if (changeCount !== 1 || !isBodyInsertion) return null;

  const userEvent = transaction.annotation(Transaction.userEvent);
  const inserted = `\n${insertedText}`;
  return {
    annotations: userEvent ? Transaction.userEvent.of(userEvent) : undefined,
    changes: {
      from: inspection.bodyOffset,
      insert: inserted,
    },
    scrollIntoView: transaction.scrollIntoView,
    selection: { anchor: inspection.bodyOffset + inserted.length },
  };
};

export const createVisualFrontmatterProtectionExtension = (): Extension =>
  [
    EditorState.transactionFilter.of((transaction) => {
      if (!transaction.docChanged) return transaction;
      const normalizedBodyInput = normalizeEmptyVisualBodyInput(transaction);
      if (normalizedBodyInput) return normalizedBodyInput;
      const isDirectVisualInput =
        transaction.isUserEvent("input") || transaction.isUserEvent("delete");
      if (!isDirectVisualInput) return transaction;
      if (
        transaction.annotation(allowVisualFrontmatterChange) ||
        transaction.annotation(Transaction.remote) ||
        transaction.isUserEvent("undo") ||
        transaction.isUserEvent("redo")
      ) {
        return transaction;
      }
      return transactionTouchesVisualFrontmatter(transaction) ? [] : transaction;
    }),
    Prec.highest(EditorView.domEventHandlers({
      pointerdown(event, view) {
        if (event.button !== 0 || !event.isPrimary) return false;
        const bodyPosition = getVisualBodyPlaceholderPosition(view.state.doc.toString());
        if (bodyPosition === null) return false;
        event.preventDefault();
        view.dispatch({
          selection: { anchor: bodyPosition },
          scrollIntoView: true,
        });
        view.focus();
        return true;
      },
    })),
  ];

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

export const getVisualBodyPlaceholderPosition = (markdown: string) => {
  const inspection = inspectFrontmatterData(markdown);
  return inspection.status === "valid" && inspection.body.length === 0
    ? inspection.bodyOffset
    : null;
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
