import { expect, test } from "@playwright/test";
import { createSmokeContext } from "../../scripts/browser-smoke/support/runtime.mjs";

const layoutCases = [
  { name: "wide light", width: 1440, theme: "light" },
  { name: "wide dark", width: 1440, theme: "dark" },
  { name: "above panel overlay boundary", width: 1161, theme: "light" },
  { name: "panel overlay boundary", width: 1160, theme: "dark" },
  { name: "narrow light", width: 900, theme: "light" },
  { name: "narrow dark", width: 900, theme: "dark" },
  { name: "compact light", width: 821, theme: "dark" },
  { name: "compact dark", width: 820, theme: "light" },
  { name: "above mobile boundary", width: 561, theme: "light" },
  { name: "mobile boundary", width: 560, theme: "dark", manyTabs: true },
  { name: "mobile", width: 390, theme: "light" },
];

const installTheme = (page, theme) =>
  page.addInitScript(({ theme }) => {
    localStorage.setItem("tabula.preferences.v1", JSON.stringify({ theme }));
  }, { theme });

const assertNoViewportClipping = async (page) => {
  const violations = await page.evaluate(() => {
    const selectors = [
      ".app-shell",
      ".center-workbench",
      ".top-chrome",
      ".file-shell",
      ".document-toolbar-row",
      ".right-panel",
      ".share-modal",
      ".toast-viewport",
    ];
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0;
    };
    const clipped = [...document.querySelectorAll(selectors.join(","))]
      .filter(visible)
      .flatMap((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > innerWidth + 1
          ? [`${element.className}: ${Math.round(rect.left)}..${Math.round(rect.right)} / ${innerWidth}`]
          : [];
      });
    if (document.documentElement.scrollWidth > innerWidth + 1) {
      clipped.push(`document: ${document.documentElement.scrollWidth} / ${innerWidth}`);
    }
    return clipped;
  });
  expect(violations).toEqual([]);
};

const createDocument = async (page, smoke) => {
  await page.locator(".empty-file-actions").getByRole("button", {
    name: /New document/,
  }).click();
  await smoke.waitForEditorReady(page, { mode: "visual" });
};

for (const layoutCase of layoutCases) {
  test(`keeps ${layoutCase.name} workspace geometry and panel semantics coherent`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: layoutCase.width, height: 800 });
    await installTheme(page, layoutCase.theme);
    await page.goto("/");
    await page.waitForSelector(".tabbar");
    await expect(page.locator("html")).toHaveAttribute("data-theme", layoutCase.theme);
    await assertNoViewportClipping(page);

    const smoke = createSmokeContext(page.context().browser());
    await createDocument(page, smoke);
    if (layoutCase.manyTabs) {
      for (let index = 0; index < 7; index += 1) {
        await page.locator(".add-tab-button").click();
      }
      await expect(page.locator(".tab-item")).toHaveCount(8);
    }
    await assertNoViewportClipping(page);

    const panelToggle = page.getByRole("button", {
      name: "Toggle side panel",
      exact: true,
    });
    await panelToggle.focus();
    await page.keyboard.press("Enter");
    const panel = page.locator(".right-panel");
    await expect(panel).toBeVisible();
    const overlayExpected = layoutCase.width <= 1160;
    if (overlayExpected) {
      await expect(panel).toHaveAttribute("role", "dialog");
      await expect(panel).toHaveAttribute("aria-modal", "true");
      await expect(page.locator(".center-workbench")).toHaveAttribute("inert", "");
      await expect(page.locator(".center-workbench")).toHaveAttribute("aria-hidden", "true");
      await expect.poll(() =>
        page.evaluate(() => Boolean(document.activeElement?.closest(".right-panel"))),
      ).toBe(true);
      await page.keyboard.press("Shift+Tab");
      expect(
        await page.evaluate(() => Boolean(document.activeElement?.closest(".right-panel"))),
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(panel).toHaveCount(0);
      await expect(page.locator(".center-workbench")).not.toHaveAttribute("inert", "");
      await expect(panelToggle).toBeFocused();
    } else {
      await expect(panel).not.toHaveAttribute("role", "dialog");
      await expect(page.locator(".center-workbench")).not.toHaveAttribute("inert", "");
    }
    await assertNoViewportClipping(page);
  });
}

test("keeps view, search, Share, toast, and focus contracts keyboard-accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.waitForSelector(".tabbar");

  await page.locator("body").press("Tab");
  const focusStyle = await page.evaluate(() => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return null;
    const style = getComputedStyle(active);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth };
  });
  expect(focusStyle?.outlineStyle).not.toBe("none");
  expect(Number.parseFloat(focusStyle?.outlineWidth ?? "0")).toBeGreaterThanOrEqual(2);

  await page.locator(".share-trigger").click();
  await expect(page.getByRole("status")).toContainText("Create or open a document");
  await assertNoViewportClipping(page);

  const smoke = createSmokeContext(page.context().browser());
  await createDocument(page, smoke);
  for (const mode of ["Preview", "Source", "Split", "Visual"]) {
    await smoke.selectDocumentViewMode(page, mode);
    await smoke.waitForEditorReady(page, {
      mode: mode === "Source" ? "edit" : mode.toLowerCase(),
    });
    await assertNoViewportClipping(page);
  }

  await smoke.selectDocumentViewMode(page, "Source");
  await smoke.waitForEditorReady(page, { mode: "edit" });
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("searchbox", { name: "Search" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("searchbox", { name: "Search" })).toHaveCount(0);

  const shareTrigger = page.locator(".share-trigger");
  await page.route("http://127.0.0.1:3014/**", (route) => route.abort());
  await shareTrigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.locator("#root")).toHaveAttribute("inert", "");
  const tabbableCount = await dialog.locator(
    "button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex='-1'])",
  ).count();
  for (let index = 0; index <= tabbableCount; index += 1) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => Boolean(document.activeElement?.closest("[role='dialog']"))),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Create link" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Export to link isn’t available right now.",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#root")).not.toHaveAttribute("inert", "");
  await expect(shareTrigger).toBeFocused();

  await expect(page.locator(".tab-item.active [role='tab']")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".document-view-mode-control [data-view-mode='edit']")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("supports touch targets and reduced motion", async ({ browser }) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForSelector(".tabbar");
    const smoke = createSmokeContext(browser);
    await createDocument(page, smoke);

    const touchTargetViolations = await page.evaluate(() =>
      [...document.querySelectorAll(".top-chrome button")]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0;
        })
        .flatMap((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width < 44 || rect.height < 44
            ? [`${element.getAttribute("aria-label") ?? element.className}: ${rect.width}x${rect.height}`]
            : [];
        }),
    );
    expect(touchTargetViolations).toEqual([]);

    await page.locator(".share-trigger").click();
    const motionDurations = await page.locator(".share-modal").evaluate((element) => {
      const style = getComputedStyle(element);
      const toMilliseconds = (value) =>
        value.trim().endsWith("ms")
          ? Number.parseFloat(value)
          : Number.parseFloat(value) * 1000;
      return [...style.transitionDuration.split(","), ...style.animationDuration.split(",")]
        .map(toMilliseconds);
    });
    expect(Math.max(...motionDurations)).toBeLessThanOrEqual(0.01);
  } finally {
    await context.close();
  }
});
