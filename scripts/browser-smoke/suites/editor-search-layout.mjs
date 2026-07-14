import { readSearchRowLayout } from "./editor-search-helpers.mjs";

export const id = "editor-search-layout";
export const description = "Find-in-file document layout, control chrome, and persistent view behavior.";

export async function run(ctx) {
  const {
    browser,
    expect,
    focusMarkdownEditor,
    waitForEditorReady,
    waitForRenderFrame,
    withPage,
  } = ctx;

  await withPage(browser, "/", async (page) => {
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText("alpha beta\nbeta gamma\nalpha beta");
    await waitForRenderFrame(page);

    await page.keyboard.press("ControlOrMeta+F");
    await page.waitForSelector(".document-search-row");
    const searchRowLayout = await readSearchRowLayout(page);
    expect(Boolean(searchRowLayout), "Search should render a measurable row.");
    expect(
      searchRowLayout.rowPosition !== "fixed" && searchRowLayout.rowPosition !== "absolute",
      "Document Search should stay in the document layout instead of floating over content.",
    );
    expect(
      searchRowLayout.rowLeft >= searchRowLayout.toolbarLeft &&
        searchRowLayout.rowRight <= searchRowLayout.toolbarRight,
      "Document Search should stay within the document chrome lane.",
    );
    expect(
      Math.abs(searchRowLayout.barLeft - searchRowLayout.rowLeft) <= 1 &&
        Math.abs(searchRowLayout.barRight - searchRowLayout.rowRight) <= 1,
      "Document Search controls should fill their document row.",
    );
    expect(
      searchRowLayout.rowBorderTop === "0px" && searchRowLayout.rowBorderBottom === "0px",
      "Search row should not add splitter-style border lines.",
    );
    expect(searchRowLayout.documentControlsSeparators === 0, "Document controls should not use a splitter line.");
    expect(!searchRowLayout.rightPanelOpen, "Cmd/Ctrl+F should not open the side panel.");
    expect(!searchRowLayout.workspaceSearchOpen, "Document Search should not activate Workspace Search.");

    await page.getByRole("button", { name: "Close search" }).click();
    expect((await page.locator(".document-search-row").count()) === 0, "Closing Document Search should remove only its row.");
    await page.getByRole("button", { name: "Toggle side panel" }).click();
    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    await page.getByRole("button", { name: "Focus" }).click();
    await page.locator(".document-toolbar-row").getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForSelector(".document-search-row");
    const focusedWidthSearchLayout = await readSearchRowLayout(page);
    expect(Boolean(focusedWidthSearchLayout), "Search row should be measurable after changing text width.");
    expect(
      focusedWidthSearchLayout.rowLeft >= focusedWidthSearchLayout.toolbarLeft &&
        focusedWidthSearchLayout.rowRight <= focusedWidthSearchLayout.toolbarRight,
      "Changing document width should keep Search in the document chrome lane.",
    );
    expect(focusedWidthSearchLayout.rightPanelOpen, "Opening Document Search should preserve an already open side panel.");

    await page.getByRole("button", { name: "Split", exact: true }).click();
    await waitForEditorReady(page, { mode: "split" });
    const splitSearchAlignment = await page.evaluate(() => {
      const bar = document.querySelector(".document-search-bar");
      const row = document.querySelector(".document-search-row");
      const barRect = bar?.getBoundingClientRect();
      const rowRect = row?.getBoundingClientRect();
      return {
        barLeft: Math.round(barRect?.left ?? -1),
        barRight: Math.round(barRect?.right ?? -1),
        rowLeft: Math.round(rowRect?.left ?? -2),
        rowRight: Math.round(rowRect?.right ?? -2),
      };
    });
    expect(
      splitSearchAlignment.barLeft >= splitSearchAlignment.rowLeft &&
        splitSearchAlignment.barRight <= splitSearchAlignment.rowRight,
      "Split view should keep Document Search inside its source or preview lane.",
    );
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });

    const searchInput = page.getByRole("searchbox", { name: "Search" });
    expect((await searchInput.getAttribute("placeholder")) === "Search", "Search input placeholder should be Search.");
    expect((await page.getByLabel("Replace with").count()) === 0, "Replace should stay collapsed by default.");
    await page.getByRole("button", { name: "Toggle replace" }).click();
    await page.getByLabel("Replace with").fill("replacement");
    expect((await page.getByLabel("Replace with").inputValue()) === "replacement", "Toggle replace should reveal the replace input.");
    await page.getByRole("button", { name: "Toggle replace" }).click();
    expect((await page.getByLabel("Replace with").count()) === 0, "Toggle replace should collapse the replace input.");

    await page.getByRole("button", { name: "Open Workspace menu" }).click();
    await page.getByRole("button", { name: "Preferences", exact: true }).click();
    expect((await page.getByRole("button", { name: "Light", exact: true }).count()) === 1, "Workspace preferences should remain interactive above an open Search row.");
    await page.getByRole("button", { name: "Close Workspace menu" }).click();

    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    expect((await page.locator(".document-search-row").count()) === 1, "Search should stay open while Editor Controls are opened.");
    expect((await page.locator('.document-controls-popover[aria-label="Editor controls"]').count()) === 1, "Editor Controls should open over the persistent search row.");
    await page.locator(".workspace").click({ position: { x: 20, y: 20 } });
    await waitForRenderFrame(page);
    expect((await page.locator('.document-controls-popover[aria-label="Editor controls"]').count()) === 0, "Outside click should close Editor Controls.");
    expect((await page.locator(".document-search-row").count()) === 1, "Outside click should not close Search.");

    await page.getByRole("button", { name: "Close search" }).click();
    await waitForRenderFrame(page);
    expect((await page.locator(".document-search-row").count()) === 0, "Closing search should remove the search row.");

    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    expect((await page.locator('.document-controls-popover[aria-label="Editor controls"]').count()) === 1, "Editor Controls should open as a popover.");
    await page.locator(".workspace").click({ position: { x: 20, y: 20 } });
    await waitForRenderFrame(page);
    expect((await page.locator('.document-controls-popover[aria-label="Editor controls"]').count()) === 0, "Editor Controls should close on outside click.");

    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    await page.getByRole("button", { name: "Line Wrapping" }).click();
    await waitForRenderFrame(page);
    expect((await page.locator('.document-controls-popover[aria-label="Editor controls"]').count()) === 0, "Editor Controls should close after choosing an action.");
  });
}
