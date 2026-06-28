import {
  createShareSnapshot,
  createShareSnapshotPayload,
  validateShareSnapshotPayload,
  type ShareSnapshot,
  type ShareSnapshotPayload,
} from "./shareSnapshotPayload";
import type { FileComment, MarkdownFile } from "./workspaceStorage";

export type JsonShareRoute = {
  snapshotId: string;
  key: string;
};

type JsonShareCreateResponse = {
  id: string;
  data: string;
};

type CreateJsonShareLinkOptions = {
  serviceUrl: string;
  origin: string;
  files: MarkdownFile[];
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
  fetchImpl?: typeof fetch;
};

type ReadJsonShareSnapshotOptions = {
  serviceUrl: string;
  origin: string;
  route: JsonShareRoute;
  fetchImpl?: typeof fetch;
};

const JSON_SHARE_KEY_BYTES = 32;
const JSON_SHARE_IV_BYTES = 12;
const JSON_SHARE_BLOB_MAGIC = new Uint8Array([0x54, 0x4a, 0x53, 0x31]);
const JSON_SHARE_PATTERN = /^[A-Za-z0-9_-]+$/;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const getConfiguredJsonShareServiceUrl = () => {
  const configuredUrl = import.meta.env.VITE_TABULA_JSON_URL as string | undefined;
  return configuredUrl ? trimTrailingSlash(configuredUrl) : null;
};

export const createJsonShareUrl = (origin: string, snapshotId: string, key: string) =>
  `${origin}/#json=${snapshotId},${key}`;

export const parseJsonShareFromHash = (hash: string): JsonShareRoute | null => {
  const fragment = hash.replace(/^#/, "").trim();
  if (!fragment.startsWith("json=")) {
    return null;
  }

  const jsonValue = fragment.slice("json=".length);
  const [snapshotId, key, extra] = jsonValue.split(",");
  if (
    extra !== undefined ||
    jsonValue.includes("&") ||
    !snapshotId ||
    !JSON_SHARE_PATTERN.test(snapshotId) ||
    !key ||
    !JSON_SHARE_PATTERN.test(key)
  ) {
    return null;
  }

  try {
    return decodeBase64Url(key).byteLength === JSON_SHARE_KEY_BYTES ? { snapshotId, key } : null;
  } catch {
    return null;
  }
};

export const getJsonShareRoute = (location: Pick<Location, "hash" | "pathname">): JsonShareRoute | null => {
  if (location.pathname !== "/") {
    return null;
  }
  return parseJsonShareFromHash(location.hash);
};

export const formatJsonShareUrlPreview = (url: string) => {
  try {
    const parsed = new URL(url);
    const [prefix] = parsed.hash.split(",");
    return `${parsed.host}/${prefix}...`;
  } catch {
    return url;
  }
};

export const createJsonShareLink = async ({
  serviceUrl,
  origin,
  files,
  activeFileId,
  commentsByFileId,
  fetchImpl = fetch,
}: CreateJsonShareLinkOptions) => {
  const payload = createShareSnapshotPayload({ files, activeFileId, commentsByFileId });
  const key = generateJsonShareKey();
  const encrypted = await encryptJsonSharePayload(payload, key);
  const jsonShareServiceUrl = trimTrailingSlash(serviceUrl);
  const response = await fetchImpl(`${jsonShareServiceUrl}/api/v1/post/`, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
    },
    body: toArrayBuffer(encrypted),
  });

  if (!response.ok) {
    throw new Error(`Share link failed: ${await readJsonShareError(response)}`);
  }

  const created = validateJsonShareCreateResponse((await response.json()) as unknown, jsonShareServiceUrl);
  const url = createJsonShareUrl(origin, created.id, key);
  return {
    snapshot: createShareSnapshot({
      id: created.id,
      url,
      payload,
    }),
    url,
  };
};

export const readJsonShareSnapshot = async ({
  serviceUrl,
  origin,
  route,
  fetchImpl = fetch,
}: ReadJsonShareSnapshotOptions): Promise<ShareSnapshot | null> => {
  const jsonShareServiceUrl = trimTrailingSlash(serviceUrl);
  const response = await fetchImpl(`${jsonShareServiceUrl}/api/v1/${encodeURIComponent(route.snapshotId)}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Share link failed: ${await readJsonShareError(response)}`);
  }

  const encrypted = new Uint8Array(await response.arrayBuffer());
  const payload = await decryptJsonSharePayload(encrypted, route.key);
  return createShareSnapshot({
    id: route.snapshotId,
    url: createJsonShareUrl(origin, route.snapshotId, route.key),
    payload,
  });
};

