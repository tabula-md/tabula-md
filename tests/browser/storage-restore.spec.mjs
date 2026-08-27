import { expect, test } from "@playwright/test";
import { selectDocumentViewMode } from "../../scripts/browser-smoke/support/view-mode.mjs";

const waitForSavedLocally = async (page) => {
  if ((await page.locator(".left-panel").count()) === 0) {
    await page.getByRole("button", { name: "Toggle workspace panel", exact: true }).click();
  }
  await page.waitForFunction(() =>
    Boolean(
      document.querySelector(
        '.left-panel-status-button[data-workspace-context="browser"][data-workspace-state="steady"]',
      ),
    ),
  );
};

test("restores the local workspace and document view after same-origin navigation", async ({
  page,
}) => {
  const marker = `Persisted workspace ${Date.now()}`;

  await page.goto("/");
  await page.locator(".tabbar").waitFor();

  if ((await page.getByRole("tab", { name: "Untitled.md", exact: true }).count()) === 0) {
    await page.getByRole("button", { name: "New document", exact: true }).click();
  }

  const activeTab = page.getByRole("tab", { name: "Untitled.md", exact: true });
  await expect(activeTab).toBeVisible();
  await selectDocumentViewMode(page, "Source");

  const editor = page.locator(".cm-content");
  await editor.waitFor();
  await editor.click();
  await page.keyboard.insertText(marker);
  await page.waitForTimeout(600);
  await waitForSavedLocally(page);

  const referralUrl = new URL(page.url());
  referralUrl.searchParams.set("ref", "storage-restore-smoke");
  await page.goto(referralUrl.toString());
  await page.locator(".tabbar").waitFor();

  await expect(page.locator(".tab-item.active")).toHaveAttribute("data-view-mode", "edit");
  await expect(page.locator(".cm-content")).toContainText(marker);
  expect(new URL(page.url()).searchParams.get("ref")).toBe("storage-restore-smoke");
});
