export const id = "workspace";
export const description = "First screen, tabs, empty state, share, templates, and view-mode chrome.";
const validRoomKey = "A".repeat(43);

export async function run(ctx) {
  const {
    appNewFileShortcut,
    browser,
    expect,
    getTabs,
    getViewModeActionLabels,
    getViewModeSlots,
    openProjectContext,
    openProjectMenu,
    waitForActiveTab,
    waitForEditorReady,
    waitForFileCount,
    waitForPanelTab,
    waitForSavedLocally,
    waitForShareDialogState,
    withPage,
  } = ctx;

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
    await waitForShareDialogState(page, { panel: "Share link" });
    expect((await page.getByRole("tab", { name: "Publish" }).count()) === 0, "Publish should stay hidden in Share until it ships.");
    expect((await page.getByText("Publish with Tabula +").count()) === 0, "Share should not expose the Tabula + publish boundary yet.");

    await page.keyboard.press("Escape");
    await waitForShareDialogState(page, { open: false });
    await page.locator('.tab-item[data-file-name="README.md"] .tab-select-button').click();
    await waitForActiveTab(page, { exact: "README.md" });
    await page.locator(".share-trigger").click();
    await waitForShareDialogState(page, { panel: "Share link" });
    expect((await page.getByRole("tab", { name: "Publish" }).count()) === 0, "Publish should stay hidden for non-empty files too.");
    expect((await page.locator(".workspace-plus-popover").count()) === 0, "The hidden publish boundary should not open a plus popover.");
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
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.dataset.themePreference = "dark";
      document.documentElement.style.colorScheme = "dark";
    });
    await page.locator(".share-trigger").click();
    await waitForShareDialogState(page, { panel: "Share link" });
    expect((await page.locator(".share-modal").count()) === 1, "Share should open a centered modal.");
    expect((await page.getByRole("tab", { name: "Share link" }).count()) === 1, "Share modal should expose Share link as a purpose.");
    expect((await page.getByRole("tab", { name: "Export" }).count()) === 1, "Share modal should expose Export as a purpose.");
    expect((await page.getByRole("tab", { name: "Send to..." }).count()) === 1, "Share modal should expose Send to as a purpose.");
    expect((await page.getByRole("tab", { name: "Publish" }).count()) === 0, "Share modal should keep Publish hidden for now.");
    expect((await page.getByText("Live collaboration").count()) > 0, "Share modal should default to live collaboration.");
    expect((await page.getByText("Shareable link").count()) > 0, "Share modal should offer a snapshot link path.");
    expect((await page.getByRole("button", { name: "Export to link" }).count()) === 1, "Share modal should expose snapshot link export.");
    expect((await page.getByText("Not live").count()) === 0, "Share link should not show redundant pre-live state text.");
    expect((await page.getByRole("button", { name: "Start session" }).count()) === 1, "Share link should start a session.");
    expect(
      (await page.getByLabel("Your collaboration name").count()) === 0,
      "Share link should not ask for a name before a session exists.",
    );
    expect((await page.getByText("Export Markdown").count()) === 0, "Export actions should not be expanded by default.");
    expect((await page.getByText("Publish project").count()) === 0, "Publish actions should not be available by default.");
    expect((await page.getByRole("button", { name: "Copy llms.txt" }).count()) === 0, "Publish actions should not be on the default Share panel.");
    await page.getByRole("tab", { name: "Export" }).click();
    await waitForShareDialogState(page, { panel: "Export" });
    expect((await page.getByText("Export Markdown").count()) > 0, "Export tab should expose local Markdown transfer.");
    expect((await page.getByRole("button", { name: /Markdown \.md/ }).count()) === 1, "Share modal should download Markdown.");
    expect((await page.getByRole("button", { name: /Copy Markdown/ }).count()) === 1, "Share modal should copy Markdown.");

    await page.getByRole("tab", { name: "Send to..." }).click();
    await waitForShareDialogState(page, { panel: "Send to..." });
    expect((await page.getByText("Send to local coding agent").count()) > 0, "Send to tab should expose local agent handoff.");
    expect((await page.getByRole("button", { name: "Copy prompt" }).count()) === 1, "Send to tab should copy an agent prompt.");

    expect((await page.getByText("Publish with Tabula +").count()) === 0, "Share should not expose the Plus publish boundary yet.");
    expect((await page.getByRole("radio", { name: /Current page/ }).count()) === 0, "Publish scope controls should stay hidden.");
    expect((await page.getByRole("radio", { name: /Project/ }).count()) === 0, "Project publish should stay hidden.");
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
      (await page.getByRole("button", { name: "Publish current page" }).count()) === 0,
      "Publish should not create public pages from the visible Share surface yet.",
    );
    expect((await page.getByRole("button", { name: "Publish snapshot" }).count()) === 0, "Publish should not expose snapshots as the action.");
    expect((await page.getByText("Publish not configured").count()) === 0, "Publish should not be a disabled placeholder.");
    expect((await page.locator(".publish-popover").count()) === 0, "Publish should not use a separate popover.");
    expect((await page.locator(".live-popover").count()) === 0, "Live should not use a separate popover.");
    await page.getByRole("tab", { name: "Share link" }).click();
    await waitForShareDialogState(page, { panel: "Share link" });
    const shareModalStyle = await page.evaluate(() => {
      const modal = document.querySelector(".share-modal");
      const title = document.querySelector(".share-modal-header h2");
      const primaryButton = document.querySelector(".share-modal-primary");
      const tabs = document.querySelector(".share-modal-tabs");
      const activeTab = document.querySelector(".share-modal-tabs button.active");
      const modalStyle = modal ? window.getComputedStyle(modal) : null;
      const titleStyle = title ? window.getComputedStyle(title) : null;
      const primaryStyle = primaryButton ? window.getComputedStyle(primaryButton) : null;
      const tabsStyle = tabs ? window.getComputedStyle(tabs) : null;
      const activeTabStyle = activeTab ? window.getComputedStyle(activeTab) : null;

      return {
        text: modal?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        modalBackground: modalStyle?.backgroundColor ?? "",
        titleText: title?.textContent?.trim() ?? "",
        titleFontSize: titleStyle?.fontSize ?? "",
        titleFontWeight: titleStyle?.fontWeight ?? "",
        titleColor: titleStyle?.color ?? "",
        primaryBackground: primaryStyle?.backgroundColor ?? "",
        primaryColor: primaryStyle?.color ?? "",
        primaryMinHeight: primaryStyle?.minHeight ?? "",
        tabCount: tabs?.querySelectorAll("button").length ?? 0,
        tabsBackground: tabsStyle?.backgroundColor ?? "",
        activeTabBackground: activeTabStyle?.backgroundColor ?? "",
        dividerCount: modal?.querySelectorAll(".share-modal-divider").length ?? 0,
        shareDividerCount: modal?.querySelectorAll(".share-section-divider").length ?? 0,
      };
    });
    expect(shareModalStyle.titleText === "Share README", "Share modal title should include the file name.");
    expect(
      shareModalStyle.modalBackground !== "rgb(255, 255, 255)",
      "Share modal should follow the active dark app theme.",
    );
    expect(
      shareModalStyle.activeTabBackground !== "rgb(255, 255, 255)",
      "Share modal active tab should not stay white in dark theme.",
    );
    expect(
      shareModalStyle.titleColor !== "rgb(31, 31, 31)",
      "Share modal title should inherit dark-theme text color.",
    );
    expect(Number.parseFloat(shareModalStyle.titleFontSize) <= 24, "Share modal title should not use hero-scale type.");
    expect(Number.parseInt(shareModalStyle.titleFontWeight, 10) <= 500, "Share modal title should use quiet weight.");
    expect(
      shareModalStyle.primaryBackground !== "rgb(31, 31, 31)",
      "Share modal primary action should not use the old black button treatment.",
    );
    expect(
      shareModalStyle.primaryColor !== "rgb(119, 119, 119)",
      "Share modal primary action should stay readable.",
    );
    expect(Number.parseFloat(shareModalStyle.primaryMinHeight) <= 38, "Share modal actions should keep compact row height.");
    expect(shareModalStyle.tabCount === 3, "Share modal should expose Share link, Export, and Send to until Publish ships.");
    expect(shareModalStyle.dividerCount === 0, "Share modal should not use legacy stacked Or dividers.");
    expect(shareModalStyle.shareDividerCount === 1, "Share link should separate live collaboration from snapshot sharing.");
    expect(!/\bworkspace\b/i.test(shareModalStyle.text), "Share modal should avoid workspace terminology.");

    await page.evaluate(() => {
      window.__tabulaClipboard = [];
      navigator.clipboard.writeText = async (text) => {
        window.__tabulaClipboard.push(text);
      };
    });
    expect((await page.getByRole("tab", { name: "Publish" }).count()) === 0, "Publish should remain hidden in the Share modal.");
    expect((await page.getByText("Publish with Tabula +").count()) === 0, "Hidden Publish should not expose Plus copy.");
    expect((await page.getByRole("button", { name: "Publish current page" }).count()) === 0, "Hidden Publish should not expose publishing actions.");

    await page.getByRole("tab", { name: "Share link" }).click();
    await waitForShareDialogState(page, { panel: "Share link" });
    const preLiveUrl = page.url();
    await page.getByRole("button", { name: "Start session" }).click();
    await waitForShareDialogState(page, { text: "Invite link" });
    expect(
      page.url() === preLiveUrl,
      "Live -> Start session should keep the current workspace URL separate from the room invite link.",
    );
    expect(
      (await page.getByText("Live collaboration").count()) > 0,
      "Starting live should keep the Share link panel heading stable.",
    );
    expect(
      (await page.getByText("Invite people to edit this file together.").count()) > 0,
      "Starting live should keep the Share link panel explanation stable.",
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
    expect((await page.locator(".share-link-display").count()) === 1, "Live modal should render one compact session-link preview.");
    expect(
      (await page.locator(".share-current-url-display").count()) === 0,
      "Live modal should not explain internal current-tab URL mechanics.",
    );
    const shareLinkPreview = await page.locator(".share-link-display").textContent();
    const shareLinkTitle = await page.locator(".share-link-display").getAttribute("title");
    expect(
      /#room=.+,\.\.\./.test(shareLinkPreview ?? ""),
      "Live modal should show the canonical hash room invite shape without exposing the key.",
    );
    expect(
      Boolean(shareLinkTitle && new URL(shareLinkTitle).pathname === "/" && new URL(shareLinkTitle).hash.startsWith("#room=")),
      "Live modal should keep the full hash room URL in the invite-link title.",
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

    const tabs = await getTabs(page);
    const activeTab = tabs.find((tab) => tab.active);
    expect(activeTab?.live, "Live -> Start session should mark the active tab as live.");
    expect(!page.url().includes("#room="), "Live -> Start session should not move the current tab to a room route.");
  });

  await withPage(browser, `/#room=browserroom,${validRoomKey}`, async (page) => {
    await page.waitForSelector(".tab-item.live.active");
    const tabs = await getTabs(page);

    expect(tabs.some((tab) => tab.title === "README.md"), "Opening a room should keep README.md.");
    expect(tabs.some((tab) => tab.title === "Untitled.md"), "Opening a room should keep the local untitled tab.");
    expect(tabs.some((tab) => tab.live && tab.active), "Opening a room should activate a live tab.");
    expect(
      page.url().endsWith(`/#room=browserroom,${validRoomKey}`),
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
    expect(tabs.find((tab) => tab.active)?.mode === "Preview", "README tab should keep its Preview mode.");
  });
}
