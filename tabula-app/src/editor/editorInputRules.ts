import { defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import {
  deleteMarkupBackward,
  insertNewlineContinueMarkupCommand,
} from "@codemirror/lang-markdown";
import { type Extension } from "@codemirror/state";
import { type EditorView, keymap } from "@codemirror/view";
import {
  applyMarkdownFormat,
  getMarkdownIndentEdit,
  type MarkdownFormatCommand,
} from "@tabula-md/tabula";

const getMinimalTextChanges = (currentText: string, nextText: string) => {
  if (currentText === nextText) {
    return [];
  }

  const currentTextIndexInNext = nextText.indexOf(currentText);
  if (currentTextIndexInNext >= 0) {
    const prefix = nextText.slice(0, currentTextIndexInNext);
    const suffix = nextText.slice(currentTextIndexInNext + currentText.length);
    return [
      prefix ? { from: 0, to: 0, insert: prefix } : null,
      suffix ? { from: currentText.length, to: currentText.length, insert: suffix } : null,
    ].filter((change): change is { from: number; to: number; insert: string } => Boolean(change));
  }

  const nextTextIndexInCurrent = currentText.indexOf(nextText);
  if (nextTextIndexInCurrent >= 0) {
    const prefixEnd = nextTextIndexInCurrent;
    const suffixStart = nextTextIndexInCurrent + nextText.length;
    return [
      prefixEnd > 0 ? { from: 0, to: prefixEnd, insert: "" } : null,
      suffixStart < currentText.length ? { from: suffixStart, to: currentText.length, insert: "" } : null,
    ].filter((change): change is { from: number; to: number; insert: string } => Boolean(change));
  }

  let from = 0;
  while (from < currentText.length && from < nextText.length && currentText[from] === nextText[from]) {
    from += 1;
  }

  let currentTo = currentText.length;
  let nextTo = nextText.length;
  while (currentTo > from && nextTo > from && currentText[currentTo - 1] === nextText[nextTo - 1]) {
    currentTo -= 1;
    nextTo -= 1;
  }

  return [{
    from,
    to: currentTo,
    insert: nextText.slice(from, nextTo),
  }];
};

export const runMarkdownFormatCommand = (view: EditorView, command: MarkdownFormatCommand) => {
  const currentText = view.state.doc.toString();
  const selection = view.state.selection.main;
  const result = applyMarkdownFormat(currentText, { from: selection.from, to: selection.to }, command);
  const selectionRange = { anchor: result.selection.from, head: result.selection.to };

  if (result.text === currentText) {
    view.dispatch({
      selection: selectionRange,
      scrollIntoView: true,
    });
    view.focus();
    return true;
  }

  const changes = getMinimalTextChanges(currentText, result.text);
  view.dispatch({
    changes,
    selection: selectionRange,
    scrollIntoView: true,
  });
  view.focus();
  return true;
};

const createMarkdownFormatKeyCommand = (command: MarkdownFormatCommand) => (view: EditorView) =>
  runMarkdownFormatCommand(view, command);

const continueMarkdownMarkup = insertNewlineContinueMarkupCommand({ nonTightLists: false });

const runExitEmptyBlockquoteCommand = (view: EditorView) => {
  const selection = view.state.selection.main;
  if (!selection.empty) {
    return false;
  }

  const line = view.state.doc.lineAt(selection.head);
  const column = selection.head - line.from;
  const beforeCursor = line.text.slice(0, column);
  const afterCursor = line.text.slice(column);
  if (afterCursor.trim().length > 0 || !/^(\s*(?:>\s?)+)$/.test(beforeCursor)) {
    return false;
  }

  // CodeMirror waits for two empty quoted lines; Tabula.md exits on the first empty marker line.
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: "" },
    selection: { anchor: line.from, head: line.from },
    scrollIntoView: true,
    userEvent: "input",
  });
  return true;
};

const createMarkdownIndentCommand = (direction: "indent" | "outdent") => (view: EditorView) => {
  const selection = view.state.selection.main;
  const edit = getMarkdownIndentEdit(
    view.state.doc.toString(),
    { from: selection.from, to: selection.to },
    direction,
  );
  if (!edit) {
    return false;
  }

  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: { anchor: edit.selection.from, head: edit.selection.to },
    scrollIntoView: true,
  });
  return true;
};

export const createMarkdownCommandExtensions = (): Extension[] => [
  keymap.of([
    { key: "Enter", run: runExitEmptyBlockquoteCommand },
    { key: "Enter", run: continueMarkdownMarkup },
    { key: "Backspace", run: deleteMarkupBackward },
    { key: "Tab", run: createMarkdownIndentCommand("indent") },
    { key: "Shift-Tab", run: createMarkdownIndentCommand("outdent") },
    indentWithTab,
    { key: "Mod-b", run: createMarkdownFormatKeyCommand("bold") },
    { key: "Mod-i", run: createMarkdownFormatKeyCommand("italic") },
    { key: "Mod-k", run: createMarkdownFormatKeyCommand("link") },
    { key: "Mod-Shift-7", run: createMarkdownFormatKeyCommand("numbered-list") },
    { key: "Mod-Shift-8", run: createMarkdownFormatKeyCommand("bullet-list") },
    { key: "Mod-Shift-9", run: createMarkdownFormatKeyCommand("quote") },
    ...defaultKeymap,
    ...historyKeymap,
  ]),
];
