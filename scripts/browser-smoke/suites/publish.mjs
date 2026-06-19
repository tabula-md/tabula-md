export const id = "publish";
export const description = "Server-backed publish snapshots, public artifacts, and vanity page restore.";
export const requiresPublishService = true;

export async function run(ctx) {
  const { baseUrl, browser, expect, publishUrl, waitForText, withPage } = ctx;

  expect(Boolean(publishUrl), "Publish smoke requires a configured publish service URL.");

  await withPage(browser, "/", async (page) => {
    await page.evaluate(() => {
      window.__tabulaClipboard = [];
      navigator.clipboard.writeText = async (text) => {
        window.__tabulaClipboard.push(text);
      };
    });

    await page.locator(".share-trigger").click();
    await page.getByRole("tab", { name: "Publish" }).click();
    await page.getByRole("button", { name: "Publish snapshot" }).click();
    await waitForText(page.locator(".app-toast"), "Snapshot published.");

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

    const publicContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    try {
      const vanityPage = await publicContext.newPage();
      await vanityPage.goto(publishedUrls.page);
      await vanityPage.waitForSelector(".published-page", { timeout: 5_000 });
      expect(
        (await vanityPage.locator(".published-header").textContent())?.includes("Tabula.md"),
        "Vanity page should restore from the publish service without localStorage.",
      );
      expect(
        (await vanityPage.locator(".published-document").textContent())?.includes("Tabula.md"),
        "Vanity page should render the published Markdown document.",
      );
    } finally {
      await publicContext.close();
    }
  });
}
