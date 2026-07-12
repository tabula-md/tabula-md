import { useEffect, useMemo, useRef } from "react";
import type {
  WorkspaceRoomComment,
  WorkspaceRoomSnapshot,
} from "@tabula-md/tabula";
import { reconcileWorkspaceRoomSnapshot } from "../collaboration/workspaceRoomStateMerge";
import type { WorkspaceRoomChangeOrigin } from "../collaboration/workspaceRoomRuntimeTypes";
import {
  readRoomViewState,
  restoreRoomWorkspaceView,
  writeRoomViewState,
} from "../collaboration/roomViewState";
import type { AppToastState } from "./useAppToast";
import { useEventCallback } from "./useEventCallback";
import type { RightPanelView } from "../uiTypes";
import {
  createWorkspaceFile,
  isEmptyGeneratedLivePlaceholder,
  type FileComment,
  type LocationRoom,
  type WorkspaceFile,
  type WorkspaceFolder,
  type WorkspaceState,
} from "../workspaceStorage";

type ShowToast = (
  message: string,
  tone?: AppToastState["tone"],
  action?: Pick<AppToastState, "actionLabel" | "onAction">,
) => void;

type WorkspaceProjection = Pick<
  WorkspaceState,
  "activeFileId" | "files" | "folders" | "openFileIds"
>;

type UseWorkspaceRoomProjectionOptions = {
  activeFile?: WorkspaceFile;
  activeFileId: string;
  activeRoom: LocationRoom | null;
  activeRoomId?: string;
  activeRoomShareUrl?: string;
  commentsByFileId: Record<string, FileComment[]>;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  getWorkspaceSnapshot: () => WorkspaceState;
  openFileIds: string[];
  replaceCommentsByFileId: (
    commentsByFileId: Record<string, FileComment[]>,
    options?: { preserveInteraction?: boolean },
  ) => void;
  replaceWorkspace: (workspace: WorkspaceProjection) => void;
  rightPanelOpen: boolean;
  rightPanelView: RightPanelView;
  selectFile: (fileId: string) => void;
  setActiveRoom: (room: LocationRoom) => void;
  setRightPanelOpen: (open: boolean) => void;
  setRightPanelView: (view: RightPanelView) => void;
  showToast: ShowToast;
};

const toLocalComments = (commentsByFileId: Record<string, WorkspaceRoomComment[]>) =>
  Object.fromEntries(
    Object.entries(commentsByFileId).map(([fileId, comments]) => [
      fileId,
      comments.map(({ fileId: _fileId, authorId: _authorId, ...comment }) => comment),
    ]),
  );

