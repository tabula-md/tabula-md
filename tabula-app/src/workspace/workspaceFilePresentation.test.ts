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
  it("keeps Markdown in the document workbench", () => {
    expect(getWorkspaceFilePresentation({
      title: "README.md",
      text: "# Hello",
    })).toEqual({ kind: "markdown", icon: "markdown" });
  });

  it("keeps non-Markdown text in source editing", () => {
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
    })).toEqual({ kind: "source", icon: "code" });
  });

  it("previews safe raster images and PDFs from preserved bytes", () => {
    expect(getWorkspaceFilePresentation(
      binaryFile("diagram.png", "image/png"),
    )).toMatchObject({
      kind: "asset",
      viewer: "image",
      icon: "image",
      mimeType: "image/png",
      bytes: new Uint8Array([1, 2, 3]),
    });
    expect(getWorkspaceFilePresentation(
      binaryFile("guide.pdf", "application/pdf"),
    )).toMatchObject({
      kind: "asset",
      viewer: "pdf",
      icon: "pdf",
      mimeType: "application/pdf",
    });
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
