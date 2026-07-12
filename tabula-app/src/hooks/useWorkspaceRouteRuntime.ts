import { useEffect } from "react";
import {
  getRoomFromLocation,
  type LocationRoom,
} from "../workspaceStorage";

type UseWorkspaceRouteRuntimeOptions = {
  activateRoomFile: (room: LocationRoom) => void;
  isRoomSession: boolean;
  onBeforeWorkspaceBoundary?: () => void;
  onLeaveRoom?: () => void;
  onRouteWorkspaceChange: () => void;
};

export function useWorkspaceRouteRuntime({
  activateRoomFile,
  isRoomSession,
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

      if (!isRoomSession) return;
      onBeforeWorkspaceBoundary?.();
      onLeaveRoom?.();
      onRouteWorkspaceChange();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [
    activateRoomFile,
    isRoomSession,
    onRouteWorkspaceChange,
    onBeforeWorkspaceBoundary,
    onLeaveRoom,
  ]);
}
