import { useMemo } from "react";
import {
  type Collaborator,
  type LiveSelection,
} from "../collaboration";
import { createCollaborationPresenceIdentity } from "../collaboration/collabRuntime";

type UseCollaborationPresenceRuntimeOptions = {
  activeSelection?: LiveSelection;
  fileTitle: string;
  identity: Collaborator;
  isLive: boolean;
  roomId?: string;
};

export function useCollaborationPresenceRuntime({
  activeSelection,
  fileTitle,
  identity,
  isLive,
  roomId,
}: UseCollaborationPresenceRuntimeOptions) {
  return useMemo(
    () =>
      createCollaborationPresenceIdentity({
        identity,
        isLive,
        roomId,
        fileTitle,
        selection: activeSelection,
      }),
    [activeSelection, fileTitle, identity, isLive, roomId],
  );
}
