import { expect, test } from "@playwright/test";

test("opens the local Markdown workspace", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".tabbar")).toBeVisible();
  await expect(page.locator(".file-shell")).toBeVisible();
});
