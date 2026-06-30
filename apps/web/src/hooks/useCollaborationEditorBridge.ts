import type { RefObject } from "react";
import type { MarkdownEditorHandle } from "../markdownEditorTypes";
import type { TextChange } from "../textPatches";
import { useEventCallback } from "./useEventCallback";

type UseCollaborationEditorBridgeOptions = {
  activeFileId?: string;
  editorRef: RefObject<MarkdownEditorHandle | null>;
};

export function useCollaborationEditorBridge({
  activeFileId,
  editorRef,
}: UseCollaborationEditorBridgeOptions) {
  return useEventCallback(
    (fileId: string, nextText: string, change?: TextChange) => {
      if (fileId !== activeFileId) {
        return;
      }

      editorRef.current?.applyRemoteTextChange(nextText, change?.patches);
    },
  );
}
