import { defaultKeymap, historyKeymap, indentWithTab } from "@codemirror/commands";
import { type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import {
  applyMarkdownFormat,
  getMarkdownEnterEdit,
  getMarkdownIndentEdit,
  getMarkdownPasteEdit,
  type MarkdownFormatCommand,
} from "@tabula-md/tabula";

const getMinimalTextChange = (currentText: string, nextText: string) => {
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

  return {
    from,
    to: currentTo,
    insert: nextText.slice(from, nextTo),
  };
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

  const change = getMinimalTextChange(currentText, result.text);
  view.dispatch({
    changes: change,
    selection: selectionRange,
    scrollIntoView: true,
  });
  view.focus();
  return true;
};

const createMarkdownFormatKeyCommand = (command: MarkdownFormatCommand) => (view: EditorView) =>
  runMarkdownFormatCommand(view, command);

const runMarkdownEnterCommand = (view: EditorView) => {
  const selection = view.state.selection.main;
  if (!selection.empty) {
    return false;
  }

  const edit = getMarkdownEnterEdit(view.state.doc.toString(), selection.head);
  if (!edit) {
    return false;
  }

  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: { anchor: edit.selection, head: edit.selection },
    scrollIntoView: true,
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

const runMarkdownPasteCommand = (view: EditorView, event: ClipboardEvent) => {
  const clipboardText = event.clipboardData?.getData("text/plain") ?? "";
  if (!clipboardText) {
    return false;
  }

  const selection = view.state.selection.main;
  const edit = getMarkdownPasteEdit(
    view.state.doc.toString(),
    { from: selection.from, to: selection.to },
    clipboardText,
  );
  if (!edit) {
    return false;
  }

  event.preventDefault();
  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: { anchor: edit.selection.from, head: edit.selection.to },
    scrollIntoView: true,
  });
  return true;
};

export const createMarkdownCommandExtensions = (): Extension[] => [
  EditorView.domEventHandlers({
    paste(event, view) {
      return runMarkdownPasteCommand(view, event);
    },
  }),
  keymap.of([
    { key: "Enter", run: runMarkdownEnterCommand },
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
