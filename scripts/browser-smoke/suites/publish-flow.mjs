export const id = "publish";
export const description = "Server-backed published pages, included AI-readable outputs, and vanity page restore.";
export const requiresPublishService = true;

export async function run(ctx) {
  const { baseUrl, browser, expect, focusMarkdownEditor, publishUrl, waitForShareDialogState, waitForText, withPage } = ctx;
  const getPublishedFileDisplayTitle = (title) => title.replace(/\.(?:md|markdown)$/i, "");
  const switchToEditMode = async (page) => {
    const editButton = page.getByRole("button", { name: "Edit", exact: true });
    if ((await editButton.count()) > 0) {
      await editButton.click();
    }
    await focusMarkdownEditor(page);
  };

  expect(Boolean(publishUrl), "Publish smoke requires a configured publish service URL.");

  await withPage(browser, "/", async (page) => {
    await page.evaluate(() => {
      window.localStorage.setItem(
        "tabula.identity",
        JSON.stringify({ id: "smoke-user", name: "Taeha", color: "#7c8bff", lastSeen: Date.now() }),
      );
      window.location.reload();
    });
    await page.waitForSelector(".tabbar");
    await page.evaluate(() => {
      window.__tabulaClipboard = [];
      navigator.clipboard.writeText = async (text) => {
        window.__tabulaClipboard.push(text);
      };
    });

    await page.locator('.tab-item[data-file-name="Untitled.md"] .tab-select-button').click();
    await focusMarkdownEditor(page);
    await page.keyboard.insertText(`---
description: Secondary public context
---

# Secondary public file

Secondary published file marker.`);
    await page.locator('.tab-item[data-file-name="README.md"] .tab-select-button').click();
    await switchToEditMode(page);
    await page.keyboard.press("ControlOrMeta+End");
    await page.keyboard.insertText("\n\nSoft publish line one\nsoft publish line two");

    await page.locator(".share-trigger").click();
    await page.getByRole("tab", { name: "Publish" }).click();
    await waitForShareDialogState(page, { panel: "Publish" });
    expect((await page.getByRole("radio", { name: /Current page/ }).count()) === 1, "Publish should offer current-page scope.");
    expect((await page.getByRole("radio", { name: /Project/ }).count()) === 1, "Publish should offer project scope.");
    expect(
      (await page.getByRole("radio", { name: /Current page/ }).getAttribute("aria-checked")) === "true",
      "Publish should default to current-page scope.",
    );
    expect((await page.getByText("AI-readable outputs included", { exact: true }).count()) === 0, "Publish should hide AI output labels.");
    expect((await page.getByRole("button", { name: "Copy llms.txt" }).count()) === 0, "Publish should hide llms copy actions.");
    expect((await page.getByRole("button", { name: "Download bundle" }).count()) === 0, "Publish should hide bundle download actions.");
    expect((await page.getByText("Project snapshot").count()) === 0, "Publish should not lead with snapshot language.");
    expect((await page.getByText("Ready to publish", { exact: true }).count()) === 1, "Publish should show pre-publish readiness.");
    expect(
      (await page.getByText("Creates one read-only public URL for this page.", { exact: true }).count()) === 1,
      "Publish should preview the public-page result before publishing.",
    );
    expect((await page.getByText("Public URL", { exact: true }).count()) === 0, "Publish should not show a URL before publishing.");
    await page.getByRole("button", { name: "Publish current page" }).click();
    await waitForText(page.locator(".app-toast"), "Page published.");
    const publishManagement = page.locator(".publish-management-box");
    expect(
      (await publishManagement.getByText("Live", { exact: true }).count()) === 1,
      "Published state should show the public page is live.",
    );
    expect(
      (await publishManagement.getByText("Public URL", { exact: true }).count()) === 1,
      "Published state should expose the public URL as status information.",
    );
    expect(
      (await publishManagement.getByText("Last updated").count()) === 1,
      "Published state should show when the page was last updated.",
    );
    expect(
      (await page.getByText(/Published as current page:/).count()) === 1,
      "Published state should summarize the current published scope.",
    );
    expect(
      (await page.getByRole("radio", { name: /Project/ }).count()) === 0,
      "Published state should hide scope cards by default.",
    );
    expect(
      (await page.getByRole("button", { name: "Update current page" }).count()) === 1,
      "Published state should update the current page.",
    );
    expect((await page.getByRole("button", { name: "Change scope" }).count()) === 1, "Published state should make scope changes explicit.");

    const publishedUrls = {
      page: (await page.getByRole("link", { name: "View page" }).getAttribute("href")) ?? "",
    };
    const publishId = publishedUrls.page.match(/\/p\/([^/]+)$/)?.[1] ?? "";
    const servicePageUrl = `${publishUrl}/p/${publishId}`;
    publishedUrls.llms = `${servicePageUrl}/llms.txt`;
    publishedUrls.llmsFull = `${servicePageUrl}/llms-full.txt`;

    expect(publishId.length > 0, "Server-backed publish should create a publish id.");
    expect(publishedUrls.page === `${baseUrl}/p/${publishId}`, "Publish should show the app vanity page URL.");

    const publicJsonResponse = await fetch(`${publishUrl}/v1/publishes/${publishId}`);
    expect(publicJsonResponse.ok, "Publish service should expose public snapshot JSON.");
    const publicSnapshot = await publicJsonResponse.json();
    expect(publicSnapshot.publishId === publishId, "Public snapshot JSON should match the published id.");
    expect(!("ownerToken" in publicSnapshot), "Public snapshot JSON must not expose the owner token.");
    expect(publicSnapshot.ownerName === "Taeha", "Public snapshot JSON should preserve the publishing user name.");
    expect(publicSnapshot.fileCount === 1, "Current-page publish should include one file.");
    expect(publicSnapshot.files?.[0]?.text?.includes("Tabula.md"), "Current-page publish should include the active Markdown text.");
    expect(
      publicSnapshot.files?.[0]?.text?.includes("Soft publish line one\nsoft publish line two"),
      "Current-page publish should preserve source soft line breaks.",
    );
    expect(
      !publicSnapshot.files?.some((file) => file.text?.includes("Secondary published file marker.")),
      "Current-page publish should not include the secondary Markdown file.",
    );

    const publishedContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const publishedPage = await publishedContext.newPage();
    try {
      await publishedPage.goto(publishedUrls.page);
      await publishedPage.waitForSelector(".published-document .preview-document-content", { timeout: 8_000 });
      const publishedSoftLineBreakState = await publishedPage.evaluate(() => {
        const paragraph = Array.from(document.querySelectorAll(".published-document p")).find((node) =>
          (node.textContent ?? "").includes("Soft publish line one"),
        );
        return {
          text: paragraph?.textContent ?? "",
          breakCount: paragraph?.querySelectorAll("br").length ?? 0,
        };
      });
      expect(
        publishedSoftLineBreakState.text.includes("Soft publish line one\nsoft publish line two") &&
          publishedSoftLineBreakState.breakCount >= 1,
        "Published page should render soft line breaks the same way as in-app preview.",
      );
    } finally {
      await publishedContext.close();
    }

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
    expect(!fullText.includes("Secondary published file marker."), "Current-page llms-full.txt should not include project-only files.");

    await page.getByRole("button", { name: "Change scope" }).click();
    expect(
      (await page.getByRole("radio", { name: /Current page/ }).getAttribute("aria-checked")) === "true",
      "Scope changes should start from the current published scope.",
    );
    await page.getByRole("radio", { name: /Project/ }).click();
    expect(
      (await page.getByText(/replace the existing current-page publish with a project publish/i).count()) === 1,
      "Converting scope should explain that the same URL will be replaced.",
    );
    expect(
      (await page.getByText("Ready to replace", { exact: true }).count()) === 1,
      "Scope conversion should read as a managed replacement action.",
    );
    await page.getByRole("button", { name: "Republish as project" }).click();
    await waitForText(page.locator(".app-toast"), "Published page updated.");
    expect(
      (await page.getByText(/Published as a project:/).count()) === 1,
      "Published state should summarize project scope after conversion.",
    );
    expect(
      (await page.getByRole("button", { name: "Update project" }).count()) === 1,
      "Project published state should update the project.",
    );
    const projectSnapshot = await (await fetch(`${publishUrl}/v1/publishes/${publishId}`)).json();
    const secondaryFile = projectSnapshot.files?.find((file) => file.text?.includes("Secondary published file marker."));
    expect(projectSnapshot.ownerName === "Taeha", "Project republish should preserve the publishing user name.");
    expect(projectSnapshot.fileCount > publicSnapshot.fileCount, "Project publish should include more than the current page.");
    expect(Boolean(secondaryFile?.id && secondaryFile?.title), "Project publish should include the secondary Markdown file.");

    await page.keyboard.press("Escape");
    await switchToEditMode(page);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.insertText("# Republished README\n\nRepublished marker for server-backed publish.");

    await page.locator(".share-trigger").click();
    await page.getByRole("tab", { name: "Publish" }).click();
    await waitForShareDialogState(page, { panel: "Publish" });
    await page.getByRole("button", { name: "Update project" }).click();
    await waitForText(page.locator(".app-toast"), "Published page updated.");

    const republishedUrls = {
      page: (await page.getByRole("link", { name: "View page" }).getAttribute("href")) ?? "",
      llms: publishedUrls.llms,
      llmsFull: publishedUrls.llmsFull,
    };
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
    await waitForShareDialogState(page, { panel: "Publish" });
    await page.getByRole("button", { name: "Update project" }).click();
    await waitForText(page.locator(".app-toast"), "Publish failed: Simulated failure");
    expect(failedUpdateRequests === 1, "Failed published-page update smoke should intercept one PUT request.");
    const failedUrls = await page.evaluate((pageUrl) => ({
      page: pageUrl,
      editorText: document.querySelector(".cm-content")?.textContent ?? "",
    }), publishedUrls.page);
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
        (await vanityPage.locator(".published-document").textContent())?.includes("Republished marker for server-backed publish."),
        "Vanity page should restore from the publish service without localStorage.",
      );
      expect(
        (await vanityPage.locator(".published-document h1").textContent())?.trim() === "Republished README",
        "Vanity page should use the Markdown body heading, not the file name.",
      );
      expect((await vanityPage.getByRole("link", { name: "llms.txt" }).count()) === 0, "Vanity page should hide llms.txt links.");
      expect(
        (await vanityPage.getByRole("link", { name: "llms-full.txt" }).count()) === 0,
        "Vanity page should hide llms-full.txt links.",
      );
      expect(
        ((await vanityPage.locator(".published-footer").textContent()) ?? "").includes("Powered by") &&
          ((await vanityPage.locator(".published-footer").textContent()) ?? "").includes("Tabula"),
        "Vanity page should include the Powered by Tabula footer.",
      );
      expect(
        (await vanityPage.locator(".published-meta-bar").count()) === 0,
        "Vanity page should not show a Published with Tabula header.",
      );
      const projectPublishedLayout = await vanityPage.evaluate(() => {
        const article = document.querySelector(".published-article-shell");
        const footer = document.querySelector(".published-footer");
        const footerLogo = document.querySelector(".published-footer-logo");
        const articleRect = article?.getBoundingClientRect();
        const footerRect = footer?.getBoundingClientRect();
        const footerStyle = footer ? window.getComputedStyle(footer) : null;
        const footerLogoStyle = footerLogo ? window.getComputedStyle(footerLogo) : null;

        return {
          articleCenter: articleRect ? Math.round(articleRect.left + articleRect.width / 2) : 0,
          articleWidth: articleRect ? Math.round(articleRect.width) : 0,
          viewportCenter: Math.round(window.innerWidth / 2),
          footerCenter: footerRect ? Math.round(footerRect.left + footerRect.width / 2) : 0,
          footerBottomOffset: footerRect ? Math.round(window.innerHeight - footerRect.bottom) : 0,
          footerWidth: footerRect ? Math.round(footerRect.width) : 0,
          footerPosition: footerStyle?.position ?? "",
          footerBackgroundColor: footerStyle?.backgroundColor ?? "",
          footerColor: footerStyle?.color ?? "",
          footerFontSize: footerStyle?.fontSize ?? "",
          footerBorderTopWidth: footerStyle?.borderTopWidth ?? "",
          footerBorderRightWidth: footerStyle?.borderRightWidth ?? "",
          footerBorderBottomWidth: footerStyle?.borderBottomWidth ?? "",
          footerBorderLeftWidth: footerStyle?.borderLeftWidth ?? "",
          footerBorderRadius: footerStyle?.borderRadius ?? "",
          footerLogoColor: footerLogoStyle?.color ?? "",
        };
      });
      expect(
        Math.abs(projectPublishedLayout.articleCenter - projectPublishedLayout.viewportCenter) <= 2,
        "Project publish should keep the document column centered instead of shifting it for contents navigation.",
      );
      expect(
        Math.abs(projectPublishedLayout.footerCenter - projectPublishedLayout.viewportCenter) <= 2 &&
          projectPublishedLayout.footerWidth < projectPublishedLayout.articleWidth / 2 &&
          projectPublishedLayout.footerPosition === "fixed" &&
          Math.abs(projectPublishedLayout.footerBottomOffset - 24) <= 2 &&
          projectPublishedLayout.footerBackgroundColor !== "rgba(0, 0, 0, 0)" &&
          Number.parseFloat(projectPublishedLayout.footerBorderTopWidth) === 0 &&
          Number.parseFloat(projectPublishedLayout.footerBorderRightWidth) === 0 &&
          Number.parseFloat(projectPublishedLayout.footerBorderBottomWidth) === 0 &&
          Number.parseFloat(projectPublishedLayout.footerBorderLeftWidth) === 0 &&
          Number.parseFloat(projectPublishedLayout.footerBorderRadius) === 8 &&
          Number.parseFloat(projectPublishedLayout.footerFontSize) === 14 &&
          projectPublishedLayout.footerLogoColor === projectPublishedLayout.footerColor,
        "Project publish footer should render as a viewport-bottom centered filled Powered by badge.",
      );
      expect(
        (await vanityPage.getByText("Project pages", { exact: true }).count()) === 0,
        "Project publish should not render a top chip list.",
      );
      expect(
        (await vanityPage.locator(".published-contents-sidebar").count()) === 1,
        "Project publish should render desktop contents navigation.",
      );
      const projectRail = await vanityPage.evaluate(() => ({
        rootText: document.querySelector(".published-file-tree-root")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        linkTexts: Array.from(document.querySelectorAll(".published-file-list a")).map(
          (link) => link.textContent?.replace(/\s+/g, " ").trim() ?? "",
        ),
        linkIconCounts: Array.from(document.querySelectorAll(".published-file-list a")).map(
          (link) => link.querySelectorAll("svg").length,
        ),
        contentsLabelCount: Array.from(document.querySelectorAll(".published-file-list, .published-contents-menu")).filter(
          (node) => node.textContent?.includes("Contents"),
        ).length,
        previewSurface: document.querySelector(".published-document")?.classList.contains("preview-surface") ?? false,
      }));
      expect(projectRail.rootText === "Taeha's Project", "Project publish contents should use the publishing user's Project label.");
      expect(
        projectRail.linkTexts.length > 1 && projectRail.linkTexts.every((text) => !/\.(md|markdown)$/i.test(text)),
        "Project publish file links should hide Markdown extensions like the app file tree.",
      );
      expect(
        projectRail.linkIconCounts.every((count) => count === 1),
        "Project publish file links should use document icons like the app file tree.",
      );
      expect(projectRail.contentsLabelCount === 0, "Project publish should not use a generic Contents label.");
      expect(projectRail.previewSurface, "Published Markdown should use the same preview surface class as app Preview.");
      await vanityPage.getByRole("button", { name: "Taeha's Project" }).click();
      expect(
        (await vanityPage.locator(".published-file-list a").count()) === 0,
        "Project publish desktop file tree should collapse from its root row.",
      );
      await vanityPage.getByRole("button", { name: "Taeha's Project" }).click();
      expect(
        (await vanityPage.locator(".published-file-list a").count()) === projectRail.linkTexts.length,
        "Project publish desktop file tree should expand from its root row.",
      );
      expect(
        !((await vanityPage.locator(".published-document").textContent()) ?? "").includes(
          "This edit should remain local after a failed published-page update.",
        ),
        "Vanity page should not render failed-attempt Markdown.",
      );
      const secondaryFileDisplayTitle = getPublishedFileDisplayTitle(secondaryFile.title);
      await vanityPage.getByRole("link", { name: secondaryFileDisplayTitle }).click();
      await vanityPage.waitForFunction((fileId) => new URL(window.location.href).searchParams.get("file") === fileId, secondaryFile.id);
      expect(
        (await vanityPage.locator(".published-document h1").textContent())?.trim() === "Secondary public file",
        "Vanity page heading should come from the selected file body.",
      );
      expect(
        ((await vanityPage.locator(".published-document .frontmatter-view").textContent()) ?? "").includes(
          "Secondary public context",
        ),
        "Vanity page should render frontmatter with the same Preview surface contract.",
      );
      expect((await vanityPage.title()).includes("Secondary public file"), "Vanity page title should match the selected file body.");
      expect(
        (await vanityPage.locator(".published-file-list a.active").textContent())?.trim() === secondaryFileDisplayTitle,
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
    expect((await page.getByRole("link", { name: "View page" }).count()) === 1, "Failed unpublish should keep published page actions visible.");
    expect((await fetch(`${publishUrl}/v1/publishes/${publishId}`)).ok, "Failed unpublish should keep the public snapshot stored.");
    await page.unroute(`${publishUrl}/v1/publishes/${publishId}`);

    page.once("dialog", async (dialog) => {
      expect(dialog.message().includes("AI-readable outputs"), "Unpublish confirmation should describe included AI outputs.");
      await dialog.accept();
    });
    await page.getByRole("button", { name: "Unpublish" }).click();
    await waitForText(page.locator(".app-toast"), "Page unpublished.");
    expect((await page.getByRole("link", { name: "View page" }).count()) === 0, "Unpublish should clear published page actions from the UI.");
    expect((await fetch(`${publishUrl}/v1/publishes/${publishId}`)).status === 404, "Unpublish should remove public JSON.");
    expect((await fetch(servicePageUrl)).status === 404, "Unpublish should remove the public HTML page.");
    expect((await fetch(publishedUrls.llms)).status === 404, "Unpublish should remove llms.txt.");
    expect((await fetch(publishedUrls.llmsFull)).status === 404, "Unpublish should remove llms-full.txt.");
  });
}
