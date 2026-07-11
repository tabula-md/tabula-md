export const id = "editor-search-source";
export const description = "Source editor search matches, shortcuts, options, and multi-selection.";

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

    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForSelector(".document-search-row");
    const searchInput = page.getByRole("searchbox", { name: "Search" });
    await searchInput.click();
    await searchInput.type("bet");
    await waitForRenderFrame(page);
    expect((await page.locator(".document-search-count").textContent()) === "1/3", "Search should update result count while typing.");
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
    expect((await page.locator(".document-search-count").textContent()) === "2/3", "Enter should move to the next search result.");
    expect((await searchInput.inputValue()) === "bet", "Enter should keep the search query in the input.");
    const activeSearchFocus = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
    expect(activeSearchFocus === "Search", "Enter should keep focus in the search input.");

    await searchInput.fill("zzz");
    await waitForRenderFrame(page);
    expect((await page.locator(".document-search-count").textContent()) === "0/0", "Search should show zero results as the query changes.");
    expect((await page.locator(".cm-search-match").count()) === 0, "Search should clear highlights when there are no matches.");
    const missingSearchInputState = await searchInput.evaluate((input) => {
      const probe = document.createElement("span");
      probe.style.color = "var(--danger-text)";
      document.body.append(probe);
      const dangerTextColor = getComputedStyle(probe).color;
      probe.remove();
      return {
        emptyResult: input.getAttribute("data-empty-result"),
        inputColor: getComputedStyle(input).color,
        dangerTextColor,
      };
    });
    expect(missingSearchInputState.emptyResult === "true", "Missing search terms should mark the search input as an empty result.");
    expect(
      missingSearchInputState.inputColor === missingSearchInputState.dangerTextColor,
      "Missing search terms should render the query in the danger text color.",
    );
  });

  await withPage(browser, "/", async (page) => {
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText("alpha beta\nbeta gamma");
    await waitForRenderFrame(page);

    await page.evaluate(() => {
      const content = document.querySelector(".cm-content");
      const view = content?.cmView?.view ?? content?.cmTile?.view;
      const docText = view?.state?.doc?.toString?.() ?? "";
      const from = docText.indexOf("beta");
      if (view && from >= 0) {
        view.dispatch({ selection: { anchor: from, head: from + "beta".length }, scrollIntoView: true });
        view.focus();
      }
    });
    await page.keyboard.press("ControlOrMeta+F");
    await waitForRenderFrame(page);
    const sourceShortcutInput = page.getByRole("searchbox", { name: "Search" });
    expect((await sourceShortcutInput.inputValue()) === "beta", "Cmd/Ctrl+F should prefill source search from the editor selection.");
    expect((await page.locator(".document-search-count").textContent()) === "1/2", "Source shortcut search should count editor matches.");
    expect((await page.locator(".cm-search-match").count()) === 2, "Source shortcut search should highlight CodeMirror matches.");
    await page.getByRole("button", { name: "Select all matches" }).click();
    await waitForRenderFrame(page);
    const selectedMatchState = await page.evaluate(() => {
      const content = document.querySelector(".cm-content");
      const view = content?.cmView?.view ?? content?.cmTile?.view;
      if (!view) {
        return null;
      }

      const visibleCursorCount = Array.from(document.querySelectorAll(".cm-cursor")).filter((cursor) => {
        if (!(cursor instanceof HTMLElement)) {
          return false;
        }

        const style = getComputedStyle(cursor);
        return style.display !== "none" && style.visibility !== "hidden" && cursor.getClientRects().length > 0;
      }).length;
      return {
        ranges: view.state.selection.ranges.length,
        selectedText: view.state.selection.ranges.map((range) => view.state.sliceDoc(range.from, range.to)).join("|"),
        visibleCursorCount,
      };
    });
    expect(selectedMatchState?.ranges === 2, "Select all matches should create one editor selection per source match.");
    expect(selectedMatchState?.selectedText === "beta|beta", "Select all matches should select the matched source text.");
    expect(selectedMatchState?.visibleCursorCount >= 2, "Select all matches should draw one visible cursor per source match.");

    await page.getByLabel("Match whole word").click();
    await waitForRenderFrame(page);
    expect((await page.locator(".document-search-count").textContent()) === "1/2", "Whole-word search should keep whole beta matches.");
    await sourceShortcutInput.fill("bet");
    await waitForRenderFrame(page);
    expect((await page.locator(".document-search-count").textContent()) === "0/0", "Whole-word search should reject partial word matches.");
    await page.getByLabel("Match whole word").click();
    await page.getByLabel("Use regular expression").click();
    await sourceShortcutInput.fill("b[a-z]+");
    await waitForRenderFrame(page);
    expect((await page.locator(".document-search-count").textContent()) === "1/2", "Regexp search should find source matches.");
    await sourceShortcutInput.fill("(");
    await waitForRenderFrame(page);
    expect((await sourceShortcutInput.getAttribute("aria-invalid")) === "true", "Invalid regexp should mark the search input invalid.");
    expect((await page.locator(".document-search-count").textContent()) === "0/0", "Invalid regexp should not report stale matches.");
  });
}
