import { expect, test } from "@playwright/test";

const openFreshDocument = async (page) => {
  await page.goto("/");
  await page.waitForSelector(".tabbar");
  await page.getByRole("button", { name: "New document", exact: true }).click();
  await page.locator(".document-metadata-toggle").click();
  await expect(page.getByRole("button", { name: "Add metadata" })).toBeVisible();
};

test.describe("document metadata", () => {
  test("keeps Write focused on the body until metadata is opened", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector(".tabbar");
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await page.getByRole("button", { name: "Write" }).click();

    await expect(page.locator(".document-metadata-drawer")).toHaveCount(0);
    await expect(page.locator(".document-properties")).toHaveCount(0);
    await expect(page.locator(".cm-content")).toBeVisible();

    await page.locator(".document-metadata-toggle").click();
    await expect(page.locator(".document-metadata-drawer")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add metadata" })).toBeVisible();
    await expect(page.locator(".document-properties-count")).toHaveCount(0);
    const metadataSurface = await page.locator(".document-metadata-drawer").evaluate((drawer) => {
      const body = document.querySelector(".cm-content");
      if (!(body instanceof HTMLElement)) throw new Error("Editor body is missing");
      const drawerStyle = getComputedStyle(drawer);
      const mutedSurfaceProbe = document.createElement("div");
      mutedSurfaceProbe.style.backgroundColor = "var(--surface-muted)";
      document.body.append(mutedSurfaceProbe);
      const mutedSurface = getComputedStyle(mutedSurfaceProbe).backgroundColor;
      mutedSurfaceProbe.remove();
      return {
        bodyWidth: body.getBoundingClientRect().width,
        drawerWidth: drawer.getBoundingClientRect().width,
        background: drawerStyle.backgroundColor,
        maxHeight: drawerStyle.maxHeight,
        mutedSurface,
        overflowY: drawerStyle.overflowY,
      };
    });
    expect(Math.abs(metadataSurface.drawerWidth - metadataSurface.bodyWidth)).toBeLessThanOrEqual(1);
    expect(metadataSurface.background).toBe(metadataSurface.mutedSurface);
    expect(metadataSurface.maxHeight).toBe("none");
    expect(metadataSurface.overflowY).toBe("visible");

    const addMetadata = page.getByRole("button", { name: "Add metadata" });
    const idleBackground = await addMetadata.evaluate(
      (button) => getComputedStyle(button).backgroundColor,
    );
    await addMetadata.hover();
    const hoverBackground = await addMetadata.evaluate(
      (button) => getComputedStyle(button).backgroundColor,
    );
    expect(hoverBackground).toBe(idleBackground);

    await page.locator(".document-metadata-toggle").click();
    await expect(page.locator(".document-metadata-drawer")).toHaveCount(0);
    await expect(page.locator(".document-properties")).toHaveCount(0);
    await expect(page.locator(".cm-content")).toBeVisible();
  });

  test("keeps the drawer rhythm stable from an empty state to one field", async ({ page }) => {
    await openFreshDocument(page);
    const emptyHeight = await page.locator(".document-metadata-drawer").evaluate(
      (drawer) => drawer.getBoundingClientRect().height,
    );

    await page.getByRole("button", { name: "Source" }).click();
    const editor = page.locator(".cm-content");
    await editor.click();
    await page.keyboard.insertText("---\ntype: Runbook\n---");
    await page.getByRole("button", { name: "Write" }).click();
    await page.locator(".document-metadata-toggle").click();

    const populatedHeight = await page.locator(".document-metadata-drawer").evaluate(
      (drawer) => drawer.getBoundingClientRect().height,
    );
    expect(Math.abs(populatedHeight - emptyHeight)).toBeLessThanOrEqual(1);
    await expect(page.getByRole("button", { name: "Add metadata" })).toBeVisible();
  });

  test("aligns search, metadata, and document content to one lane", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openFreshDocument(page);
    await page.getByRole("button", { name: "Search", exact: true }).click();

    const readLaneMetrics = () => page.evaluate(() => {
      const selectors = [
        ".document-search-line",
        ".document-metadata-drawer",
        ".markdown-editor .cm-content",
      ];
      return selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof HTMLElement)) throw new Error(`${selector} is missing`);
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, width: rect.width };
      });
    });

    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 700, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      const metrics = await readLaneMetrics();
      const widths = metrics.map(({ width }) => width);
      const leftEdges = metrics.map(({ left }) => left);
      const rightEdges = metrics.map(({ right }) => right);
      expect(Math.max(...widths) - Math.min(...widths)).toBeLessThanOrEqual(1);
      expect(Math.max(...leftEdges) - Math.min(...leftEdges)).toBeLessThanOrEqual(1);
      expect(Math.max(...rightEdges) - Math.min(...rightEdges)).toBeLessThanOrEqual(1);
    }
  });

  test("shows every top-level field without a second disclosure", async ({ page }) => {
    await openFreshDocument(page);
    await page.getByRole("button", { name: "Source" }).click();
    const editor = page.locator(".cm-content");
    await editor.click();
    await page.keyboard.insertText(
      "---\ntype: Runbook\ntitle: Incident response\ndescription: Recovery guide\ntags: [incident]\nstatus: stable\nstale_after: 2026-12-31\nowner: team:operations\n---",
    );
    await page.getByRole("button", { name: "Write" }).click();
    await page.locator(".document-metadata-toggle").click();

    await expect(page.getByText("Metadata", { exact: true })).toHaveCount(0);
    await expect(page.locator(".document-properties")).toHaveAttribute("aria-label", "Metadata");
    await expect(page.getByRole("button", { name: "owner", exact: true })).toBeVisible();
    await expect(page.locator(".document-properties-count")).toHaveCount(0);
    await expect(page.locator(".document-properties-show-more")).toHaveCount(0);
  });

  test("selects new scalar types and resets inferred types for arbitrary keys", async ({ page }) => {
    await openFreshDocument(page);
    await page.getByRole("button", { name: "Add metadata" }).click();
    await page.getByRole("button", { name: "Change type for Field name" }).click();
    await page.getByRole("menuitemradio", { name: "Number" }).click();
    await expect(page.getByRole("textbox", { name: "Field value" })).toHaveValue("0");

    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Add metadata" }).click();
    const keyInput = page.getByRole("combobox", { name: "Field name" });
    await keyInput.fill("sources");
    await page.getByRole("option", { name: /^sources/ }).click();
    await keyInput.fill("owner");
    await page.getByRole("button", { name: "Change type for owner" }).click();
    await expect(page.getByRole("menuitemradio", { name: "Text" })).toHaveAttribute(
      "data-state",
      "checked",
    );
  });

  test("creates editable OKF structure templates without enforcing them", async ({ page }) => {
    await openFreshDocument(page);
    await page.getByRole("button", { name: "Add metadata" }).click();
    const keyInput = page.getByRole("combobox", { name: "Field name" });
    await keyInput.fill("sources");
    await page.getByRole("option", { name: /^sources/ }).click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("button", { name: "1 item" })).toBeVisible();
    await page.getByRole("button", { name: "1 field" }).click();
    await expect(page.getByRole("button", { name: "resource", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Empty", exact: true })).toBeVisible();
  });

  test("moves from a metadata key to its value and commits once with Enter", async ({ page }) => {
    await openFreshDocument(page);
    await page.getByRole("button", { name: "Add metadata" }).click();
    const keyInput = page.getByRole("combobox", { name: "Field name" });
    await keyInput.fill("type");
    await page.keyboard.press("Enter");

    const valueInput = page.getByRole("textbox", { name: "Field value" });
    await expect(valueInput).toBeFocused();
    await expect(valueInput).toHaveValue("");
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
    await valueInput.fill("Runbook");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("button", { name: "Add metadata" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "type value" })).toHaveCount(0);

    const editor = page.locator(".cm-content");
    await page.getByRole("button", { name: "Source" }).click();
    await expect(editor).toContainText("type: Runbook");
    await expect(editor).not.toContainText('type: ""');
    await expect(editor).toContainText("---");
  });

  test("dismisses an uncommitted metadata row when focus returns to the document", async ({ page }) => {
    await openFreshDocument(page);
    await page.getByRole("button", { name: "Add metadata" }).click();
    await page.getByRole("combobox", { name: "Field name" }).fill("owner");

    await page.locator(".cm-content").click();

    await expect(page.getByRole("button", { name: "Add metadata" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Field name" })).toHaveCount(0);
    await page.getByRole("button", { name: "Source" }).click();
    await expect(page.locator(".cm-content")).not.toContainText("owner:");
  });

  test("closes suggestions before cancelling the metadata row with Escape", async ({ page }) => {
    await openFreshDocument(page);
    await page.getByRole("button", { name: "Add metadata" }).click();
    const keyInput = page.getByRole("combobox", { name: "Field name" });
    await expect(keyInput).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(keyInput).toHaveAttribute("aria-expanded", "false");
    await expect(keyInput).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Add metadata" })).toBeVisible();
  });

  test("focuses the first editable field in a suggested structured value", async ({ page }) => {
    await openFreshDocument(page);
    await page.getByRole("button", { name: "Add metadata" }).click();
    const keyInput = page.getByRole("combobox", { name: "Field name" });
    await keyInput.fill("generated");
    await page.keyboard.press("Enter");

    const byValue = page.getByRole("textbox", { name: "by value" });
    await expect(byValue).toBeFocused();
    await byValue.fill("human:taeha");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("textbox", { name: "at value" })).toBeFocused();
  });

  test("moves from an existing property key to its value after renaming", async ({ page }) => {
    await openFreshDocument(page);
    await page.getByRole("button", { name: "Source" }).click();
    const editor = page.locator(".cm-content");
    await editor.click();
    await page.keyboard.insertText("---\ntype: Runbook\n---");
    await page.getByRole("button", { name: "Write" }).click();
    await page.locator(".document-metadata-toggle").click();

    await page.getByRole("button", { name: "type", exact: true }).click();
    const keyInput = page.getByRole("textbox", { name: "Field name" });
    await keyInput.fill("kind");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("textbox", { name: "kind value" })).toBeFocused();
    await expect(page.getByRole("textbox", { name: "kind value" })).toHaveValue("Runbook");
  });

  test("keeps a metadata value stationary when it enters edit mode", async ({ page }) => {
    await openFreshDocument(page);
    await page.getByRole("button", { name: "Source" }).click();
    const editor = page.locator(".cm-content");
    await editor.click();
    await page.keyboard.insertText(
      "---\ndescription: This deliberately long metadata value wraps across multiple lines without moving when editing begins.\n---",
    );
    await page.getByRole("button", { name: "Write" }).click();
    await page.locator(".document-metadata-toggle").click();

    const row = page.locator(".document-property-row").filter({
      has: page.getByRole("button", { name: "description", exact: true }),
    });
    const displayValue = row.locator(".document-property-value-button");
    const before = await displayValue.boundingBox();
    await displayValue.click();
    const editValue = page.getByRole("textbox", { name: "description value" });
    const after = await editValue.boundingBox();

    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(Math.abs(after.y - before.y)).toBeLessThan(0.5);
    expect(Math.abs(after.height - before.height)).toBeLessThan(0.5);
  });

  test("treats an empty metadata envelope like an empty document in Write and Read", async ({ page }) => {
    await openFreshDocument(page);
    await page.getByRole("button", { name: "Source" }).click();
    const editor = page.locator(".cm-content");
    await editor.click();
    await page.keyboard.insertText("---\n---");

    await page.getByRole("button", { name: "Write" }).click();
    await expect(page.locator(".document-metadata-drawer")).toHaveCount(0);
    await expect(page.locator(".cm-visual-body-placeholder")).toHaveText("Start writing...");

    await editor.click();
    await expect(page.locator(".cm-cursor")).toBeVisible();
    await page.keyboard.insertText("Body starts here");
    await expect(editor).toContainText("Body starts here");
    await expect(page.locator(".cm-visual-body-placeholder")).toHaveCount(0);

    await page.getByRole("button", { name: "Source" }).click();
    await expect(editor.locator(".cm-line")).toHaveText([
      "---",
      "---",
      "Body starts here",
    ]);
    await page.getByRole("button", { name: "Read" }).click();
    const preview = page.getByRole("article");
    await expect(preview).toContainText("Body starts here");
    await expect(preview.locator("hr")).toHaveCount(0);
  });

  test("edits a suggested OKF object before committing it", async ({ page }) => {
    await openFreshDocument(page);
    await page.getByRole("button", { name: "Add metadata" }).click();
    const keyInput = page.getByRole("combobox", { name: "Field name" });
    await keyInput.fill("generated");
    await page.getByRole("option", { name: /^generated/ }).click();

    await expect(page.getByRole("button", { name: "2 fields" })).toBeVisible();
    await expect(page.getByRole("button", { name: "by", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "at", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Change type for at" }).click();
    await expect(page.getByRole("menuitemradio", { name: "Date & time" })).toHaveAttribute(
      "data-state",
      "checked",
    );
    await page.keyboard.press("Escape");

    const byRow = page.locator(".document-property-nested-row").filter({
      has: page.getByRole("button", { name: "by", exact: true }),
    });
    await byRow.getByRole("button", { name: "Empty", exact: true }).click();
    await page.getByRole("textbox", { name: "by value" }).fill("human:taeha");
    await page.keyboard.press("ControlOrMeta+Enter");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("button", { name: "2 fields" })).toBeVisible();
    await expect(page.getByRole("button", { name: "human:taeha" })).toBeVisible();
  });

  test("suggests metadata fields already used by workspace documents", async ({ page }) => {
    await openFreshDocument(page);
    await page.getByRole("button", { name: "Source" }).click();
    const editor = page.locator(".cm-content");
    await editor.click();
    await page.keyboard.insertText("---\nowner: team:platform\n---\nWorkspace source");
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await page.getByRole("button", { name: "Write" }).click();
    await page.locator(".document-metadata-toggle").click();

    await page.getByRole("button", { name: "Add metadata" }).click();
    const keyInput = page.getByRole("combobox", { name: "Field name" });
    await keyInput.fill("owner");
    const ownerOption = page.getByRole("option", { name: /^owner/ });
    await expect(ownerOption).toContainText("Used in 1 document");
    await ownerOption.click();
    await page.getByRole("button", { name: "Change type for owner" }).click();
    await expect(page.getByRole("menuitemradio", { name: "Text" })).toHaveAttribute(
      "data-state",
      "checked",
    );
  });

  test("surfaces invalid YAML instead of presenting it as missing metadata", async ({ page }) => {
    await openFreshDocument(page);
    await page.getByRole("button", { name: "Source" }).click();
    const editor = page.locator(".cm-content");
    await editor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText("---\ntitle: [\n---\nBody");
    await page.getByRole("button", { name: "Write" }).click();
    await page.locator(".document-metadata-toggle").click();

    await expect(page.getByText("Metadata couldn’t be read.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit in Source" })).toBeVisible();
  });

  test("stacks the add-field controls on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 760 });
    await openFreshDocument(page);
    await page.getByRole("button", { name: "Add metadata" }).click();

    const keyBox = await page.getByRole("combobox", { name: "Field name" }).boundingBox();
    const valueBox = await page.getByRole("textbox", { name: "Field value" }).boundingBox();
    expect(keyBox).not.toBeNull();
    expect(valueBox).not.toBeNull();
    expect(valueBox.y).toBeGreaterThan(keyBox.y + keyBox.height - 1);
  });
});
