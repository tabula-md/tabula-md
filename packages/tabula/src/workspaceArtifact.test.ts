import { describe, expect, it } from "vitest";
import {
  cloneWorkspaceArtifact,
  createWorkspaceArtifact,
  getWorkspaceArtifactBytes,
  getWorkspaceArtifactKind,
  getWorkspaceArtifactMediaType,
} from "./workspaceArtifact";

describe("workspace artifacts", () => {
  it("classifies editable Markdown without mixing editor state into the artifact", async () => {
    const artifact = await createWorkspaceArtifact({
      id: "readme",
      path: "docs/README.markdown",
      content: { kind: "text", text: "# Readme\r\n", encoding: "utf-8" },
    });

    expect(artifact).toMatchObject({
      kind: "document",
      mediaType: "text/markdown",
      editable: true,
    });
    expect(artifact.sourceHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(artifact).not.toHaveProperty("viewMode");
    expect(new TextDecoder().decode(getWorkspaceArtifactBytes(artifact.content)))
      .toBe("# Readme\r\n");
  });

  it("preserves unknown binary files as opaque support artifacts", async () => {
    const bytes = new Uint8Array([0, 255, 10, 128]);
    const artifact = await createWorkspaceArtifact({
      id: "opaque",
      path: "custom.unknown",
      content: { kind: "binary", bytes },
    });
    const clone = cloneWorkspaceArtifact(artifact);

    expect(artifact).toMatchObject({
      kind: "support",
      mediaType: "application/octet-stream",
      editable: false,
    });
    expect(getWorkspaceArtifactBytes(clone.content)).toEqual(bytes);
    expect(getWorkspaceArtifactBytes(clone.content)).not.toBe(bytes);
  });

  it("recognizes instructions and assets without treating them as documents", async () => {
    const instruction = await createWorkspaceArtifact({
      id: "agents",
      path: "packages/app/AGENTS.md",
      content: { kind: "text", text: "# Rules", encoding: "utf-8" },
    });
    const image = await createWorkspaceArtifact({
      id: "diagram",
      path: "images/diagram.png",
      content: { kind: "binary", bytes: new Uint8Array([137, 80, 78, 71]) },
    });

    expect(instruction.kind).toBe("instruction");
    expect(image).toMatchObject({
      kind: "asset",
      mediaType: "image/png",
      editable: false,
    });
  });

  it("classifies common audio and video formats as previewable assets", () => {
    expect(getWorkspaceArtifactMediaType("recording.mp3")).toBe("audio/mpeg");
    expect(getWorkspaceArtifactMediaType("recording.m4a")).toBe("audio/mp4");
    expect(getWorkspaceArtifactMediaType("demo.mp4")).toBe("video/mp4");
    expect(getWorkspaceArtifactMediaType("demo.webm")).toBe("video/webm");
    expect(getWorkspaceArtifactKind("recording.mp3")).toBe("asset");
    expect(getWorkspaceArtifactKind("demo.mp4")).toBe("asset");
  });
});
