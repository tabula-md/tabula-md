import type {
  ConnectionStatus,
  RoomRecoveryMode,
} from "./liveCollaboration";
import type { RoomDurability } from "./runtime/CheckpointCoordinator";
import type { RoomPresenceState } from "@tabula-md/tabula";

export const ROOM_IDLE_AFTER_MS = 60_000;
export const ROOM_SUSPEND_AFTER_MS = 15 * 60_000;

export const getRoomPresenceState = ({
  hidden,
  inactiveForMs,
}: {
  hidden: boolean;
  inactiveForMs: number;
}): RoomPresenceState => {
  if (hidden) return "away";
  return inactiveForMs >= ROOM_IDLE_AFTER_MS ? "idle" : "active";
};

export const canSuspendInactiveRoom = ({
  connectionStatus,
  durability,
  inactiveForMs,
  recoveryMode,
}: {
  connectionStatus: ConnectionStatus;
  durability: RoomDurability;
  inactiveForMs: number;
  recoveryMode: RoomRecoveryMode;
}) =>
  connectionStatus === "connected" &&
  durability === "clean" &&
  recoveryMode === "durable" &&
  inactiveForMs >= ROOM_SUSPEND_AFTER_MS;
