import { expect, test } from "@playwright/test";
import { selectDocumentViewMode } from "../../scripts/browser-smoke/support/view-mode.mjs";

test("opens MDX in Source edit and previews it without executing code", async ({ page }) => {
  await page.addInitScript(() => {
    globalThis.__tabulaMdxExecuted = false;
  });
  await page.goto("/");
  await expect(page.locator(".tabbar")).toBeVisible({ timeout: 30_000 });

  const source = [
    "import Danger from 'https://example.com/danger.js'",
    "",
    "# Safe guide",
    "",
    "<Danger>",
    "{globalThis.__tabulaMdxExecuted = true}",
    "</Danger>",
  ].join("\n");
  await page.locator('input[aria-label="Open Markdown file"]').setInputFiles({
    name: "Safe guide.mdx",
    mimeType: "text/mdx",
    buffer: Buffer.from(source),
  });

  const activeTab = page.locator(".tab-item.active");
  await expect(activeTab).toHaveAttribute("data-file-name", "Safe guide.mdx");
  await expect(activeTab).toHaveAttribute("data-view-mode", "edit");
  await expect(page.locator(".cm-content")).toContainText("globalThis.__tabulaMdxExecuted");
  expect(await page.evaluate(() => globalThis.__tabulaMdxExecuted)).toBe(false);

  await selectDocumentViewMode(page, "Preview");
  await expect(activeTab).toHaveAttribute("data-view-mode", "preview");
  await expect(page.locator(".mdx-safe-preview")).toContainText("MDX source preview");
  await expect(page.locator(".mdx-safe-preview code")).toHaveText(source);
  expect(await page.evaluate(() => globalThis.__tabulaMdxExecuted)).toBe(false);
  await expect(page.locator("script[src='https://example.com/danger.js']")).toHaveCount(0);
});
