import {
  IDLE_FOLLOW_STATE,
  type FollowState,
} from "../../collaboration/followModel";

export const createFollowStore = () => {
  let snapshot: FollowState = IDLE_FOLLOW_STATE;
  let disposed = false;
  const listeners = new Set<() => void>();

  const publish = (next: FollowState) => {
    if (disposed) return;
    if (
      next.status === snapshot.status &&
      (next.status === "idle" || (snapshot.status === "following" && next.actorId === snapshot.actorId))
    ) return;
    snapshot = next;
    listeners.forEach((listener) => listener());
  };

  return {
    subscribe(listener: () => void) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    start(actorId: string) {
      if (!actorId) return;
      publish({ status: "following", actorId });
    },
    stop() {
      publish(IDLE_FOLLOW_STATE);
    },
    dispose() {
      if (disposed) return;
      snapshot = IDLE_FOLLOW_STATE;
      disposed = true;
      listeners.clear();
    },
  };
};

export type FollowStore = ReturnType<typeof createFollowStore>;
