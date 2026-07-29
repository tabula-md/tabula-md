const PROJECT_SCHEMA = "tabula.project";
const ROOT_FOLDER_ID = "workspace-root";

type JsonRecord = Record<string, unknown>;

export type WorkspaceStorageMigrationEvent = {
  fromVersion: number;
  status: "current" | "migrated" | "rejected";
  toVersion: number;
};

export type WorkspaceStorageMigrationResult = {
  event: WorkspaceStorageMigrationEvent;
  payload: JsonRecord | null;
};

const isRecord = (value: unknown): value is JsonRecord =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const getVersion = (payload: JsonRecord) =>
  typeof payload.version === "number" && Number.isInteger(payload.version)
    ? payload.version
    : 0;

const migrateV5ToV6 = (payload: JsonRecord): JsonRecord | null => {
  if (!isRecord(payload.files)) return null;

  const folderIds = new Map<string, string>();
  const folders: JsonRecord = {
    [ROOT_FOLDER_ID]: {
      id: ROOT_FOLDER_ID,
      title: "Project",
      parentId: null,
      order: 0,
    },
  };
  let folderCount = 0;

  const ensureFolder = (segments: string[]) => {
    let parentId = ROOT_FOLDER_ID;
    let path = "";
    segments.forEach((segment) => {
      path = path ? `${path}/${segment}` : segment;
      const existingId = folderIds.get(path);
      if (existingId) {
        parentId = existingId;
        return;
      }
      folderCount += 1;
      const id = `migrated-folder-${folderCount}`;
      folderIds.set(path, id);
      folders[id] = {
        id,
        title: segment,
        parentId,
        order: folderCount,
      };
      parentId = id;
    });
    return parentId;
  };

  const files = Object.fromEntries(
    Object.entries(payload.files).map(([id, value]) => {
      if (!isRecord(value)) return [id, value];
      const title = typeof value.title === "string" ? value.title : "";
      const segments = title.split("/").filter(Boolean);
      const filename = segments.pop() ?? title;
      return [
        id,
        {
          ...value,
          title: filename,
          parentId: ensureFolder(segments),
        },
      ];
    }),
  );

  return {
    ...payload,
    version: 6,
    folderOrder: Object.keys(folders),
    folders,
    files,
  };
};

const migrateV6ToV7 = (payload: JsonRecord): JsonRecord | null => {
  if (!isRecord(payload.files)) return null;
  return {
    ...payload,
    version: 7,
    files: Object.fromEntries(
      Object.entries(payload.files).map(([id, value]) => [
        id,
        isRecord(value)
          ? {
              ...value,
              editingMode: value.editingMode === "visual" || value.viewMode === "visual"
                ? "visual"
                : "source",
            }
          : value,
      ]),
    ),
  };
};

const migrations = new Map<number, (payload: JsonRecord) => JsonRecord | null>([
  [5, migrateV5ToV6],
  [6, migrateV6ToV7],
]);

export const migrateWorkspaceStoragePayload = (
  value: unknown,
  currentVersion: number,
): WorkspaceStorageMigrationResult => {
  if (!isRecord(value) || value.schema !== PROJECT_SCHEMA) {
    return {
      event: { fromVersion: 0, status: "rejected", toVersion: currentVersion },
      payload: null,
    };
  }

  const fromVersion = getVersion(value);
  let payload: JsonRecord | null = value;
  while (payload && getVersion(payload) < currentVersion) {
    const migrate = migrations.get(getVersion(payload));
    payload = migrate ? migrate(payload) : null;
  }

  const accepted = payload !== null && getVersion(payload) === currentVersion;
  return {
    event: {
      fromVersion,
      status: !accepted
        ? "rejected"
        : fromVersion < currentVersion
          ? "migrated"
          : "current",
      toVersion: currentVersion,
    },
    payload: accepted ? payload : null,
  };
};
