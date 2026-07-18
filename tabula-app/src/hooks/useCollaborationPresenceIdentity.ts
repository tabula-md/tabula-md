import { useMemo, useRef } from "react";
import type { Collaborator } from "../collaboration/liveCollaboration";
import { createCollaborationPresenceIdentity } from "../collaboration/collabRuntime";

type UseCollaborationPresenceIdentityOptions = {
  identity: Collaborator;
  isLive: boolean;
};

export function useCollaborationPresenceIdentity({
  identity,
  isLive,
}: UseCollaborationPresenceIdentityOptions) {
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
