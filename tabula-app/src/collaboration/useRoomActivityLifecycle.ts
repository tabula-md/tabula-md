import { useEffect, useRef, useState } from "react";
import type { RoomPresenceState } from "@tabula-md/tabula";
import { useEventCallback } from "../shared/useEventCallback";
import type {
  ConnectionStatus,
  RoomRecoveryMode,
} from "./liveCollaboration";
import type { RoomDurability } from "./runtime/CheckpointCoordinator";
import {
  canSuspendInactiveRoom,
  getRoomPresenceState,
  ROOM_IDLE_AFTER_MS,
  ROOM_SUSPEND_AFTER_MS,
} from "./roomActivityLifecycle";

const ACTIVITY_THROTTLE_MS = 1_000;
const SUSPEND_RETRY_MS = 5_000;

type UseRoomActivityLifecycleOptions = {
  connectionStatus: ConnectionStatus;
  durability: RoomDurability;
  enabled: boolean;
  lifecycleKey: string;
  recoveryMode: RoomRecoveryMode;
  onPresenceStateChange: (state: RoomPresenceState) => void;
  onResume: () => void;
  onSuspend: () => boolean;
};

export const useRoomActivityLifecycle = ({
  connectionStatus,
  durability,
  enabled,
  lifecycleKey,
  recoveryMode,
  onPresenceStateChange,
  onResume,
  onSuspend,
}: UseRoomActivityLifecycleOptions) => {
  const lastLocalActivityAtRef = useRef(Date.now());
  const lastRoomActivityAtRef = useRef(Date.now());
  const lastRecordedActivityAtRef = useRef(0);
  const presenceStateRef = useRef<RoomPresenceState>("active");
  const [presenceState, setPresenceState] = useState<RoomPresenceState>("active");
  const presenceTimerRef = useRef<number | null>(null);
  const suspendTimerRef = useRef<number | null>(null);

  const clearPresenceTimer = useEventCallback(() => {
    if (presenceTimerRef.current === null) return;
    window.clearTimeout(presenceTimerRef.current);
    presenceTimerRef.current = null;
  });

  const clearSuspendTimer = useEventCallback(() => {
    if (suspendTimerRef.current === null) return;
    window.clearTimeout(suspendTimerRef.current);
    suspendTimerRef.current = null;
  });

  const publishPresence = useEventCallback((state: RoomPresenceState) => {
    if (presenceStateRef.current === state) return;
    presenceStateRef.current = state;
    setPresenceState(state);
    onPresenceStateChange(state);
  });

  const schedulePresence = useEventCallback(() => {
    clearPresenceTimer();
    if (!enabled || connectionStatus === "suspended") return;
    const now = Date.now();
    const inactiveForMs = now - lastLocalActivityAtRef.current;
    const state = getRoomPresenceState({ hidden: document.hidden, inactiveForMs });
    publishPresence(state);
    if (state !== "active") return;
    presenceTimerRef.current = window.setTimeout(
      schedulePresence,
      Math.max(0, ROOM_IDLE_AFTER_MS - inactiveForMs),
    );
  });

  const scheduleSuspend = useEventCallback(() => {
    clearSuspendTimer();
    if (!enabled || connectionStatus === "suspended") return;
    const inactiveForMs = Date.now() - lastRoomActivityAtRef.current;
    const remainingMs = ROOM_SUSPEND_AFTER_MS - inactiveForMs;
    if (remainingMs > 0) {
      suspendTimerRef.current = window.setTimeout(scheduleSuspend, remainingMs);
      return;
    }
    if (canSuspendInactiveRoom({ connectionStatus, durability, inactiveForMs, recoveryMode })) {
      if (onSuspend()) return;
    }
    if (connectionStatus === "connected") {
      suspendTimerRef.current = window.setTimeout(scheduleSuspend, SUSPEND_RETRY_MS);
    }
  });

  const markRoomActivity = useEventCallback(() => {
    lastRoomActivityAtRef.current = Date.now();
    scheduleSuspend();
  });

  const markLocalActivity = useEventCallback(() => {
    if (!enabled || document.hidden) return;
    const now = Date.now();
    if (
      presenceStateRef.current === "active" &&
      now - lastRecordedActivityAtRef.current < ACTIVITY_THROTTLE_MS
    ) return;
    lastRecordedActivityAtRef.current = now;
    lastLocalActivityAtRef.current = now;
    lastRoomActivityAtRef.current = now;
    publishPresence("active");
    if (connectionStatus === "suspended") onResume();
    schedulePresence();
    scheduleSuspend();
  });

  useEffect(() => {
    const now = Date.now();
    lastLocalActivityAtRef.current = now;
    lastRoomActivityAtRef.current = now;
    lastRecordedActivityAtRef.current = 0;
    presenceStateRef.current = "active";
    setPresenceState("active");
  }, [lifecycleKey]);

  useEffect(() => {
    if (!enabled) {
      clearPresenceTimer();
      clearSuspendTimer();
      return;
    }
    schedulePresence();
    scheduleSuspend();
    return () => {
      clearPresenceTimer();
      clearSuspendTimer();
    };
  }, [connectionStatus, durability, enabled, lifecycleKey, recoveryMode]);

  useEffect(() => {
    if (!enabled) return;
    const handleVisibilityChange = () => {
      const now = Date.now();
      lastRoomActivityAtRef.current = now;
      if (document.hidden) {
        clearPresenceTimer();
        publishPresence("away");
        scheduleSuspend();
        return;
      }
      markLocalActivity();
    };
    const activityOptions: AddEventListenerOptions = { capture: true, passive: true };
    window.addEventListener("focus", markLocalActivity);
    window.addEventListener("keydown", markLocalActivity);
    window.addEventListener("pointerdown", markLocalActivity, activityOptions);
    window.addEventListener("pointermove", markLocalActivity, activityOptions);
    window.addEventListener("scroll", markLocalActivity, activityOptions);
    window.addEventListener("touchstart", markLocalActivity, activityOptions);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", markLocalActivity);
      window.removeEventListener("keydown", markLocalActivity);
      window.removeEventListener("pointerdown", markLocalActivity, activityOptions);
      window.removeEventListener("pointermove", markLocalActivity, activityOptions);
      window.removeEventListener("scroll", markLocalActivity, activityOptions);
      window.removeEventListener("touchstart", markLocalActivity, activityOptions);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, lifecycleKey]);

  return { markRoomActivity, presenceState };
};
