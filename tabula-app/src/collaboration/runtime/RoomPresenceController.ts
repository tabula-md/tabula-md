import * as Y from "yjs";
import {
  createRoomActor,
  hasRoomCapability,
  parseRoomActor,
  type RoomActor,
  type RoomActorClient,
  type RoomActorKind,
  type RoomCapability,
  type WorkspaceRoomCrdt,
} from "@tabula-md/tabula";
import {
  removeAwarenessStates,
  type Awareness,
} from "y-protocols/awareness";
import { getCollaboratorDisplayList } from "../collabCollaborators";

export type LiveSelection = {
  documentId?: string;
  from: number;
  to: number;
  columnNumber?: number;
  fromLineNumber?: number;
  lineNumber?: number;
  selectionEndsWithLineBreak?: boolean;
  toLineNumber?: number;
};

export type LiveViewport = {
  documentId: string;
  position: number;
  offset: number;
};

export type Collaborator = {
  id: string;
  name: string;
  color: string;
  lastSeen: number;
  activeDocumentId?: string;
  kind?: RoomActorKind;
  client?: RoomActorClient;
  capabilities?: RoomCapability[];
  joinedAt?: string;
  roomId?: string;
  fileTitle?: string;
  selection?: LiveSelection;
  viewport?: LiveViewport;
  followingActorId?: string;
};

type RoomPresenceControllerOptions = {
  room: WorkspaceRoomCrdt;
  roomId: string;
  awareness: Awareness;
  identity: Collaborator;
  activeDocumentId: string | null;
  fileTitle?: string;
  now?: () => number;
  nowIso: () => string;
};

const isActor = (value: unknown): value is RoomActor => parseRoomActor(value) !== null;

const toActor = (identity: Collaborator): RoomActor => createRoomActor({
  id: identity.id,
  kind: identity.kind ?? "human",
  name: identity.name,
  color: identity.color,
  client: identity.client ?? "tabula-md",
  capabilities: identity.capabilities,
  joinedAt: identity.joinedAt,
});

const getDocumentIdForType = (room: WorkspaceRoomCrdt, type: unknown) => {
  let documentId: string | undefined;
  room.documents.forEach((text, id) => {
    if (text === type) documentId = id;
  });
  return documentId;
};

const getSelection = (
  room: WorkspaceRoomCrdt,
  state: Record<string, unknown>,
): LiveSelection | undefined => {
  const cursor = state.cursor;
  if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return undefined;
  const raw = cursor as { anchor?: Y.RelativePosition; head?: Y.RelativePosition };
  if (!raw.anchor || !raw.head) return undefined;
  try {
    const anchor = Y.createAbsolutePositionFromRelativePosition(raw.anchor, room.doc);
    const head = Y.createAbsolutePositionFromRelativePosition(raw.head, room.doc);
    if (!anchor || !head || anchor.type !== head.type) return undefined;
    const documentId = getDocumentIdForType(room, anchor.type);
    return documentId
      ? { documentId, from: Math.min(anchor.index, head.index), to: Math.max(anchor.index, head.index) }
      : undefined;
  } catch {
    return undefined;
  }
};

const getViewport = (
  room: WorkspaceRoomCrdt,
  state: Record<string, unknown>,
): LiveViewport | undefined => {
  const viewport = state.viewport;
  if (!viewport || typeof viewport !== "object" || Array.isArray(viewport)) return undefined;
  const raw = viewport as { anchor?: Y.RelativePosition; offset?: unknown };
  if (!raw.anchor || typeof raw.offset !== "number" || !Number.isFinite(raw.offset)) return undefined;
  try {
    const absolute = Y.createAbsolutePositionFromRelativePosition(raw.anchor, room.doc);
    if (!absolute) return undefined;
    const documentId = getDocumentIdForType(room, absolute.type);
    return documentId
      ? { documentId, position: absolute.index, offset: raw.offset }
      : undefined;
  } catch {
    return undefined;
  }
};

