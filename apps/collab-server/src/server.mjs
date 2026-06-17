import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { Server } from "@hocuspocus/server";
import * as Y from "yjs";
import {
  createCollabSnapshotsPath,
  createCollabTokenPath,
  matchCollabSnapshotsPath,
  matchCollabTokenPath,
  sanitizeRoomId,
} from "../../../packages/collab-protocol/index.mjs";

const PORT = Number(process.env.PORT ?? 1234);
const DATA_DIR = process.env.COLLAB_DATA_DIR ?? path.join(process.cwd(), ".tabula-collab");
const ROOMS_DIR = path.join(DATA_DIR, "rooms");
const SNAPSHOT_LIMIT = Number(process.env.COLLAB_SNAPSHOT_LIMIT ?? 20);
const SNAPSHOT_INTERVAL_MS = Number(process.env.COLLAB_SNAPSHOT_INTERVAL_MS ?? 30_000);
const TOKEN_SECRET = process.env.COLLAB_TOKEN_SECRET ?? "tabula-local-dev-secret-change-me";
const TOKEN_TTL_SECONDS = Number(process.env.COLLAB_TOKEN_TTL_SECONDS ?? 60 * 60);
const REQUIRE_TOKEN = process.env.COLLAB_REQUIRE_TOKEN !== "false";
const ENABLE_DEV_TOKEN_ENDPOINT = process.env.COLLAB_ENABLE_DEV_TOKEN_ENDPOINT !== "false";
const MAX_TOKEN_BODY_BYTES = Number(process.env.COLLAB_TOKEN_MAX_BODY_BYTES ?? 4096);
const TOKEN_RATE_LIMIT_PER_MINUTE = Number(process.env.COLLAB_TOKEN_RATE_LIMIT_PER_MINUTE ?? 120);
const CONNECTION_RATE_LIMIT_PER_MINUTE = Number(process.env.COLLAB_CONNECTION_RATE_LIMIT_PER_MINUTE ?? 120);
const UPDATE_RATE_LIMIT_PER_MINUTE = Number(process.env.COLLAB_UPDATE_RATE_LIMIT_PER_MINUTE ?? 600);
const rooms = new Map();
const rateLimits = new Map();

fs.mkdirSync(ROOMS_DIR, { recursive: true });

const parseAllowedOrigins = () => {
  const configuredOrigins = process.env.COLLAB_ALLOWED_ORIGINS;
  if (!configuredOrigins) {
    return null;
  }

  return configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const ALLOWED_ORIGINS = parseAllowedOrigins();

const readJson = (filePath, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
};

const isLocalOrigin = (origin) => /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  if (!ALLOWED_ORIGINS) {
    return isLocalOrigin(origin);
  }

  return ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin);
};

const applyCorsHeaders = (request, response) => {
  const origin = request.headers.origin;
  if (typeof origin === "string" && isAllowedOrigin(origin)) {
    response.setHeader("access-control-allow-origin", origin);
    response.setHeader("vary", "origin");
  }

  response.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type");
};

const assertRateLimit = (key, limit, windowMs = 60_000) => {
  if (!Number.isFinite(limit) || limit <= 0) {
    return;
  }

  const now = Date.now();
  const bucket = rateLimits.get(key);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    rateLimits.set(key, { count: 1, startedAt: now });
    return;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    throw new Error("Rate limit exceeded");
  }
};

const base64UrlEncode = (value) => Buffer.from(value).toString("base64url");

const base64UrlDecodeJson = (value) => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

const signTokenBody = (body) => crypto.createHmac("sha256", TOKEN_SECRET).update(body).digest("base64url");

const createRoomToken = ({ roomId, userId, role = "write" }) => {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    iss: "tabula-collab",
    roomId,
    userId,
    role,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  return {
    token: `${body}.${signTokenBody(body)}`,
    payload,
  };
};

