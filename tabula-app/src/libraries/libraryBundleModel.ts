export const TABULA_LIBRARY_SCHEMA = "tabula.library";
export const TABULA_LIBRARY_FORMAT_VERSION = 1;

export type LibraryBundleFile = {
  path: string;
  content: string;
  encoding: "utf-8" | "base64";
  mediaType?: string;
};

export type LibraryBundle = {
  schema: typeof TABULA_LIBRARY_SCHEMA;
  formatVersion: typeof TABULA_LIBRARY_FORMAT_VERSION;
  id: string;
  name: string;
  version: string;
  publisher?: string;
  sourceUrl?: string;
  files: LibraryBundleFile[];
};

export type ConnectedLibrary = LibraryBundle & {
  connectedAt: string;
  updatedAt: string;
};

export type LibraryBundleParseResult =
  | { ok: true; bundle: LibraryBundle }
  | { ok: false; errors: string[] };

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;

const readRequiredString = (
  record: Record<string, unknown>,
  key: string,
  errors: string[],
) => {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${key} must be a non-empty string.`);
    return "";
  }
  return value.trim();
};

const readOptionalString = (
  record: Record<string, unknown>,
  key: string,
  errors: string[],
) => {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    errors.push(`${key} must be a non-empty string when provided.`);
    return undefined;
  }
  return value.trim();
};

export const isSafeLibraryPath = (path: string) => {
  if (!path || path.startsWith("/") || path.includes("\\")) return false;
  const segments = path.split("/");
  return segments.every((segment) => segment !== "" && segment !== "." && segment !== "..");
};

const parseLibraryFile = (
  value: unknown,
  index: number,
  errors: string[],
): LibraryBundleFile | undefined => {
  const record = asRecord(value);
  if (!record) {
    errors.push(`files[${index}] must be an object.`);
    return undefined;
  }
  const path = typeof record.path === "string" ? record.path.trim() : "";
  if (!path) errors.push(`files[${index}].path must be a non-empty string.`);
  const content = typeof record.content === "string" ? record.content : "";
  if (typeof record.content !== "string") {
    errors.push(`files[${index}].content must be a string.`);
  }
  const encoding = record.encoding === undefined ? "utf-8" : record.encoding;
  if (encoding !== "utf-8" && encoding !== "base64") {
    errors.push(`files[${index}].encoding must be utf-8 or base64.`);
    return undefined;
  }
  if (!isSafeLibraryPath(path)) {
    errors.push(`files[${index}].path must be a safe relative path.`);
    return undefined;
  }
  const mediaType = record.mediaType === undefined
    ? undefined
    : typeof record.mediaType === "string" && record.mediaType.trim()
      ? record.mediaType.trim()
      : undefined;
  if (record.mediaType !== undefined && !mediaType) {
    errors.push(`files[${index}].mediaType must be a non-empty string when provided.`);
  }
  return { path, content, encoding, mediaType };
};

export const parseLibraryBundle = (value: unknown): LibraryBundleParseResult => {
  const errors: string[] = [];
  const record = asRecord(value);
  if (!record) return { ok: false, errors: ["Library bundle must be an object."] };

  if (record.schema !== TABULA_LIBRARY_SCHEMA) {
    errors.push(`schema must be ${TABULA_LIBRARY_SCHEMA}.`);
  }
  if (record.formatVersion !== TABULA_LIBRARY_FORMAT_VERSION) {
    errors.push(`formatVersion must be ${TABULA_LIBRARY_FORMAT_VERSION}.`);
  }
  const id = readRequiredString(record, "id", errors);
  const name = readRequiredString(record, "name", errors);
  const version = readRequiredString(record, "version", errors);
  const publisher = readOptionalString(record, "publisher", errors);
  const sourceUrl = readOptionalString(record, "sourceUrl", errors);
  if (sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      if (url.protocol !== "https:") errors.push("sourceUrl must use https.");
    } catch {
      errors.push("sourceUrl must be a valid URL.");
    }
  }

  if (!Array.isArray(record.files) || record.files.length === 0) {
    errors.push("files must contain at least one file.");
  }
  const files = Array.isArray(record.files)
    ? record.files.flatMap((file, index) => {
        const parsed = parseLibraryFile(file, index, errors);
        return parsed ? [parsed] : [];
      })
    : [];
  const duplicatePaths = files
    .map((file) => file.path)
    .filter((path, index, paths) => paths.indexOf(path) !== index);
  if (duplicatePaths.length > 0) {
    errors.push(`files contain duplicate paths: ${[...new Set(duplicatePaths)].join(", ")}.`);
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    bundle: {
      schema: TABULA_LIBRARY_SCHEMA,
      formatVersion: TABULA_LIBRARY_FORMAT_VERSION,
      id,
      name,
      version,
      publisher,
      sourceUrl,
      files: [...files].sort((first, second) => first.path.localeCompare(second.path)),
    },
  };
};

export const connectLibraryBundle = (
  bundle: LibraryBundle,
  connectedAt: string,
  previous?: ConnectedLibrary,
): ConnectedLibrary => ({
  ...bundle,
  connectedAt: previous?.connectedAt ?? connectedAt,
  updatedAt: connectedAt,
});
