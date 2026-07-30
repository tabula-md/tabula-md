export type WorkspaceArtifactKind =
  | "document"
  | "asset"
  | "instruction"
  | "support";

export type WorkspaceArtifactContent =
  | { kind: "text"; text: string; encoding: "utf-8" }
  | { kind: "binary"; bytes: Uint8Array };

export type WorkspaceArtifact = {
  id: string;
  path: string;
  kind: WorkspaceArtifactKind;
  mediaType?: string;
  content: WorkspaceArtifactContent;
  sourceHash: string;
  editable: boolean;
};

export type WorkspaceArtifactDraft = Omit<
  WorkspaceArtifact,
  "kind" | "mediaType" | "sourceHash" | "editable"
> & {
  kind?: WorkspaceArtifactKind;
  mediaType?: string;
  editable?: boolean;
};

const textEncoder = new TextEncoder();

const extensionMediaTypes: Readonly<Record<string, string>> = {
  ".css": "text/css",
  ".csv": "text/csv",
  ".gif": "image/gif",
  ".html": "text/html",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript",
  ".json": "application/json",
  ".markdown": "text/markdown",
  ".md": "text/markdown",
  ".mdx": "text/mdx",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".py": "text/x-python",
  ".sql": "application/sql",
  ".svg": "image/svg+xml",
  ".ts": "text/typescript",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
};

const getExtension = (path: string) => {
  const basename = path.split("/").at(-1) ?? "";
  const dotIndex = basename.lastIndexOf(".");
  return dotIndex > 0 ? basename.slice(dotIndex).toLocaleLowerCase() : "";
};

export const getWorkspaceArtifactMediaType = (path: string) =>
  extensionMediaTypes[getExtension(path)] ?? "application/octet-stream";

export const getWorkspaceArtifactKind = (
  path: string,
): WorkspaceArtifactKind => {
  const basename = path.split("/").at(-1)?.toLocaleLowerCase() ?? "";
  if (
    basename === "agents.md" ||
    basename === "claude.md" ||
    basename === "skill.md"
  ) {
    return "instruction";
  }
  if ([".md", ".markdown", ".mdx"].includes(getExtension(path))) {
    return "document";
  }
  const mediaType = getWorkspaceArtifactMediaType(path);
  if (
    mediaType.startsWith("image/") ||
    mediaType.startsWith("audio/") ||
    mediaType.startsWith("video/") ||
    mediaType === "application/pdf"
  ) {
    return "asset";
  }
  return "support";
};

export const isWorkspaceArtifactEditable = (
  path: string,
  content: WorkspaceArtifactContent,
) => {
  if (content.kind !== "text") return false;
  const extension = getExtension(path);
  return [
    ".css",
    ".csv",
    ".html",
    ".js",
    ".json",
    ".markdown",
    ".md",
    ".mdx",
    ".py",
    ".sql",
    ".svg",
    ".ts",
    ".txt",
    ".yaml",
    ".yml",
  ].includes(extension);
};

export const getWorkspaceArtifactBytes = (
  content: WorkspaceArtifactContent,
) =>
  content.kind === "binary"
    ? content.bytes
    : textEncoder.encode(content.text);

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

export const hashWorkspaceArtifactContent = async (
  content: WorkspaceArtifactContent,
) => {
  const bytes = getWorkspaceArtifactBytes(content);
  const buffer = Uint8Array.from(bytes).buffer;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    buffer,
  );
  return `sha256:${toHex(new Uint8Array(digest))}`;
};

export const createWorkspaceArtifact = async (
  draft: WorkspaceArtifactDraft,
): Promise<WorkspaceArtifact> => ({
  id: draft.id,
  path: draft.path,
  kind: draft.kind ?? getWorkspaceArtifactKind(draft.path),
  mediaType: draft.mediaType ?? getWorkspaceArtifactMediaType(draft.path),
  content: draft.content,
  sourceHash: await hashWorkspaceArtifactContent(draft.content),
  editable:
    draft.editable ??
    isWorkspaceArtifactEditable(draft.path, draft.content),
});

export const cloneWorkspaceArtifact = (
  artifact: WorkspaceArtifact,
): WorkspaceArtifact => ({
  ...artifact,
  content:
    artifact.content.kind === "binary"
      ? {
          kind: "binary",
          bytes: Uint8Array.from(artifact.content.bytes),
        }
      : { ...artifact.content },
});
