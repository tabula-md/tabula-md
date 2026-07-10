export type RoomActorKind = "human" | "agent";

export type RoomActorClient = "tabula-md" | "tabula-mcp" | "custom";

export type RoomCapability =
  | "presence"
  | "read"
  | "comment"
  | "write"
  | "create"
  | "delete"
  | "move";

export type RoomActor = {
  id: string;
  kind: RoomActorKind;
  name: string;
  color?: string;
  client: RoomActorClient;
  capabilities: RoomCapability[];
  joinedAt: string;
};

export type RoomEventType =
  | "actor.joined"
  | "actor.left"
  | "presence.updated"
  | "text.updated"
  | "workspace.updated";

export type RoomEventBase = {
  id: string;
  roomId: string;
  actorId: string;
  type: RoomEventType;
  createdAt: string;
};

export type RoomPresenceSelection = {
  documentId?: string;
  from: number;
  to: number;
};

export type RoomPresenceCursor = {
  documentId?: string;
  offset: number;
};

export type RoomPresence = {
  actorId: string;
  activeDocumentId?: string;
  selection?: RoomPresenceSelection;
  cursor?: RoomPresenceCursor;
  lastSeen: number;
};

export type RoomPresenceUpdatedEvent = RoomEventBase & {
  type: "presence.updated";
  actor: RoomActor;
  presence: RoomPresence;
  fileTitle?: string;
  selection?: RoomPresenceSelection;
};

export type RoomTextUpdatedEvent = RoomEventBase & {
  type: "text.updated";
  actor: RoomActor;
  documentId: string;
  baseHash?: string;
  baseSha256?: string;
  sha256?: string;
  update: string;
};

export type WorkspaceFolderNode = {
  id: string;
  type: "folder";
  parentId: string | null;
  title: string;
  order?: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceDocumentNode = {
  id: string;
  type: "document";
  parentId: string | null;
  title: string;
  sha256: string;
  textLength: number;
  order?: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceNode = WorkspaceFolderNode | WorkspaceDocumentNode;

export type WorkspaceRoomState = {
  roomId: string;
  mode: "workspace";
  version: number;
  rootId: string;
  nodes: WorkspaceNode[];
  activeDocumentId?: string;
};

export const WORKSPACE_ROOM_CHECKPOINT_SCHEMA_VERSION = 1;

export type WorkspaceRoomCheckpoint = {
  schema: "tabula.workspace-room-checkpoint";
  version: typeof WORKSPACE_ROOM_CHECKPOINT_SCHEMA_VERSION;
  roomId: string;
  createdAt: string;
  updatedAt: string;
  workspace: WorkspaceRoomState;
  documents: WorkspaceRoomDocument[];
};

export type WorkspaceRoomDocument = {
  id: string;
  title: string;
  markdown: string;
  parentId?: string | null;
};

export type RoomActorJoinedEvent = RoomEventBase & {
  type: "actor.joined";
  actor: RoomActor;
};

export type RoomActorLeftEvent = RoomEventBase & {
  type: "actor.left";
};

export type RoomWorkspaceUpdatedEvent = RoomEventBase & {
  type: "workspace.updated";
  actor: RoomActor;
  workspace: WorkspaceRoomState;
};

export type RoomEvent =
  | RoomActorJoinedEvent
  | RoomActorLeftEvent
  | RoomPresenceUpdatedEvent
  | RoomTextUpdatedEvent
  | RoomWorkspaceUpdatedEvent;

export type RoomEventParseResult =
  | { ok: true; event: RoomEvent }
  | { ok: false; reason: "invalid" | "unknown" };

export const HUMAN_ROOM_CAPABILITIES: readonly RoomCapability[] = [
  "presence",
  "read",
  "comment",
  "write",
  "create",
  "delete",
  "move",
];

export const AGENT_ROOM_CAPABILITIES: readonly RoomCapability[] = [
  "presence",
  "read",
  "comment",
  "write",
  "create",
  "delete",
  "move",
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
export const MARKDOWN_TEXT_HASH_ALGORITHM = "sha256-hex";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const base64UrlPattern = /^[A-Za-z0-9_-]+$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isRoomActorKind = (value: unknown): value is RoomActorKind =>
  value === "human" || value === "agent";

const isRoomActorClient = (value: unknown): value is RoomActorClient =>
  value === "tabula-md" || value === "tabula-mcp" || value === "custom";

export const isRoomCapability = (value: unknown): value is RoomCapability =>
  value === "presence" ||
  value === "read" ||
  value === "comment" ||
  value === "write" ||
  value === "create" ||
  value === "delete" ||
  value === "move";

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
    id: actorId,
    kind,
    name: name?.trim() || createRoomActorName(kind, actorId),
    color: color?.trim() || createRoomActorColor(actorId),
    client: client ?? (kind === "agent" ? DEFAULT_AGENT_ACTOR_CLIENT : DEFAULT_HUMAN_ACTOR_CLIENT),
    capabilities: capabilities?.length ? [...new Set(capabilities)] : getDefaultRoomCapabilities(kind),
    joinedAt: joinedAt || new Date(0).toISOString(),
  };
};

export const parseRoomActor = (value: unknown): RoomActor | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.trim() === "" ||
    !isRoomActorKind(value.kind) ||
    typeof value.name !== "string" ||
    value.name.trim() === "" ||
    !isRoomActorClient(value.client) ||
    !Array.isArray(value.capabilities) ||
    typeof value.joinedAt !== "string" ||
    value.joinedAt.trim() === ""
  ) {
    return null;
  }

  const capabilities = value.capabilities.filter(isRoomCapability);
  if (capabilities.length !== value.capabilities.length || capabilities.length === 0) {
    return null;
  }

  const color = typeof value.color === "string" && value.color.trim() ? value.color.trim() : createRoomActorColor(value.id);

  return {
    id: value.id.trim(),
    kind: value.kind,
    name: value.name.trim(),
    color,
    client: value.client,
    capabilities: [...new Set(capabilities)],
    joinedAt: value.joinedAt,
  };
};

