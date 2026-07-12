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
  clearAuthoritativeText(fileId?: string): boolean;
  flush(): EditorDocumentRuntimeFlushResult | null;
  getLatestFileText(fileId: string, fallbackText: string): string;
  getRuntime(file: EditorDocumentRuntimeFile): EditorDocumentRuntime;
  getVisibleFileText(file: EditorDocumentRuntimeFile): string;
  setAuthoritativeText(fileId: string, text: string): boolean;
};

export const createWorkspaceEditorDocumentRuntimeOwner = (): WorkspaceEditorDocumentRuntimeOwner => {
  let runtime: EditorDocumentRuntime | null = null;
  let authoritativeText: { fileId: string; text: string } | null = null;

  const getSourceText = (file: EditorDocumentRuntimeFile) =>
    authoritativeText?.fileId === file.id ? authoritativeText.text : file.text;

  const getRuntime = (file: EditorDocumentRuntimeFile) => {
    if (runtime?.getSnapshot().fileId === file.id) {
      return runtime;
    }

    runtime = createEditorDocumentRuntime({
      fileId: file.id,
      text: getSourceText(file),
    });
    return runtime;
  };

  return {
    clear() {
      runtime = null;
      authoritativeText = null;
    },

    clearAuthoritativeText(fileId) {
      if (!authoritativeText || (fileId && authoritativeText.fileId !== fileId)) return false;
      authoritativeText = null;
      return true;
    },

    flush() {
      return runtime?.flush() ?? null;
    },

    getLatestFileText(fileId, fallbackText) {
      if (authoritativeText?.fileId === fileId) return authoritativeText.text;
      return runtime?.getSnapshot().fileId === fileId ? runtime.getVisibleText() : fallbackText;
    },

    getRuntime,

    getVisibleFileText(file) {
      const activeRuntime = getRuntime(file);
      const snapshot = activeRuntime.getSnapshot();
      const sourceText = getSourceText(file);
      if (!snapshot.pendingCommit && snapshot.committedText !== sourceText) {
        activeRuntime.syncCommitted({ fileId: file.id, text: sourceText });
      }

      return activeRuntime.getVisibleText();
    },

    setAuthoritativeText(fileId, text) {
      if (authoritativeText?.fileId === fileId && authoritativeText.text === text) return false;
      authoritativeText = { fileId, text };
      if (runtime?.getSnapshot().fileId === fileId && !runtime.getSnapshot().pendingCommit) {
        runtime.syncCommitted({ fileId, text });
      }
      return true;
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
