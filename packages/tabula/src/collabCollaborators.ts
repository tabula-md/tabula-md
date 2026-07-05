import { sortCollaborators } from "./collabConnectionModel";
import type { CollaborationCollaborator } from "./collaborationTypes";
import { normalizeTextPatches, type TextPatch } from "./textPatches";

export type CollaboratorRegistry = {
  upsert(collaborator: CollaborationCollaborator, selfId: string): boolean;
  prune(peerIds: Iterable<string>): boolean;
  remapSelections(patches: readonly TextPatch[], docLength: number): boolean;
  clear(): boolean;
  list(): CollaborationCollaborator[];
};

const clampPosition = (position: number, docLength: number) => Math.max(0, Math.min(position, docLength));

const selectionsAreEqual = (
  first?: CollaborationCollaborator["selection"],
  second?: CollaborationCollaborator["selection"],
) =>
  first === second ||
  (Boolean(first) &&
    Boolean(second) &&
    first?.from === second?.from &&
    first?.to === second?.to);

const collaboratorsAreEqual = (
  first: CollaborationCollaborator,
  second: CollaborationCollaborator,
) =>
  first.id === second.id &&
  first.name === second.name &&
  first.color === second.color &&
  first.roomId === second.roomId &&
  first.fileTitle === second.fileTitle &&
  selectionsAreEqual(first.selection, second.selection);

export const mapCollaborationPositionThroughTextPatches = (
  position: number,
  patches: readonly TextPatch[],
  docLength: number,
  assoc: -1 | 1 = -1,
) => {
  let delta = 0;
  for (const patch of normalizeTextPatches(patches)) {
    const insertedLength = patch.insert.length;
    const deletedLength = patch.to - patch.from;

    if (position < patch.from) {
      break;
    }

    if (position > patch.to) {
      delta += insertedLength - deletedLength;
      continue;
    }

    if (position === patch.from && deletedLength === 0) {
      return clampPosition(position + delta + (assoc > 0 ? insertedLength : 0), docLength);
    }

    return clampPosition(patch.from + delta + (assoc > 0 ? insertedLength : 0), docLength);
  }

  return clampPosition(position + delta, docLength);
};

export const mapCollaborationSelectionThroughTextPatches = (
  selection: NonNullable<CollaborationCollaborator["selection"]>,
  patches: readonly TextPatch[],
  docLength: number,
) => {
  if (selection.from === selection.to) {
    const position = mapCollaborationPositionThroughTextPatches(selection.to, patches, docLength, -1);
    return { from: position, to: position };
  }

  return {
    from: mapCollaborationPositionThroughTextPatches(selection.from, patches, docLength, -1),
    to: mapCollaborationPositionThroughTextPatches(selection.to, patches, docLength, 1),
  };
};

export const createCollaboratorRegistry = (): CollaboratorRegistry => {
  const collaborators = new Map<string, CollaborationCollaborator>();

  return {
    upsert(collaborator, selfId) {
      if (collaborator.id === selfId) {
        return false;
      }

      const currentCollaborator = collaborators.get(collaborator.id);
      if (currentCollaborator && collaboratorsAreEqual(currentCollaborator, collaborator)) {
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
    remapSelections(patches, docLength) {
      if (patches.length === 0) {
        return false;
      }

      let changed = false;
      for (const [collaboratorId, collaborator] of collaborators) {
        if (!collaborator.selection) {
          continue;
        }

        const selection = mapCollaborationSelectionThroughTextPatches(collaborator.selection, patches, docLength);
        if (
          selection.from === collaborator.selection.from &&
          selection.to === collaborator.selection.to
        ) {
          continue;
        }

        collaborators.set(collaboratorId, {
          ...collaborator,
          selection,
        });
        changed = true;
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
