export const id = "json-share";
export const description = "Encrypted Export link export and import.";
export const requiresJsonService = true;

export async function run(ctx) {
  const {
    baseUrl,
    browser,
    expect,
    focusMarkdownEditor,
    jsonUrl,
    waitForEditorReady,
    waitForSavedLocally,
    waitForShareDialogState,
    waitForText,
    withPage,
  } = ctx;

  expect(Boolean(jsonUrl), "JSON share smoke requires VITE_TABULA_JSON_URL.");
  await waitForJsonHealth(jsonUrl);

  await withPage(browser, "/", async (page) => {
    const requestUrls = [];
    const responseStatuses = [];
    page.on("request", (request) => requestUrls.push(request.url()));
    page.on("response", (response) => responseStatuses.push({
      status: response.status(),
      url: response.url(),
    }));

    await page.getByTitle("New document").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.type("\n\n# Export Link Smoke\n\nExport link import body.");
    await waitForSavedLocally(page);
    const contentFileName = await page.locator(".tab-item.active").getAttribute("data-file-name");
    expect(Boolean(contentFileName), "Export link smoke should identify the document containing the test body.");

    await page.locator(".share-trigger").click();
    await waitForShareDialogState(page, { panel: "Share link" });
    await page.getByRole("button", { name: "Export to link" }).click();
    const exportSamples = [];
    for (let index = 0; index < 80; index += 1) {
      const sample = await page.evaluate(() => ({
        hasResult: Boolean(document.querySelector('[aria-label="Export link"]')),
        modalText: document.querySelector(".share-modal")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        toastText: document.querySelector(".app-toast")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      }));
      exportSamples.push(sample);
      if (sample.hasResult || (!sample.modalText && sample.toastText)) break;
      await page.waitForTimeout(100);
    }
    if (!exportSamples.at(-1)?.hasResult) {
      const payloadDebug = await page.evaluate(async () => {
        const [{ useWorkspaceStore }, snapshotModule, storageModule] = await Promise.all([
          import("/src/stores/workspaceStore.ts"),
          import("/src/share/shareSnapshotPayload.ts"),
          import("/src/workspaceStorage.ts"),
        ]);
        const state = useWorkspaceStore.getState();
        const files = state.files.map(({ id, parentId, title }) => ({ id, parentId, title }));
        const folders = state.folders.map(({ id, parentId, title }) => ({ id, parentId, title }));
        try {
          snapshotModule.createShareSnapshotPayload({
            files: state.files,
            folders: state.folders,
            rootFolderId: storageModule.WORKSPACE_ROOT_FOLDER_ID,
            activeFileId: state.activeFileId,
            commentsByFileId: {},
          });
          return { error: "", files, folders };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : String(error),
            files,
            folders,
          };
        }
      });
      throw new Error(
        `Export to link did not render a result.\n${JSON.stringify({ exportSamples, payloadDebug, responseStatuses }, null, 2)}`,
      );
    }

    const firstExportUrl = await page.locator('[aria-label="Export link"]').getAttribute("title");
    expect(Boolean(firstExportUrl), "Export to link should create an Export link URL.");
    await page.getByRole("button", { name: "Close share dialog" }).click();
    await page.getByTitle("New document").click();
    await page.locator(".share-trigger").click();
    expect(
      (await page.getByRole("button", { name: "Export to link" }).count()) === 1,
      "Changing the workspace should invalidate the previous Export link.",
    );
    const exportedActiveFileName = await page.locator(".tab-item.active").getAttribute("data-file-name");
    expect(Boolean(exportedActiveFileName), "Export link smoke should identify the active document.");
    await page.getByRole("button", { name: "Export to link" }).click();
    await page.locator('[aria-label="Export link"]').waitFor({ state: "visible" });
    const exportUrl = await page.locator('[aria-label="Export link"]').getAttribute("title");
    expect(Boolean(exportUrl), "Export to link should create an Export link URL.");
    expect(exportUrl !== firstExportUrl, "Re-exporting a changed workspace should create a new immutable link.");

    const parsedExportUrl = new URL(exportUrl);
    const [snapshotId, exportKey] = parsedExportUrl.hash.replace(/^#json=/, "").split(",");
    expect(parsedExportUrl.origin === baseUrl, "Export links should point at the current Tabula.md origin.");
    expect(parsedExportUrl.pathname === "/", "Export links should keep the app root path.");
    expect(parsedExportUrl.hash.startsWith("#json="), "Export links should use the #json fragment.");
    expect(Boolean(snapshotId), "Export links should include a snapshot id in the hash fragment.");
    expect(Boolean(exportKey), "Export links should include a local decryption key in the hash fragment.");
    expect(
      requestUrls.every((url) => !url.includes(exportKey)),
      "Export link creation should not send the local decryption key to the app or JSON store.",
    );

    const secondContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const secondPage = await secondContext.newPage();
    try {
      const secondRequestUrls = [];
      secondPage.on("request", (request) => secondRequestUrls.push(request.url()));
      await secondPage.goto(baseUrl);
      await secondPage.getByTitle("New document").click();
      await waitForEditorReady(secondPage, { mode: "edit" });
      await focusMarkdownEditor(secondPage);
      await secondPage.keyboard.type("\n\nLocal draft before import.");
      await waitForSavedLocally(secondPage);

      await secondPage.locator(".share-trigger").click();
      await waitForShareDialogState(secondPage, { panel: "Share link" });
      await secondPage.evaluate((hash) => {
        window.location.hash = hash;
      }, parsedExportUrl.hash);
      await waitForText(secondPage.locator(".share-modal"), "Open export link");
      expect(
        (await secondPage.locator('.share-modal[aria-modal="true"]').count()) === 1,
        "Opening an Export link should replace Share instead of stacking two modals.",
      );
      await waitForText(secondPage.locator(".share-modal"), "Opening it replaces this local workspace.");
      await secondPage.getByRole("button", { name: "Open copy" }).click();
      await secondPage.locator(".share-modal").waitFor({ state: "detached" });
      await secondPage.waitForSelector(`.tab-item.active[data-file-name="${exportedActiveFileName}"]`);
      await secondPage.locator(`.tab-item[data-file-name="${contentFileName}"] .tab-select-button`).click();
      try {
        await waitForText(secondPage.locator(".cm-content"), "Export link import body.");
      } catch (error) {
        const importDebug = await secondPage.evaluate(() => ({
          activeTab: document.querySelector(".tab-item.active")?.textContent ?? "",
          editorText: Array.from(document.querySelectorAll(".cm-content .cm-line")).map(
            (line) => line.textContent ?? "",
          ),
          tabText: document.querySelector(".tabbar")?.textContent ?? "",
        }));
        throw new Error(`Export link import did not render expected body.\n${JSON.stringify(importDebug, null, 2)}\n${error.message}`);
      }
      expect(
        secondRequestUrls.every((url) => !url.includes(exportKey)),
        "Export link import should not send the local decryption key to the app or JSON store.",
      );
      await waitForSavedLocally(secondPage);
      await secondPage.reload();
      await secondPage.waitForSelector(".tabbar");
      await waitForText(secondPage.locator(".cm-content"), "Export link import body.");
      expect(
        (await secondPage.locator(".share-modal").count()) === 0,
        "Reloading after Export link import should restore the local workspace without reopening import UI.",
      );

      await secondPage.goto(`${baseUrl}/#json=${snapshotId}`);
      await waitForText(secondPage.locator(".share-modal"), "Unable to open link");
      await waitForText(secondPage.locator(".share-modal"), "This export link is missing its client-only key.");
      await secondPage.goto(`${baseUrl}/#json=${snapshotId},not-a-32-byte-key`);
      await waitForText(secondPage.locator(".share-modal"), "Unable to open link");
      await waitForText(secondPage.locator(".share-modal"), "This export link has an invalid client-only key.");
    } finally {
      await secondContext.close();
    }
  });
}

const waitForJsonHealth = async (jsonUrl) => {
  const deadline = Date.now() + 20_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${jsonUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${jsonUrl}/health${lastError ? `: ${lastError.message}` : ""}`);
};
