export const id = "editor-search-preview";
export const description = "Rendered Markdown preview search target, count, options, and highlight behavior.";

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
    await page.keyboard.insertText([
      "# Preview Search",
      "",
      "A fully rendered app created with `fastapp-new`.",
      "",
      "> full quote",
      "",
      "| Column | Value |",
      "| --- | --- |",
      "| target | full |",
    ].join("\n"));
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });

    await page.evaluate(() => {
      const walker = document.createTreeWalker(document.querySelector(".preview-surface"), NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const text = node.textContent ?? "";
        const start = text.indexOf("fastapp-new");
        if (start >= 0) {
          const range = document.createRange();
          range.setStart(node, start);
          range.setEnd(node, start + "fastapp-new".length);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
          return;
        }
        node = walker.nextNode();
      }
    });
    await page.keyboard.press("ControlOrMeta+F");
    await waitForRenderFrame(page);
    const previewSearchInput = page.getByRole("searchbox", { name: "Search" });
    expect((await previewSearchInput.inputValue()) === "fastapp-new", "Cmd/Ctrl+F should prefill preview search from rendered selection.");
    expect((await page.locator(".workspace.preview").count()) === 1, "Preview search shortcut should not leave Preview mode.");
    expect((await page.getByRole("button", { name: "Toggle replace" }).count()) === 0, "Preview search should hide replace controls.");
    expect((await page.getByRole("button", { name: "Select all matches" }).count()) === 0, "Preview search should hide source selection controls.");
    expect((await page.locator(".preview-search-match").count()) === 1, "Preview search should highlight rendered matches.");
    expect((await page.locator(".cm-search-match").count()) === 0, "Preview search should not create source editor highlights.");

    await previewSearchInput.fill("absent-preview-token");
    await waitForRenderFrame(page);
    expect((await page.locator(".document-search-count").textContent()) === "0/0", "Preview search should not show stale counts for a new missing query.");
    expect((await page.locator(".preview-search-match").count()) === 0, "Preview search should clear rendered matches for a missing query.");
    await previewSearchInput.fill("full");
    await waitForRenderFrame(page);
    expect((await page.locator(".document-search-count").textContent()) === "1/3", "Preview search should count rendered paragraph, quote, and table text.");
    expect((await page.locator(".preview-search-match").count()) === 3, "Preview search should highlight matches in rendered preview text.");
    await page.getByLabel("Match whole word").click();
    await waitForRenderFrame(page);
    expect((await page.locator(".document-search-count").textContent()) === "1/2", "Preview whole-word search should reject the fully partial match.");
    await page.getByLabel("Match whole word").click();
    await waitForRenderFrame(page);
    await previewSearchInput.click();
    await page.keyboard.press("Enter");
    await waitForRenderFrame(page);
    expect((await page.locator(".document-search-count").textContent()) === "2/3", "Enter should move to the next preview match.");
    expect((await page.locator(".preview-search-match.active").count()) === 1, "Preview search should keep one active rendered match.");
  });
}