export const isBase64UrlBytes = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && base64UrlPattern.test(value) && value.length % 4 !== 1;

export const parseRoomPresence = (value: unknown): RoomPresence | null => {
  if (!isRecord(value) || typeof value.actorId !== "string") {
    return null;
  }

  const selection = parseSelection(value.selection);
  const cursor =
    isRecord(value.cursor) && typeof value.cursor.offset === "number"
      ? {
          documentId: typeof value.cursor.documentId === "string" ? value.cursor.documentId : undefined,
          offset: value.cursor.offset,
        }
      : undefined;

  return {
    actorId: value.actorId,
    activeDocumentId: typeof value.activeDocumentId === "string" ? value.activeDocumentId : undefined,
    selection,
    cursor,
    lastSeen: typeof value.lastSeen === "number" ? value.lastSeen : Date.now(),
  };
};

export const parseWorkspaceNode = (value: unknown): WorkspaceNode | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !(value.parentId === null || typeof value.parentId === "string")
  ) {
    return null;
  }

  const base = {
    id: value.id,
    parentId: value.parentId,
    title: value.title,
    order: typeof value.order === "number" ? value.order : undefined,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };

  if (value.type === "folder") {
    return {
      ...base,
      type: "folder",
    };
  }

  if (value.type === "document" && typeof value.sha256 === "string" && typeof value.textLength === "number") {
    return {
      ...base,
      type: "document",
      sha256: value.sha256,
      textLength: value.textLength,
    };
  }

  return null;
};

export const parseWorkspaceRoomState = (value: unknown): WorkspaceRoomState | null => {
  if (
    !isRecord(value) ||
    typeof value.roomId !== "string" ||
    typeof value.version !== "number" ||
    typeof value.rootId !== "string" ||
    !Array.isArray(value.nodes)
  ) {
    return null;
  }

  const nodes = value.nodes.map(parseWorkspaceNode);
  if (nodes.some((node) => !node)) {
    return null;
  }

  return {
    roomId: value.roomId,
    mode: "workspace",
    version: value.version,
    rootId: value.rootId,
    nodes: nodes as WorkspaceNode[],
    activeDocumentId: typeof value.activeDocumentId === "string" ? value.activeDocumentId : undefined,
  };
};

export const parseWorkspaceRoomDocument = (value: unknown): WorkspaceRoomDocument | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.markdown !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    title: value.title,
    markdown: value.markdown,
    parentId: value.parentId === null || typeof value.parentId === "string" ? value.parentId : undefined,
  };
};

