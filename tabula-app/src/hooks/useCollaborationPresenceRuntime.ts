import { useMemo, useRef } from "react";
import {
  type Collaborator,
  type LiveSelection,
} from "../collaboration";
import { createCollaborationPresenceIdentity } from "../collaboration/collabRuntime";

type UseCollaborationPresenceRuntimeOptions = {
  activeDocumentId?: string;
  activeSelection?: LiveSelection;
  fileTitle?: string;
  identity: Collaborator;
  isLive: boolean;
  roomId?: string;
};

export function useCollaborationPresenceRuntime({
  activeDocumentId,
  activeSelection,
  fileTitle,
  identity,
  isLive,
  roomId,
}: UseCollaborationPresenceRuntimeOptions) {
  const joinedAtRef = useRef(new Date().toISOString());

  return useMemo(
    () =>
      createCollaborationPresenceIdentity({
        activeDocumentId,
        identity,
        isLive,
        roomId,
        fileTitle,
        selection: activeSelection,
        joinedAt: joinedAtRef.current,
      }),
    [activeDocumentId, activeSelection, fileTitle, identity, isLive, roomId],
  );
}
