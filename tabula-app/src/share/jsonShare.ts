import {
  createJsonShareUrl,
  decodeEncryptedData,
  encodeEncryptedData,
  generateEncryptionKey,
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
import type { FileComment, WorkspaceFile, WorkspaceFolder } from "../workspaceStorage";

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
  folders: WorkspaceFolder[];
  rootFolderId: string;
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
};

type ReadJsonShareSnapshotOptions = {
  serviceUrl: string;
  origin: string;
  route: JsonShareRoute;
  fetchImpl?: typeof fetch;
};

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
  folders,
  rootFolderId,
  activeFileId,
  commentsByFileId,
  signal,
  fetchImpl = fetch,
}: CreateJsonShareLinkOptions) => {
  const payload = createShareSnapshotPayload({
    files,
    folders,
    rootFolderId,
    activeFileId,
    commentsByFileId,
  });
  const key = generateJsonShareKey();
  const encrypted = await encryptJsonSharePayload(payload, key);
  const jsonShareServiceUrl = trimTrailingSlash(serviceUrl);
  const response = await fetchImpl(`${jsonShareServiceUrl}${JSON_SHARE_POST_PATH}`, {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
    },
    body: toArrayBuffer(encrypted),
    signal,
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
    expiresAt: created.expiresAt,
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
  const decoded = await decodeEncryptedData(encryptedBlob, {
    decryptionKey: encodedKey,
  });
  return parseShareSnapshot(decoded.data);
};

const generateJsonShareKey = () => {
  return generateEncryptionKey(JSON_SHARE_KEY_BYTES);
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
