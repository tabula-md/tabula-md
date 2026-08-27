import { getWorkspaceArtifactMediaType } from "@tabula-md/tabula";
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
  | "audio"
  | "video"
  | "binary";

export type WorkspaceFilePresentation =
  | { kind: "markdown"; icon: "markdown" }
  | {
      kind: "asset";
      viewer: "text" | "image" | "pdf" | "audio" | "video" | "binary";
      icon: "code" | "image" | "pdf" | "audio" | "video" | "binary";
      format: string;
      mimeType: string;
      bytes: Uint8Array;
      text?: string;
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

const getFormat = (file: Pick<WorkspaceFile, "title" | "artifact">) => {
  const extension = getExtension(file.title);
  if (file.artifact?.mediaType === "application/pdf") return "PDF";
  return extension ? extension.toLocaleUpperCase() : "File";
};

export const getWorkspaceFilePresentation = (
  file: Pick<WorkspaceFile, "title" | "text" | "artifact">,
): WorkspaceFilePresentation => {
  if (isMarkdownWorkspacePath(file.title)) {
    return { kind: "markdown", icon: "markdown" };
  }

  const decodedBytes = decodeBinaryWorkspaceSupportFile(file.title, file.text);
  if (!decodedBytes && file.artifact?.contentKind !== "binary") {
    return {
      kind: "asset",
      viewer: "text",
      icon: "code",
      format: getFormat(file),
      mimeType: file.artifact?.mediaType ?? "text/plain;charset=utf-8",
      bytes: new TextEncoder().encode(file.text),
      text: file.text,
    };
  }

  const bytes = decodedBytes ?? new Uint8Array();
  const mimeType =
    file.artifact?.mediaType ?? getWorkspaceArtifactMediaType(file.title);

  if (SAFE_RASTER_MEDIA_TYPES.has(mimeType)) {
    return {
      kind: "asset",
      viewer: "image",
      icon: "image",
      format: getFormat(file),
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

  if (mimeType.startsWith("audio/")) {
    return {
      kind: "asset",
      viewer: "audio",
      icon: "audio",
      format: getFormat(file),
      mimeType,
      bytes,
    };
  }

  if (mimeType.startsWith("video/")) {
    return {
      kind: "asset",
      viewer: "video",
      icon: "video",
      format: getFormat(file),
      mimeType,
      bytes,
    };
  }

  return {
    kind: "asset",
    viewer: "binary",
    icon: "binary",
    format: getFormat(file),
    mimeType: "application/octet-stream",
    bytes,
  };
};

export const getWorkspaceFileIconKind = (
  file: Pick<WorkspaceFile, "title" | "text" | "artifact">,
): WorkspaceFileIconKind => getWorkspaceFilePresentation(file).icon;

export const formatWorkspaceAssetBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
