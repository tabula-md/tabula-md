import type { Collaborator } from "./liveCollaboration";

export type FollowState =
  | { status: "idle" }
  | { status: "following"; actorId: string };

export type FollowStopReason =
  | "manual"
  | "local-edit"
  | "local-navigation"
  | "target-left"
  | "target-document-deleted"
  | "cycle"
  | "invalid-location";

export const IDLE_FOLLOW_STATE: FollowState = { status: "idle" };

export const canFollowActor = ({
  actorId,
  collaborators,
  selfId,
}: {
  actorId: string;
  collaborators: readonly Collaborator[];
  selfId: string;
}) => {
  if (!actorId || actorId === selfId) return false;
  const collaboratorsById = new Map(collaborators.map((collaborator) => [collaborator.id, collaborator]));
  if (!collaboratorsById.has(actorId)) return false;
  const visited = new Set<string>();
  let currentId: string | undefined = actorId;
  for (let index = 0; currentId && index <= collaborators.length; index += 1) {
    if (currentId === selfId || visited.has(currentId)) return false;
    if (!collaboratorsById.has(currentId)) return false;
    visited.add(currentId);
    currentId = collaboratorsById.get(currentId)?.followingActorId;
  }
  return !currentId;
};

export const toggleFollowState = (
  current: FollowState,
  actorId: string,
): FollowState =>
  current.status === "following" && current.actorId === actorId
    ? IDLE_FOLLOW_STATE
    : { status: "following", actorId };
