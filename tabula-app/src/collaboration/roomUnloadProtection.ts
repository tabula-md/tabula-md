import type {
  RoomHydrationStatus,
  RoomRecoveryMode,
} from "./liveCollaboration";
import type { RoomDurability } from "./runtime/CheckpointCoordinator";

export const shouldPreventRoomUnload = ({
  collaboratorCount,
  durability,
  hydrationStatus,
  isLive,
  recoveryMode,
}: {
  collaboratorCount: number;
  durability: RoomDurability;
  hydrationStatus: RoomHydrationStatus;
  isLive: boolean;
  recoveryMode: RoomRecoveryMode;
}) => {
  if (!isLive || hydrationStatus !== "ready") return false;
  if (recoveryMode === "temporary") return collaboratorCount === 0;
  if (durability === "clean") return false;
  if (durability === "unknown") return collaboratorCount === 0;
  return true;
};
