import { useRef } from "react";
import {
  createEditorDocumentRuntime,
  type EditorDocumentRuntime,
  type EditorDocumentRuntimeFlushResult,
} from "@tabula-md/tabula";
import type { WorkspaceFile } from "../workspaceStorage";

type EditorDocumentRuntimeFile = Pick<WorkspaceFile, "id" | "text">;

export type WorkspaceEditorDocumentRuntimeOwner = {
  clear(): void;
  flush(): EditorDocumentRuntimeFlushResult | null;
  getLatestFileText(fileId: string, fallbackText: string): string;
  getRuntime(file: EditorDocumentRuntimeFile): EditorDocumentRuntime;
  getVisibleFileText(file: EditorDocumentRuntimeFile): string;
};

export const createWorkspaceEditorDocumentRuntimeOwner = (): WorkspaceEditorDocumentRuntimeOwner => {
  let runtime: EditorDocumentRuntime | null = null;

  const getRuntime = (file: EditorDocumentRuntimeFile) => {
    if (runtime?.getSnapshot().fileId === file.id) {
      return runtime;
    }

    runtime = createEditorDocumentRuntime({
      fileId: file.id,
      text: file.text,
    });
    return runtime;
  };

  return {
    clear() {
      runtime = null;
    },

    flush() {
      return runtime?.flush() ?? null;
    },

    getLatestFileText(fileId, fallbackText) {
      return runtime?.getSnapshot().fileId === fileId ? runtime.getText() : fallbackText;
    },

    getRuntime,

    getVisibleFileText(file) {
      const activeRuntime = getRuntime(file);
      const snapshot = activeRuntime.getSnapshot();
      if (!snapshot.pendingCommit && snapshot.committedText !== file.text) {
        activeRuntime.syncCommitted({ fileId: file.id, text: file.text });
      }

      return activeRuntime.getText();
    },
  };
};

export const useWorkspaceEditorDocumentRuntimeOwner = () => {
  const ownerRef = useRef<WorkspaceEditorDocumentRuntimeOwner | null>(null);
  if (!ownerRef.current) {
    ownerRef.current = createWorkspaceEditorDocumentRuntimeOwner();
  }

  return ownerRef.current;
};
