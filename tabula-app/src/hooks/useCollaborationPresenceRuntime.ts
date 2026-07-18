import { useMemo, useRef } from "react";
import type { Collaborator } from "../collaboration/liveCollaboration";
import { createCollaborationPresenceIdentity } from "../collaboration/collabRuntime";

type UseCollaborationPresenceRuntimeOptions = {
  identity: Collaborator;
  isLive: boolean;
};

export function useCollaborationPresenceRuntime({
  identity,
  isLive,
}: UseCollaborationPresenceRuntimeOptions) {
  const joinedAtRef = useRef(new Date().toISOString());

  return useMemo(
    () =>
      createCollaborationPresenceIdentity({
        identity,
        isLive,
        joinedAt: joinedAtRef.current,
      }),
    [identity, isLive],
  );
}
