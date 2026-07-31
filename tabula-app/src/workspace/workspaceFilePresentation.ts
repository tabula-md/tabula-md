import {
  decodeBinaryWorkspaceSupportFile,
  isEncodedBinaryWorkspaceSupportFile,
  isMarkdownWorkspacePath,
} from "./io/workspaceSupportFile";
import type { WorkspaceFile } from "./workspaceStorage";

export type WorkspaceAssetViewer = "text" | "image" | "pdf" | "binary";
export type WorkspaceFileIconKind =
  | "markdown"
  | "code"
  | "image"
  | "pdf"
  | "binary";

export type WorkspaceFilePresentation =
  | {
      kind: "markdown";
      icon: "markdown";
    }
  | {
      kind: "asset";
      viewer: WorkspaceAssetViewer;
      icon: Exclude<WorkspaceFileIconKind, "markdown">;
      format: string;
      mimeType: string;
      bytes: Uint8Array;
      text?: string;
    };

const IMAGE_MIME_TYPES: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const CODE_FORMATS: Record<string, string> = {
  c: "C",
  cc: "C++",
  cpp: "C++",
  css: "CSS",
  csv: "CSV",
  go: "Go",
  h: "C header",
  hpp: "C++ header",
  html: "HTML",
  java: "Java",
  js: "JavaScript",
  json: "JSON",
  jsonl: "JSON Lines",
  jsx: "JSX",
  log: "Log",
  mjs: "JavaScript",
  py: "Python",
  rb: "Ruby",
  rs: "Rust",
  sh: "Shell",
  sql: "SQL",
  svg: "SVG source",
  toml: "TOML",
  ts: "TypeScript",
  tsx: "TSX",
  txt: "Text",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
};

const getExtension = (title: string) => {
  const basename = title.split("/").at(-1) ?? title;
  const index = basename.lastIndexOf(".");
  return index > 0 && index < basename.length - 1
    ? basename.slice(index + 1).toLocaleLowerCase()
    : "";
};

const getUnknownFormat = (extension: string, binary: boolean) =>
  extension
    ? `${extension.toLocaleUpperCase()} ${binary ? "binary" : "text"}`
    : (binary ? "Binary" : "Text");

export const getWorkspaceFileIconKind = (
  file: Pick<WorkspaceFile, "title" | "text">,
): WorkspaceFileIconKind => {
  if (isMarkdownWorkspacePath(file.title)) return "markdown";
  const extension = getExtension(file.title);
  const binary = isEncodedBinaryWorkspaceSupportFile(file.title, file.text);
  if (IMAGE_MIME_TYPES[extension] && binary) return "image";
  if (extension === "pdf" && binary) return "pdf";
  return binary ? "binary" : "code";
};

export const getWorkspaceFilePresentation = (
  file: Pick<WorkspaceFile, "title" | "text">,
): WorkspaceFilePresentation => {
  if (isMarkdownWorkspacePath(file.title)) {
    return { kind: "markdown", icon: "markdown" };
  }

  const extension = getExtension(file.title);
  const binary = isEncodedBinaryWorkspaceSupportFile(file.title, file.text);
  const decodedBytes = binary
    ? decodeBinaryWorkspaceSupportFile(file.title, file.text)
    : undefined;
  const bytes = decodedBytes ?? new TextEncoder().encode(file.text);
  const imageMimeType = IMAGE_MIME_TYPES[extension];

  if (imageMimeType && binary) {
    return {
      kind: "asset",
      viewer: "image",
      icon: "image",
      format: extension.toLocaleUpperCase(),
      mimeType: imageMimeType,
      bytes,
    };
  }

  if (extension === "pdf" && binary) {
    return {
      kind: "asset",
      viewer: "pdf",
      icon: "pdf",
      format: "PDF",
      mimeType: "application/pdf",
      bytes,
    };
  }

  if (!binary) {
    return {
      kind: "asset",
      viewer: "text",
      icon: "code",
      format: CODE_FORMATS[extension] ?? getUnknownFormat(extension, false),
      mimeType: extension === "json"
        ? "application/json"
        : "text/plain;charset=utf-8",
      bytes,
      text: file.text,
    };
  }

  return {
    kind: "asset",
    viewer: "binary",
    icon: "binary",
    format: getUnknownFormat(extension, true),
    mimeType: "application/octet-stream",
    bytes,
  };
};

export const isWorkspaceMarkdownFile = (
  file: Pick<WorkspaceFile, "title"> | undefined,
) => Boolean(file && isMarkdownWorkspacePath(file.title));

export const formatWorkspaceAssetBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
