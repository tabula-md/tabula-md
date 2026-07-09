import { isolateHistory } from "@codemirror/commands";
import {
  Transaction,
  type ChangeSet,
} from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { getTextPatchesForChange, type TextPatch } from "@tabula-md/tabula";
import type { MarkdownBookmark } from "../markdownEditorTypes";

export const clampEditorPosition = (position: number, docLength: number) =>
  Math.max(0, Math.min(position, docLength));

export const getEditorTextChangePatches = (changes: ChangeSet): TextPatch[] => {
  const patches: TextPatch[] = [];

  changes.iterChanges((from, to, _insertFrom, _insertTo, insert) => {
    const insertText = insert.toString();
    if (from !== to || insertText) {
      patches.push({ from, to, insert: insertText });
    }
  });

  return patches;
};

export const isRemoteEditorUpdate = (transactions: readonly Transaction[]) =>
  transactions.some((transaction) => transaction.annotation(Transaction.remote));

export const dispatchRemoteTextChange = (
  view: EditorView,
  nextValue: string,
  preferredPatches?: readonly TextPatch[],
) => {
  const currentValue = view.state.doc.toString();
  if (currentValue === nextValue) {
    return;
  }

  const patches = getTextPatchesForChange(currentValue, nextValue, preferredPatches);
  if (patches.length === 0) {
    return;
  }

  view.dispatch({
    changes: patches.map((patch) => ({
      from: patch.from,
      to: patch.to,
      insert: patch.insert,
    })),
    annotations: [Transaction.remote.of(true), Transaction.addToHistory.of(false)],
  });
};

export const dispatchLocalTextPatches = (
  view: EditorView,
  patches: readonly TextPatch[],
  selection?: { from: number; to: number },
  options: { focus?: boolean; isolateHistory?: boolean } = {},
) => {
  if (patches.length === 0) {
    return false;
  }

  const annotations = options.isolateHistory ? [isolateHistory.of("full")] : undefined;

  view.dispatch({
    changes: patches.map((patch) => ({
      from: patch.from,
      to: patch.to,
      insert: patch.insert,
    })),
    selection: selection ? { anchor: selection.from, head: selection.to } : undefined,
    scrollIntoView: true,
    annotations,
  });
  if (options.focus ?? true) {
    view.focus();
  }
  return true;
};

export const mapBookmarksThroughTransactions = (
  currentBookmarks: readonly MarkdownBookmark[],
  transactions: readonly Transaction[],
  docLength: number,
) => {
  const seenPositions = new Set<number>();
  let changed = false;
  const bookmarks = currentBookmarks
    .map((bookmark) => {
      const position = clampEditorPosition(
        transactions.reduce(
          (mappedPosition, transaction) => transaction.changes.mapPos(mappedPosition, 1),
          bookmark.position,
        ),
        docLength,
      );
      changed = changed || position !== bookmark.position;
      return { ...bookmark, position };
    })
    .filter((bookmark) => {
      if (seenPositions.has(bookmark.position)) {
        changed = true;
        return false;
      }

      seenPositions.add(bookmark.position);
      return true;
    });

  return { bookmarks, changed };
};
