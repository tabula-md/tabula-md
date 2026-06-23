export const id = "editor-search";
export const description = "Find-in-file row behavior, live search results, and focus handling.";

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

    const readSearchRowLayout = () =>
      page.evaluate(() => {
        const controls = document.querySelector(".editor-control-row");
        const row = document.querySelector(".file-search-row");
        const workspace = document.querySelector(".workspace");
        if (!(controls instanceof HTMLElement) || !(row instanceof HTMLElement) || !(workspace instanceof HTMLElement)) {
          return null;
        }

        const controlsRect = controls.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const workspaceRect = workspace.getBoundingClientRect();
        const rowStyle = getComputedStyle(row);
        return {
          rowLeft: Math.round(rowRect.left),
          rowRight: Math.round(rowRect.right),
          rowTop: Math.round(rowRect.top),
          rowBottom: Math.round(rowRect.bottom),
          rowWidth: Math.round(rowRect.width),
          controlsLeft: Math.round(controlsRect.left),
          controlsRight: Math.round(controlsRect.right),
          controlsBottom: Math.round(controlsRect.bottom),
          controlsWidth: Math.round(controlsRect.width),
          workspaceTop: Math.round(workspaceRect.top),
          rowPosition: rowStyle.position,
          rowBorderTop: rowStyle.borderTopWidth,
          rowBorderBottom: rowStyle.borderBottomWidth,
          fileToolbarSeparators: document.querySelectorAll(".file-toolbar > .toolbar-separator").length,
        };
      });

    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForSelector(".file-search-row");
    const searchRowLayout = await readSearchRowLayout();
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
    expect(searchRowLayout.fileToolbarSeparators === 0, "File toolbar controls should not use a splitter line.");

    await page.getByRole("button", { name: "Close search" }).click();
    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    await page.getByRole("button", { name: "Focus" }).click();
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForSelector(".file-search-row");
    const focusedWidthSearchLayout = await readSearchRowLayout();
    expect(Boolean(focusedWidthSearchLayout), "Search row should be measurable after changing text width.");
    expect(
      Math.abs(focusedWidthSearchLayout.rowLeft - focusedWidthSearchLayout.controlsLeft) <= 1 &&
        Math.abs(focusedWidthSearchLayout.rowRight - focusedWidthSearchLayout.controlsRight) <= 1 &&
        Math.abs(focusedWidthSearchLayout.rowWidth - focusedWidthSearchLayout.controlsWidth) <= 1,
      "Search row should stay aligned after Text Width changes.",
    );

    const searchInput = page.getByRole("searchbox", { name: "Find in file" });
    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    expect((await page.locator(".file-search-row").count()) === 1, "Search should stay open while Editor Controls are opened.");
    expect((await page.locator('.file-tool-popover[aria-label="Editor controls"]').count()) === 1, "Editor Controls should open over the persistent search row.");
    await page.locator(".workspace").click({ position: { x: 20, y: 20 } });
    await waitForRenderFrame(page);
    expect((await page.locator('.file-tool-popover[aria-label="Editor controls"]').count()) === 0, "Outside click should close Editor Controls.");
    expect((await page.locator(".file-search-row").count()) === 1, "Outside click should not close Search.");

    await searchInput.click();
    await searchInput.type("bet");
    await waitForRenderFrame(page);
    expect((await page.locator(".file-search-count").textContent()) === "1/3", "Search should update result count while typing.");
    expect((await page.locator(".cm-search-match").count()) === 3, "Search should highlight all matches while typing.");
    expect((await page.locator(".cm-search-match.active").count()) === 1, "Search should highlight the active match.");
    const searchHighlightColors = await page.evaluate(() => {
      const match = document.querySelector(".cm-search-match:not(.active)") ?? document.querySelector(".cm-search-match");
      const activeMatch = document.querySelector(".cm-search-match.active");
      return {
        match: match instanceof HTMLElement ? getComputedStyle(match).backgroundColor : "",
        activeMatch: activeMatch instanceof HTMLElement ? getComputedStyle(activeMatch).backgroundColor : "",
      };
    });
    expect(
      searchHighlightColors.match.includes("118, 63, 200") &&
        searchHighlightColors.activeMatch.includes("118, 63, 200"),
      "Search highlights should use the Tabula purple accent scale.",
    );

    await page.keyboard.press("Enter");
    await waitForRenderFrame(page);
    expect((await page.locator(".file-search-count").textContent()) === "2/3", "Enter should move to the next search result.");
    expect((await searchInput.inputValue()) === "bet", "Enter should keep the search query in the input.");
    const activeSearchFocus = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
    expect(activeSearchFocus === "Find in file", "Enter should keep focus in the search input.");

    await page.locator(".workspace").click({ position: { x: 20, y: 20 } });
    await waitForRenderFrame(page);
    expect((await page.locator(".file-search-row").count()) === 1, "Search should stay open after clicking the document.");

    await searchInput.fill("zzz");
    await waitForRenderFrame(page);
    expect((await page.locator(".file-search-count").textContent()) === "0/0", "Search should show zero results as the query changes.");
    expect((await page.locator(".cm-search-match").count()) === 0, "Search should clear highlights when there are no matches.");

    await page.getByRole("button", { name: "Close search" }).click();
    await waitForRenderFrame(page);
    expect((await page.locator(".file-search-row").count()) === 0, "Closing search should remove the search row.");

    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    expect((await page.locator('.file-tool-popover[aria-label="Editor controls"]').count()) === 1, "Editor Controls should open as a popover.");
    await page.locator(".workspace").click({ position: { x: 20, y: 20 } });
    await waitForRenderFrame(page);
    expect((await page.locator('.file-tool-popover[aria-label="Editor controls"]').count()) === 0, "Editor Controls should close on outside click.");

    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    await page.getByRole("button", { name: "Line Wrapping" }).click();
    await waitForRenderFrame(page);
    expect((await page.locator('.file-tool-popover[aria-label="Editor controls"]').count()) === 0, "Editor Controls should close after choosing an action.");
  });

  await withPage(browser, "/", async (page) => {
    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText("Agent anchor\n\nWorking line");
    await waitForRenderFrame(page);

    await page.getByRole("button", { name: "Search", exact: true }).click();
    const searchInput = page.getByRole("searchbox", { name: "Find in file" });
    await searchInput.fill("Agent");
    await waitForRenderFrame(page);
    expect((await page.locator(".file-search-count").textContent()) === "1/1", "Search should find the Agent match before editing.");

    const workingLinePoint = await page.evaluate(() => {
      const line = Array.from(document.querySelectorAll(".cm-line")).find((element) =>
        element.textContent?.includes("Working line"),
      );
      if (!(line instanceof HTMLElement)) {
        return null;
      }

      const rect = line.getBoundingClientRect();
      return {
        x: rect.left + 20,
        y: rect.top + rect.height / 2,
      };
    });
    expect(Boolean(workingLinePoint), "The non-search editing line should be clickable.");
    await page.mouse.click(workingLinePoint.x, workingLinePoint.y);
    await page.keyboard.press("End");
    await page.keyboard.type(" typed", { delay: 25 });
    await waitForRenderFrame(page);

    const searchEditState = await page.evaluate(() => ({
      editorText: document.querySelector(".cm-content")?.textContent ?? "",
      searchCount: document.querySelector(".file-search-count")?.textContent ?? "",
      activeElementLabel: document.activeElement?.getAttribute("aria-label") ?? "",
    }));
    expect(searchEditState.editorText.includes("Agent anchor"), "Editing with Search open should not overwrite the matching Agent text.");
    expect(
      searchEditState.editorText.includes("Working line typed"),
      "Editing with Search open should keep typing on the line the user selected.",
    );
    expect(searchEditState.searchCount === "1/1", "Search should keep the same match count while unrelated text changes.");
    expect(searchEditState.activeElementLabel !== "Find in file", "Typing in the document should not be pulled back into the search input.");
  });
}
