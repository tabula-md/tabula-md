import { readSearchRowLayout } from "./editor-search-helpers.mjs";

export const id = "editor-search-layout";
export const description = "Find-in-file row layout, control chrome, and persistent row behavior.";

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
    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText("alpha beta\nbeta gamma\nalpha beta");
    await waitForRenderFrame(page);

    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForSelector(".document-search-row");
    const searchRowLayout = await readSearchRowLayout(page);
    expect(Boolean(searchRowLayout), "Search should render a measurable row.");
    expect(searchRowLayout.rowPosition === "relative", "Search should be a document row, not a floating popover.");
    expect(searchRowLayout.rowTop >= searchRowLayout.controlsBottom - 1, "Search row should sit below the editor controls.");
    expect(searchRowLayout.workspaceTop >= searchRowLayout.rowBottom - 1, "Workspace should start below the search row.");
    expect(
      Math.abs(searchRowLayout.rowLeft - searchRowLayout.controlsLeft) <= 1 &&
        Math.abs(searchRowLayout.rowRight - searchRowLayout.controlsRight) <= 1 &&
        Math.abs(searchRowLayout.rowWidth - searchRowLayout.controlsWidth) <= 1,
      "Search row should follow the same text-width layout as the top toolbar.",
    );
    expect(
      searchRowLayout.rowBorderTop === "0px" && searchRowLayout.rowBorderBottom === "0px",
      "Search row should not add splitter-style border lines.",
    );
    expect(searchRowLayout.documentControlsSeparators === 0, "Document controls should not use a splitter line.");

    await page.getByRole("button", { name: "Close search" }).click();
    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    await page.getByRole("button", { name: "Focus" }).click();
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForSelector(".document-search-row");
    const focusedWidthSearchLayout = await readSearchRowLayout(page);
    expect(Boolean(focusedWidthSearchLayout), "Search row should be measurable after changing text width.");
    expect(
      Math.abs(focusedWidthSearchLayout.rowLeft - focusedWidthSearchLayout.controlsLeft) <= 1 &&
        Math.abs(focusedWidthSearchLayout.rowRight - focusedWidthSearchLayout.controlsRight) <= 1 &&
        Math.abs(focusedWidthSearchLayout.rowWidth - focusedWidthSearchLayout.controlsWidth) <= 1,
      "Search row should stay aligned after Text Width changes.",
    );

    const searchInput = page.getByRole("searchbox", { name: "Search" });
    expect((await searchInput.getAttribute("placeholder")) === "Search", "Search input placeholder should be Search.");
    expect((await page.getByLabel("Replace with").count()) === 0, "Replace should stay collapsed by default.");
    await page.getByRole("button", { name: "Toggle replace" }).click();
    await page.getByLabel("Replace with").fill("replacement");
    expect((await page.getByLabel("Replace with").inputValue()) === "replacement", "Toggle replace should reveal the replace input.");
    await page.getByRole("button", { name: "Toggle replace" }).click();
    expect((await page.getByLabel("Replace with").count()) === 0, "Toggle replace should collapse the replace input.");
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
