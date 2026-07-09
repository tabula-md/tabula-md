import {
  createJsonShareUrl,
  decodeEncryptedData,
  decodeBase64Url,
  decryptData,
  encodeEncryptedData,
  encodeBase64Url,
  generateEncryptionKey,
  importEncryptionKey,
  JSON_SHARE_KEY_BYTES,
  JSON_SHARE_API_PREFIX,
  JSON_SHARE_POST_PATH,
  parseShareSnapshot,
  serializeShareSnapshot,
  toArrayBuffer,
  trimTrailingSlash,
  validateJsonShareCreateResponse,
  type JsonShareRoute,
} from "@tabula-md/tabula";
import {
  createShareSnapshot,
  createShareSnapshotPayload,
  type ShareSnapshot,
  type ShareSnapshotPayload,
} from "./shareSnapshotPayload";
import { resolveTabulaJsonShareServiceUrl } from "../serviceConfig";
import type { FileComment, WorkspaceFile } from "../workspaceStorage";

export {
  createJsonShareUrl,
  formatJsonShareUrlPreview,
  getJsonShareImportRoute,
  getJsonShareRoute,
  parseJsonShareFromHash,
  type JsonShareImportRoute,
  type JsonShareRoute,
} from "@tabula-md/tabula";

type CreateJsonShareLinkOptions = {
  serviceUrl: string;
  origin: string;
  files: WorkspaceFile[];
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

const JSON_SHARE_BLOB_MAGIC = new Uint8Array([0x54, 0x4a, 0x53, 0x31]);
const JSON_SHARE_DECRYPTION_ERROR =
  "This export link could not be decrypted. It may have the wrong client-only key.";

export const getConfiguredJsonShareServiceUrl = () =>
  resolveTabulaJsonShareServiceUrl({
    location: typeof window === "undefined" ? undefined : window.location,
  });

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
  const response = await fetchImpl(`${jsonShareServiceUrl}${JSON_SHARE_POST_PATH}`, {
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
  const response = await fetchImpl(`${jsonShareServiceUrl}${JSON_SHARE_API_PREFIX}${encodeURIComponent(route.snapshotId)}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Share link failed: ${await readJsonShareError(response)}`);
  }

  const encrypted = new Uint8Array(await response.arrayBuffer());
  const payload = await decryptJsonSharePayload(encrypted, route.key).catch((error: unknown) => {
    if (error instanceof Error && error.message.startsWith("Share link failed:")) {
      throw error;
    }
    throw new Error(JSON_SHARE_DECRYPTION_ERROR);
  });
  return createShareSnapshot({
    id: route.snapshotId,
    url: createJsonShareUrl(origin, route.snapshotId, route.key),
    payload,
  });
};

const encryptJsonSharePayload = async (payload: ShareSnapshotPayload, encodedKey: string) => {
  return encodeEncryptedData(serializeShareSnapshot(payload), {
    encryptionKey: encodedKey,
    metadata: { kind: "json-share", schemaVersion: payload.schemaVersion },
  });
};

const decryptJsonSharePayload = async (
  encryptedBlob: Uint8Array,
  encodedKey: string,
): Promise<ShareSnapshotPayload> => {
  if (isLegacyJsonShareBlob(encryptedBlob)) {
    return decryptLegacyJsonSharePayload(encryptedBlob, encodedKey);
  }

  const decoded = await decodeEncryptedData(encryptedBlob, {
    decryptionKey: encodedKey,
  });
  return parseShareSnapshot(decoded.data);
};

const generateJsonShareKey = () => {
  return generateEncryptionKey(JSON_SHARE_KEY_BYTES);
};

const isLegacyJsonShareBlob = (encryptedBlob: Uint8Array) =>
  encryptedBlob.byteLength > JSON_SHARE_BLOB_MAGIC.byteLength &&
  JSON_SHARE_BLOB_MAGIC.every((byte, index) => encryptedBlob[index] === byte);

const decryptLegacyJsonSharePayload = async (
  encryptedBlob: Uint8Array,
  encodedKey: string,
): Promise<ShareSnapshotPayload> => {
  const rawKey = decodeBase64Url(encodedKey);
  if (rawKey.byteLength !== JSON_SHARE_KEY_BYTES) {
    throw new Error("Share link key must be 32 bytes");
  }
  const ivStart = JSON_SHARE_BLOB_MAGIC.byteLength;
  const encryptedStart = JSON_SHARE_BLOB_MAGIC.byteLength + 12;
  if (encryptedBlob.byteLength <= encryptedStart) {
    throw new Error("Share link failed: invalid snapshot payload");
  }
  const key = await importEncryptionKey(encodeBase64Url(rawKey), ["decrypt"], JSON_SHARE_KEY_BYTES);
  const decrypted = await decryptData(encryptedBlob.slice(ivStart, encryptedStart), encryptedBlob.slice(encryptedStart), key);
  return parseShareSnapshot(new Uint8Array(decrypted));
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
