import {
  getWorkspaceRoomStructureSnapshot,
  type WorkspaceRoomCrdt,
  type WorkspaceRoomStructureSnapshot,
} from "@tabula-md/tabula";

const sameNode = (
  first: WorkspaceRoomStructureSnapshot["nodes"][number],
  second: WorkspaceRoomStructureSnapshot["nodes"][number],
) =>
  first.id === second.id &&
  first.type === second.type &&
  first.parentId === second.parentId &&
  first.title === second.title &&
  first.order === second.order &&
  first.createdAt === second.createdAt &&
  first.updatedAt === second.updatedAt;

const sameSnapshot = (
  first: WorkspaceRoomStructureSnapshot,
  second: WorkspaceRoomStructureSnapshot,
) =>
  first.roomId === second.roomId &&
  first.schemaVersion === second.schemaVersion &&
  first.rootId === second.rootId &&
  first.nodes.length === second.nodes.length &&
  first.nodes.every((node, index) => sameNode(node, second.nodes[index]));

export const createRoomStructureStore = (room: WorkspaceRoomCrdt) => {
  let snapshot = getWorkspaceRoomStructureSnapshot(room);
  let disposed = false;
  const listeners = new Set<() => void>();

  return {
    subscribe(listener: () => void) {
      if (disposed) return () => undefined;
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot() {
      return snapshot;
    },

    refresh() {
      if (disposed) return false;
      const next = getWorkspaceRoomStructureSnapshot(room);
      if (sameSnapshot(snapshot, next)) return false;
      snapshot = next;
      listeners.forEach((listener) => listener());
      return true;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      listeners.clear();
    },
  };
};

export type RoomStructureStore = ReturnType<typeof createRoomStructureStore>;
