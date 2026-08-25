import { expect, test } from "@playwright/test";

async function openWorkspaceMenu(page) {
  const menuButton = page.getByRole("button", {
    name: /^(Open|Close) Workspace menu$/,
  });
  if ((await menuButton.count()) === 0) {
    await page.getByRole("button", { name: "Toggle workspace panel", exact: true }).click();
  }
  await page.getByRole("button", { name: "Open Workspace menu", exact: true }).click();
}

test("clear local workspace is explicit and immediately recoverable", async ({ page }) => {
  await page.goto("/");
  await page.locator(".tabbar").waitFor();

  if ((await page.getByRole("tab", { name: "Untitled.md", exact: true }).count()) === 0) {
    await page.getByRole("button", { name: "New document", exact: true }).click();
  }
  await expect(page.getByRole("tab", { name: "Untitled.md", exact: true })).toBeVisible();

  await openWorkspaceMenu(page);
  await page.getByRole("button", { name: "Clear local workspace…", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: "Clear local workspace?" });
  await expect(dialog).toContainText(
    "Remove all documents, folders, and comments from this browser. You can undo immediately after clearing.",
  );
  await expect(dialog.getByRole("button")).toHaveCount(2);
  await dialog.getByRole("button", { name: "Clear workspace", exact: true }).click();

  await expect(page.locator(".empty-file-state")).toBeVisible();
  const toast = page.locator(".app-toast");
  await expect(toast).toContainText("Local workspace cleared.");
  await toast.getByRole("button", { name: "Undo", exact: true }).click();

  await expect(page.getByRole("tab", { name: "Untitled.md", exact: true })).toBeVisible();
  await expect(page.locator(".app-toast")).toContainText("Local workspace restored.");
});
