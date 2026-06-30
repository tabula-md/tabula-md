import { useEffect } from "react";
import {
  getRoomFromLocation,
  syncUrlForFile,
  type LocationRoom,
  type WorkspaceFile,
} from "../workspaceStorage";

type UseWorkspaceRouteRuntimeOptions = {
  activeFile?: WorkspaceFile;
  activeFileId: string;
  activateRoomFile: (room: LocationRoom) => void;
  files: WorkspaceFile[];
  selectFile: (fileId: string) => void;
  onRouteWorkspaceChange: () => void;
};

export function useWorkspaceRouteRuntime({
  activeFile,
  activeFileId,
  activateRoomFile,
  files,
  selectFile,
  onRouteWorkspaceChange,
}: UseWorkspaceRouteRuntimeOptions) {
  useEffect(() => {
    const activateRoomFromLocation = (room: LocationRoom) => {
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
        return;
      }

      const localFile = files.find((file) => !file.roomId) ?? files[0];
      if (localFile) {
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
    selectFile,
  ]);

  useEffect(() => {
    if (!activeFile || activeFile.roomId || !getRoomFromLocation()) {
      return;
    }

    syncUrlForFile(undefined, "replace");
  }, [activeFile?.id, activeFile?.roomId]);
}
