export const id = "json-share";
export const description = "Encrypted shareable link export and import.";
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
    page.on("request", (request) => requestUrls.push(request.url()));

    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.type("\n\n# Snapshot Smoke\n\nSnapshot import body.");
    await waitForSavedLocally(page);

    await page.locator(".share-trigger").click();
    await waitForShareDialogState(page, { panel: "Share link" });
    await page.getByRole("button", { name: "Export to link" }).click();
    await page.waitForSelector('a[aria-label="Shareable link"]', { timeout: 8_000 });

    const snapshotUrl = await page.locator('a[aria-label="Shareable link"]').getAttribute("href");
    expect(Boolean(snapshotUrl), "Export to link should create a shareable URL.");

    const parsedSnapshotUrl = new URL(snapshotUrl);
    const [, snapshotKey] = parsedSnapshotUrl.hash.replace(/^#json=/, "").split(",");
    expect(parsedSnapshotUrl.origin === baseUrl, "Shareable links should point at the current Tabula.md origin.");
    expect(parsedSnapshotUrl.pathname === "/", "Shareable links should keep the app root path.");
    expect(parsedSnapshotUrl.hash.startsWith("#json="), "Shareable links should use the #json fragment.");
    expect(Boolean(snapshotKey), "Shareable links should include a local decryption key in the hash fragment.");
    expect(
      requestUrls.every((url) => !url.includes(snapshotKey)),
      "Snapshot export should not send the local decryption key to the app or JSON store.",
    );

    const secondContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const secondPage = await secondContext.newPage();
    try {
      const secondRequestUrls = [];
      secondPage.on("request", (request) => secondRequestUrls.push(request.url()));
      await secondPage.goto(baseUrl);
      await secondPage.getByTitle("New tab").click();
      await waitForEditorReady(secondPage, { mode: "edit" });
      await focusMarkdownEditor(secondPage);
      await secondPage.keyboard.type("\n\nLocal draft before import.");
      await waitForSavedLocally(secondPage);

      await secondPage.goto(`${baseUrl}${parsedSnapshotUrl.hash}`);
      await waitForText(secondPage.locator(".share-modal"), "Load from link");
      await waitForText(secondPage.locator(".share-modal"), "Loading this link will replace your current local content.");
      await secondPage.getByRole("button", { name: "Load copy" }).click();
      await secondPage.locator(".share-modal").waitFor({ state: "detached" });
      await waitForText(secondPage.locator(".cm-content"), "Snapshot import body.");
      expect(
        secondRequestUrls.every((url) => !url.includes(snapshotKey)),
        "Snapshot import should not send the local decryption key to the app or JSON store.",
      );
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
