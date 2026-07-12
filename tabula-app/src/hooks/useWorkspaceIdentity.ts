import { useState } from "react";
import {
  createRoomActorColor,
  createRoomActorName,
  ROOM_ACTOR_ADJECTIVES,
} from "@tabula-md/tabula";
import type { Collaborator } from "../collaboration";
import { randomId } from "../workspaceStorage";

export const IDENTITY_KEY = "tabula.identity";
export const IDENTITY_SESSION_KEY = "tabula.identity.session";

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
  { preserveGeneratedName = false }: { preserveGeneratedName?: boolean } = {},
): Collaborator => {
  const name = identity.name?.trim();
  const kind = identity.kind ?? "human";
  const nextName =
    name && (preserveGeneratedName || !isGeneratedName(name))
      ? name
      : createRoomActorName(kind, identity.id);

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

const writeSessionIdentity = (
  identity: Collaborator,
  storage: Storage = window.sessionStorage,
) => {
  storage.setItem(
    IDENTITY_SESSION_KEY,
    JSON.stringify({ name: identity.name, color: identity.color }),
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
  sessionStorage,
  actorId,
  createId = randomId,
  now = Date.now,
}: {
  storage?: Storage;
  sessionStorage?: Storage;
  actorId?: string;
  createId?: () => string;
  now?: () => number;
} = {}): Collaborator => {
  const resolvedSessionStorage =
    sessionStorage ?? (typeof window === "undefined" ? storage : window.sessionStorage);
  const storedProfile = readStoredJson(storage, IDENTITY_KEY);
  const storedSessionProfile = readStoredJson(resolvedSessionStorage, IDENTITY_SESSION_KEY);
  const id = actorId?.trim() || createId();
  const storedName = typeof storedProfile?.name === "string" ? storedProfile.name.trim() : "";
  const sessionName =
    typeof storedSessionProfile?.name === "string" ? storedSessionProfile.name.trim() : "";
  const sessionColor =
    typeof storedSessionProfile?.color === "string" ? storedSessionProfile.color.trim() : "";
  const identity = normalizeWorkspaceIdentity(
    {
      id,
      name:
        storedName && !isGeneratedName(storedName)
          ? storedName
          : sessionName || createRoomActorName("human", id),
      color: sessionColor || createRoomActorColor(id),
      lastSeen: now(),
    },
    now,
    { preserveGeneratedName: Boolean(sessionName) },
  );
  writeIdentity(identity, storage);
  writeSessionIdentity(identity, resolvedSessionStorage);
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
      writeSessionIdentity(updatedIdentity);
      return updatedIdentity;
    });
  };

  const normalizeIdentityName = () => {
    setIdentity((currentIdentity) => {
      const updatedIdentity = normalizeWorkspaceIdentity(currentIdentity);
      writeIdentity(updatedIdentity);
      writeSessionIdentity(updatedIdentity);
      return updatedIdentity;
    });
  };

  return {
    identity,
    updateIdentityName,
    normalizeIdentityName,
  };
}
