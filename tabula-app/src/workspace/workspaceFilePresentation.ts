import type { WorkspaceFile } from "./workspaceStorage";
import {
  decodeBinaryWorkspaceSupportFile,
  isMarkdownWorkspacePath,
} from "./io/workspaceSupportFile";

export type WorkspaceFileIconKind =
  | "markdown"
  | "code"
  | "image"
  | "pdf"
  | "binary";

export type WorkspaceFilePresentation =
  | { kind: "markdown"; icon: "markdown" }
  | { kind: "source"; icon: "code" }
  | {
      kind: "asset";
      viewer: "image" | "pdf" | "binary";
      icon: "image" | "pdf" | "binary";
      format: string;
      mimeType: string;
      bytes: Uint8Array;
    };

const SAFE_RASTER_MEDIA_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/x-icon",
]);

const getExtension = (title: string) => {
  const basename = title.split("/").at(-1) ?? title;
  const index = basename.lastIndexOf(".");
  return index > 0 && index < basename.length - 1
    ? basename.slice(index + 1).toLocaleLowerCase()
    : "";
};

const getBinaryFormat = (file: Pick<WorkspaceFile, "title" | "artifact">) => {
  const extension = getExtension(file.title);
  if (file.artifact?.mediaType === "application/pdf") return "PDF";
  return extension ? `${extension.toLocaleUpperCase()} binary` : "Binary";
};

export const getWorkspaceFilePresentation = (
  file: Pick<WorkspaceFile, "title" | "text" | "artifact">,
): WorkspaceFilePresentation => {
  if (isMarkdownWorkspacePath(file.title)) {
    return { kind: "markdown", icon: "markdown" };
  }

  if (file.artifact?.contentKind !== "binary") {
    return { kind: "source", icon: "code" };
  }

  const bytes =
    decodeBinaryWorkspaceSupportFile(file.title, file.text) ??
    new Uint8Array();
  const mimeType = file.artifact.mediaType ?? "application/octet-stream";

  if (SAFE_RASTER_MEDIA_TYPES.has(mimeType)) {
    return {
      kind: "asset",
      viewer: "image",
      icon: "image",
      format: getExtension(file.title).toLocaleUpperCase() || "Image",
      mimeType,
      bytes,
    };
  }

  if (mimeType === "application/pdf") {
    return {
      kind: "asset",
      viewer: "pdf",
      icon: "pdf",
      format: "PDF",
      mimeType,
      bytes,
    };
  }

  return {
    kind: "asset",
    viewer: "binary",
    icon: "binary",
    format: getBinaryFormat(file),
    mimeType: "application/octet-stream",
    bytes,
  };
};

export const getWorkspaceFileIconKind = (
  file: Pick<WorkspaceFile, "title" | "text" | "artifact">,
): WorkspaceFileIconKind => getWorkspaceFilePresentation(file).icon;

export const isWorkspaceMarkdownFile = (
  file: Pick<WorkspaceFile, "title"> | undefined,
) => Boolean(file && isMarkdownWorkspacePath(file.title));

export const formatWorkspaceAssetBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