export function useWorkspaceRoomProjection({
  activeFile,
  activeFileId,
  activeRoom,
  activeRoomId,
  activeRoomShareUrl,
  commentsByFileId,
  files,
  folders,
  getWorkspaceSnapshot,
  openFileIds,
  replaceCommentsByFileId,
  replaceWorkspace,
  rightPanelOpen,
  rightPanelView,
  selectFile,
  setActiveRoom,
  setRightPanelOpen,
  setRightPanelView,
  showToast,
}: UseWorkspaceRoomProjectionOptions) {
  const restoredRoomIdRef = useRef<string | null>(null);

  const mergeWorkspaceRoomSnapshot = useEventCallback((
    snapshot: WorkspaceRoomSnapshot,
    origin?: WorkspaceRoomChangeOrigin,
  ) => {
    if (activeRoomId && snapshot.roomId !== activeRoomId) return;
    const workspaceSnapshot = getWorkspaceSnapshot();
    const previousRoomFiles = workspaceSnapshot.files.filter((file) => file.roomId === snapshot.roomId);
    const previousRoomFilesById = new Map(previousRoomFiles.map((file) => [file.id, file]));
    const nextDocumentNodes = snapshot.nodes.filter((node) => node.type === "document");
    const nextDocumentIds = new Set(nextDocumentNodes.map((node) => node.id));
    const addedDocuments = nextDocumentNodes.filter((node) => !previousRoomFilesById.has(node.id));
    const deletedDocuments = previousRoomFiles.filter((file) => !nextDocumentIds.has(file.id));
    const renamedDocuments = nextDocumentNodes.filter((node) => {
      const previous = previousRoomFilesById.get(node.id);
      return previous && previous.title !== node.title;
    });
    const previousFolderSignature = workspaceSnapshot.folders
      .filter((folder) => folder.roomId === snapshot.roomId)
      .map((folder) => [folder.id, folder.title, folder.parentId, folder.order ?? 0])
      .sort(([firstId], [secondId]) => String(firstId).localeCompare(String(secondId)));
    const nextFolderSignature = snapshot.nodes
      .filter((node) => node.type === "folder" && node.id !== snapshot.rootId)
      .map((node) => [node.id, node.title, node.parentId, node.order ?? 0])
      .sort(([firstId], [secondId]) => String(firstId).localeCompare(String(secondId)));
    const foldersChanged = JSON.stringify(previousFolderSignature) !== JSON.stringify(nextFolderSignature);
    let nextWorkspace = reconcileWorkspaceRoomSnapshot({
      activeFile,
      createFile: createWorkspaceFile,
      roomShareUrl: activeRoomShareUrl,
      snapshot,
      workspaceSnapshot,
    });

    if (restoredRoomIdRef.current !== snapshot.roomId) {
      const roomViewState = readRoomViewState(snapshot.roomId);
      nextWorkspace = restoreRoomWorkspaceView(nextWorkspace, roomViewState);
      restoredRoomIdRef.current = snapshot.roomId;
      if (roomViewState) {
        setRightPanelView(roomViewState.rightPanelView);
        setRightPanelOpen(roomViewState.rightPanelOpen);
      }
    }
    if (
      activeRoomShareUrl &&
      (activeRoom?.roomId !== snapshot.roomId || activeRoom.shareUrl !== activeRoomShareUrl)
    ) {
      setActiveRoom({ roomId: snapshot.roomId, shareUrl: activeRoomShareUrl });
    }
    replaceWorkspace(nextWorkspace);

    if (origin) {
      const deletedActiveFile = deletedDocuments.find((file) => file.id === workspaceSnapshot.activeFileId);
      if (deletedActiveFile) {
        const nextActiveTitle = nextWorkspace.files.find((file) => file.id === nextWorkspace.activeFileId)?.title;
        showToast(
          nextActiveTitle
            ? `${origin.actorName ?? "Another participant"} deleted ${deletedActiveFile.title}. Opened ${nextActiveTitle}.`
            : `${origin.actorName ?? "Another participant"} deleted ${deletedActiveFile.title} from the room.`,
        );
      } else if (addedDocuments.length === 1 && deletedDocuments.length === 0 && renamedDocuments.length === 0) {
        const addedDocument = addedDocuments[0];
        showToast(`${addedDocument.title} was added to the room.`, "neutral", {
          actionLabel: "Open",
          onAction: () => selectFile(addedDocument.id),
        });
      } else if (renamedDocuments.length === 1 && addedDocuments.length === 0 && deletedDocuments.length === 0) {
        const renamedDocument = renamedDocuments[0];
        showToast(`${previousRoomFilesById.get(renamedDocument.id)?.title} was renamed to ${renamedDocument.title}.`);
      } else if (addedDocuments.length || deletedDocuments.length || renamedDocuments.length || foldersChanged) {
        showToast("The shared workspace was updated.");
      }
    }

    replaceCommentsByFileId(toLocalComments(snapshot.commentsByFileId), { preserveInteraction: true });
  });

  useEffect(() => {
    if (!activeRoomId) {
      restoredRoomIdRef.current = null;
      return;
    }
    if (!files.some((file) => file.roomId === activeRoomId)) return;
    writeRoomViewState(activeRoomId, {
      activeDocumentId: activeFileId || undefined,
      openDocumentIds: openFileIds,
      rightPanelOpen,
      rightPanelView,
    });
  }, [activeFileId, activeRoomId, files, openFileIds, rightPanelOpen, rightPanelView]);

  const mergeWorkspaceRoomComments = useEventCallback(
    (roomCommentsByFileId: Record<string, WorkspaceRoomComment[]>) => {
      if (!activeRoomId) return;
      replaceCommentsByFileId(toLocalComments(roomCommentsByFileId), { preserveInteraction: true });
    },
  );

  const workspaceShareDocuments = useMemo(
    () => files
      .filter((file) => !isEmptyGeneratedLivePlaceholder(file))
      .map((file) => ({
        id: file.id,
        title: file.title,
        text: file.text,
        parentId: file.parentId,
        order: file.order,
      })),
    [files],
  );
  const workspaceShareFolders = useMemo(() => folders, [folders]);
  const workspaceShareComments = useMemo<Record<string, WorkspaceRoomComment[]>>(() => {
    const documentIds = new Set(workspaceShareDocuments.map((document) => document.id));
    return Object.fromEntries(
      Object.entries(commentsByFileId)
        .filter(([fileId]) => documentIds.has(fileId))
        .map(([fileId, comments]) => [fileId, comments.map((comment) => ({
          ...comment,
          fileId,
          resolved: comment.resolved ?? false,
          replies: comment.replies ?? [],
        }))]),
    );
  }, [commentsByFileId, workspaceShareDocuments]);

  return {
    mergeWorkspaceRoomComments,
    mergeWorkspaceRoomSnapshot,
    workspaceShareComments,
    workspaceShareDocuments,
    workspaceShareFolders,
  };
}
