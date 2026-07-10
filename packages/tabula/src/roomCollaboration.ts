export type RoomActorKind = "human" | "agent";

export type RoomActorClient = "tabula-md" | "tabula-mcp" | "custom";

export type RoomCapability = "presence" | "read" | "write";

export type RoomActor = {
  id: string;
  kind: RoomActorKind;
  name: string;
  color?: string;
  client: RoomActorClient;
  capabilities: RoomCapability[];
  joinedAt: string;
};

export const HUMAN_ROOM_CAPABILITIES: readonly RoomCapability[] = [
  "presence",
  "read",
  "write",
];

export const AGENT_ROOM_CAPABILITIES: readonly RoomCapability[] = [
  "presence",
  "read",
  "write",
];

export const DEFAULT_HUMAN_ACTOR_CLIENT: RoomActorClient = "tabula-md";
export const DEFAULT_AGENT_ACTOR_CLIENT: RoomActorClient = "tabula-mcp";
export const ROOM_ACTOR_ADJECTIVES = [
  "Bright",
  "Calm",
  "Careful",
  "Clear",
  "Clever",
  "Curious",
  "Gentle",
  "Kind",
  "Lively",
  "Nimble",
  "Patient",
  "Quiet",
  "Ready",
  "Sharp",
  "Steady",
  "Thoughtful",
  "Warm",
  "Wise",
] as const;
export const ROOM_ACTOR_COLORS = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#c2410c",
  "#be123c",
  "#047857",
  "#0e7490",
  "#4f46e5",
  "#9333ea",
  "#b45309",
] as const;
export const DEFAULT_ACTOR_NAME = "Curious Human";
export const DEFAULT_ACTOR_COLOR = ROOM_ACTOR_COLORS[0];
export const ROOM_ACTOR_MAX_ID_LENGTH = 128;
export const ROOM_ACTOR_MAX_NAME_LENGTH = 40;

const ROOM_ACTOR_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isRoomActorKind = (value: unknown): value is RoomActorKind =>
  value === "human" || value === "agent";

const isRoomActorClient = (value: unknown): value is RoomActorClient =>
  value === "tabula-md" || value === "tabula-mcp" || value === "custom";

export const isRoomCapability = (value: unknown): value is RoomCapability =>
  value === "presence" || value === "read" || value === "write";

export const getDefaultRoomCapabilities = (kind: RoomActorKind) =>
  kind === "agent" ? [...AGENT_ROOM_CAPABILITIES] : [...HUMAN_ROOM_CAPABILITIES];

export const normalizeRoomCapabilities = (
  capabilities: unknown,
  kind: RoomActorKind = "human",
): RoomCapability[] => {
  if (!Array.isArray(capabilities)) {
    return getDefaultRoomCapabilities(kind);
  }

  const normalized = capabilities.filter(isRoomCapability);
  return normalized.length > 0 ? [...new Set(normalized)] : getDefaultRoomCapabilities(kind);
};

export const hasRoomCapability = (
  actor: Pick<RoomActor, "capabilities"> | null | undefined,
  capability: RoomCapability,
) => Boolean(actor?.capabilities.includes(capability));

const getStableActorIndex = (seed: string, modulo: number) => {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % modulo;
};

export const createRoomActorName = (kind: RoomActorKind = "human", actorId = "") => {
  const adjective =
    ROOM_ACTOR_ADJECTIVES[
      getStableActorIndex(actorId.trim() || kind, ROOM_ACTOR_ADJECTIVES.length)
    ] ?? "Curious";
  return `${adjective} ${kind === "agent" ? "Agent" : "Human"}`;
};

export const createRoomActorColor = (actorId = "") =>
  ROOM_ACTOR_COLORS[
    getStableActorIndex(actorId.trim() || "actor", ROOM_ACTOR_COLORS.length)
  ] ?? DEFAULT_ACTOR_COLOR;

export const createRoomActor = ({
  id,
  kind = "human",
  name,
  color,
  client,
  capabilities,
  joinedAt,
}: {
  id: string;
  kind?: RoomActorKind;
  name?: string;
  color?: string;
  client?: RoomActorClient;
  capabilities?: readonly RoomCapability[];
  joinedAt?: string;
}): RoomActor => {
  const actorId = id.trim() || "actor";
  return {
    id: actorId.slice(0, ROOM_ACTOR_MAX_ID_LENGTH),
    kind,
    name: (name?.trim() || createRoomActorName(kind, actorId)).slice(0, ROOM_ACTOR_MAX_NAME_LENGTH),
    color: color?.trim().match(ROOM_ACTOR_COLOR_PATTERN)?.[0] || createRoomActorColor(actorId),
    client: client ?? (kind === "agent" ? DEFAULT_AGENT_ACTOR_CLIENT : DEFAULT_HUMAN_ACTOR_CLIENT),
    capabilities: capabilities?.length
      ? [...new Set(capabilities)]
      : getDefaultRoomCapabilities(kind),
    joinedAt: joinedAt || new Date(0).toISOString(),
  };
};

export const parseRoomActor = (value: unknown): RoomActor | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.trim() === "" ||
    value.id.trim().length > ROOM_ACTOR_MAX_ID_LENGTH ||
    !isRoomActorKind(value.kind) ||
    typeof value.name !== "string" ||
    value.name.trim() === "" ||
    value.name.trim().length > ROOM_ACTOR_MAX_NAME_LENGTH ||
    !isRoomActorClient(value.client) ||
    !Array.isArray(value.capabilities) ||
    typeof value.joinedAt !== "string" ||
    value.joinedAt.trim() === "" ||
    value.joinedAt.length > 64 ||
    !Number.isFinite(Date.parse(value.joinedAt))
  ) {
    return null;
  }

  const capabilities = value.capabilities.filter(isRoomCapability);
  if (capabilities.length !== value.capabilities.length || capabilities.length === 0 || capabilities.length > 3) {
    return null;
  }
  if (typeof value.color === "string" && !ROOM_ACTOR_COLOR_PATTERN.test(value.color.trim())) return null;

  return {
    id: value.id.trim(),
    kind: value.kind,
    name: value.name.trim(),
    color:
      typeof value.color === "string" && value.color.trim()
        ? value.color.trim()
        : createRoomActorColor(value.id),
    client: value.client,
    capabilities: [...new Set(capabilities)],
    joinedAt: value.joinedAt,
  };
};