const encryptJsonSharePayload = async (payload: ShareSnapshotPayload, encodedKey: string) => {
  const cryptoKey = await importJsonShareKey(encodedKey, ["encrypt"]);
  const iv = new Uint8Array(JSON_SHARE_IV_BYTES);
  crypto.getRandomValues(iv);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    cryptoKey,
    textEncoder.encode(JSON.stringify(payload)),
  );
  const encryptedBytes = new Uint8Array(encrypted);
  const blob = new Uint8Array(JSON_SHARE_BLOB_MAGIC.byteLength + JSON_SHARE_IV_BYTES + encryptedBytes.byteLength);
  blob.set(JSON_SHARE_BLOB_MAGIC, 0);
  blob.set(iv, JSON_SHARE_BLOB_MAGIC.byteLength);
  blob.set(encryptedBytes, JSON_SHARE_BLOB_MAGIC.byteLength + JSON_SHARE_IV_BYTES);

  return blob;
};

const decryptJsonSharePayload = async (
  encryptedBlob: Uint8Array,
  encodedKey: string,
): Promise<ShareSnapshotPayload> => {
  if (encryptedBlob.byteLength <= JSON_SHARE_BLOB_MAGIC.byteLength + JSON_SHARE_IV_BYTES) {
    throw new Error("Share link failed: invalid snapshot payload");
  }
  for (let index = 0; index < JSON_SHARE_BLOB_MAGIC.byteLength; index += 1) {
    if (encryptedBlob[index] !== JSON_SHARE_BLOB_MAGIC[index]) {
      throw new Error("Share link failed: unsupported snapshot payload");
    }
  }

  const cryptoKey = await importJsonShareKey(encodedKey, ["decrypt"]);
  const ivStart = JSON_SHARE_BLOB_MAGIC.byteLength;
  const encryptedStart = JSON_SHARE_BLOB_MAGIC.byteLength + JSON_SHARE_IV_BYTES;
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: encryptedBlob.slice(ivStart, encryptedStart),
    },
    cryptoKey,
    encryptedBlob.slice(encryptedStart),
  );
  return validateShareSnapshotPayload(JSON.parse(textDecoder.decode(decrypted)) as unknown);
};

const generateJsonShareKey = () => {
  const bytes = new Uint8Array(JSON_SHARE_KEY_BYTES);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
};

const importJsonShareKey = async (encodedKey: string, usages: KeyUsage[]) => {
  const rawKey = decodeBase64Url(encodedKey);
  if (rawKey.byteLength !== JSON_SHARE_KEY_BYTES) {
    throw new Error("Share link key must be 32 bytes");
  }
  return crypto.subtle.importKey("raw", toArrayBuffer(rawKey), "AES-GCM", false, usages);
};

const encodeBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const validateJsonShareCreateResponse = (value: unknown, serviceUrl: string): JsonShareCreateResponse => {
  if (!isRecord(value)) {
    throw new Error("Share link failed: invalid service response");
  }
  const id = requireNonEmptyString(value.id, "id");
  if (!JSON_SHARE_PATTERN.test(id)) {
    throw new Error("Share link failed: invalid service response id");
  }
  const data = requireNonEmptyString(value.data, "data");
  const expectedData = `${trimTrailingSlash(serviceUrl)}/api/v1/${id}`;
  if (data !== expectedData) {
    throw new Error("Share link failed: invalid service response data");
  }
  return {
    id,
    data,
  };
};

const readJsonShareError = async (response: Response) => {
  try {
    const parsed = (await response.json()) as unknown;
    if (isRecord(parsed) && typeof parsed.error === "string") {
      return parsed.error;
    }
  } catch {
    // Fall through to the status text below.
  }
  return response.statusText || `HTTP ${response.status}`;
};

const requireString = (value: unknown, fieldName: string) => {
  if (typeof value !== "string") {
    throw new Error(`Share link failed: missing ${fieldName}`);
  }
  return value;
};

const requireNonEmptyString = (value: unknown, fieldName: string) => {
  const text = requireString(value, fieldName);
  if (!text) {
    throw new Error(`Share link failed: missing ${fieldName}`);
  }
  return text;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
