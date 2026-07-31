import { describe, expect, it } from "vitest";
import { encodeBinaryWorkspaceSupportFile } from "./io/workspaceSupportFile";
import {
  formatWorkspaceAssetBytes,
  getWorkspaceFilePresentation,
} from "./workspaceFilePresentation";

describe("workspace file presentation", () => {
  it("keeps Markdown documents distinct from text bundle assets", () => {
    expect(getWorkspaceFilePresentation({
      title: "runtime.md",
      text: "# Runtime",
    })).toEqual({ kind: "markdown", icon: "markdown" });
    expect(getWorkspaceFilePresentation({
      title: "visual-components.mdx",
      text: "<Callout>Runtime</Callout>",
    })).toEqual({ kind: "markdown", icon: "markdown" });

    expect(getWorkspaceFilePresentation({
      title: "computations/query.sql",
      text: "SELECT 1;",
    })).toMatchObject({
      kind: "asset",
      viewer: "text",
      icon: "code",
      format: "SQL",
      text: "SELECT 1;",
    });
  });

  it("selects safe viewers without exposing encoded binary contents", () => {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(getWorkspaceFilePresentation({
      title: "diagram.png",
      text: encodeBinaryWorkspaceSupportFile(png),
    })).toMatchObject({
      kind: "asset",
      viewer: "image",
      icon: "image",
      format: "PNG",
      bytes: png,
    });

    expect(getWorkspaceFilePresentation({
      title: "archive.zip",
      text: encodeBinaryWorkspaceSupportFile(new Uint8Array([0, 255])),
    })).toMatchObject({
      kind: "asset",
      viewer: "binary",
      icon: "binary",
      format: "ZIP binary",
    });
  });

  it("formats asset sizes for the viewer", () => {
    expect(formatWorkspaceAssetBytes(12)).toBe("12 B");
    expect(formatWorkspaceAssetBytes(1536)).toBe("1.5 KB");
    expect(formatWorkspaceAssetBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
