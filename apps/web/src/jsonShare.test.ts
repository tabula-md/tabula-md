import { describe, expect, it } from "vitest";
import {
  createJsonShareLink,
  getJsonShareRoute,
  parseJsonShareFromHash,
  readJsonShareSnapshot,
} from "./jsonShare";
import { createWorkspaceFromJsonShareSnapshot, hasMeaningfulWorkspaceContent } from "./jsonShareImport";
import { SHARE_SNAPSHOT_SCHEMA_VERSION, type ShareSnapshot } from "./shareSnapshotPayload";
import { STARTER_README_MARKDOWN, type MarkdownFile } from "./workspaceStorage";

const file = (): MarkdownFile => ({
  id: "readme",
  title: "README.md",
  text: "# Hello\n\nEncrypted share content.",
  viewMode: "edit",
  readingWidth: "wide",
  lineWrapping: true,
  lineNumbers: true,
});

describe("json share links", () => {
  it("creates an encrypted #json link and reads it back with the fragment key", async () => {
    let encryptedRequest: ArrayBuffer | undefined;
    let createRequestUrl = "";
    const createdAt = "2026-06-28T00:00:00.000Z";
    const jsonId = "jsonShare123";
    const createFetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      createRequestUrl = String(url);
      encryptedRequest = init?.body as ArrayBuffer;
      expect(init?.headers).toMatchObject({ "content-type": "application/octet-stream" });
      return new Response(JSON.stringify({ jsonId, createdAt }), { status: 201 });
    };

    const created = await createJsonShareLink({
      serviceUrl: "https://json.tabula.md",
      origin: "https://tabula.md",
      files: [file()],
      activeFileId: "readme",
      commentsByFileId: {},
      fetchImpl: createFetch as typeof fetch,
    });

    expect(created.url).toMatch(/^https:\/\/tabula\.md\/#json=jsonShare123,/);
    expect(createRequestUrl).toBe("https://json.tabula.md/v1/json");
    expect(createRequestUrl).not.toContain(new URL(created.url).hash.slice(1));
    const encryptedBody = encryptedRequest;
    if (!encryptedBody) {
      throw new Error("Expected encrypted request body");
    }
    expect(encryptedBody.byteLength).toBeGreaterThan(20);
    expect(new TextDecoder().decode(encryptedBody)).not.toContain("Encrypted share content");
    expect(new TextDecoder().decode(encryptedBody)).not.toContain("llmsTxt");

    const route = parseJsonShareFromHash(new URL(created.url).hash);
    expect(route).toMatchObject({ snapshotId: jsonId });

    let readRequestUrl = "";
    const readFetch = async (url: RequestInfo | URL) => {
      readRequestUrl = String(url);
      return new Response(encryptedBody, {
        headers: { "content-type": "application/octet-stream" },
        status: 200,
      });
    };

    const snapshot = await readJsonShareSnapshot({
      serviceUrl: "https://json.tabula.md",
      origin: "https://tabula.md",
      route: route!,
      fetchImpl: readFetch as typeof fetch,
    });

    expect(readRequestUrl).toBe("https://json.tabula.md/v1/json/jsonShare123");
    expect(readRequestUrl).not.toContain(route!.key);
    expect(snapshot?.id).toBe(jsonId);
    expect(snapshot?.url).toBe(created.url);
    expect(snapshot?.schemaVersion).toBe(SHARE_SNAPSHOT_SCHEMA_VERSION);
    expect(snapshot?.files[0]).toMatchObject({
      id: "readme",
      title: "README.md",
      text: "# Hello\n\nEncrypted share content.",
    });
  });

  it("only treats root #json fragments as share routes", () => {
    const key = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

    expect(getJsonShareRoute({ pathname: "/", hash: `#json=abc12345,${key}` })).toEqual({
      snapshotId: "abc12345",
      key,
    });
    expect(getJsonShareRoute({ pathname: "/p/example", hash: `#json=abc12345,${key}` })).toBeNull();
    expect(parseJsonShareFromHash(`#json=abc12345,${key}&bad=1`)).toBeNull();
  });

  it("converts decrypted snapshots into editable workspaces", () => {
    const workspace = createWorkspaceFromJsonShareSnapshot({
      id: "jsonShare123",
      url: "https://tabula.md/#json=jsonShare123,key",
      schemaVersion: SHARE_SNAPSHOT_SCHEMA_VERSION,
      createdAt: "2026-06-28T00:00:00.000Z",
      activeFileId: "brief",
      files: [{ id: "brief", title: "BRIEF.md", text: "# Brief" }],
      commentsByFileId: { brief: [] },
    } satisfies ShareSnapshot);

    expect(workspace.activeFileId).toBe("brief");
    expect(workspace.openFileIds).toEqual(["brief"]);
    expect(workspace.files[0]).toMatchObject({
      id: "brief",
      title: "BRIEF.md",
      text: "# Brief",
      viewMode: "edit",
      connectionStatus: "idle",
    });
  });

  it("does not treat the default README as content that blocks share-link import", () => {
    expect(
      hasMeaningfulWorkspaceContent({
        files: [
          {
            ...file(),
            id: "tabula-readme",
            title: "README.md",
            text: STARTER_README_MARKDOWN,
          },
        ],
        commentsByFileId: {},
      }),
    ).toBe(false);
    expect(
      hasMeaningfulWorkspaceContent({
        files: [
          {
            ...file(),
            id: "tabula-readme",
            title: "README.md",
            text: `${STARTER_README_MARKDOWN}\nUser note.`,
          },
        ],
        commentsByFileId: {},
      }),
    ).toBe(true);
    expect(hasMeaningfulWorkspaceContent({ files: [file()], commentsByFileId: {} })).toBe(true);
  });
});