const timingSafeEqualString = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const verifyRoomToken = (token) => {
  const [body, signature] = token.split(".");
  if (!body || !signature || !timingSafeEqualString(signature, signTokenBody(body))) {
    throw new Error("Invalid room token");
  }

  const payload = base64UrlDecodeJson(body);
  const now = Math.floor(Date.now() / 1000);
  if (payload.v !== 1 || payload.iss !== "tabula-collab") {
    throw new Error("Unsupported room token");
  }
  if (!payload.roomId || !payload.userId || !["write", "read"].includes(payload.role)) {
    throw new Error("Malformed room token");
  }
  if (!Number.isFinite(payload.exp) || payload.exp <= now) {
    throw new Error("Expired room token");
  }

  return payload;
};

const readRequestJson = async (request) =>
  new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_TOKEN_BODY_BYTES) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });

const getRequestAddress = (request) => request.socket.remoteAddress ?? "unknown";

const normalizeTokenRequest = (value) => {
  const roomId = typeof value.roomId === "string" ? value.roomId.trim() : "";
  const userId = typeof value.userId === "string" ? value.userId.trim() : "";
  const role = value.role === "read" ? "read" : "write";

  if (!roomId || roomId.length > 160 || sanitizeRoomId(roomId) !== roomId) {
    throw new Error("Invalid room id");
  }
  if (!userId || userId.length > 160) {
    throw new Error("Invalid user id");
  }

  return { roomId, userId, role };
};

const getRoomDirectory = (roomId) => path.join(ROOMS_DIR, sanitizeRoomId(roomId));

const getRoomRecord = (roomId) => {
  const existingRoom = rooms.get(roomId);
  if (existingRoom) {
    return existingRoom;
  }

  const directory = getRoomDirectory(roomId);
  const updateFile = path.join(directory, "state.bin");
  const metaFile = path.join(directory, "meta.json");
  const snapshotDirectory = path.join(directory, "snapshots");
  const meta = readJson(metaFile, {});

  const room = {
    id: roomId,
    directory,
    updateFile,
    metaFile,
    snapshotDirectory,
    version: meta.version ?? 0,
    lastSavedAt: meta.lastSavedAt,
    lastUpdatedAt: meta.lastUpdatedAt,
    lastSnapshotTimestamp: meta.lastSnapshotTimestamp ?? 0,
    snapshots: Array.isArray(meta.snapshots) ? meta.snapshots : [],
  };

  rooms.set(roomId, room);
  return room;
};

const getRoomMetaPayload = (room) => ({
  roomId: room.id,
  version: room.version,
  snapshotCount: room.snapshots.length,
  lastSavedAt: room.lastSavedAt,
  lastUpdatedAt: room.lastUpdatedAt,
  snapshots: room.snapshots.slice(-5).reverse(),
});

const writeRoomMeta = (room) => {
  fs.mkdirSync(room.directory, { recursive: true });
  fs.writeFileSync(
    room.metaFile,
    JSON.stringify(
      {
        id: room.id,
        version: room.version,
        lastSavedAt: room.lastSavedAt,
        lastUpdatedAt: room.lastUpdatedAt,
        lastSnapshotTimestamp: room.lastSnapshotTimestamp,
        snapshots: room.snapshots,
      },
      null,
      2,
    ),
  );
};

const persistRoom = (room, sharedDoc, options = {}) => {
  const now = new Date().toISOString();
  const update = Y.encodeStateAsUpdate(sharedDoc);
  fs.mkdirSync(room.directory, { recursive: true });
  fs.writeFileSync(room.updateFile, update);

  const shouldSnapshot =
    options.forceSnapshot ||
    room.snapshots.length === 0 ||
    Date.now() - room.lastSnapshotTimestamp >= SNAPSHOT_INTERVAL_MS;

  if (shouldSnapshot) {
    const snapshotId = `${Date.now()}-${room.version}`;
    const snapshotFile = path.join(room.snapshotDirectory, `${snapshotId}.bin`);
    fs.mkdirSync(room.snapshotDirectory, { recursive: true });
    fs.writeFileSync(snapshotFile, update);
    room.lastSnapshotTimestamp = Date.now();
    room.snapshots = [
      ...room.snapshots,
      {
        id: snapshotId,
        createdAt: now,
        textLength: sharedDoc.getText("markdown").length,
        updateSize: update.length,
        version: room.version,
      },
    ].slice(-SNAPSHOT_LIMIT);
  }

  room.lastSavedAt = now;
  writeRoomMeta(room);
};

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
};