export const createRoomPresenceController = ({
  room,
  roomId,
  awareness,
  identity,
  activeDocumentId: initialActiveDocumentId,
  fileTitle: initialFileTitle,
  now = Date.now,
  nowIso,
}: RoomPresenceControllerOptions) => {
  let currentIdentity: Collaborator = {
    ...identity,
    joinedAt: identity.joinedAt ?? nowIso(),
  };
  let activeDocumentId = initialActiveDocumentId;
  let fileTitle = initialFileTitle;
  let editorPresenceEnabled = true;

  const getActors = () => {
    const actors = new Map<string, RoomActor>();
    awareness.getStates().forEach((state) => {
      const actor = state?.actor;
      if (isActor(actor)) actors.set(actor.id, actor);
    });
    const localActor = toActor(currentIdentity);
    actors.set(localActor.id, localActor);
    return [...actors.values()];
  };

  const getActorDisplay = (actorId: string) =>
    getCollaboratorDisplayList(getActors()).find((actor) => actor.id === actorId);

  const publishLocalState = () => {
    const actor = toActor(currentIdentity);
    const displayActor = getActorDisplay(actor.id) ?? actor;
    const displayColor = displayActor.color ?? "#2563eb";
    const nextState: Record<string, unknown> = {
      ...awareness.getLocalState(),
      actor,
      user: { name: displayActor.name, color: displayColor, colorLight: `${displayColor}33` },
      lastSeen: now(),
    };
    if (activeDocumentId) {
      nextState.activeDocumentId = activeDocumentId;
      nextState.fileTitle = fileTitle;
    } else {
      delete nextState.activeDocumentId;
      delete nextState.fileTitle;
    }
    awareness.setLocalState(nextState);
    if (!editorPresenceEnabled && awareness.getLocalState()?.cursor != null) {
      awareness.setLocalStateField("cursor", null);
    }
  };

  return {
    getIdentity: () => currentIdentity,
    getActorDisplay,
    getSenderActor(senderId: string) {
      for (const state of awareness.getStates().values()) {
        const actor = state?.actor;
        if (isActor(actor) && actor.id === senderId) return actor;
      }
      return null;
    },
    getActiveActorIds() {
      return [...new Set([
        currentIdentity.id,
        ...getActors().map((actor) => actor.id),
      ])].sort();
    },
    getCollaborators() {
      const collaborators: Collaborator[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID || !state || typeof state !== "object") return;
        const actor = (state as Record<string, unknown>).actor;
        if (!isActor(actor) || actor.id === currentIdentity.id || !hasRoomCapability(actor, "presence")) return;
        collaborators.push({
          id: actor.id,
          name: actor.name,
          color: actor.color ?? "#2563eb",
          kind: actor.kind,
          client: actor.client,
          capabilities: actor.capabilities,
          joinedAt: actor.joinedAt,
          roomId,
          activeDocumentId: typeof state.activeDocumentId === "string" ? state.activeDocumentId : undefined,
          fileTitle: typeof state.fileTitle === "string" ? state.fileTitle : undefined,
          selection: getSelection(room, state as Record<string, unknown>),
          viewport: getViewport(room, state as Record<string, unknown>),
          followingActorId: typeof state.followingActorId === "string" ? state.followingActorId : undefined,
          lastSeen: typeof state.lastSeen === "number" ? state.lastSeen : now(),
        });
      });
      collaborators.sort((first, second) => first.name.localeCompare(second.name) || first.id.localeCompare(second.id));
      return collaborators;
    },
    publishLocalState,
    reconcileLocalDisplay() {
      const localState = awareness.getLocalState();
      const currentUser = localState?.user;
      const currentDisplayName = currentUser && typeof currentUser === "object"
        ? (currentUser as Record<string, unknown>).name
        : undefined;
      const currentDisplayColor = currentUser && typeof currentUser === "object"
        ? (currentUser as Record<string, unknown>).color
        : undefined;
      const nextDisplay = getActorDisplay(currentIdentity.id) ?? currentIdentity;
      if (currentDisplayName !== nextDisplay.name || currentDisplayColor !== nextDisplay.color) {
        publishLocalState();
      }
    },
    refreshPeers(peerIds: readonly string[]) {
      const allowed = new Set(peerIds);
      const staleClientIds: number[] = [];
      awareness.getStates().forEach((state, clientId) => {
        if (clientId === awareness.clientID) return;
        const actor = state?.actor;
        if (isActor(actor) && !allowed.has(actor.id)) staleClientIds.push(clientId);
      });
      if (staleClientIds.length > 0) {
        removeAwarenessStates(awareness, staleClientIds, "transport.peers");
      }
    },
    clearLocalState() {
      if (!awareness.getLocalState()) return;
      removeAwarenessStates(awareness, [awareness.clientID], "tabula.disconnect");
    },
    setActiveDocument(nextDocument: { documentId: string; fileTitle?: string } | null) {
      activeDocumentId = nextDocument?.documentId ?? null;
      fileTitle = nextDocument?.fileTitle;
      awareness.setLocalStateField("cursor", null);
      awareness.setLocalStateField("viewport", null);
      publishLocalState();
    },
    setEditorPresenceEnabled(enabled: boolean) {
      editorPresenceEnabled = enabled;
      if (!enabled) {
        awareness.setLocalStateField("cursor", null);
        awareness.setLocalStateField("viewport", null);
      }
    },
    setViewport(viewport: LiveViewport | null) {
      if (!viewport || !editorPresenceEnabled) {
        awareness.setLocalStateField("viewport", null);
        return;
      }
      const text = room.documents.get(viewport.documentId);
      if (!text) return;
      awareness.setLocalStateField("viewport", {
        anchor: Y.createRelativePositionFromTypeIndex(
          text,
          Math.max(0, Math.min(viewport.position, text.length)),
        ),
        offset: Number.isFinite(viewport.offset) ? viewport.offset : 0,
      });
    },
    setFollowingActor(actorId: string | null) {
      awareness.setLocalStateField("followingActorId", actorId);
    },
    setIdentity(nextIdentity: Collaborator) {
      currentIdentity = {
        ...nextIdentity,
        joinedAt: nextIdentity.joinedAt ?? currentIdentity.joinedAt ?? nowIso(),
      };
      publishLocalState();
    },
  };
};

export type RoomPresenceController = ReturnType<typeof createRoomPresenceController>;
