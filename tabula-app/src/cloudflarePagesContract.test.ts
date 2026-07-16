import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const publicFile = (name: string) => new URL(`../public/${name}`, import.meta.url);

describe("Cloudflare Pages contract", () => {
  it("uses a top-level 404 instead of returning the app shell for missing assets", async () => {
    const notFound = await readFile(publicFile("404.html"), "utf8");

    expect(notFound).toContain("Page not found");
    expect(notFound).toContain('href="/"');
  });

  it("never makes an HTML fallback immutable", async () => {
    const headers = await readFile(publicFile("_headers"), "utf8");

    expect(headers).not.toContain("/assets/*");
    expect(headers).not.toContain("immutable");
    expect(headers).toContain("/index.html\n  Cache-Control: no-store");
    expect(headers).toContain("/404.html\n  Cache-Control: no-store");
  });
});
