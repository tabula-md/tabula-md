import { readEditorText } from "./editor-search-helpers.mjs";

export const id = "editor-search-replace";
export const description = "Source search replace current/all behavior and replace input traversal.";

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
    const searchInput = page.getByRole("searchbox", { name: "Search" });
    await searchInput.fill("bet");
    await waitForRenderFrame(page);
    await page.keyboard.press("Enter");
    await waitForRenderFrame(page);
    await page.getByRole("button", { name: "Toggle replace" }).click();
    await page.getByLabel("Replace with").fill("stone");
    await page.getByRole("button", { name: "Replace match" }).click();
    await waitForRenderFrame(page);
    const replaceOneText = (await readEditorText(page)).replace(/\n$/, "");
    expect(
      replaceOneText === "alpha beta\nstonea gamma\nalpha beta",
      `Replace match should update the active search match in the editor. Actual: ${replaceOneText}`,
    );
    expect((await page.locator(".document-search-count").textContent()) === "2/2", "Replace match should keep the active result on the next remaining match.");
    await page.getByRole("button", { name: "Replace all" }).click();
    await waitForRenderFrame(page);
    const replaceAllText = (await readEditorText(page)).replace(/\n$/, "");
    expect(
      replaceAllText === "alpha stonea\nstonea gamma\nalpha stonea",
      `Replace all should update every remaining search match. Actual: ${replaceAllText}`,
    );
    expect((await page.locator(".document-search-count").textContent()) === "0/0", "Replace all should clear search matches after no results remain.");
  });

  await withPage(browser, "/", async (page) => {
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText("foo foo foo");
    await waitForRenderFrame(page);

    await page.keyboard.press("ControlOrMeta+F");
    const searchInput = page.getByRole("searchbox", { name: "Search" });
    await searchInput.fill("foo");
    await waitForRenderFrame(page);
    await page.getByRole("button", { name: "Toggle replace" }).click();
    const replaceInput = page.getByLabel("Replace with");
    await replaceInput.fill("fooX");
    await replaceInput.press("Enter");
    await waitForRenderFrame(page);

    const replacementState = await page.evaluate(() => {
      const content = document.querySelector(".cm-content");
      const view = content?.cmView?.view ?? content?.cmTile?.view;
      return {
        text: view?.state?.doc?.toString?.() ?? content?.textContent ?? "",
        count: document.querySelector(".document-search-count")?.textContent ?? "",
        focusLabel: document.activeElement?.getAttribute("aria-label") ?? "",
      };
    });
    expect(replacementState.text === "fooX foo foo", "Replace current should apply the replacement text once.");
    expect(
      replacementState.count === "2/3",
      "Replace current should advance past a replacement that still contains the query.",
    );
    expect(replacementState.focusLabel === "Replace with", "Enter in replace should keep focus in the replace input.");

    await replaceInput.press("Enter");
    await waitForRenderFrame(page);
    const nextReplacementState = await page.evaluate(() => {
      const content = document.querySelector(".cm-content");
      const view = content?.cmView?.view ?? content?.cmTile?.view;
      return {
        text: view?.state?.doc?.toString?.() ?? content?.textContent ?? "",
        count: document.querySelector(".document-search-count")?.textContent ?? "",
        focusLabel: document.activeElement?.getAttribute("aria-label") ?? "",
      };
    });
    expect(nextReplacementState.text === "fooX fooX foo", "Enter in replace should continue replacing the next match.");
    expect(nextReplacementState.count === "3/3", "Enter in replace should keep cycling through remaining matches.");
    expect(nextReplacementState.focusLabel === "Replace with", "Repeated Enter in replace should not focus the editor.");
  });
}
