export const id = "editor-search-focus-history";
export const description = "Search focus retention, document typing, and isolated undo history.";

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
    await page.keyboard.insertText("Agent anchor\n\nWorking line");
    await waitForRenderFrame(page);

    await page.keyboard.press("ControlOrMeta+F");
    const searchInput = page.getByRole("searchbox", { name: "Search" });
    await searchInput.fill("Agent");
    await waitForRenderFrame(page);
    expect((await page.locator(".document-search-count").textContent()) === "1/1", "Search should find the Agent match before editing.");

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
      searchCount: document.querySelector(".document-search-count")?.textContent ?? "",
      activeElementLabel: document.activeElement?.getAttribute("aria-label") ?? "",
    }));
    expect(searchEditState.editorText.includes("Agent anchor"), "Editing with Search open should not overwrite the matching Agent text.");
    expect(
      searchEditState.editorText.includes("Working line typed"),
      "Editing with Search open should keep typing on the line the user selected.",
    );
    expect(searchEditState.searchCount === "1/1", "Search should keep the same match count while unrelated text changes.");
    expect(searchEditState.activeElementLabel !== "Search", "Typing in the document should not be pulled back into the search input.");
  });

  await withPage(browser, "/", async (page) => {
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText("editor undo base");
    await waitForRenderFrame(page);

    await page.keyboard.press("ControlOrMeta+F");
    const searchInput = page.getByRole("searchbox", { name: "Search" });
    await searchInput.click();
    await page.keyboard.type("base");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("missing");
    await page.keyboard.press("ControlOrMeta+Z");
    await waitForRenderFrame(page);

    let undoIsolationState = await page.evaluate(() => {
      const content = document.querySelector(".cm-content");
      const view = content?.cmView?.view ?? content?.cmTile?.view;
      return {
        editorText: view?.state?.doc?.toString?.() ?? content?.textContent ?? "",
        searchValue: document.querySelector('input[aria-label="Search"]')?.value ?? "",
        replaceValue: document.querySelector('input[aria-label="Replace with"]')?.value ?? "",
        activeElementLabel: document.activeElement?.getAttribute("aria-label") ?? "",
      };
    });
    expect(undoIsolationState.searchValue !== "missing", "Undo in Search should apply to the search query.");
    expect(undoIsolationState.editorText === "editor undo base", "Undo in Search should not undo editor text.");
    expect(undoIsolationState.activeElementLabel === "Search", "Undo in Search should keep focus in the search input.");
    const searchValueAfterUndo = undoIsolationState.searchValue;

    await page.getByRole("button", { name: "Toggle replace" }).click();
    const replaceInput = page.getByLabel("Replace with");
    await replaceInput.click();
    await page.keyboard.type("replace");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("replacement");
    await page.keyboard.press("ControlOrMeta+Z");
    await waitForRenderFrame(page);

    undoIsolationState = await page.evaluate(() => {
      const content = document.querySelector(".cm-content");
      const view = content?.cmView?.view ?? content?.cmTile?.view;
      return {
        editorText: view?.state?.doc?.toString?.() ?? content?.textContent ?? "",
        searchValue: document.querySelector('input[aria-label="Search"]')?.value ?? "",
        replaceValue: document.querySelector('input[aria-label="Replace with"]')?.value ?? "",
        activeElementLabel: document.activeElement?.getAttribute("aria-label") ?? "",
      };
    });
    expect(undoIsolationState.replaceValue !== "replacement", "Undo in Replace should apply to the replace query.");
    expect(undoIsolationState.searchValue === searchValueAfterUndo, "Undo in Replace should not undo the search query.");
    expect(undoIsolationState.editorText === "editor undo base", "Undo in Replace should not undo editor text.");
    expect(undoIsolationState.activeElementLabel === "Replace with", "Undo in Replace should keep focus in the replace input.");
    const replaceValueAfterUndo = undoIsolationState.replaceValue;

    await focusMarkdownEditor(page);
    await page.keyboard.press("End");
    await page.keyboard.type(" editor");
    await page.keyboard.press("ControlOrMeta+Z");
    await waitForRenderFrame(page);

    undoIsolationState = await page.evaluate(() => {
      const content = document.querySelector(".cm-content");
      const view = content?.cmView?.view ?? content?.cmTile?.view;
      return {
        editorText: view?.state?.doc?.toString?.() ?? content?.textContent ?? "",
        searchValue: document.querySelector('input[aria-label="Search"]')?.value ?? "",
        replaceValue: document.querySelector('input[aria-label="Replace with"]')?.value ?? "",
      };
    });
    expect(undoIsolationState.editorText === "editor undo base", "Undo in Editor should undo only the editor transaction.");
    expect(undoIsolationState.searchValue === searchValueAfterUndo, "Undo in Editor should not undo the search query.");
    expect(undoIsolationState.replaceValue === replaceValueAfterUndo, "Undo in Editor should not undo the replace query.");
  });
}