export const parseWorkspaceRoomCheckpoint = (value: unknown): WorkspaceRoomCheckpoint | null => {
  if (
    !isRecord(value) ||
    value.schema !== "tabula.workspace-room-checkpoint" ||
    value.version !== WORKSPACE_ROOM_CHECKPOINT_SCHEMA_VERSION ||
    typeof value.roomId !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !Array.isArray(value.documents)
  ) {
    return null;
  }

  const workspace = parseWorkspaceRoomState(value.workspace);
  const documents = value.documents.map(parseWorkspaceRoomDocument);
  if (!workspace || workspace.roomId !== value.roomId || documents.some((document) => !document)) {
    return null;
  }

  const documentIds = new Set((documents as WorkspaceRoomDocument[]).map((document) => document.id));
  const hasMissingDocument = workspace.nodes.some((node) => node.type === "document" && !documentIds.has(node.id));
  if (hasMissingDocument) {
    return null;
  }

  return {
    schema: "tabula.workspace-room-checkpoint",
    version: WORKSPACE_ROOM_CHECKPOINT_SCHEMA_VERSION,
    roomId: value.roomId,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    workspace,
    documents: documents as WorkspaceRoomDocument[],
  };
};

export const createWorkspaceRoomState = async ({
  activeDocumentId,
  documents,
  hashText = hashMarkdownText,
  nowIso = () => new Date(0).toISOString(),
  roomId,
  rootId = "workspace-root",
  version = 1,
}: {
  activeDocumentId?: string;
  documents: readonly WorkspaceRoomDocument[];
  hashText?: (text: string) => Promise<string>;
  nowIso?: () => string;
  roomId: string;
  rootId?: string;
  version?: number;
}): Promise<WorkspaceRoomState> => {
  const createdAt = nowIso();
  const documentIds = new Set(documents.map((document) => document.id));
  const resolvedActiveDocumentId =
    activeDocumentId && documentIds.has(activeDocumentId)
      ? activeDocumentId
      : documents[0]?.id;
  const documentNodes = await Promise.all(
    documents.map(async (document, index): Promise<WorkspaceDocumentNode> => ({
      id: document.id,
      type: "document",
      parentId: document.parentId ?? rootId,
      title: document.title,
      sha256: await hashText(document.markdown),
      textLength: document.markdown.length,
      order: index,
      createdAt,
      updatedAt: createdAt,
    })),
  );

  return {
    roomId,
    mode: "workspace",
    version,
    rootId,
    nodes: [
      {
        id: rootId,
        type: "folder",
        parentId: null,
        title: "Workspace",
        order: 0,
        createdAt,
        updatedAt: createdAt,
      },
      ...documentNodes,
    ],
    ...(resolvedActiveDocumentId ? { activeDocumentId: resolvedActiveDocumentId } : {}),
  };
};

export const createWorkspaceRoomCheckpoint = async ({
  activeDocumentId,
  createdAt,
  documents,
  hashText,
  nowIso = () => new Date(0).toISOString(),
  roomId,
  rootId,
  version,
  workspace,
}: {
  activeDocumentId?: string;
  createdAt?: string;
  documents: readonly WorkspaceRoomDocument[];
  hashText?: (text: string) => Promise<string>;
  nowIso?: () => string;
  roomId: string;
  rootId?: string;
  version?: number;
  workspace?: WorkspaceRoomState;
}): Promise<WorkspaceRoomCheckpoint> => {
  const updatedAt = nowIso();
  const resolvedWorkspace = workspace ?? await createWorkspaceRoomState({
    activeDocumentId,
    documents,
    hashText,
    nowIso: () => updatedAt,
    roomId,
    rootId,
    version,
  });

  return {
    schema: "tabula.workspace-room-checkpoint",
    version: WORKSPACE_ROOM_CHECKPOINT_SCHEMA_VERSION,
    roomId,
    createdAt: createdAt ?? updatedAt,
    updatedAt,
    workspace: resolvedWorkspace,
    documents: documents.map((document) => ({
      id: document.id,
      title: document.title,
      markdown: document.markdown,
      parentId: document.parentId ?? null,
    })),
  };
};

export const encodeWorkspaceRoomCheckpoint = (checkpoint: WorkspaceRoomCheckpoint) =>
  textEncoder.encode(JSON.stringify(checkpoint));

