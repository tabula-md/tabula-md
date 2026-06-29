import type { RefObject } from "react";
import type {
  Collaborator,
  CollabRecoveryEvent,
  ConnectionStatus,
  LiveSelection,
} from "../collab";
import type { MarkdownEditorHandle } from "../markdownEditorTypes";
import type { TextChange } from "../textPatches";
import type { WorkspaceFile } from "../workspaceStorage";
import { useCollaborationRoom } from "./useCollaborationRoom";
import { useEventCallback } from "./useEventCallback";

type UseWorkspaceCollaborationRuntimeOptions = {
  activeFile?: WorkspaceFile;
  activeSelection?: LiveSelection;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  identity: Collaborator;
  setFileText: (fileId: string, text: string) => void;
  setFileCollaborationStatus: (
    fileId: string,
    status: ConnectionStatus,
    options?: { collaboratorCount?: number; requireRoom?: boolean },
  ) => void;
  setFileCollaboratorCount: (fileId: string, collaboratorCount: number) => void;
  setFileRoomMeta: (
    fileId: string,
    meta: { snapshotCount: number; lastSnapshotAt?: string },
  ) => void;
  setFileRecoveryEvent: (
    fileId: string,
    event: {
      type: CollabRecoveryEvent["type"];
      message: string;
      createdAt: string;
    },
  ) => void;
  startFileCollaborationSession: (
    fileId: string,
    roomId: string,
    shareUrl: string,
  ) => WorkspaceFile | undefined;
};

export function useWorkspaceCollaborationRuntime({
  activeFile,
  activeSelection,
  editorRef,
  identity,
  setFileText,
  setFileCollaborationStatus,
  setFileCollaboratorCount,
  setFileRoomMeta,
  setFileRecoveryEvent,
  startFileCollaborationSession,
}: UseWorkspaceCollaborationRuntimeOptions) {
  const handleRemoteTextChange = useEventCallback(
    (fileId: string, nextText: string, change?: TextChange) => {
      if (fileId !== activeFile?.id) {
        return;
      }

      editorRef.current?.applyRemoteTextChange(nextText, change?.patches);
    },
  );

  return useCollaborationRoom({
    activeFile,
    activeSelection,
    identity,
    setFileText,
    setFileCollaborationStatus,
    setFileCollaboratorCount,
    setFileRoomMeta,
    setFileRecoveryEvent,
    startFileCollaborationSession,
    onRemoteTextChange: handleRemoteTextChange,
  });
}
