import type { RefObject } from "react";
import type { RoomEvent, TextChange } from "@tabula-md/tabula";
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
import type { WorkspaceEditorDocumentRuntimeOwner } from "./editorDocumentRuntimeOwner";
import { useEventCallback } from "./useEventCallback";

type UseWorkspaceCollaborationRuntimeOptions = {
  activeFile?: WorkspaceFile;
  activeFileTitle: string;
  activeSelection?: LiveSelection;
  editorDocumentRuntime: WorkspaceEditorDocumentRuntimeOwner;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  identity: Collaborator;
  workspaceDocuments?: readonly { id: string; title: string; text: string; parentId?: string | null }[];
  setFileText: (fileId: string, text: string) => void;
  setFileCollaborationStatus: (
    fileId: string,
    status: ConnectionStatus,
    options?: { collaboratorCount?: number; requireRoom?: boolean },
  ) => void;
  setFileCollaboratorCount: (fileId: string, collaboratorCount: number) => void;
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
  onRoomEvent?: (event: RoomEvent) => void;
};

export const syncRemoteTextToDocumentRuntime = ({
  activeFile,
  editorDocumentRuntime,
  fileId,
  text,
}: {
  activeFile?: WorkspaceFile;
  editorDocumentRuntime: WorkspaceEditorDocumentRuntimeOwner;
  fileId: string;
  text: string;
}) => {
  if (!activeFile || activeFile.id !== fileId) {
    return false;
  }

  editorDocumentRuntime.getRuntime(activeFile).syncCommitted({
    fileId,
    text,
  });
  return true;
};

export function useWorkspaceCollaborationRuntime({
  activeFile,
  activeFileTitle,
  activeSelection,
  editorDocumentRuntime,
  editorRef,
  getActiveFileSnapshot,
  identity,
  workspaceDocuments,
  setFileText,
  setFileCollaborationStatus,
  setFileCollaboratorCount,
  setFileRecoveryEvent,
  startFileCollaborationSession,
  onRoomEvent,
}: UseWorkspaceCollaborationRuntimeOptions) {
  const applyRemoteTextToEditor = useCollaborationEditorBridge({
    activeFileId: activeFile?.id,
    editorRef,
  });
  const handleRemoteTextChange = useEventCallback(
    (fileId: string, nextText: string, change?: TextChange) => {
      syncRemoteTextToDocumentRuntime({
        activeFile,
        editorDocumentRuntime,
        fileId,
        text: nextText,
      });
      applyRemoteTextToEditor(fileId, nextText, change);
    },
  );

  const room = useCollaborationRoom({
    activeFile,
    activeSelection,
    getActiveFileSnapshot,
    identity,
    workspaceDocuments,
    setFileText,
    setFileCollaborationStatus,
    setFileCollaboratorCount,
    setFileRecoveryEvent,
    startFileCollaborationSession,
    onRemoteTextChange: handleRemoteTextChange,
    onRoomEvent,
  });
  const isLive = isUsableLiveRoomFile(activeFile);
  const activeStatus = getActiveWorkspaceStatus({
    isLive,
    connectionStatus: room.connectionStatus,
  });
  const presenceIdentity = useCollaborationPresenceRuntime({
    activeDocumentId: activeFile?.id,
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
