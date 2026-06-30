import { useMemo, type RefObject } from "react";
import type {
  Collaborator,
  CollabRecoveryEvent,
  ConnectionStatus,
  LiveSelection,
} from "../collab";
import type { MarkdownEditorHandle } from "../markdownEditorTypes";
import type { TextChange } from "../textPatches";
import {
  isUsableLiveRoomFile,
  type WorkspaceFile,
} from "../workspaceStorage";
import {
  getActiveWorkspaceStatus,
  getWorkspaceStatusLabel,
} from "../workspaceViewModel";
import { useCollaborationRoom } from "./useCollaborationRoom";
import { useEventCallback } from "./useEventCallback";
import { createCollaborationPresenceIdentity } from "../collabRuntime";

type UseWorkspaceCollaborationRuntimeOptions = {
  activeFile?: WorkspaceFile;
  activeFileTitle: string;
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
  activeFileTitle,
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

  const room = useCollaborationRoom({
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
  const isLive = isUsableLiveRoomFile(activeFile);
  const activeStatus = getActiveWorkspaceStatus({
    isLive,
    connectionStatus: room.connectionStatus,
  });
  const presenceIdentity = useMemo(
    () =>
      createCollaborationPresenceIdentity({
        identity,
        isLive,
        roomId: activeFile?.roomId,
        fileTitle: activeFileTitle,
        selection: activeSelection,
      }),
    [activeFile?.roomId, activeFileTitle, activeSelection, identity, isLive],
  );

  return {
    ...room,
    activeStatus,
    isLive,
    presenceIdentity,
    statusLabel: getWorkspaceStatusLabel(activeStatus),
  };
}
