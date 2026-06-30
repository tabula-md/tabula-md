import {
  createJsonShareUrl,
  decodeBase64Url,
  encodeBase64Url,
  JSON_SHARE_KEY_BYTES,
  trimTrailingSlash,
  validateJsonShareCreateResponse,
  type JsonShareRoute,
} from "@tabula-md/tabula";
import {
  createShareSnapshot,
  createShareSnapshotPayload,
  validateShareSnapshotPayload,
  type ShareSnapshot,
  type ShareSnapshotPayload,
} from "./shareSnapshotPayload";
import { tabulaServiceConfig } from "../serviceConfig";
import type { FileComment, WorkspaceFile } from "../workspaceStorage";

export {
  createJsonShareUrl,
  formatJsonShareUrlPreview,
  getJsonShareRoute,
  parseJsonShareFromHash,
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

const JSON_SHARE_IV_BYTES = 12;
const JSON_SHARE_BLOB_MAGIC = new Uint8Array([0x54, 0x4a, 0x53, 0x31]);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const getConfiguredJsonShareServiceUrl = () => {
  return tabulaServiceConfig.jsonUrl;
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

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