const server = new Server({
  port: PORT,
  name: "tabula-collab",
  quiet: true,
  stopOnSignals: false,
  debounce: 250,
  maxDebounce: 2_000,
  websocketOptions: {
    maxPayload: Number(process.env.COLLAB_MAX_PAYLOAD_BYTES ?? 2 * 1024 * 1024),
  },
  async onConnect({ documentName: roomId, requestHeaders }) {
    const origin = requestHeaders.get("origin");
    if (!isAllowedOrigin(origin)) {
      throw new Error("Origin not allowed");
    }

    assertRateLimit(`connect:${roomId}`, CONNECTION_RATE_LIMIT_PER_MINUTE);
  },
  async onAuthenticate({ token, documentName: roomId, connectionConfig }) {
    if (!REQUIRE_TOKEN) {
      return;
    }

    const payload = verifyRoomToken(token);
    if (payload.roomId !== roomId) {
      throw new Error("Room token does not match room");
    }

    connectionConfig.readOnly = payload.role === "read";
    return payload;
  },
  async onLoadDocument({ documentName: roomId }) {
    const room = getRoomRecord(roomId);
    try {
      return fs.readFileSync(room.updateFile);
    } catch {
      return undefined;
    }
  },
  async onChange({ documentName: roomId }) {
    assertRateLimit(`update:${roomId}`, UPDATE_RATE_LIMIT_PER_MINUTE);
    const room = getRoomRecord(roomId);
    room.version += 1;
    room.lastUpdatedAt = new Date().toISOString();
  },
  async onStoreDocument({ documentName: roomId, document: sharedDoc }) {
    const room = getRoomRecord(roomId);
    persistRoom(room, sharedDoc);
    sharedDoc.broadcastStateless(
      JSON.stringify({
        type: "tabula-room-meta",
        meta: getRoomMetaPayload(room),
      }),
    );
  },
  async onRequest({ request, response, instance }) {
    applyCorsHeaders(request, response);

    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    if (!isAllowedOrigin(request.headers.origin)) {
      sendJson(response, 403, { ok: false, error: "Origin not allowed" });
      throw null;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      throw null;
    }

    if (matchCollabTokenPath(requestUrl.pathname)) {
      if (!ENABLE_DEV_TOKEN_ENDPOINT) {
        sendJson(response, 404, { ok: false, error: "Token endpoint disabled" });
        throw null;
      }

      if (request.method !== "POST") {
        sendJson(response, 405, { ok: false, error: "Use POST" });
        throw null;
      }

      try {
        assertRateLimit(`token:${getRequestAddress(request)}`, TOKEN_RATE_LIMIT_PER_MINUTE);
        sendJson(response, 200, createRoomToken(normalizeTokenRequest(await readRequestJson(request))));
      } catch (error) {
        sendJson(response, 400, { ok: false, error: error.message || "Invalid token request" });
      }

      throw null;
    }

    const snapshotRoomId = matchCollabSnapshotsPath(requestUrl.pathname);

    if (snapshotRoomId) {
      sendJson(response, 200, getRoomMetaPayload(getRoomRecord(snapshotRoomId)));
      throw null;
    }

    sendJson(response, 200, {
      ok: true,
      service: "tabula-collab",
      engine: "hocuspocus",
      authRequired: REQUIRE_TOKEN,
      devTokenEndpoint: ENABLE_DEV_TOKEN_ENDPOINT ? createCollabTokenPath() : null,
      rooms: instance.getDocumentsCount(),
      connections: instance.getConnectionsCount(),
      persistentRooms: fs.existsSync(ROOMS_DIR) ? fs.readdirSync(ROOMS_DIR).length : 0,
      snapshotsPath: "/collab/:roomId/snapshots",
    });
    throw null;
  },
});

const shutdown = async () => {
  server.hocuspocus.flushPendingStores();
  await server.destroy();
  process.exit(0);
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});

await server.listen();
console.log(`Tabula.md collaboration server listening on ws://localhost:${PORT} using Hocuspocus`);
