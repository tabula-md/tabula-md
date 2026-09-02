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
      makeFile("doc", "runbook.md", [
        "---",
        "type: Runbook",
        "title: Incident response",
        "tags: [oncall]",
        "status: draft",
        "stale_after: 2000-01-01",
        "verified: { by: human:taeha, at: 2026-09-01T00:00:00Z }",
        "sources:",
        "  - id: incident-guide",
        "    resource: ./sources/incident-guide.md",
        "---",
        "",
        "# Trigger",
        "",
        "Checkout failed.",
      ].join("\n")),
    ], [createWorkspaceRootFolder("Workspace")]);

    expect(entry).toMatchObject({
      title: "Incident response",
      type: "Runbook",
      tags: ["oncall"],
      status: "draft",
      trustTier: "human-reviewed",
      freshness: "stale",
      verifiedBy: ["human:taeha"],
      sourceValues: ["incident-guide", "./sources/incident-guide.md"],
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
