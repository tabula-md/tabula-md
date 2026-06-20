export const id = "publish";
export const description = "Server-backed published pages, included AI-readable outputs, and vanity page restore.";
export const requiresPublishService = true;

export async function run(ctx) {
  const { baseUrl, browser, expect, focusMarkdownEditor, publishUrl, waitForText, withPage } = ctx;

  expect(Boolean(publishUrl), "Publish smoke requires a configured publish service URL.");

  await withPage(browser, "/", async (page) => {
    await page.evaluate(() => {
      window.__tabulaClipboard = [];
      navigator.clipboard.writeText = async (text) => {
        window.__tabulaClipboard.push(text);
      };
    });

    await page.getByTitle("New tab").click();
    await focusMarkdownEditor(page);
    await page.keyboard.insertText("# Secondary public file\n\nSecondary published file marker.");
    await page.locator('.tab-item[data-file-name="README.md"] .tab-select-button').click();

    await page.locator(".share-trigger").click();
    await page.getByRole("tab", { name: "Publish" }).click();
    expect((await page.getByText("AI-readable outputs included", { exact: true }).count()) === 1, "Publish should treat AI outputs as included.");
    expect((await page.getByText("Project snapshot").count()) === 0, "Publish should not lead with snapshot language.");
    await page.getByRole("button", { name: "Publish" }).click();
    await waitForText(page.locator(".app-toast"), "Page published.");

    const publishedUrls = await page.evaluate(() => ({
      page: document.querySelector('[data-testid="publish-page-url"]')?.textContent?.trim() ?? "",
      llms: document.querySelector('[data-testid="publish-llms-url"]')?.textContent?.trim() ?? "",
      llmsFull: document.querySelector('[data-testid="publish-llms-full-url"]')?.textContent?.trim() ?? "",
    }));
    const publishId = publishedUrls.page.match(/\/p\/([^/]+)$/)?.[1] ?? "";
    const servicePageUrl = `${publishUrl}/p/${publishId}`;

    expect(publishId.length > 0, "Server-backed publish should create a publish id.");
    expect(publishedUrls.page === `${baseUrl}/p/${publishId}`, "Publish should show the app vanity page URL.");
    expect(publishedUrls.llms === `${servicePageUrl}/llms.txt`, "Publish should show the service llms.txt URL.");
    expect(
      publishedUrls.llmsFull === `${servicePageUrl}/llms-full.txt`,
      "Publish should show the service llms-full.txt URL.",
    );

    const publicJsonResponse = await fetch(`${publishUrl}/v1/publishes/${publishId}`);
    expect(publicJsonResponse.ok, "Publish service should expose public snapshot JSON.");
    const publicSnapshot = await publicJsonResponse.json();
    expect(publicSnapshot.publishId === publishId, "Public snapshot JSON should match the published id.");
    expect(!("ownerToken" in publicSnapshot), "Public snapshot JSON must not expose the owner token.");
    expect(publicSnapshot.files?.[0]?.text?.includes("Tabula.md"), "Public snapshot JSON should include Markdown text.");
    const secondaryFile = publicSnapshot.files?.find((file) => file.text?.includes("Secondary published file marker."));
    expect(Boolean(secondaryFile?.id && secondaryFile?.title), "Public snapshot JSON should include the secondary Markdown file.");

    const servicePageResponse = await fetch(servicePageUrl);
    const servicePageHtml = await servicePageResponse.text();
    expect(servicePageResponse.headers.get("content-type")?.includes("text/html"), "Service page should be HTML.");
    expect(servicePageHtml.includes("README.md"), "Service page should include the published file title.");

    const llmsResponse = await fetch(publishedUrls.llms);
    const llmsText = await llmsResponse.text();
    expect(llmsResponse.headers.get("content-type")?.includes("text/plain"), "llms.txt should be text/plain.");
    expect(llmsText.includes("Use llms-full.txt"), "llms.txt should include the compact agent index.");

    const fullResponse = await fetch(publishedUrls.llmsFull);
    const fullText = await fullResponse.text();
    expect(fullResponse.headers.get("content-type")?.includes("text/plain"), "llms-full.txt should be text/plain.");
    expect(fullText.includes("## README.md"), "llms-full.txt should include the full Markdown context.");

    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.insertText("# Republished README\n\nRepublished marker for server-backed publish.");

    await page.locator(".share-trigger").click();
    await page.getByRole("tab", { name: "Publish" }).click();
    await page.getByRole("button", { name: "Update published page" }).click();
    await waitForText(page.locator(".app-toast"), "Published page updated.");

    const republishedUrls = await page.evaluate(() => ({
      page: document.querySelector('[data-testid="publish-page-url"]')?.textContent?.trim() ?? "",
      llms: document.querySelector('[data-testid="publish-llms-url"]')?.textContent?.trim() ?? "",
      llmsFull: document.querySelector('[data-testid="publish-llms-full-url"]')?.textContent?.trim() ?? "",
    }));
    expect(republishedUrls.page === publishedUrls.page, "Updating the published page should keep the same app vanity URL.");
    expect(republishedUrls.llms === publishedUrls.llms, "Updating the published page should keep the same llms.txt URL.");
    expect(republishedUrls.llmsFull === publishedUrls.llmsFull, "Updating the published page should keep the same llms-full.txt URL.");

    const republishedJsonResponse = await fetch(`${publishUrl}/v1/publishes/${publishId}`);
    const republishedSnapshot = await republishedJsonResponse.json();
    expect(
      republishedSnapshot.files?.[0]?.text?.includes("Republished marker for server-backed publish."),
      "Updating the published page should update the public content.",
    );
    const republishedLlmsFull = await (await fetch(republishedUrls.llmsFull)).text();
    expect(
      republishedLlmsFull.includes("Republished marker for server-backed publish."),
      "Updating the published page should update the service llms-full.txt output.",
    );

    let failedUpdateRequests = 0;
    await page.route(`${publishUrl}/v1/publishes/${publishId}`, async (route) => {
      if (route.request().method() !== "PUT") {
        await route.fallback();
        return;
      }

      failedUpdateRequests += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Simulated failure" }),
      });
    });
    await page.keyboard.press("Escape");
    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.insertText("# Failed Update\n\nThis edit should remain local after a failed published-page update.");
    await page.locator(".share-trigger").click();
    await page.getByRole("tab", { name: "Publish" }).click();
    await page.getByRole("button", { name: "Update published page" }).click();
    await waitForText(page.locator(".app-toast"), "Publish failed: Simulated failure");
    expect(failedUpdateRequests === 1, "Failed published-page update smoke should intercept one PUT request.");
    const failedUrls = await page.evaluate(() => ({
      page: document.querySelector('[data-testid="publish-page-url"]')?.textContent?.trim() ?? "",
      editorText: document.querySelector(".cm-content")?.textContent ?? "",
    }));
    expect(failedUrls.page === publishedUrls.page, "Failed published-page update should preserve the previous published URL.");
    expect(
      failedUrls.editorText.includes("This edit should remain local after a failed published-page update."),
      "Failed published-page update should preserve the user's local document edit.",
    );
    const afterFailureSnapshot = await (await fetch(`${publishUrl}/v1/publishes/${publishId}`)).json();
    expect(
      afterFailureSnapshot.files?.[0]?.text?.includes("Republished marker for server-backed publish."),
      "Failed published-page update should not overwrite the stored publish snapshot.",
    );
    expect(
      !afterFailureSnapshot.files?.[0]?.text?.includes("This edit should remain local after a failed published-page update."),
      "Failed published-page update should not publish failed-attempt content.",
    );
    await page.unroute(`${publishUrl}/v1/publishes/${publishId}`);

    const publicContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      const vanityPage = await publicContext.newPage();
      await vanityPage.goto(publishedUrls.page);
      await vanityPage.waitForSelector(".published-page", { timeout: 5_000 });
      expect(
        (await vanityPage.locator(".published-header").textContent())?.includes("README.md"),
        "Vanity page should restore from the publish service without localStorage.",
      );
      expect(
        (await vanityPage.locator(".published-document").textContent())?.includes("Republished marker for server-backed publish."),
        "Vanity page should render the published Markdown document.",
      );
      expect(
        !((await vanityPage.locator(".published-document").textContent()) ?? "").includes(
          "This edit should remain local after a failed published-page update.",
        ),
        "Vanity page should not render failed-attempt Markdown.",
      );
      await vanityPage.getByRole("link", { name: secondaryFile.title }).click();
      await vanityPage.waitForFunction((fileId) => new URL(window.location.href).searchParams.get("file") === fileId, secondaryFile.id);
      expect(
        (await vanityPage.locator(".published-header h1").textContent())?.trim() === secondaryFile.title,
        "Vanity page heading should match the selected published file.",
      );
      expect((await vanityPage.title()).includes(secondaryFile.title), "Vanity page title should match the selected published file.");
      expect(
        (await vanityPage.locator(".published-file-list a.active").textContent())?.trim() === secondaryFile.title,
        "Vanity page file list should mark the selected file active.",
      );
      expect(
        (await vanityPage.locator(".published-document").textContent())?.includes("Secondary published file marker."),
        "Vanity page should render the selected file content.",
      );
    } finally {
      await publicContext.close();
    }

    let failedUnpublishRequests = 0;
    await page.route(`${publishUrl}/v1/publishes/${publishId}`, async (route) => {
      if (route.request().method() !== "DELETE") {
        await route.fallback();
        return;
      }

      failedUnpublishRequests += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Simulated unpublish failure" }),
      });
    });
    page.once("dialog", async (dialog) => {
      expect(dialog.message().includes("Unpublish this page?"), "Unpublish should ask for confirmation.");
      await dialog.accept();
    });
    await page.getByRole("button", { name: "Unpublish" }).click();
    await waitForText(page.locator(".app-toast"), "Publish failed: Simulated unpublish failure");
    expect(failedUnpublishRequests === 1, "Failed unpublish smoke should intercept one DELETE request.");
    expect((await page.locator('[aria-label="Published URLs"]').count()) === 1, "Failed unpublish should keep published URLs visible.");
    expect((await fetch(`${publishUrl}/v1/publishes/${publishId}`)).ok, "Failed unpublish should keep the public snapshot stored.");
    await page.unroute(`${publishUrl}/v1/publishes/${publishId}`);

    page.once("dialog", async (dialog) => {
      expect(dialog.message().includes("AI-readable outputs"), "Unpublish confirmation should describe included AI outputs.");
      await dialog.accept();
    });
    await page.getByRole("button", { name: "Unpublish" }).click();
    await waitForText(page.locator(".app-toast"), "Page unpublished.");
    expect((await page.locator('[aria-label="Published URLs"]').count()) === 0, "Unpublish should clear published URLs from the UI.");
    expect((await page.locator('[aria-label="AI-readable output URLs"]').count()) === 0, "Unpublish should clear secondary output URLs from the UI.");
    expect((await fetch(`${publishUrl}/v1/publishes/${publishId}`)).status === 404, "Unpublish should remove public JSON.");
    expect((await fetch(servicePageUrl)).status === 404, "Unpublish should remove the public HTML page.");
    expect((await fetch(publishedUrls.llms)).status === 404, "Unpublish should remove llms.txt.");
    expect((await fetch(publishedUrls.llmsFull)).status === 404, "Unpublish should remove llms-full.txt.");
  });
}
