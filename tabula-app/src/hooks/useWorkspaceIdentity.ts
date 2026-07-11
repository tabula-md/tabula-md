import { useState } from "react";
import {
  createRoomActorColor,
  createRoomActorName,
  ROOM_ACTOR_ADJECTIVES,
} from "@tabula-md/tabula";
import type { Collaborator } from "../collaboration";
import { randomId } from "../workspaceStorage";

export const IDENTITY_KEY = "tabula.identity";

let pageActorId: string | null = null;

const getPageActorId = () => {
  if (pageActorId) return pageActorId;
  pageActorId = randomId();
  return pageActorId;
};

const isGeneratedName = (name: string) =>
  /^Guest\s+\d+$/i.test(name) ||
  /^Anonymous\s+\S+$/i.test(name) ||
  ROOM_ACTOR_ADJECTIVES.some(
    (adjective) => new RegExp(`^${adjective} (Human|Agent)$`, "i").test(name),
  );

export const normalizeWorkspaceIdentity = (
  identity: Collaborator,
  now: () => number = Date.now,
): Collaborator => {
  const name = identity.name?.trim();
  const kind = identity.kind ?? "human";
  const nextName = name && !isGeneratedName(name) ? name : createRoomActorName(kind, identity.id);

  return {
    ...identity,
    name: nextName.slice(0, 40),
    color: identity.color?.trim() || createRoomActorColor(identity.id),
    lastSeen: now(),
  };
};

const writeIdentity = (identity: Collaborator, storage: Storage = window.localStorage) => {
  storage.setItem(
    IDENTITY_KEY,
    JSON.stringify(identity.name && !isGeneratedName(identity.name) ? { name: identity.name } : {}),
  );
};

const readStoredJson = (storage: Storage, key: string) => {
  try {
    const stored = storage.getItem(key);
    return stored ? (JSON.parse(stored) as Partial<Collaborator>) : null;
  } catch {
    return null;
  }
};

export const createWorkspaceIdentity = ({
  storage = window.localStorage,
  actorId,
  createId = randomId,
  now = Date.now,
}: {
  storage?: Storage;
  actorId?: string;
  createId?: () => string;
  now?: () => number;
} = {}): Collaborator => {
  const storedProfile = readStoredJson(storage, IDENTITY_KEY);
  const id = actorId?.trim() || createId();
  const storedName = typeof storedProfile?.name === "string" ? storedProfile.name.trim() : "";
  const identity = normalizeWorkspaceIdentity(
    {
      id,
      name: storedName && !isGeneratedName(storedName) ? storedName : createRoomActorName("human", id),
      color: createRoomActorColor(id),
      lastSeen: now(),
    },
    now,
  );
  writeIdentity(identity, storage);
  return identity;
};

export function useWorkspaceIdentity() {
  const [identity, setIdentity] = useState<Collaborator>(() =>
    createWorkspaceIdentity({ actorId: getPageActorId() }),
  );

  const updateIdentityName = (nextName: string) => {
    setIdentity((currentIdentity) => {
      const updatedIdentity = {
        ...currentIdentity,
        name: nextName.slice(0, 40),
        lastSeen: Date.now(),
      };
      writeIdentity(updatedIdentity);
      return updatedIdentity;
    });
  };

  const normalizeIdentityName = () => {
    setIdentity((currentIdentity) => {
      const updatedIdentity = normalizeWorkspaceIdentity(currentIdentity);
      writeIdentity(updatedIdentity);
      return updatedIdentity;
    });
  };

  return {
    identity,
    updateIdentityName,
    normalizeIdentityName,
  };
}
