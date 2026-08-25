import { describe, expect, it } from "vitest";
import {
  formatWorkspaceAssetBytes,
  getWorkspaceFilePresentation,
} from "./workspaceFilePresentation";
import { encodeBinaryWorkspaceSupportFile } from "./io/workspaceSupportFile";

const binaryFile = (
  title: string,
  mediaType: string,
  bytes = new Uint8Array([1, 2, 3]),
) => ({
  title,
  text: encodeBinaryWorkspaceSupportFile(bytes),
  artifact: {
    kind: "asset" as const,
    mediaType,
    contentKind: "binary" as const,
    sourceHash: "sha256:test",
    editable: false,
  },
});

describe("workspace file presentation", () => {
  it("keeps Markdown and MDX in the document workbench", () => {
    expect(getWorkspaceFilePresentation({
      title: "README.md",
      text: "# Hello",
    })).toEqual({ kind: "markdown", icon: "markdown" });
    expect(getWorkspaceFilePresentation({
      title: "Guide.mdx",
      text: "# Hello",
    })).toEqual({ kind: "markdown", icon: "markdown" });
  });

  it("presents non-Markdown text in a read-only source viewer", () => {
    expect(getWorkspaceFilePresentation({
      title: "data.json",
      text: "{}",
      artifact: {
        kind: "support",
        mediaType: "application/json",
        contentKind: "text",
        sourceHash: "sha256:test",
        editable: true,
      },
    })).toMatchObject({
      kind: "asset",
      viewer: "text",
      icon: "code",
      format: "JSON",
      mimeType: "application/json",
      text: "{}",
    });
    expect(getWorkspaceFilePresentation({
      title: "notes.tmp",
      text: "preserved",
    })).toMatchObject({ kind: "asset", viewer: "text", text: "preserved" });
  });

  it("previews safe raster images, PDFs, audio, and video", () => {
    expect(getWorkspaceFilePresentation(
      binaryFile("diagram.png", "image/png"),
    )).toMatchObject({ kind: "asset", viewer: "image", icon: "image" });
    expect(getWorkspaceFilePresentation(
      binaryFile("guide.pdf", "application/pdf"),
    )).toMatchObject({ kind: "asset", viewer: "pdf", icon: "pdf" });
    expect(getWorkspaceFilePresentation(
      binaryFile("briefing.mp3", "audio/mpeg"),
    )).toMatchObject({ kind: "asset", viewer: "audio", icon: "audio" });
    expect(getWorkspaceFilePresentation(
      binaryFile("walkthrough.mp4", "video/mp4"),
    )).toMatchObject({ kind: "asset", viewer: "video", icon: "video" });
  });

  it("recognizes preserved binary payloads from legacy workspaces", () => {
    const legacyPdf = binaryFile("guide.pdf", "application/pdf");
    expect(getWorkspaceFilePresentation({
      title: legacyPdf.title,
      text: legacyPdf.text,
    })).toMatchObject({ kind: "asset", viewer: "pdf", icon: "pdf" });
  });

  it("does not execute SVG or unknown binary content", () => {
    expect(getWorkspaceFilePresentation(
      binaryFile("diagram.svg", "image/svg+xml"),
    )).toMatchObject({
      kind: "asset",
      viewer: "binary",
      icon: "binary",
      mimeType: "application/octet-stream",
    });
  });

  it("formats asset sizes", () => {
    expect(formatWorkspaceAssetBytes(12)).toBe("12 B");
    expect(formatWorkspaceAssetBytes(1536)).toBe("1.5 KB");
    expect(formatWorkspaceAssetBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
