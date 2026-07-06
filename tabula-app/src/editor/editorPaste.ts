import { type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

export const normalizePastedMarkdown = (pastedText: string) => {
  const lineEndingNormalized = pastedText.replace(/\r\n?/g, "\n");
  const tabNormalized = lineEndingNormalized.replace(/(^|\n)(\t+)/g, (_, prefix: string, tabs: string) => {
    return `${prefix}${"  ".repeat(tabs.length)}`;
  });

  return tabNormalized === pastedText ? null : tabNormalized;
};

export const createEditorPasteNormalizationExtension = (): Extension =>
  EditorView.clipboardInputFilter.of((pastedText) => normalizePastedMarkdown(pastedText) ?? pastedText);
