export const id = "workspace";
export const description = "First screen, tabs, empty state, share, templates, and view-mode chrome.";
const validRoomKey = "A".repeat(43);

export async function run(ctx) {
  const {
    appNewFileShortcut,
    baseUrl,
    browser,
    expect,
    getTabs,
    getViewModeActionLabels,
    getViewModeSlots,
    openProjectContext,
    openProjectMenu,
    publishUrl,
    waitForActiveTab,
    waitForEditorReady,
    waitForFileCount,
    waitForPanelTab,
    waitForSavedLocally,
    waitForShareDialogState,
    waitForText,
    withPage,
  } = ctx;
  const expectsPublishService = Boolean(publishUrl);

  await withPage(browser, "/", async (page) => {
    const tabs = await getTabs(page);
    const activeTab = tabs.find((tab) => tab.active);
    const previewText = await page.locator(".preview-surface").textContent();

    expect(activeTab?.title === "README.md", "Fresh projects should open on the product README.");
    expect(activeTab?.visibleTitle === "README", "Markdown tabs should omit the .md extension visually.");
    expect(activeTab?.mode === "Preview", "The product README should open in Preview mode.");
    expect(previewText?.includes("Tabula.md is a local-first Markdown workspace"), "The first screen should be a product document.");
    expect(previewText?.includes("No dashboard first."), "The README should explain the product in a short product voice.");
    expect(!previewText?.includes("## Frontmatter"), "The README first screen should avoid long instructional sections.");
    expect(!previewText?.includes("```"), "The README first screen should not include code examples.");
    expect((await page.locator(".intro-action-button").count()) === 0, "The product README should not embed app actions.");
    expect((await page.locator(".tabula-plus-trigger").count()) === 0, "Tabula + should not live in the top-right document chrome.");
    expect((await page.locator(".share-trigger").count()) === 1, "Share should be a single top-right chrome action.");
    expect((await page.locator(".live-button").count()) === 0, "Live should live inside Share, not as a separate top-right action.");
    expect((await page.locator(".publish-trigger").count()) === 0, "Publish should live inside Share, not as a separate top-right action.");
    expect((await page.locator(".blank-document-action").count()) === 0, "The first screen should not show canvas-style onboarding actions.");
    expect((await page.locator(".empty-feature-callout").count()) === 0, "The first screen should not show canvas-style callouts.");
    const compactTabs = await page.evaluate(() => {
      const lastTab = Array.from(document.querySelectorAll(".tab-item")).at(-1);
      const addButton = document.querySelector(".add-tab-button");
      const tabbar = document.querySelector(".tabbar");
      const tabsScroll = document.querySelector(".tabs-scroll");
      if (!lastTab || !addButton || !tabbar || !tabsScroll) {
        return null;
      }

      const tabRect = lastTab.getBoundingClientRect();
      const addRect = addButton.getBoundingClientRect();
      const tabbarRect = tabbar.getBoundingClientRect();
      const tabsScrollRect = tabsScroll.getBoundingClientRect();
      return {
        gap: addRect.left - tabRect.right,
        unusedSpaceAfterAdd: tabbarRect.right - addRect.right,
        tabsScrollWidth: tabsScrollRect.width,
        tabsScrollContentWidth: tabsScroll.scrollWidth,
      };
    });
    expect(compactTabs, "Compact tab row should be measurable.");
    expect(compactTabs.gap >= 0 && compactTabs.gap <= 12, "New tab should sit next to the last tab before overflow.");
    expect(
      compactTabs.unusedSpaceAfterAdd > 120,
      "Compact tab row should leave unused space after the new-tab control instead of pinning it right.",
    );

    await page.getByTitle("New tab").click();
    await waitForActiveTab(page, { startsWith: "Untitled" });
    await waitForEditorReady(page, { mode: "edit" });
    let nextTabs = await getTabs(page);
    expect(nextTabs.find((tab) => tab.active)?.title?.startsWith("Untitled"), "New tab should activate a blank document.");
    expect(
      !nextTabs.find((tab) => tab.active)?.visibleTitle.endsWith(".md"),
      "Blank Markdown tabs should omit the .md extension visually.",
    );
    expect((await page.locator(".intro-action-button").count()) === 0, "Blank writing documents should not show README actions.");

    await page.getByTitle("New tab").click();
    await waitForActiveTab(page, { startsWith: "Untitled" });
    await waitForEditorReady(page, { mode: "edit" });
    nextTabs = await getTabs(page);
    expect(nextTabs.find((tab) => tab.active)?.mode === "Edit", "New documents should open as blank Edit documents.");
  });

  await withPage(browser, "/", async (page) => {
    await page.getByTitle("New tab").click();
    await waitForActiveTab(page, { startsWith: "Untitled" });
    await waitForEditorReady(page, { mode: "edit" });
    await page.locator(".share-trigger").click();
    await waitForShareDialogState(page, { panel: "Collaborate" });
    await page.getByRole("tab", { name: "Publish" }).click();
    await waitForShareDialogState(page, { panel: "Publish" });
    if (expectsPublishService) {
      expect(
        await page.getByRole("button", { name: "Publish current page" }).isDisabled(),
        "Publish should block a blank current page.",
      );
      expect(
        (await page.getByText(/^Add content to Untitled(?: \d+)? before publishing\.$/).count()) === 1,
        "Publish should explain that the current blank page needs content.",
      );
    } else {
      expect((await page.getByText("Publish with Tabula +").count()) === 1, "Publish should show the Tabula + boundary.");
      expect((await page.getByRole("button", { name: "View Tabula +" }).count()) === 1, "Publish gate should link to Tabula +.");
      expect((await page.getByRole("button", { name: "Publish current page" }).count()) === 0, "Publish should not run without Tabula +.");
    }

    await page.keyboard.press("Escape");
    await waitForShareDialogState(page, { open: false });
    await page.locator('.tab-item[data-file-name="README.md"] .tab-select-button').click();
    await waitForActiveTab(page, { exact: "README.md" });
    await page.locator(".share-trigger").click();
    await waitForShareDialogState(page, { panel: "Collaborate" });
    await page.getByRole("tab", { name: "Publish" }).click();
    await waitForShareDialogState(page, { panel: "Publish" });
    if (expectsPublishService) {
      expect(
        !(await page.getByRole("button", { name: "Publish current page" }).isDisabled()),
        "Publish should allow a non-empty current page even when another project file is blank.",
      );
      await page.getByRole("radio", { name: /Project/ }).click();
      expect(await page.getByRole("button", { name: "Publish project" }).isDisabled(), "Project publish should block if any project file is blank.");
      expect(
        (await page
          .getByText(/^Add content to Untitled(?: \d+)?(?: and \d+ other empty project files?)? before publishing\.$/)
          .count()) === 1,
        "Project publish should identify the blank project file before publishing.",
      );
    } else {
      expect((await page.getByText("Publish with Tabula +").count()) === 1, "Publish should stay behind Tabula + for non-empty files.");
      await page.getByRole("button", { name: "View Tabula +" }).click();
      expect((await page.locator(".share-modal").count()) === 0, "Opening Tabula + from Publish should close the Share modal.");
      expect((await page.locator(".workspace-plus-popover").count()) === 1, "Opening Tabula + should show the product boundary popover.");
    }
  });

  await withPage(browser, "/", async (page) => {
    for (let index = 0; index < 8; index += 1) {
      const tabCount = await page.locator(".tab-item").count();
      if (tabCount === 0) {
        break;
      }

      await page.locator(".tab-item").first().hover();
      await page.locator(".tab-item .tab-action-button.close").first().click();
      await waitForFileCount(page, tabCount - 1);
    }

    expect((await page.locator(".tab-item").count()) === 0, "Closing the final tab should leave no tabs open.");
    expect((await page.locator(".empty-file-state").count()) === 1, "Closing every tab should show the no-open-file state.");
    expect((await page.locator(".file-toolbar").count()) === 0, "No-open-file state should hide file tools.");
    expect((await page.locator(".file-status-bar").count()) === 0, "No-open-file state should hide the file status bar.");
    expect((await page.locator(".share-trigger").count()) === 0, "No-open-file state should hide file sharing.");

    const emptyChromeState = await page.evaluate(() => {
      const rightPanelButton = document.querySelector('button[aria-label="Open Project Context"]');
      const workspace = document.querySelector(".empty-workspace");
      const emptyState = document.querySelector(".empty-file-state");
      const workspaceRect = workspace?.getBoundingClientRect();
      const emptyStateRect = emptyState?.getBoundingClientRect();
      return {
        rightPanelDisabled: rightPanelButton instanceof HTMLButtonElement ? rightPanelButton.disabled : false,
        workspaceText: document.querySelector(".empty-workspace")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        workspaceTop: Math.round(workspaceRect?.top ?? -1),
        workspaceHeight: Math.round(workspaceRect?.height ?? -1),
        emptyStateCenterY:
          emptyStateRect && workspaceRect ? Math.round(emptyStateRect.top + emptyStateRect.height / 2 - workspaceRect.top) : -1,
      };
    });
    expect(!emptyChromeState.rightPanelDisabled, "No-open-file state should keep the project file panel available.");
    expect(emptyChromeState.workspaceTop < 120, "No-open-file area should occupy the file area, not fall to the bottom.");
    expect(
      Math.abs(emptyChromeState.emptyStateCenterY - emptyChromeState.workspaceHeight / 2) < 80,
      "No-open-file state should sit near the center of the empty file area.",
    );
    expect(
      emptyChromeState.workspaceText.includes("The default document format for humans and agents.") &&
        !emptyChromeState.workspaceText.includes("Start with Markdown.") &&
        !emptyChromeState.workspaceText.includes("Tabula turns Markdowns into collaborative documents for people and agents.") &&
        emptyChromeState.workspaceText.includes("New Markdown") &&
        emptyChromeState.workspaceText.includes("Open .md file") &&
        emptyChromeState.workspaceText.includes("Browse project files") &&
        emptyChromeState.workspaceText.includes("Help") &&
        !emptyChromeState.workspaceText.includes("Import Markdown") &&
        !emptyChromeState.workspaceText.includes("Export project") &&
        !emptyChromeState.workspaceText.includes("Project menu") &&
        !emptyChromeState.workspaceText.includes("No file open") &&
        !emptyChromeState.workspaceText.includes("Tabula.md"),
      "No-open-file state should keep the branded start screen available.",
    );

    const emptyFontSizes = await page.$$eval(".empty-file-state :is(p, button, span)", (nodes) =>
      nodes.map((node) => Number.parseFloat(window.getComputedStyle(node).fontSize)),
    );
    expect(
      emptyFontSizes.every((fontSize) => fontSize >= 14),
      "No-open-file state should not render text below 14px.",
    );

    await page.getByRole("button", { name: "Browse project files" }).click();
    await waitForPanelTab(page, "Files");
    expect((await page.locator(".right-panel").count()) === 1, "Browse project files should open the right file panel.");
    const closedTabFileState = await page.evaluate(() => ({
      fileRows: Array.from(document.querySelectorAll(".right-file-tree-row.file")).map((row) => ({
        title: row.getAttribute("title") ?? "",
        text: row.textContent?.replace(/\s+/g, " ").trim() ?? "",
        active: row.classList.contains("active"),
      })),
      emptyMessageCount: Array.from(document.querySelectorAll(".right-empty-state")).length,
    }));
    expect(closedTabFileState.emptyMessageCount === 0, "Closing tabs should not delete project files.");
    expect(
      closedTabFileState.fileRows.some((row) => row.title === "README.md"),
      "Files panel should keep README available after all tabs are closed.",
    );
    expect(
      closedTabFileState.fileRows.every((row) => !row.active),
      "Files panel should not mark an active file when no tab is open.",
    );

    await page.reload();
    await page.waitForSelector(".tabbar");
    await page.locator(".empty-file-state").waitFor({ state: "visible" });
    const reloadedNoOpenState = await page.evaluate(() => ({
      tabCount: document.querySelectorAll(".tab-item").length,
      text: document.querySelector(".empty-workspace")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(reloadedNoOpenState.tabCount === 0, "Reloading with no open tabs should preserve the openTabs state.");
    expect(
      reloadedNoOpenState.text.includes("The default document format for humans and agents."),
      "Reloading with no open tabs should keep the branded start state.",
    );

    if ((await page.locator(".right-panel").count()) === 0) {
      await openProjectContext(page);
    }
    await page.getByRole("searchbox", { name: "Search files" }).fill("README");
    await page.keyboard.press("Enter");
    await waitForActiveTab(page, { exact: "README.md" });
    const reopenedTabs = await getTabs(page);
    expect(reopenedTabs.length === 1, "Pressing Enter in Files search should reopen the first matching file as a tab.");
    expect(reopenedTabs[0]?.title === "README.md", "Files search Enter should reopen README.");
    expect(reopenedTabs[0]?.active, "Reopened file should become active.");

    await page.locator(".tab-item.active").hover();
    await page.locator(".tab-item.active .tab-action-button.close").click();
    await waitForFileCount(page, 0);
    await page.keyboard.press(appNewFileShortcut);
    await waitForFileCount(page, 1);
    await waitForEditorReady(page, { mode: "edit" });
    await waitForSavedLocally(page);
    let nextTabs = await getTabs(page);
    expect(nextTabs.length === 1, "New Markdown shortcut from the empty workbench should open one tab.");
    expect(nextTabs[0]?.active, "New Markdown shortcut from the empty workbench should activate the new tab.");

    await page.locator(".tab-item.active").hover();
    await page.locator(".tab-item.active .tab-action-button.close").click();
    await waitForFileCount(page, 0);
    await page.locator(".empty-file-actions").getByRole("button", { name: "New Markdown" }).click();
    await waitForFileCount(page, 1);
    await waitForEditorReady(page, { mode: "edit" });
    await waitForSavedLocally(page);
    nextTabs = await getTabs(page);
    expect(nextTabs.length === 1, "New Markdown from the empty workbench should open one tab.");
    expect(nextTabs[0]?.active, "New Markdown from the empty workbench should activate the new tab.");
    expect((await page.locator(".empty-file-state").count()) === 0, "New file should leave the empty workbench.");
    expect((await page.locator(".file-toolbar").count()) === 1, "New file should restore file tools.");
    const newFileFocused = await page.evaluate(() => {
      const editor = document.querySelector(".markdown-editor");
      return Boolean(editor?.contains(document.activeElement));
    });
    expect(newFileFocused, "New file from the empty workbench should focus the Markdown editor.");
  });

  await withPage(browser, "/", async (page) => {
    await page.locator(".share-trigger").click();
    await waitForShareDialogState(page, { panel: "Collaborate" });
    expect((await page.locator(".share-modal").count()) === 1, "Share should open a centered modal.");
    const getShareModalHeight = () =>
      page.locator(".share-modal").evaluate((modal) => Math.round(modal.getBoundingClientRect().height));
    expect((await page.getByRole("tab", { name: "Collaborate" }).count()) === 1, "Share modal should expose Collaborate as a purpose.");
    expect((await page.getByRole("tab", { name: "Send" }).count()) === 1, "Share modal should expose Send as a purpose.");
    expect((await page.getByRole("tab", { name: "Publish" }).count()) === 1, "Share modal should expose Publish as a purpose.");
    expect((await page.getByText("Collaborate with people").count()) > 0, "Share modal should default to human collaboration.");
    expect((await page.getByText("Not live").count()) === 0, "Collaborate should not show redundant pre-live state text.");
    expect((await page.getByRole("button", { name: "Start session" }).count()) === 1, "Collaborate should start a session.");
    expect(
      (await page.getByLabel("Your collaboration name").count()) === 0,
      "Collaborate should not ask for a name before a session exists.",
    );
    expect((await page.getByText("Send the Markdown file").count()) === 0, "Send actions should not be expanded by default.");
    expect((await page.getByText("Publish project").count()) === 0, "Publish actions should not be expanded by default.");
    expect((await page.getByRole("button", { name: "Copy llms.txt" }).count()) === 0, "Publish actions should not be on the default Share panel.");
    const collaborateShareHeight = await getShareModalHeight();

    await page.getByRole("tab", { name: "Send" }).click();
    await waitForShareDialogState(page, { panel: "Send" });
    expect((await page.getByText("Send the Markdown file").count()) > 0, "Send tab should expose local copy transfer.");
    expect((await page.getByRole("button", { name: "Copy Markdown" }).count()) === 1, "Share modal should copy Markdown.");
    expect((await page.getByRole("button", { name: "Download .md" }).count()) === 1, "Share modal should download Markdown.");
    const sendShareHeight = await getShareModalHeight();

    await page.getByRole("tab", { name: "Publish" }).click();
    await waitForShareDialogState(page, { panel: "Publish" });
    if (expectsPublishService) {
      expect((await page.getByText("Choose what goes live, then create a read-only page.").count()) > 0, "Publish should read as web publishing.");
      expect((await page.getByText("Publish a public page").count()) > 0, "Publish tab should use a simple page heading.");
      expect((await page.getByRole("radio", { name: /Current page/ }).count()) === 1, "Publish should offer current-page scope.");
      expect((await page.getByRole("radio", { name: /Project/ }).count()) === 1, "Publish should offer project scope.");
      expect(
        (await page.getByRole("radio", { name: /Current page/ }).getAttribute("aria-checked")) === "true",
        "Publish should default to current-page scope.",
      );
    } else {
      expect((await page.getByText("Publish with Tabula +").count()) > 0, "Publish tab should name the Plus boundary.");
      expect(
        (await page.getByText("Public pages, project publishing, and durable agent handoff belong to Tabula +.").count()) > 0,
        "Publish tab should explain the commercial boundary.",
      );
      expect((await page.getByRole("button", { name: "View Tabula +" }).count()) === 1, "Publish gate should link to Tabula +.");
      expect((await page.getByRole("radio", { name: /Current page/ }).count()) === 0, "Publish scope controls should not be active without Tabula +.");
      expect((await page.getByRole("radio", { name: /Project/ }).count()) === 0, "Project publish should stay behind Tabula +.");
    }
    expect((await page.locator('input[aria-label="Publish URL"]').count()) === 0, "Publish should not show a URL before publishing.");
    expect((await page.locator('[aria-label="Published URLs"]').count()) === 0, "Publish should not show endpoint URLs before publishing.");
    expect((await page.locator('[aria-label="AI-readable output URLs"]').count()) === 0, "Publish should not show endpoint URLs before publishing.");
    expect((await page.getByText("No public URL exists yet.").count()) === 0, "Publish should not show an unavailable URL placeholder.");
    expect((await page.getByText("llms.txt", { exact: true }).count()) === 0, "Publish should hide llms.txt from the human UI.");
    expect((await page.getByText("llms-full.txt", { exact: true }).count()) === 0, "Publish should hide llms-full.txt from the human UI.");
    expect((await page.getByText("AI-readable outputs included", { exact: true }).count()) === 0, "Publish should not expose AI output labels.");
    expect((await page.getByText("Outputs", { exact: true }).count()) === 0, "Publish should not make outputs the headline.");
    expect((await page.getByText("Project snapshot").count()) === 0, "Publish should not use snapshot-first language.");
    expect((await page.getByText("Published snapshot").count()) === 0, "Publish should not use snapshot-first language.");
    expect((await page.getByText("Publishing will index this file.").count()) === 0, "Publish should not repeat the file scope.");
    expect((await page.getByText(/open files/i).count()) === 0, "Share publish should not describe an open-file bundle.");
    expect((await page.getByText("For people").count()) === 0, "Publish should not split people and agent features.");
    expect((await page.getByText("For agents").count()) === 0, "Publish should not split people and agent features.");
    expect((await page.getByRole("button", { name: "Create publish URL" }).count()) === 0, "Publish should not expose fake URL creation.");
    expect((await page.getByRole("button", { name: "Copy publish URL" }).count()) === 0, "Publish should not copy a URL before publishing.");
    expect((await page.getByRole("button", { name: "Copy llms.txt URL" }).count()) === 0, "Publish should not copy endpoint URLs before publishing.");
    expect((await page.getByRole("button", { name: "Copy llms-full.txt URL" }).count()) === 0, "Publish should not copy endpoint URLs before publishing.");
    expect((await page.getByRole("button", { name: "Copy page" }).count()) === 0, "Publish should not look like a Markdown export panel.");
    expect((await page.getByRole("button", { name: "Copy llms.txt" }).count()) === 0, "Publish should not expose llms copy actions.");
    expect((await page.getByRole("button", { name: "Copy llms-full.txt" }).count()) === 0, "Publish should not expose llms copy actions.");
    expect((await page.getByRole("button", { name: "Download bundle" }).count()) === 0, "Publish should not expose bundle download actions.");
    expect(
      (await page.getByRole("button", { name: "Publish current page" }).count()) === (expectsPublishService ? 1 : 0),
      "Publish should only create a public page when Tabula + is enabled.",
    );
    expect((await page.getByRole("button", { name: "Publish snapshot" }).count()) === 0, "Publish should not expose snapshots as the action.");
    expect((await page.getByText("Publish not configured").count()) === 0, "Publish should not be a disabled placeholder.");
    expect((await page.locator(".publish-popover").count()) === 0, "Publish should not use a separate popover.");
    expect((await page.locator(".live-popover").count()) === 0, "Live should not use a separate popover.");
    const publishShareHeight = await getShareModalHeight();
    expect(
      Math.max(collaborateShareHeight, sendShareHeight, publishShareHeight) -
        Math.min(collaborateShareHeight, sendShareHeight, publishShareHeight) <=
        1,
      "Share modal height should stay stable when switching purpose tabs.",
    );

    await page.getByRole("tab", { name: "Collaborate" }).click();
    await waitForShareDialogState(page, { panel: "Collaborate" });
    const shareModalStyle = await page.evaluate(() => {
      const modal = document.querySelector(".share-modal");
      const title = document.querySelector(".share-modal-header h2");
      const primaryButton = document.querySelector(".share-modal-primary");
      const tabs = document.querySelector(".share-modal-tabs");
      const titleStyle = title ? window.getComputedStyle(title) : null;
      const primaryStyle = primaryButton ? window.getComputedStyle(primaryButton) : null;
      const tabsStyle = tabs ? window.getComputedStyle(tabs) : null;

      return {
        text: modal?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        titleText: title?.textContent?.trim() ?? "",
        titleFontSize: titleStyle?.fontSize ?? "",
        titleFontWeight: titleStyle?.fontWeight ?? "",
        primaryBackground: primaryStyle?.backgroundColor ?? "",
        primaryColor: primaryStyle?.color ?? "",
        primaryMinHeight: primaryStyle?.minHeight ?? "",
        tabCount: tabs?.querySelectorAll("button").length ?? 0,
        tabsBackground: tabsStyle?.backgroundColor ?? "",
        dividerCount: modal?.querySelectorAll(".share-modal-divider").length ?? 0,
      };
    });
    expect(shareModalStyle.titleText === "Share README", "Share modal title should include the file name.");
    expect(Number.parseFloat(shareModalStyle.titleFontSize) <= 24, "Share modal title should not use hero-scale type.");
    expect(Number.parseInt(shareModalStyle.titleFontWeight, 10) <= 500, "Share modal title should use quiet weight.");
    expect(
      shareModalStyle.primaryBackground !== "rgb(31, 31, 31)",
      "Share modal primary action should not use the old black button treatment.",
    );
    expect(shareModalStyle.primaryColor === "rgb(31, 31, 31)", "Share modal primary action should stay readable.");
    expect(Number.parseFloat(shareModalStyle.primaryMinHeight) <= 38, "Share modal actions should keep compact row height.");
    expect(shareModalStyle.tabCount === 3, "Share modal should use purpose tabs instead of stacked sections.");
    expect(shareModalStyle.dividerCount === 0, "Share modal should not use stacked Or dividers.");
    expect(!/\bworkspace\b/i.test(shareModalStyle.text), "Share modal should avoid workspace terminology.");

    await page.evaluate(() => {
      window.__tabulaClipboard = [];
      navigator.clipboard.writeText = async (text) => {
        window.__tabulaClipboard.push(text);
      };
    });
    await page.getByRole("tab", { name: "Publish" }).click();
    await waitForShareDialogState(page, { panel: "Publish" });
    const publishModalTitle = await page.locator(".share-modal-header h2").textContent();
    expect(publishModalTitle?.trim() === "Publish", "Publish should use a short modal title.");

    if (expectsPublishService) {
      await page.getByRole("button", { name: "Publish current page" }).click();
      await waitForText(page.locator(".app-toast"), "Page published.");
      const publishedUrls = {
        page: (await page.getByRole("link", { name: "View page" }).getAttribute("href")) ?? "",
        llms: "",
        llmsFull: "",
      };
      const publishId = publishedUrls.page.match(/\/p\/([^/]+)$/)?.[1] ?? "";
      expect(/\/p\/[^/]+$/.test(publishedUrls.page), "Publishing should create a readable page URL.");
      publishedUrls.llms = `${publishUrl}/p/${publishId}/llms.txt`;
      publishedUrls.llmsFull = `${publishUrl}/p/${publishId}/llms-full.txt`;
      expect(
        publishedUrls.page.startsWith(`${baseUrl}/p/`),
        "Server-backed publishing should expose the app vanity page URL.",
      );
      expect(
        publishedUrls.llms.startsWith(`${publishUrl}/p/`) && publishedUrls.llms.endsWith("/llms.txt"),
        "Server-backed publishing should expose the publish service llms.txt endpoint URL.",
      );
      expect(
        publishedUrls.llmsFull.startsWith(`${publishUrl}/p/`) && publishedUrls.llmsFull.endsWith("/llms-full.txt"),
        "Server-backed publishing should expose the publish service llms-full.txt endpoint URL.",
      );
      expect((await page.getByRole("link", { name: "View page" }).count()) === 1, "Published state should offer a page view action.");
      expect((await page.getByRole("button", { name: "Copy link" }).count()) === 1, "Published state should offer a page copy action.");
      expect(
        (await page.getByText(/Published as current page:/).count()) === 1,
        "Published state should summarize the published current page.",
      );
      expect((await page.getByRole("radio", { name: /Project/ }).count()) === 0, "Published state should hide scope cards by default.");
      expect((await page.getByRole("button", { name: "Change scope" }).count()) === 1, "Published state should make scope changes explicit.");
      expect((await page.locator('[aria-label="AI-readable output URLs"]').count()) === 0, "Published state should hide AI URLs.");
      expect((await page.getByRole("button", { name: "Update current page" }).count()) === 1, "Published state should update the page.");
      expect((await page.getByRole("button", { name: "Republish snapshot" }).count()) === 0, "Published state should not use snapshot update copy.");
      await page.getByRole("button", { name: "Copy link" }).click();
      await page.waitForFunction(() => Boolean(window.__tabulaClipboard?.at(-1)));
      expect(
        (await page.evaluate(() => window.__tabulaClipboard.at(-1) ?? "")) === publishedUrls.page,
        "Copy link should copy the published page URL.",
      );
      expect((await page.getByRole("button", { name: "Copy llms.txt URL" }).count()) === 0, "Published state should not expose llms URL copying.");

      const publishedPage = await page.context().newPage();
      await publishedPage.goto(publishedUrls.page);
      await publishedPage.waitForSelector(".published-page", { timeout: 5_000 });
      expect(
        (await publishedPage.locator(".published-document").textContent())?.includes("Tabula.md"),
        "Published page should render the read-only Markdown page.",
      );
      expect((await publishedPage.getByRole("link", { name: "llms.txt" }).count()) === 0, "Published page should hide llms.txt links.");
      expect(
        (await publishedPage.getByRole("link", { name: "llms-full.txt" }).count()) === 0,
        "Published page should hide llms-full.txt links.",
      );
      expect(
        ((await publishedPage.locator(".published-footer").textContent()) ?? "").includes("Powered by") &&
          ((await publishedPage.locator(".published-footer").textContent()) ?? "").includes("Tabula"),
        "Published page should include the Powered by Tabula footer.",
      );
      expect(
        (await publishedPage.locator(".published-meta-bar").count()) === 0,
        "Published page should not show a Published with Tabula header.",
      );
      const singlePublishedLayout = await publishedPage.evaluate(() => {
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
          previewSurface: document.querySelector(".published-document")?.classList.contains("preview-surface") ?? false,
          viewportCenter: Math.round(window.innerWidth / 2),
          footerCenter: footerRect ? Math.round(footerRect.left + footerRect.width / 2) : 0,
          footerWidth: footerRect ? Math.round(footerRect.width) : 0,
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
        Math.abs(singlePublishedLayout.articleCenter - singlePublishedLayout.viewportCenter) <= 2,
        "Single-page publish should keep the document column centered.",
      );
      expect(singlePublishedLayout.previewSurface, "Single-page publish should use the same preview surface class as app Preview.");
      expect(
        Math.abs(singlePublishedLayout.footerCenter - singlePublishedLayout.articleCenter) <= 2 &&
          singlePublishedLayout.footerWidth < singlePublishedLayout.articleWidth / 2 &&
          singlePublishedLayout.footerBackgroundColor !== "rgba(0, 0, 0, 0)" &&
          Number.parseFloat(singlePublishedLayout.footerBorderTopWidth) === 0 &&
          Number.parseFloat(singlePublishedLayout.footerBorderRightWidth) === 0 &&
          Number.parseFloat(singlePublishedLayout.footerBorderBottomWidth) === 0 &&
          Number.parseFloat(singlePublishedLayout.footerBorderLeftWidth) === 0 &&
          Number.parseFloat(singlePublishedLayout.footerBorderRadius) === 8 &&
          Number.parseFloat(singlePublishedLayout.footerFontSize) === 14 &&
          singlePublishedLayout.footerLogoColor === singlePublishedLayout.footerColor,
        "Single-page publish footer should render as a centered filled Powered by badge.",
      );
      const llmsResponse = await fetch(publishedUrls.llms);
      const fullResponse = await fetch(publishedUrls.llmsFull);
      expect(llmsResponse.headers.get("content-type")?.includes("text/plain"), "Publish llms.txt should be text/plain.");
      expect((await llmsResponse.text()).includes("Use llms-full.txt"), "Published llms.txt should include the compact agent index.");
      expect(fullResponse.headers.get("content-type")?.includes("text/plain"), "Publish llms-full.txt should be text/plain.");
      expect((await fullResponse.text()).includes("## README.md"), "Published llms-full.txt should include the full agent context.");
      await publishedPage.close();
    } else {
      expect((await page.getByText("Publish with Tabula +").count()) === 1, "Publish should stay behind Tabula + without entitlement.");
      expect((await page.getByRole("button", { name: "Publish current page" }).count()) === 0, "Publish should not create local public pages by default.");
    }

    await page.getByRole("tab", { name: "Collaborate" }).click();
    await waitForShareDialogState(page, { panel: "Collaborate" });
    const preLiveShareHeight = await getShareModalHeight();
    const preLiveUrl = page.url();
    await page.getByRole("button", { name: "Start session" }).click();
    await waitForShareDialogState(page, { text: "Invite link" });
    expect(
      page.url() === preLiveUrl,
      "Live -> Start session should keep the current workspace URL separate from the room invite link.",
    );
    expect(
      (await page.getByText("Collaborate with people").count()) > 0,
      "Starting live should keep the Collaborate panel heading stable.",
    );
    expect(
      (await page.getByText("Invite people to edit this file together.").count()) > 0,
      "Starting live should keep the Collaborate panel explanation stable.",
    );
    expect(
      (await page.locator(".share-modal").getByText("Live room", { exact: true }).count()) === 0,
      "Live modal should not show redundant room-state title text.",
    );
    expect(
      (await page.locator(".share-room-status-hint").count()) <= 1,
      "Live modal should keep connection status as a small optional hint.",
    );
    expect(
      (await page.locator(".share-modal").getByText("People with this link can edit while the room is active.").count()) === 0,
      "Live modal should not repeat obvious invite-link behavior.",
    );
    expect((await page.getByRole("button", { name: "Copy link" }).count()) === 1, "Live modal should switch to invite-link state.");
    expect(
      (await page.getByLabel("Your collaboration name").count()) === 1,
      "Live modal should expose the collaboration name after the room starts.",
    );
    await page.getByLabel("Your collaboration name").fill("Local User");
    await page.getByLabel("Your collaboration name").blur();
    expect(
      (await page.getByLabel("Your collaboration name").inputValue()) === "Local User",
      "Live modal should allow editing the collaboration name.",
    );
    expect((await page.locator(".share-link-display").count()) === 1, "Live modal should render a compact invite-link preview.");
    const shareLinkPreview = await page.locator(".share-link-display").textContent();
    const shareLinkTitle = await page.locator(".share-link-display").getAttribute("title");
    expect(
      /\/r\/.+#key=\.\.\./.test(shareLinkPreview ?? ""),
      "Live modal should not show a visually clipped raw invite URL.",
    );
    expect(
      Boolean(shareLinkTitle && new URL(shareLinkTitle).pathname.startsWith("/r/") && new URL(shareLinkTitle).hash.startsWith("#key=")),
      "Live modal should keep the full room URL in the invite-link title.",
    );
    const liveLinkLayout = await page.evaluate(() => {
      const roomBox = document.querySelector(".live-room-box");
      const linkRow = document.querySelector(".share-modal-link-row");
      const linkPreview = document.querySelector(".share-link-display");
      const copyButton = document.querySelector(".share-modal-link-row button");

      return {
        roomWidth: roomBox?.getBoundingClientRect().width ?? 0,
        rowWidth: linkRow?.getBoundingClientRect().width ?? 0,
        linkWidth: linkPreview?.getBoundingClientRect().width ?? 0,
        buttonWidth: copyButton?.getBoundingClientRect().width ?? 0,
      };
    });
    expect(
      liveLinkLayout.rowWidth >= liveLinkLayout.roomWidth - 24,
      "Live invite-link row should use the available card width.",
    );
    expect(
      liveLinkLayout.linkWidth > liveLinkLayout.buttonWidth,
      "Live invite-link preview should receive more width than the copy button.",
    );
    expect((await page.getByRole("button", { name: "Stop session" }).count()) === 1, "Live modal should offer session stop.");
    const liveShareHeight = await getShareModalHeight();
    expect(
      Math.abs(preLiveShareHeight - liveShareHeight) <= 1,
      "Share modal height should stay stable when starting a live room.",
    );

    const tabs = await getTabs(page);
    const activeTab = tabs.find((tab) => tab.active);
    expect(activeTab?.live, "Live -> Start session should mark the active tab as live.");
    expect(!page.url().includes("/r/"), "Live -> Start session should not move the current tab to a room route.");
  });

  await withPage(browser, `/r/browserroom#key=${validRoomKey}`, async (page) => {
    await page.waitForSelector(".tab-item.live.active");
    const tabs = await getTabs(page);

    expect(tabs.some((tab) => tab.title === "README.md"), "Opening a room should keep README.md.");
    expect(tabs.some((tab) => tab.title === "Untitled.md"), "Opening a room should keep the local untitled tab.");
    expect(tabs.some((tab) => tab.live && tab.active), "Opening a room should activate a live tab.");
    expect(
      page.url().endsWith(`/r/browserroom#key=${validRoomKey}`),
      "Opening a room should keep the room URL active.",
    );
  });

  await withPage(browser, "/", async (page) => {
    await openProjectMenu(page);

    const menuSurface = await page.evaluate(() => ({
      menuOpen: Boolean(document.querySelector(".workspace-menu-popover")),
      menuRows: Array.from(document.querySelectorAll(".workspace-menu-row")).map((button) =>
        button.textContent?.replace(/\s+/g, " ").trim(),
      ),
      templateButtonCount: Array.from(document.querySelectorAll("button")).filter((button) =>
        button.textContent?.includes("Templates"),
      ).length,
      agentButtonCount: Array.from(document.querySelectorAll("button")).filter((button) =>
        button.textContent?.includes("Agent"),
      ).length,
      templateSurfaceCount: document.querySelectorAll(".left-library-item, .left-template-detail").length,
    }));

    expect(menuSurface.menuOpen, "The workspace menu should open from the top-left menu button.");
    expect(menuSurface.templateButtonCount === 0, "Templates should not ship as a visible menu item yet.");
    expect(menuSurface.agentButtonCount === 0, "Agent should not ship as an inert menu item yet.");
    expect(menuSurface.templateSurfaceCount === 0, "Template detail surfaces should be removed until templates are real.");
    expect(
      menuSurface.menuRows.includes("New Markdown") && menuSurface.menuRows.includes("Open Markdown..."),
      "The menu should keep the must-have Markdown start actions.",
    );

    await page.getByRole("button", { name: "New Markdown", exact: true }).click();
    await waitForActiveTab(page, { startsWith: "Untitled" });
    await waitForEditorReady(page, { mode: "edit" });
    const tabs = await getTabs(page);
    const activeTab = tabs.find((tab) => tab.active);
    expect(activeTab?.title.startsWith("Untitled"), "Menu New Markdown should create and activate the next blank document.");
    expect(!activeTab?.visibleTitle.endsWith(".md"), "New blank tabs should still hide the Markdown extension.");
  });

  await withPage(browser, "/", async (page) => {
    let tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.mode === "Preview", "Preview mode should be reflected in the active tab.");
    expect(
      JSON.stringify(await getViewModeActionLabels(page)) === JSON.stringify(["Edit"]),
      "Preview mode should only show Edit as the available mode action.",
    );
    expect(
      JSON.stringify(await getViewModeSlots(page)) ===
        JSON.stringify([
          { slot: "split", label: "", action: "", active: false },
          { slot: "edit-preview", label: "Edit", action: "edit", active: false },
        ]),
      "Preview mode should leave Split's slot empty and put Edit in the shared Edit/Preview slot.",
    );
    expect(
      (await page.getByRole("button", { name: "Preview", exact: true }).count()) === 0,
      "The active Preview mode should not also be rendered as a toolbar action.",
    );
    expect(
      (await page.getByRole("button", { name: "Split", exact: true }).count()) === 0,
      "Preview mode should not expose Split because Split belongs to editing.",
    );

    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.mode === "Edit", "New local tabs should start in Edit mode.");
    expect(
      JSON.stringify(await getViewModeActionLabels(page)) === JSON.stringify(["Split", "Preview"]),
      "Edit mode should keep Split first and put Preview in the shared Edit/Preview slot.",
    );
    expect(
      JSON.stringify(await getViewModeSlots(page)) ===
        JSON.stringify([
          { slot: "split", label: "Split", action: "split", active: false },
          { slot: "edit-preview", label: "Preview", action: "preview", active: false },
        ]),
      "Edit mode should keep Split in its own slot and put Preview in the shared Edit/Preview slot.",
    );
    expect(
      (await page.getByRole("button", { name: "Edit", exact: true }).count()) === 0,
      "The active Edit mode should not also be rendered as a toolbar action.",
    );

    await page.getByRole("button", { name: "Split", exact: true }).click();
    await waitForEditorReady(page, { mode: "split" });
    tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.mode === "Split", "Split should be reachable from Edit mode.");
    expect(
      JSON.stringify(await getViewModeActionLabels(page)) === JSON.stringify(["Split", "Preview"]),
      "Split mode should preserve the Split slot first and keep Preview in the shared Edit/Preview slot.",
    );
    expect(
      JSON.stringify(await getViewModeSlots(page)) ===
        JSON.stringify([
          { slot: "split", label: "Split", action: "edit", active: true },
          { slot: "edit-preview", label: "Preview", action: "preview", active: false },
        ]),
      "Split mode should keep Split active in the Split slot and target Edit when pressed again.",
    );

    await page.getByRole("button", { name: "Split", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.mode === "Edit", "Pressing active Split again should return to Edit mode.");

    await page.locator('.tab-select-button[title^="README.md ·"]').click();
    await waitForActiveTab(page, { exact: "README.md" });
    tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.buttonTitle.includes("Preview"), "README tab should keep its Preview mode.");
  });
}
