import { useEffect } from "react";
import {
  getRoomFromLocation,
  type LocationRoom,
  type WorkspaceFile,
} from "../workspaceStorage";

type UseWorkspaceRouteRuntimeOptions = {
  activeFileId: string;
  activateRoomFile: (room: LocationRoom) => void;
  files: WorkspaceFile[];
  selectFile: (fileId: string) => void;
  onBeforeWorkspaceBoundary?: () => void;
  onLeaveRoom?: () => void;
  onRouteWorkspaceChange: () => void;
};

export function useWorkspaceRouteRuntime({
  activeFileId,
  activateRoomFile,
  files,
  selectFile,
  onBeforeWorkspaceBoundary,
  onLeaveRoom,
  onRouteWorkspaceChange,
}: UseWorkspaceRouteRuntimeOptions) {
  useEffect(() => {
    const activateRoomFromLocation = (room: LocationRoom) => {
      onBeforeWorkspaceBoundary?.();
      activateRoomFile(room);
      onRouteWorkspaceChange();
    };

    const handlePopState = () => {
      const room = getRoomFromLocation();
      if (room) {
        activateRoomFromLocation(room);
        return;
      }

      const currentFile = files.find((file) => file.id === activeFileId);
      if (!currentFile?.roomId) {
        onLeaveRoom?.();
        return;
      }

      const localFile = files.find((file) => !file.roomId) ?? files[0];
      if (localFile) {
        onBeforeWorkspaceBoundary?.();
        onLeaveRoom?.();
        selectFile(localFile.id);
        onRouteWorkspaceChange();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [
    activeFileId,
    activateRoomFile,
    files,
    onRouteWorkspaceChange,
    onBeforeWorkspaceBoundary,
    onLeaveRoom,
    selectFile,
  ]);
}
