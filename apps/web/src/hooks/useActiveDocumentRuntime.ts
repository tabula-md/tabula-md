import { useMemo } from "react";
import { createActiveDocumentRuntime } from "../document";
import type { WorkspaceFile } from "../workspaceStorage";

export const useActiveDocumentRuntime = (activeFile?: WorkspaceFile) => {
  return useMemo(
    () => createActiveDocumentRuntime(activeFile),
    [
      activeFile?.bookmarks,
      activeFile?.lineNumbers,
      activeFile?.lineWrapping,
      activeFile?.readingWidth,
      activeFile?.splitRatio,
      activeFile?.text,
      activeFile?.title,
      activeFile?.viewMode,
    ],
  );
};
