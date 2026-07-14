import { readSearchRowLayout } from "./editor-search-helpers.mjs";

export const id = "editor-search-layout";
export const description = "Find-in-file side panel layout, control chrome, and persistent view behavior.";

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
    expect(searchRowLayout.rowPosition === "static", "Search should be part of the side panel flow, not a floating popover.");
    expect(
      searchRowLayout.rowLeft >= searchRowLayout.panelBodyLeft &&
        searchRowLayout.rowRight <= searchRowLayout.panelBodyRight,
      "Search should stay within the side panel body.",
    );
    expect(
      Math.abs(searchRowLayout.barLeft - searchRowLayout.rowLeft) <= 1 &&
        Math.abs(searchRowLayout.barRight - searchRowLayout.rowRight) <= 1,
      "Search controls should fill the Search panel view.",
    );
    expect(
      searchRowLayout.rowBorderTop === "0px" && searchRowLayout.rowBorderBottom === "0px",
      "Search row should not add splitter-style border lines.",
    );
    expect(searchRowLayout.documentControlsSeparators === 0, "Document controls should not use a splitter line.");

    await page.getByRole("button", { name: "Close search" }).click();
    expect((await page.locator(".right-panel").count()) === 0, "Closing Search should close the side panel.");
    await page.getByRole("button", { name: "Toggle side panel" }).click();
    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    await page.getByRole("button", { name: "Focus" }).click();
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForSelector(".document-search-row");
    const focusedWidthSearchLayout = await readSearchRowLayout(page);
    expect(Boolean(focusedWidthSearchLayout), "Search row should be measurable after changing text width.");
    expect(
      focusedWidthSearchLayout.rowLeft >= focusedWidthSearchLayout.panelBodyLeft &&
        focusedWidthSearchLayout.rowRight <= focusedWidthSearchLayout.panelBodyRight,
      "Changing document width should not move Search out of the side panel.",
    );

    await page.getByRole("button", { name: "Split", exact: true }).click();
    await waitForEditorReady(page, { mode: "split" });
    const splitSearchAlignment = await page.evaluate(() => {
      const bar = document.querySelector(".document-search-bar");
      const panelBody = document.querySelector(".right-panel-body.search");
      const barRect = bar?.getBoundingClientRect();
      const panelBodyRect = panelBody?.getBoundingClientRect();
      return {
        barLeft: Math.round(barRect?.left ?? -1),
        barRight: Math.round(barRect?.right ?? -1),
        panelLeft: Math.round(panelBodyRect?.left ?? -2),
        panelRight: Math.round(panelBodyRect?.right ?? -2),
      };
    });
    expect(
      splitSearchAlignment.barLeft >= splitSearchAlignment.panelLeft &&
        splitSearchAlignment.barRight <= splitSearchAlignment.panelRight,
      "Split view should keep Search inside the side panel instead of either document pane.",
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
