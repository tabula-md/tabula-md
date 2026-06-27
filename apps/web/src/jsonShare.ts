import { createPublishPayload, getConfiguredPublishServiceUrl, type PublishedSnapshot, type PublishPayload } from "./publish";
import type { FileComment, MarkdownFile } from "./workspaceStorage";

export type JsonShareRoute = {
  snapshotId: string;
  key: string;
};

type JsonShareCreateResponse = {
  jsonId: string;
  createdAt: string;
};

type EncryptedJsonShareRecord = {
  v: 1;
  jsonId: string;
  createdAt: string;
  encryptedData: string;
  iv: string;
};

type CreateJsonShareLinkOptions = {
  serviceUrl: string;
  origin: string;
  ownerName?: string;
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
const JSON_SHARE_PATTERN = /^[A-Za-z0-9_-]+$/;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const getConfiguredJsonShareServiceUrl = getConfiguredPublishServiceUrl;

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
  ownerName,
  files,
  activeFileId,
  commentsByFileId,
  fetchImpl = fetch,
}: CreateJsonShareLinkOptions) => {
  const payload = createPublishPayload({ ownerName, files, activeFileId, commentsByFileId });
  const key = generateJsonShareKey();
  const encrypted = await encryptJsonSharePayload(payload, key);
  const jsonShareServiceUrl = trimTrailingSlash(serviceUrl);
  const response = await fetchImpl(`${jsonShareServiceUrl}/v1/json`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(encrypted),
  });

  if (!response.ok) {
    throw new Error(`Share link failed: ${await readJsonShareError(response)}`);
  }

  const created = validateJsonShareCreateResponse((await response.json()) as unknown);
  const url = createJsonShareUrl(origin, created.jsonId, key);
  return {
    snapshot: snapshotFromPayload({
      createdAt: created.createdAt,
      id: created.jsonId,
      pageUrl: url,
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
}: ReadJsonShareSnapshotOptions): Promise<PublishedSnapshot | null> => {
  const jsonShareServiceUrl = trimTrailingSlash(serviceUrl);
  const response = await fetchImpl(`${jsonShareServiceUrl}/v1/json/${encodeURIComponent(route.snapshotId)}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Share link failed: ${await readJsonShareError(response)}`);
  }

  const record = validateEncryptedJsonShareRecord((await response.json()) as unknown);
  const payload = await decryptJsonSharePayload(record, route.key);
  return snapshotFromPayload({
    createdAt: record.createdAt,
    id: record.jsonId,
    pageUrl: createJsonShareUrl(origin, record.jsonId, route.key),
    payload,
  });
};

const encryptJsonSharePayload = async (payload: PublishPayload, encodedKey: string) => {
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

  return {
    encryptedData: encodeBase64Url(new Uint8Array(encrypted)),
    iv: encodeBase64Url(iv),
  };
};

const decryptJsonSharePayload = async (record: EncryptedJsonShareRecord, encodedKey: string): Promise<PublishPayload> => {
  const cryptoKey = await importJsonShareKey(encodedKey, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: decodeBase64Url(record.iv),
    },
    cryptoKey,
    decodeBase64Url(record.encryptedData),
  );
  return validatePublishPayload(JSON.parse(textDecoder.decode(decrypted)) as unknown);
};

const snapshotFromPayload = ({
  createdAt,
  id,
  pageUrl,
  payload,
}: {
  createdAt: string;
  id: string;
  pageUrl: string;
  payload: PublishPayload;
}): PublishedSnapshot => ({
  id,
  createdAt,
  activeFileId: payload.activeFileId,
  fileCount: payload.files.length,
  files: payload.files,
  commentsByFileId: payload.commentsByFileId,
  urls: {
    page: pageUrl,
    llmsTxt: "",
    llmsFullTxt: "",
  },
  llmsTxt: payload.llmsTxt,
  llmsFullTxt: payload.llmsFullTxt,
  markdownBundle: payload.markdownBundle ?? "",
  publishBundle: payload.publishBundle ?? "",
  ...(payload.ownerName ? { ownerName: payload.ownerName } : {}),
});

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

const validateJsonShareCreateResponse = (value: unknown): JsonShareCreateResponse => {
  if (!isRecord(value)) {
    throw new Error("Share link failed: invalid service response");
  }
  return {
    jsonId: requireNonEmptyString(value.jsonId, "jsonId"),
    createdAt: requireNonEmptyString(value.createdAt, "createdAt"),
  };
};

const validateEncryptedJsonShareRecord = (value: unknown): EncryptedJsonShareRecord => {
  if (!isRecord(value)) {
    throw new Error("Share link failed: invalid service response");
  }
  return {
    v: 1,
    jsonId: requireNonEmptyString(value.jsonId, "jsonId"),
    createdAt: requireNonEmptyString(value.createdAt, "createdAt"),
    encryptedData: requireNonEmptyString(value.encryptedData, "encryptedData"),
    iv: requireNonEmptyString(value.iv, "iv"),
  };
};

const validatePublishPayload = (value: unknown): PublishPayload => {
  if (!isRecord(value) || !Array.isArray(value.files) || !isRecord(value.commentsByFileId)) {
    throw new Error("Share link failed: invalid snapshot payload");
  }

  const files = value.files.map((file) => {
    if (!isRecord(file)) {
      throw new Error("Share link failed: invalid snapshot payload");
    }
    return {
      id: requireString(file.id, "file.id"),
      title: requireString(file.title, "file.title"),
      text: requireString(file.text, "file.text"),
    };
  });

  return {
    ...(typeof value.title === "string" ? { title: value.title } : {}),
    ...(typeof value.ownerName === "string" ? { ownerName: value.ownerName } : {}),
    activeFileId: requireNonEmptyString(value.activeFileId, "activeFileId"),
    files,
    commentsByFileId: value.commentsByFileId as Record<string, FileComment[]>,
    llmsTxt: requireString(value.llmsTxt, "llmsTxt"),
    llmsFullTxt: requireString(value.llmsFullTxt, "llmsFullTxt"),
    markdownBundle: requireString(value.markdownBundle, "markdownBundle"),
    publishBundle: requireString(value.publishBundle, "publishBundle"),
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
