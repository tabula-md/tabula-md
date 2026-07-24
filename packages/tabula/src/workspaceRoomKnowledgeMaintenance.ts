import type { RoomActorAttribution } from "./roomCollaboration";
import {
  getWorkspaceRoomDocument,
  getWorkspaceRoomStructureSnapshot,
  touchWorkspaceRoomNode,
  type WorkspaceRoomCrdt,
} from "./workspaceRoomCrdt";
import type { WorkspaceRoomNode } from "./workspaceRoomModel";
import {
  planWorkspaceKnowledgeMaintenance,
  type WorkspaceKnowledgeMaintenancePlan,
} from "./workspaceKnowledgeMaintenance";
import type { WorkspaceSourceDocument } from "./workspaceKnowledgeIndex";

export type WorkspaceRoomKnowledgeSnapshot = {
  rootId: string;
  nodes: readonly WorkspaceRoomNode[];
  documents: Readonly<Record<string, string>>;
};

export const getWorkspaceRoomKnowledgeSnapshot = (
  room: WorkspaceRoomCrdt,
): WorkspaceRoomKnowledgeSnapshot => ({
  ...getWorkspaceRoomStructureSnapshot(room),
  documents: Object.fromEntries(
    [...room.documents].map(([documentId, text]) => [
      documentId,
      text.toString(),
    ]),
  ),
});

export const getWorkspaceRoomKnowledgeDocuments = (
  snapshot: WorkspaceRoomKnowledgeSnapshot,
): WorkspaceSourceDocument[] => {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
  const folderPathById = new Map<string, readonly string[]>();
  const getFolderPath = (folderId: string | null): readonly string[] => {
    if (!folderId || folderId === snapshot.rootId) return [];
    const cached = folderPathById.get(folderId);
    if (cached) return cached;
    const path: string[] = [];
    const visited = new Set<string>();
    let currentId: string | null = folderId;
    while (
      currentId &&
      currentId !== snapshot.rootId &&
      !visited.has(currentId)
    ) {
      visited.add(currentId);
      const folder = nodesById.get(currentId);
      if (!folder || folder.type !== "folder") break;
      path.unshift(folder.title);
      currentId = folder.parentId;
    }
    folderPathById.set(folderId, path);
    return path;
  };

  return snapshot.nodes
    .filter((node) => node.type === "document")
    .map((node) => ({
      id: node.id,
      path: [...getFolderPath(node.parentId), node.title].join("/"),
      markdown: snapshot.documents[node.id] ?? "",
    }));
};

export const planWorkspaceRoomKnowledgeMaintenance = (
  previous: WorkspaceRoomKnowledgeSnapshot,
  next: WorkspaceRoomKnowledgeSnapshot,
) => planWorkspaceKnowledgeMaintenance(
  getWorkspaceRoomKnowledgeDocuments(previous),
  getWorkspaceRoomKnowledgeDocuments(next),
);

export const applyWorkspaceRoomKnowledgeMaintenancePlan = (
  room: WorkspaceRoomCrdt,
  plan: WorkspaceKnowledgeMaintenancePlan,
  updatedBy?: RoomActorAttribution,
  updatedAt = new Date().toISOString(),
) => {
  if (plan.updates.length === 0) return true;
  for (const update of plan.updates) {
    if (!getWorkspaceRoomDocument(room, update.documentId)) return false;
  }
  room.doc.transact(() => {
    for (const update of plan.updates) {
      const text = getWorkspaceRoomDocument(room, update.documentId);
      if (!text) continue;
      for (const patch of [...update.patches].sort(
        (left, right) => right.from - left.from || right.to - left.to,
      )) {
        if (patch.to > patch.from) text.delete(patch.from, patch.to - patch.from);
        if (patch.insert) text.insert(patch.from, patch.insert);
      }
      touchWorkspaceRoomNode(room, update.documentId, updatedBy, updatedAt);
    }
  }, "tabula.knowledge.maintain");
  return true;
};
