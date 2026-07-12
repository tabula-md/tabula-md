import type { WorkspaceRoomComment, WorkspaceRoomSnapshot } from "@tabula-md/tabula";
import type {
  Collaborator,
  CollabRecoveryEvent,
  ConnectionStatus,
  LiveSelection,
} from "../collaboration";
import type { WorkspaceRoomChangeOrigin } from "../collaboration/workspaceRoomRuntimeTypes";
import {
  isUsableLiveRoomFile,
  type WorkspaceFile,
} from "../workspaceStorage";
import {
  getActiveWorkspaceStatus,
  getWorkspaceStatusLabel,
} from "../workspace";
import { useCollaborationPresenceRuntime } from "./useCollaborationPresenceRuntime";
import { useCollaborationRoom } from "./useCollaborationRoom";
import type { WorkspaceEditorDocumentRuntimeOwner } from "./editorDocumentRuntimeOwner";
import { useEventCallback } from "./useEventCallback";

type UseWorkspaceCollaborationRuntimeOptions = {
  roomFile?: WorkspaceFile;
  activeDocument?: WorkspaceFile;
  activeSelection?: LiveSelection;
  editorPresenceEnabled?: boolean;
  editorDocumentRuntime: WorkspaceEditorDocumentRuntimeOwner;
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  identity: Collaborator;
  workspaceDocuments?: readonly { id: string; title: string; text: string; parentId?: string | null }[];
  workspaceFolders?: readonly { id: string; title: string; parentId: string | null; order?: number }[];
  commentsByFileId?: Record<string, WorkspaceRoomComment[]>;
  setFileText: (fileId: string, text: string) => void;
  setFileCollaborationStatus: (
    fileId: string,
    status: ConnectionStatus,
    options?: { requireRoom?: boolean },
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
  onWorkspaceChange?: (snapshot: WorkspaceRoomSnapshot, origin?: WorkspaceRoomChangeOrigin) => void;
  onCommentsChange?: (commentsByFileId: Record<string, WorkspaceRoomComment[]>) => void;
  onOpenFailure?: (reason: "expired" | "invalid" | "unsupported") => void;
  onCapacityExceeded?: () => void;
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
  roomFile,
  activeDocument,
  activeSelection,
  editorPresenceEnabled,
  editorDocumentRuntime,
  getActiveFileSnapshot,
  identity,
  workspaceDocuments,
  workspaceFolders,
  commentsByFileId,
  setFileText,
  setFileCollaborationStatus,
  setFileRecoveryEvent,
  startFileCollaborationSession,
  onWorkspaceChange,
  onCommentsChange,
  onOpenFailure,
  onCapacityExceeded,
}: UseWorkspaceCollaborationRuntimeOptions) {
  const handleRemoteTextChange = useEventCallback(
    (fileId: string, nextText: string) => {
      syncRemoteTextToDocumentRuntime({
        activeFile: activeDocument,
        editorDocumentRuntime,
        fileId,
        text: nextText,
      });
    },
  );

  const room = useCollaborationRoom({
    roomFile,
    activeDocument,
    editorPresenceEnabled,
    getActiveFileSnapshot,
    identity,
    workspaceDocuments,
    workspaceFolders,
    commentsByFileId,
    setFileText,
    setFileCollaborationStatus,
    setFileRecoveryEvent,
    startFileCollaborationSession,
    onRemoteTextChange: handleRemoteTextChange,
    onWorkspaceChange,
    onCommentsChange,
    onOpenFailure,
    onCapacityExceeded,
  });
  const isLive = isUsableLiveRoomFile(roomFile);
  const activeStatus = getActiveWorkspaceStatus({
    isLive,
    connectionStatus: room.connectionStatus,
  });
  const presenceIdentity = useCollaborationPresenceRuntime({
    activeDocumentId: activeDocument?.id,
    activeSelection,
    fileTitle: activeDocument?.title,
    identity,
    isLive,
    roomId: roomFile?.roomId,
  });

  return {
    ...room,
    activeStatus,
    isLive,
    presenceIdentity,
    statusLabel: getWorkspaceStatusLabel(activeStatus),
  };
}
