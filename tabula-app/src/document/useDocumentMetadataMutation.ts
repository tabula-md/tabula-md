import { useCallback, type RefObject } from "react";
import {
  diffTextPatch,
  type FrontmatterValueUpdate,
  type TextChange,
} from "@tabula-md/tabula";
import type { MarkdownEditorHandle } from "./markdownEditorTypes";
import type { DocumentPropertiesCopy } from "./documentPropertiesLocale";

type DocumentMetadataMutationOptions = {
  copy: DocumentPropertiesCopy;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  markdown: string;
  onChange: (nextValue: string | null, change?: TextChange) => void;
  onError: (message: string | null) => void;
};

export function useDocumentMetadataMutation({
  copy,
  editorRef,
  markdown,
  onChange,
  onError,
}: DocumentMetadataMutationOptions) {
  return useCallback((result: FrontmatterValueUpdate) => {
    if (!result.ok) {
      onError(
        result.reason === "invalid_key"
          ? copy.invalidKey
          : result.reason === "duplicate_key"
            ? copy.duplicateKey
            : copy.updateFailed,
      );
      return false;
    }
    if (result.markdown === markdown) return true;
    const patch = diffTextPatch(markdown, result.markdown);
    const applied = editorRef.current?.applyLocalTextPatches([patch], undefined, {
      allowFrontmatterChanges: true,
      focus: false,
      isolateHistory: true,
    }) ?? false;
    if (!applied) onChange(result.markdown, { patches: [patch] });
    onError(null);
    return true;
  }, [copy, editorRef, markdown, onChange, onError]);
}
