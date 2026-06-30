import type { Collaborator } from "./collab";
import { sortCollaborators } from "./collabConnectionModel";

export type CollaboratorRegistry = {
  upsert(collaborator: Collaborator, selfId: string): boolean;
  prune(peerIds: Iterable<string>): boolean;
  clear(): boolean;
  list(): Collaborator[];
};

export const createCollaboratorRegistry = (): CollaboratorRegistry => {
  const collaborators = new Map<string, Collaborator>();

  return {
    upsert(collaborator, selfId) {
      if (collaborator.id === selfId) {
        return false;
      }

      collaborators.set(collaborator.id, collaborator);
      return true;
    },
    prune(peerIds) {
      const nextPeerIds = new Set(peerIds);
      let changed = false;
      for (const collaboratorId of collaborators.keys()) {
        if (!nextPeerIds.has(collaboratorId)) {
          collaborators.delete(collaboratorId);
          changed = true;
        }
      }
      return changed;
    },
    clear() {
      const changed = collaborators.size > 0;
      collaborators.clear();
      return changed;
    },
    list() {
      return sortCollaborators(collaborators.values());
    },
  };
};
