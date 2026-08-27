import { describe, expect, it } from "vitest";
import { buildWorkspaceSearchIndex } from "./workspaceSearchIndex";
import {
  createWorkspaceRootFolder,
  type WorkspaceFile,
} from "./workspaceStorage";

const makeFile = (
  id: string,
  title: string,
  text: string,
  artifact?: WorkspaceFile["artifact"],
): WorkspaceFile => ({
  id,
  title,
  text,
  viewMode: "visual",
  readingWidth: "standard",
  lineWrapping: true,
  lineNumbers: true,
  ...(artifact ? { artifact } : {}),
});

describe("buildWorkspaceSearchIndex", () => {
  it("indexes Markdown metadata and body text", () => {
    const [entry] = buildWorkspaceSearchIndex([
      makeFile("doc", "runbook.md", "---\ntitle: Incident response\ntags: [oncall]\n---\n\n# Trigger\n\nCheckout failed."),
    ], [createWorkspaceRootFolder("Workspace")]);

    expect(entry).toMatchObject({
      title: "Incident response",
      tags: ["oncall"],
      body: "\n# Trigger\n\nCheckout failed.",
      iconKind: "markdown",
    });
  });

  it("indexes safe text assets without treating them as frontmatter", () => {
    const [entry] = buildWorkspaceSearchIndex([
      makeFile("text", "data/query.sql", "SELECT * FROM payments", {
        kind: "support",
        contentKind: "text",
        mediaType: "text/plain",
        sourceHash: "text-hash",
        editable: false,
      }),
    ], [createWorkspaceRootFolder("Workspace")]);

    expect(entry).toMatchObject({
      markdown: "SELECT * FROM payments",
      preview: "SELECT FROM payments",
      iconKind: "code",
    });
  });

  it("never indexes encoded binary payloads", () => {
    const [entry] = buildWorkspaceSearchIndex([
      makeFile("binary", "assets/image.png", "tabula.md:binary-support-file;base64,QUJD", {
        kind: "asset",
        contentKind: "binary",
        mediaType: "image/png",
        sourceHash: "binary-hash",
        editable: false,
      }),
    ], [createWorkspaceRootFolder("Workspace")]);

    expect(entry).toMatchObject({
      displayPath: "assets/image.png",
      body: "",
      iconKind: "image",
    });
    expect(entry.markdown).toBeUndefined();
    expect(entry.preview).toBeUndefined();
  });
});
