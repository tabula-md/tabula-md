import { describe, expect, it } from "vitest";
import {
  createJsonShareLink,
  getJsonShareRoute,
  parseJsonShareFromHash,
  readJsonShareSnapshot,
} from "./jsonShare";
import type { MarkdownFile } from "./workspaceStorage";

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
    let encryptedRequest: Record<string, string> | undefined;
    const createdAt = "2026-06-28T00:00:00.000Z";
    const jsonId = "jsonShare123";
    const createFetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
      encryptedRequest = JSON.parse(String(init?.body)) as Record<string, string>;
      return new Response(JSON.stringify({ jsonId, createdAt }), { status: 201 });
    };

    const created = await createJsonShareLink({
      serviceUrl: "https://publish.tabula.md",
      origin: "https://tabula.md",
      ownerName: "Taeha",
      files: [file()],
      activeFileId: "readme",
      commentsByFileId: {},
      fetchImpl: createFetch as typeof fetch,
    });

    expect(created.url).toMatch(/^https:\/\/tabula\.md\/#json=jsonShare123,/);
    expect(encryptedRequest?.encryptedData).toEqual(expect.any(String));
    expect(encryptedRequest?.iv).toEqual(expect.any(String));
    expect(JSON.stringify(encryptedRequest)).not.toContain("Encrypted share content");

    const route = parseJsonShareFromHash(new URL(created.url).hash);
    expect(route).toMatchObject({ snapshotId: jsonId });

    const readFetch = async () =>
      new Response(
        JSON.stringify({
          v: 1,
          jsonId,
          createdAt,
          encryptedData: encryptedRequest?.encryptedData,
          iv: encryptedRequest?.iv,
        }),
        { status: 200 },
      );

    const snapshot = await readJsonShareSnapshot({
      serviceUrl: "https://publish.tabula.md",
      origin: "https://tabula.md",
      route: route!,
      fetchImpl: readFetch as typeof fetch,
    });

    expect(snapshot?.id).toBe(jsonId);
    expect(snapshot?.urls.page).toBe(created.url);
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
});
