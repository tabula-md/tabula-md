import { expect, test } from "@playwright/test";
import {
  createSmokeContext,
  smokeConfig,
} from "../../scripts/browser-smoke/support/runtime.mjs";

test("exports and restores an encrypted share link", async ({ browser, page }) => {
  test.setTimeout(120_000);
  const context = createSmokeContext(browser, {
    externalUrl: smokeConfig.externalUrl ?? smokeConfig.baseUrl,
    jsonUrl: smokeConfig.jsonUrl,
  });
  const requestUrls = [];
  page.on("request", (request) => requestUrls.push(request.url()));

  await page.goto("/");
  await page.getByRole("button", { name: "New document", exact: true }).click();
  await context.selectDocumentViewMode(page, "Edit");
  await context.waitForEditorReady(page, { mode: "edit" });
  await context.focusMarkdownEditor(page);
  await page.keyboard.type("\n\n# Export Link Capability\n\nEncrypted handoff body.");
  await context.waitForSavedLocally(page);

  await page.evaluate(() => {
    window.__tabulaCopiedLink = "";
    navigator.clipboard.writeText = async (text) => {
      window.__tabulaCopiedLink = text;
    };
  });
  await page.locator(".share-trigger").click();
  await context.waitForShareDialogState(page, { panel: "Share link" });
  await page.getByRole("button", { name: "Create link" }).click();
  await expect(page.locator(".share-export-result")).toBeVisible();
  await page.getByRole("button", { name: "Copy link" }).click();

  const exportUrl = await page.evaluate(() => window.__tabulaCopiedLink);
  const parsedExportUrl = new URL(exportUrl);
  const [snapshotId, exportKey] = parsedExportUrl.hash
    .replace(/^#json=/, "")
    .split(",");
  expect(snapshotId).toBeTruthy();
  expect(exportKey).toBeTruthy();
  expect(requestUrls.every((url) => !url.includes(exportKey))).toBe(true);

  const importContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  try {
    const importPage = await importContext.newPage();
    const importRequestUrls = [];
    importPage.on("request", (request) => importRequestUrls.push(request.url()));
    await importPage.goto(exportUrl);
    await importPage.waitForFunction(() => {
      const modalText = document.querySelector(".share-modal")?.textContent ?? "";
      const editorText = document.querySelector(".cm-content")?.textContent ?? "";
      return (
        modalText.includes("Opening it replaces this local workspace.") ||
        editorText.includes("Encrypted handoff body.")
      );
    });
    if (await importPage.getByRole("button", { name: "Open copy" }).count()) {
      await importPage.getByRole("button", { name: "Open copy" }).click();
      await importPage.locator(".share-modal").waitFor({ state: "detached" });
    }
    await expect(importPage.locator(".cm-content")).toContainText("Encrypted handoff body.");
    expect(importRequestUrls.every((url) => !url.includes(exportKey))).toBe(true);
  } finally {
    await importContext.close();
  }
});
