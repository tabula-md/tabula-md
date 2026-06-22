import { useState } from "react";
import type { Collaborator } from "../collab";
import { randomId } from "../workspaceStorage";

export const IDENTITY_KEY = "tabula.identity";

const IDENTITY_COLORS = ["#0f766e", "#2563eb", "#7c3aed", "#c2410c", "#be123c", "#047857"];

const getAnonymousName = (id: string) => `Anonymous ${id.slice(0, 3)}`;

export const normalizeWorkspaceIdentity = (
  identity: Collaborator,
  now: () => number = Date.now,
): Collaborator => {
  const name = identity.name?.trim();
  const nextName = name && !/^Guest\s+\d+$/i.test(name) ? name : getAnonymousName(identity.id);

  return {
    ...identity,
    name: nextName.slice(0, 40),
    lastSeen: now(),
  };
};

const writeIdentity = (identity: Collaborator, storage: Storage = window.localStorage) => {
  storage.setItem(IDENTITY_KEY, JSON.stringify(identity));
};

export const createWorkspaceIdentity = ({
  storage = window.localStorage,
  createId = randomId,
  random = Math.random,
  now = Date.now,
}: {
  storage?: Storage;
  createId?: () => string;
  random?: () => number;
  now?: () => number;
} = {}): Collaborator => {
  try {
    const stored = storage.getItem(IDENTITY_KEY);
    if (stored) {
      const identity = normalizeWorkspaceIdentity(JSON.parse(stored) as Collaborator, now);
      writeIdentity(identity, storage);
      return identity;
    }
  } catch {
    // Fall through and create a new local identity.
  }

  const id = createId();
  const identity = normalizeWorkspaceIdentity(
    {
      id,
      name: `Anonymous ${Math.floor(random() * 900 + 100)}`,
      color: IDENTITY_COLORS[Math.floor(random() * IDENTITY_COLORS.length)] ?? IDENTITY_COLORS[0],
      lastSeen: now(),
    },
    now,
  );
  writeIdentity(identity, storage);
  return identity;
};

export function useWorkspaceIdentity() {
  const [identity, setIdentity] = useState<Collaborator>(() => createWorkspaceIdentity());

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
