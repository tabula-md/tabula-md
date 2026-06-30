export type JsonShareRoute = {
  snapshotId: string;
  key: string;
};

export type JsonShareCreateResponse = {
  id: string;
  data: string;
};

export type JsonShareLocation = {
  hash: string;
  pathname: string;
};

export const JSON_SHARE_KEY_BYTES = 32;
export const JSON_SHARE_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

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
    !JSON_SHARE_ID_PATTERN.test(snapshotId) ||
    !key ||
    !JSON_SHARE_ID_PATTERN.test(key)
  ) {
    return null;
  }

  try {
    return decodeBase64Url(key).byteLength === JSON_SHARE_KEY_BYTES ? { snapshotId, key } : null;
  } catch {
    return null;
  }
};

export const getJsonShareRoute = (location: JsonShareLocation): JsonShareRoute | null => {
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

export const validateJsonShareCreateResponse = (
  value: unknown,
  serviceUrl: string,
): JsonShareCreateResponse => {
  if (!isRecord(value)) {
    throw new Error("Share link failed: invalid service response");
  }
  const id = requireNonEmptyString(value.id, "id");
  if (!JSON_SHARE_ID_PATTERN.test(id)) {
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

export const encodeBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

export const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
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
