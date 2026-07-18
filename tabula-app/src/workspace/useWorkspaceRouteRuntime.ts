import { useEffect } from "react";
import {
  getRoomFromLocation,
  type LocationRoom,
} from "./workspaceStorage";

type UseWorkspaceRouteRuntimeOptions = {
  activateRoomWorkspace: (room: LocationRoom) => void;
  isRoomSession: boolean;
  onBeforeWorkspaceBoundary?: () => void;
  onLeaveRoom?: () => void;
  onRouteWorkspaceChange: () => void;
};

export function useWorkspaceRouteRuntime({
  activateRoomWorkspace,
  isRoomSession,
  onBeforeWorkspaceBoundary,
  onLeaveRoom,
  onRouteWorkspaceChange,
}: UseWorkspaceRouteRuntimeOptions) {
  useEffect(() => {
    const activateRoomFromLocation = (room: LocationRoom) => {
      onBeforeWorkspaceBoundary?.();
      activateRoomWorkspace(room);
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
    activateRoomWorkspace,
    isRoomSession,
    onRouteWorkspaceChange,
    onBeforeWorkspaceBoundary,
    onLeaveRoom,
  ]);
}
