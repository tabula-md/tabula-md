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
};

export const createWorkspaceEditorDocumentRuntimeOwner = (): WorkspaceEditorDocumentRuntimeOwner => {
  let runtime: EditorDocumentRuntime | null = null;

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

    getRuntime(file) {
      if (runtime?.getSnapshot().fileId === file.id) {
        return runtime;
      }

      runtime = createEditorDocumentRuntime({
        fileId: file.id,
        text: file.text,
      });
      return runtime;
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