export const decodeWorkspaceRoomCheckpoint = (bytes: Uint8Array): WorkspaceRoomCheckpoint | null => {
  try {
    return parseWorkspaceRoomCheckpoint(JSON.parse(textDecoder.decode(bytes)) as unknown);
  } catch {
    return null;
  }
};

export const encodeRoomEvent = (event: RoomEvent) => textEncoder.encode(JSON.stringify(event));

export const decodeRoomEvent = (bytes: Uint8Array): RoomEventParseResult => {
  try {
    return parseRoomEvent(JSON.parse(textDecoder.decode(bytes)));
  } catch {
    return { ok: false, reason: "invalid" };
  }
};

export const parseRoomEvent = (value: unknown): RoomEventParseResult => {
  if (!isRecord(value) || typeof value.type !== "string") {
    return { ok: false, reason: "invalid" };
  }

  if (!isRoomEventType(value.type)) {
    return { ok: false, reason: "unknown" };
  }

  const base = parseRoomEventBase(value, value.type);
  if (!base) {
    return { ok: false, reason: "invalid" };
  }

  if (value.type === "actor.joined") {
    const actor = parseRoomActor(value.actor);
    if (!actor || actor.id !== base.actorId) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, event: { ...base, type: value.type, actor } };
  }

  if (value.type === "actor.left") {
    return { ok: true, event: { ...base, type: value.type } };
  }

  if (value.type === "presence.updated") {
    const actor = parseRoomActor(value.actor);
    const presence = parseRoomPresence(value.presence);
    if (!actor || !presence || actor.id !== base.actorId || presence.actorId !== base.actorId) {
      return { ok: false, reason: "invalid" };
    }
    return {
      ok: true,
      event: {
        ...base,
        type: value.type,
        actor,
        presence,
        fileTitle: typeof value.fileTitle === "string" ? value.fileTitle : undefined,
        selection: parseSelection(value.selection),
      },
    };
  }

  if (value.type === "text.updated") {
    const actor = parseRoomActor(value.actor);
    if (!actor || actor.id !== base.actorId || typeof value.documentId !== "string" || !isBase64UrlBytes(value.update)) {
      return { ok: false, reason: "invalid" };
    }
    return {
      ok: true,
      event: {
        ...base,
        type: value.type,
        actor,
        documentId: value.documentId,
        baseHash: typeof value.baseHash === "string" ? value.baseHash : undefined,
        baseSha256: typeof value.baseSha256 === "string" ? value.baseSha256 : undefined,
        sha256: typeof value.sha256 === "string" ? value.sha256 : undefined,
        update: value.update,
      },
    };
  }

  if (value.type === "workspace.updated") {
    const actor = parseRoomActor(value.actor);
    const workspace = parseWorkspaceRoomState(value.workspace);
    if (!actor || actor.id !== base.actorId || !workspace || workspace.roomId !== base.roomId) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, event: { ...base, type: value.type, actor, workspace } };
  }

  return { ok: false, reason: "unknown" };
};

export const hashMarkdownText = async (text: string): Promise<string> => {
  if (!globalThis.crypto?.subtle) {
    throw new Error("SHA-256 hashing requires Web Crypto.");
  }

  const digest = await globalThis.crypto.subtle.digest("SHA-256", textEncoder.encode(text));
  return bytesToHex(new Uint8Array(digest));
};

const roomEventTypes: readonly RoomEventType[] = [
  "actor.joined",
  "actor.left",
  "presence.updated",
  "text.updated",
  "workspace.updated",
];

const isRoomEventType = (value: string): value is RoomEventType =>
  roomEventTypes.includes(value as RoomEventType);

const parseRoomEventBase = (
  value: Record<string, unknown>,
  type: RoomEventType,
): RoomEventBase | null => {
  if (
    typeof value.id !== "string" ||
    typeof value.roomId !== "string" ||
    typeof value.actorId !== "string" ||
    typeof value.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    roomId: value.roomId,
    actorId: value.actorId,
    type,
    createdAt: value.createdAt,
  };
};

const parseSelection = (value: unknown): RoomPresenceUpdatedEvent["selection"] => {
  if (!isRecord(value) || typeof value.from !== "number" || typeof value.to !== "number") {
    return undefined;
  }
  return {
    documentId: typeof value.documentId === "string" ? value.documentId : undefined,
    from: value.from,
    to: value.to,
  };
};

const bytesToHex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
