import type { RefObject } from "react";
import type {
  Collaborator,
  CollabRecoveryEvent,
  ConnectionStatus,
  LiveSelection,
} from "../collaboration";
import type { MarkdownEditorHandle } from "../markdownEditorTypes";
import {
  isUsableLiveRoomFile,
  type WorkspaceFile,
} from "../workspaceStorage";
import {
  getActiveWorkspaceStatus,
  getWorkspaceStatusLabel,
} from "../workspace";
import { useCollaborationEditorBridge } from "./useCollaborationEditorBridge";
import { useCollaborationPresenceRuntime } from "./useCollaborationPresenceRuntime";
import { useCollaborationRoom } from "./useCollaborationRoom";

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
  const handleRemoteTextChange = useCollaborationEditorBridge({
    activeFileId: activeFile?.id,
    editorRef,
  });

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
  const presenceIdentity = useCollaborationPresenceRuntime({
    activeSelection,
    fileTitle: activeFileTitle,
    identity,
    isLive,
    roomId: activeFile?.roomId,
  });

  return {
    ...room,
    activeStatus,
    isLive,
    presenceIdentity,
    statusLabel: getWorkspaceStatusLabel(activeStatus),
  };
}
