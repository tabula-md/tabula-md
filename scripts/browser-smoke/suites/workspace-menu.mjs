import { strToU8, zipSync } from "fflate";

export const id = "workspace";
export const description = "First screen, tabs, empty state, share, templates, and view-mode chrome.";
const validRoomKey = "A".repeat(43);

export async function run(ctx) {
  const {
    appNewFileShortcut,
    browser,
    expect,
    externalUrl,
    getTabs,
    getViewModeActionLabels,
    getViewModeSlots,
    openMarkdownFile,
    openProjectContext,
    openProjectMenu,
    waitForActiveTab,
    waitForEditorReady,
    waitForFileCount,
    waitForPanelTab,
    waitForSavedLocally,
    waitForShareDialogState,
    startRoomServer,
    stopRoomServer,
    withPage,
  } = ctx;

  await withPage(browser, "/", async (page) => {
    await page.locator(".empty-file-state").waitFor({ state: "visible" });
    const tabs = await getTabs(page);
    const firstScreenText = await page.locator(".empty-file-state").textContent();

    expect(tabs.length === 0, "Fresh projects should start without an open document tab.");
    expect(firstScreenText?.includes("New document"), "The first screen should offer a direct new-document action.");
    expect(firstScreenText?.includes("Open Markdown file"), "The first screen should offer a direct open-file action.");
    expect((await page.locator(".preview-surface").count()) === 0, "Fresh projects should not load Preview before it is requested.");
    expect((await page.getByText("Opening workspace...").count()) === 0, "Local hydration should not flash loading copy.");
    expect((await page.getByText("Preparing preview...").count()) === 0, "Fresh projects should not flash Preview loading copy.");
    expect((await page.locator(".tabula-plus-trigger").count()) === 0, "Tabula + should not live in the top-right document chrome.");
    expect((await page.locator(".share-trigger").count()) === 0, "Share should stay hidden until a document is open.");
    expect((await page.getByRole("button", { name: "More document actions" }).count()) === 0, "Document controls should not expose a single-command More menu.");
    await page.evaluate(() => {
      window.__tabulaClipboard = [];
      navigator.clipboard.writeText = async (text) => {
        window.__tabulaClipboard.push(text);
      };
    });
    await openProjectContext(page);
    expect((await page.locator(".right-file-tree-row.file").count()) === 0, "Fresh projects should contain no hidden files.");
    await page.getByRole("button", { name: "Close Project Context" }).click();
    expect((await page.locator(".live-button").count()) === 0, "Live should live inside Share, not as a separate top-right action.");
    expect((await page.locator(".publish-trigger").count()) === 0, "Publish should live inside Share, not as a separate top-right action.");
    expect((await page.locator(".blank-document-action").count()) === 0, "The first screen should not show canvas-style onboarding actions.");
    expect((await page.locator(".empty-feature-callout").count()) === 0, "The first screen should not show canvas-style callouts.");
    await page.locator(".empty-file-actions").getByRole("button", { name: "New document" }).click();
    await waitForActiveTab(page, { exact: "Untitled.md" });
    await waitForEditorReady(page, { mode: "edit" });
    let nextTabs = await getTabs(page);
    expect(nextTabs.find((tab) => tab.active)?.title === "Untitled.md", "The first created document should use the base Untitled name.");
    expect((await page.locator(".share-trigger").count()) === 1, "Opening a document should expose the Share action.");

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
    expect(compactTabs.gap >= 0 && compactTabs.gap <= 12, "New document should sit next to the last tab before overflow.");
    expect(
      compactTabs.unusedSpaceAfterAdd > 120,
      "Compact tab row should leave unused space after the new-tab control instead of pinning it right.",
    );

    expect(
      !nextTabs.find((tab) => tab.active)?.visibleTitle.endsWith(".md"),
      "Blank File tabs should omit the .md extension visually.",
    );
    expect((await page.locator(".intro-action-button").count()) === 0, "Blank writing documents should not show README actions.");

    await openProjectContext(page);
    await page.getByRole("button", { name: "More actions for Untitled.md" }).click();
    expect(
      (await page.locator(".right-file-action-menu").evaluate((menu) => getComputedStyle(menu).borderTopWidth)) === "0px",
      "File action menus should use elevation without a static border.",
    );
    await page.getByRole("menuitem", { name: "Copy Markdown" }).click();
    expect((await page.evaluate(() => window.__tabulaClipboard.at(-1) ?? "")) === "", "Blank file copy should preserve its source.");
    await page.getByRole("button", { name: "Close Project Context" }).click();

    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForActiveTab(page, { startsWith: "Untitled" });
    await waitForEditorReady(page, { mode: "edit" });
    nextTabs = await getTabs(page);
    expect(nextTabs.find((tab) => tab.active)?.mode === "Edit", "New documents should open as blank Edit documents.");
  });

  await withPage(browser, "/", async (page) => {
    const workspaceArchive = zipSync({
      "Planning/Launch notes.md": strToU8("# Launch notes\n\nReady."),
      "Planning/Research/Questions.md": strToU8("# Questions"),
    });
    await page.locator('input[aria-label="Open workspace"]').setInputFiles({
      name: "tabula-workspace.zip",
      mimeType: "application/zip",
      buffer: Buffer.from(workspaceArchive),
    });
    await page.getByRole("dialog", { name: "Open workspace" }).waitFor();
    expect(
      (await page.getByText("Planning/Research/Questions.md", { exact: true }).count()) === 1,
      "Opening a workspace should preview its logical document paths before replacing local state.",
    );
    await page.getByRole("button", { name: "Open workspace", exact: true }).click();
    await waitForActiveTab(page, { exact: "Launch notes.md" });
    await waitForEditorReady(page, { mode: "edit" });

    for (let index = 0; index < 2; index += 1) {
      await page.locator(".tab-item.active").hover();
      await page.locator(".tab-item.active .tab-action-button.close").click();
    }
    await page.locator(".empty-file-state").waitFor({ state: "visible" });
    expect(
      (await page.locator(".share-trigger").count()) === 1,
      "Share should remain available when workspace files exist but every document tab is closed.",
    );
  });

  await withPage(browser, "/", async (page) => {
    await page.locator(".empty-file-actions").getByRole("button", { name: "New document" }).click();
    await waitForActiveTab(page, { exact: "Untitled.md" });
    await openProjectMenu(page);
    expect(
      (await page.locator('input[type="file"][accept*="json"]').count()) === 0,
      "The workspace menu should not expose the removed JSON backup importer.",
    );
    await page.getByRole("button", { name: "Clear local workspace…", exact: true }).click();
    await page.getByRole("dialog", { name: "Clear local workspace?" }).waitFor();
    expect(
      (await page.getByText("Delete all local documents, folders, and comments. This cannot be undone.").count()) === 1,
      "Clear workspace should explain its destructive local scope.",
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await waitForActiveTab(page, { exact: "Untitled.md" });

    await openProjectMenu(page);
    await page.getByRole("button", { name: "Clear local workspace…", exact: true }).click();
    await page.getByRole("button", { name: "Clear workspace", exact: true }).click();
    await page.locator(".empty-file-state").waitFor({ state: "visible" });
    expect((await page.locator(".tab-item").count()) === 0, "Clearing the workspace should close every document tab.");
    await page.waitForFunction(
      () => document.querySelector(".app-toast")?.textContent?.includes("Local workspace cleared."),
    );
    await page.reload();
    await page.locator(".empty-file-state").waitFor({ state: "visible" });
    expect(
      (await page.locator(".tab-item").count()) === 0,
      "A cleared workspace should stay empty after an immediate reload.",
    );
    await openProjectContext(page);
    const remainingFiles = await page.locator(".right-file-tree-row.file").evaluateAll((rows) =>
      rows.map((row) => row.getAttribute("title")),
    );
    expect(
      remainingFiles.length === 0,
      "Clearing should leave the workspace genuinely empty.",
    );
  });

  await withPage(browser, "/", async (page) => {
    await page.locator(".empty-file-actions").getByRole("button", { name: "New document" }).click();
    await waitForActiveTab(page, { startsWith: "Untitled" });
    await waitForEditorReady(page, { mode: "edit" });
    await page.locator(".share-trigger").click();
    await waitForShareDialogState(page, { panel: "Share link" });
    expect(await page.locator("#root").evaluate((root) => root.inert), "An open modal should make the app root inert.");
    expect(
      (await page.locator("#root").getAttribute("aria-hidden")) === "true",
      "An open modal should hide the background app from assistive technology.",
    );
    expect((await page.getByRole("tab", { name: "Publish" }).count()) === 0, "Publish should stay hidden in Share until it ships.");
    expect((await page.getByText("Publish with Tabula +").count()) === 0, "Share should not expose the Tabula + publish boundary yet.");
    expect(
      (await page.getByText(/Add content to Untitled(?: \d+)? before creating an Export link\./).count()) === 0,
      "Export links should use the whole workspace instead of blocking on the current empty file.",
    );

    await page.keyboard.press("Escape");
    await waitForShareDialogState(page, { open: false });
    expect(!(await page.locator("#root").evaluate((root) => root.inert)), "Closing the modal should restore app interaction.");
    expect(
      (await page.locator("#root").getAttribute("aria-hidden")) === null,
      "Closing the modal should restore the app accessibility tree.",
    );
    await openProjectMenu(page);
    await page.getByRole("button", { name: "About", exact: true }).click();
    await page.getByRole("dialog", { name: "About Tabula.md" }).waitFor();
    expect(
      (await page.locator('.tab-item[data-file-name="README.md"]').count()) === 0,
      "About should not create a document in the user's workspace.",
    );
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page.locator(".share-trigger").click();
    await waitForShareDialogState(page, { panel: "Share link" });
    expect((await page.getByRole("tab", { name: "Publish" }).count()) === 0, "Publish should stay hidden for non-empty files too.");
    expect((await page.locator(".workspace-plus-popover").count()) === 0, "The hidden publish boundary should not open a plus popover.");
  });

  await withPage(browser, "/", async (page) => {
    await page.route("**/src/components/ShareControls.tsx*", (route) => route.abort("failed"));
    await page.locator(".empty-file-actions").getByRole("button", { name: "New document" }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector(".app-toast.error")?.textContent?.includes("Couldn’t open sharing."),
    );
    expect((await page.locator(".share-modal").count()) === 0, "A failed Share chunk should close the modal surface.");
    expect(
      await page.locator(".app-shell").evaluate((shell) => shell.getClientRects().length > 0),
      "A failed Share chunk should leave the workspace visible and usable.",
    );
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForActiveTab(page, { startsWith: "Untitled" });
    await waitForEditorReady(page, { mode: "edit" });
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
    expect((await page.locator(".document-controls").count()) === 0, "No-open-file state should hide file tools.");
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
      emptyChromeState.workspaceText.includes(
        "A local-first workspace for files that people and coding agents can share safely.",
      ) &&
        !emptyChromeState.workspaceText.includes("Start with Markdown.") &&
        !emptyChromeState.workspaceText.includes("Tabula turns Markdowns into collaborative documents for people and agents.") &&
        emptyChromeState.workspaceText.includes("New document") &&
        emptyChromeState.workspaceText.includes("Open Markdown file") &&
        emptyChromeState.workspaceText.includes("Browse project files") &&
        emptyChromeState.workspaceText.includes("Help") &&
        !emptyChromeState.workspaceText.includes("Import file") &&
        !emptyChromeState.workspaceText.includes("Download workspace ZIP") &&
        !emptyChromeState.workspaceText.includes("Project menu") &&
        !emptyChromeState.workspaceText.includes("No file open") &&
        !emptyChromeState.workspaceText.includes("Tabula.md"),
      "No-open-file state should keep the branded start screen available.",
    );

    const emptyTypography = await page.$$eval(".empty-file-state :is(p, button, span)", (nodes) =>
      nodes
        .filter((node) => !node.classList.contains("tabula-logo"))
        .map((node) => ({
          className: node.getAttribute("class") ?? "",
          fontSize: Number.parseFloat(window.getComputedStyle(node).fontSize),
          tagName: node.tagName,
        })),
    );
    expect(
      emptyTypography.every(({ fontSize }) => fontSize === 13 || fontSize === 15),
      `No-open-file state should use the shared 13px body and 15px surface-heading type scale (${JSON.stringify(emptyTypography)}).`,
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
      closedTabFileState.fileRows.some((row) => row.title === "Untitled.md"),
      "Files panel should keep user-created documents available after all tabs are closed.",
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
      reloadedNoOpenState.text.includes(
        "A local-first workspace for files that people and coding agents can share safely.",
      ),
      "Reloading with no open tabs should keep the branded start state.",
    );

    if ((await page.locator(".right-panel").count()) === 0) {
      await openProjectContext(page);
    }
    await page.getByRole("searchbox", { name: "Search files" }).fill("Untitled");
    await page.keyboard.press("Enter");
    await waitForActiveTab(page, { exact: "Untitled.md" });
    const reopenedTabs = await getTabs(page);
    expect(reopenedTabs.length === 1, "Pressing Enter in Files search should reopen the first matching file as a tab.");
    expect(reopenedTabs[0]?.title === "Untitled.md", "Files search Enter should reopen the user-created document.");
    expect(reopenedTabs[0]?.active, "Reopened file should become active.");

    await page.locator(".tab-item.active").hover();
    await page.locator(".tab-item.active .tab-action-button.close").click();
    await waitForFileCount(page, 0);
    await page.keyboard.press(appNewFileShortcut);
    await waitForFileCount(page, 1);
    await waitForEditorReady(page, { mode: "edit" });
    await waitForSavedLocally(page);
    let nextTabs = await getTabs(page);
    expect(nextTabs.length === 1, "New document shortcut from the empty workbench should open one tab.");
    expect(nextTabs[0]?.active, "New document shortcut from the empty workbench should activate the new tab.");

    await page.locator(".tab-item.active").hover();
    await page.locator(".tab-item.active .tab-action-button.close").click();
    await waitForFileCount(page, 0);
    await page.locator(".empty-file-actions").getByRole("button", { name: "New document" }).click();
    await waitForFileCount(page, 1);
    await waitForEditorReady(page, { mode: "edit" });
    await waitForSavedLocally(page);
    nextTabs = await getTabs(page);
    expect(nextTabs.length === 1, "New document from the empty workbench should open one tab.");
    expect(nextTabs[0]?.active, "New document from the empty workbench should activate the new tab.");
    expect((await page.locator(".empty-file-state").count()) === 0, "New file should leave the empty workbench.");
    expect((await page.locator(".document-controls").count()) === 1, "New file should restore file tools.");
    await waitForEditorFocus(page);
  });

  await withPage(browser, "/", async (page) => {
    await page.locator(".empty-file-actions").getByRole("button", { name: "New document" }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
      document.documentElement.dataset.themePreference = "dark";
      document.documentElement.style.colorScheme = "dark";
    });
    await page.locator(".share-trigger").click();
    await waitForShareDialogState(page, { panel: "Share link" });
    expect((await page.locator(".share-modal").count()) === 1, "Share should open a centered modal.");
    const shareModal = page.locator(".share-modal");
    expect((await shareModal.getByRole("tab").count()) === 0, "Share modal should be a single room/snapshot/export screen.");
    expect((await shareModal.getByRole("tab", { name: "Publish" }).count()) === 0, "Share modal should keep Publish hidden for now.");
    expect((await page.getByText("Live collaboration").count()) > 0, "Share modal should default to live collaboration.");
    expect((await page.locator(".share-included-documents").count()) === 0, "Share modal should not expose document-level sharing scope.");
    expect((await page.getByText("Invite agent").count()) === 0, "Share modal should not invite agents before a room exists.");
    expect((await page.getByText("Export to link").count()) > 0, "Share modal should expose link export as a first-class local action.");
    expect(
      (await page.getByText("Create an encrypted point-in-time copy. Changes do not sync back.").count()) === 1,
      "Export link should describe an independent encrypted copy.",
    );
    expect((await page.getByRole("button", { name: "Export to link" }).count()) === 1, "Share modal should export the whole workspace to a link.");
    expect((await page.getByText(/unavailable in this build/i).count()) === 0, "Share modal should not expose build-status copy to users.");
    expect((await page.getByText("Not live").count()) === 0, "Share link should not show redundant pre-live state text.");
    expect((await page.getByRole("button", { name: "Start session" }).count()) === 1, "Share should start a workspace room.");
    expect(
      (await page.getByLabel("Your collaboration name").count()) === 0,
      "Share link should not ask for a name before a session exists.",
    );
    expect((await page.locator(".share-export-section").getByRole("heading", { name: "Export" }).count()) === 1, "Export actions should live on the single Share screen.");
    expect((await page.getByRole("button", { name: /File \.md/ }).count()) === 0, "Share modal should not expose a current-file download.");
    expect((await page.getByRole("button", { name: /Copy File/ }).count()) === 0, "Share modal should not copy files from Export.");
    expect((await page.getByRole("button", { name: /Export to file/ }).count()) === 1, "Share modal should export the workspace archive as a file.");
    const exportOptions = await page.locator(".share-export-option").evaluateAll((options) =>
      options.map((option) => option.textContent?.replace(/\s+/g, " ").trim() ?? ""),
    );
    expect(exportOptions.length === 2, "Link and file exports should have separate semantic rows.");
    expect(
      exportOptions[0]?.includes("Export to link") && exportOptions[0]?.includes("encrypted point-in-time copy"),
      "The link export row should own its encrypted-copy description.",
    );
    expect(
      exportOptions[1]?.includes("Export to file") && exportOptions[1]?.includes("folder structure"),
      "The file export row should own its local ZIP description.",
    );
    expect((await page.getByText("Publish project").count()) === 0, "Publish actions should not be available by default.");
    expect((await page.getByRole("button", { name: "Copy llms.txt" }).count()) === 0, "Publish actions should not be on the default Share panel.");

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
    expect((await page.getByText("For people", { exact: true }).count()) === 0, "Publish should not split people and agent features.");
    expect((await page.getByText("For agents", { exact: true }).count()) === 0, "Publish should not split people and agent features.");
    expect((await page.getByRole("button", { name: "Create publish URL" }).count()) === 0, "Publish should not expose fake URL creation.");
    expect((await page.getByRole("button", { name: "Copy publish URL" }).count()) === 0, "Publish should not copy a URL before publishing.");
    expect((await page.getByRole("button", { name: "Copy llms.txt URL" }).count()) === 0, "Publish should not copy endpoint URLs before publishing.");
    expect((await page.getByRole("button", { name: "Copy llms-full.txt URL" }).count()) === 0, "Publish should not copy endpoint URLs before publishing.");
    expect((await page.getByRole("button", { name: "Copy page" }).count()) === 0, "Publish should not look like a file export panel.");
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
    await waitForShareDialogState(page, { panel: "Share link" });
    const shareModalStyle = await page.evaluate(() => {
      const modal = document.querySelector(".share-modal");
      const title = document.querySelector("#share-modal-title");
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
        tabsBackground: tabsStyle?.backgroundColor ?? "none",
        activeTabBackground: activeTabStyle?.backgroundColor ?? "none",
        dividerCount: modal?.querySelectorAll(".share-modal-divider").length ?? 0,
        shareDividerCount: modal?.querySelectorAll(".share-section-divider").length ?? 0,
      };
    });
    expect(shareModalStyle.titleText === "Share", "Share modal title should not depend on the current file.");
    expect(
      shareModalStyle.modalBackground !== "rgb(255, 255, 255)",
      "Share modal should follow the active dark app theme.",
    );
    expect(
      shareModalStyle.tabsBackground === "none",
      "Share modal should not render legacy tab chrome.",
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
    expect(shareModalStyle.tabCount === 0, "Share modal should not expose legacy purpose tabs.");
    expect(shareModalStyle.dividerCount === 0, "Share modal should not use legacy stacked Or dividers.");
    expect(shareModalStyle.shareDividerCount === 1, "Share modal should separate live room and export choices.");
    expect(/whole workspace/i.test(shareModalStyle.text), "Share modal should make the whole-workspace contract explicit.");
    expect(/point-in-time/i.test(shareModalStyle.text), "Export link should be described as an independent point-in-time copy.");
    expect(!/\bpublish\b/i.test(shareModalStyle.text), "Export link should not be described as publishing.");
    const modalPointerState = await page.evaluate(() => {
      const fileShell = document.querySelector(".file-shell");
      const workspace = document.querySelector(".workspace");
      const editorControlRow = document.querySelector(".document-toolbar-row");
      const statusBar = document.querySelector(".file-status-bar");
      return {
        fileShellHasModalClass: Boolean(fileShell?.classList.contains("share-modal-open")),
        workspacePointerEvents: workspace ? window.getComputedStyle(workspace).pointerEvents : "",
        editorControlsPointerEvents: editorControlRow ? window.getComputedStyle(editorControlRow).pointerEvents : "",
        statusBarPointerEvents: statusBar ? window.getComputedStyle(statusBar).pointerEvents : "",
      };
    });
    expect(modalPointerState.fileShellHasModalClass, "Share modal should mark the file shell as modal-open.");
    expect(modalPointerState.workspacePointerEvents === "none", "Share modal should block editor and split divider interaction behind it.");
    expect(modalPointerState.editorControlsPointerEvents === "none", "Share modal should block editor chrome behind it.");
    expect(modalPointerState.statusBarPointerEvents === "none", "Share modal should block status bar interaction behind it.");

    await page.evaluate(() => {
      window.__tabulaClipboard = [];
      navigator.clipboard.writeText = async (text) => {
        window.__tabulaClipboard.push(text);
      };
    });
    expect((await page.getByRole("tab", { name: "Publish" }).count()) === 0, "Publish should remain hidden in the Share modal.");
    expect((await page.getByText("Publish with Tabula +").count()) === 0, "Hidden Publish should not expose Plus copy.");
    expect((await page.getByRole("button", { name: "Publish current page" }).count()) === 0, "Hidden Publish should not expose publishing actions.");

    await waitForShareDialogState(page, { panel: "Share link" });
    await page.getByRole("button", { name: "Start session" }).click();
    await page.waitForSelector(".share-link-display");
    expect(
      new URL(page.url()).hash.startsWith("#room="),
      "Live -> Start session should move the current tab to the canonical room URL.",
    );
    expect(
      (await page.getByText("Live collaboration").count()) > 0,
      "Starting live should keep the Share link panel heading stable.",
    );
    expect(
      (await page.getByText("Create an encrypted room for real-time collaboration.").count()) > 0,
      "Starting live should keep the Share link panel explanation stable.",
    );
    expect((await page.getByText("Copy agent prompt").count()) > 0, "Live modal should expose the agent prompt action after a room starts.");
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
    expect(page.url().includes("#room="), "Live -> Start session should keep the current tab on the room route.");
  });

  if (!externalUrl) {
    await stopRoomServer();
    try {
      await withPage(browser, "/", async (page) => {
        await page.locator(".empty-file-actions").getByRole("button", { name: "New document" }).click();
        await waitForActiveTab(page, { startsWith: "Untitled" });
        await waitForEditorReady(page, { mode: "edit" });
        await page.locator(".share-trigger").click();
        await waitForShareDialogState(page, { panel: "Share link" });
        await page.getByRole("button", { name: "Start session" }).click();

        const startSamples = [];
        for (let index = 0; index < 30; index += 1) {
          const modalCount = await page.locator(".share-modal").count();
          const startButtonCount = await page.getByRole("button", { name: "Start session" }).count();
          const inviteLinkCount = await page.locator(".share-link-display").count();
          const stopSessionCount = await page.getByRole("button", { name: "Stop session" }).count();
          const toastCount = await page.locator(".app-toast").count();
          startSamples.push({
            url: page.url(),
            modalCount,
            startButtonCount,
            inviteLinkCount,
            stopSessionCount,
          });
          if (toastCount > 0) {
            break;
          }
          await page.waitForTimeout(100);
        }
        await page.waitForSelector(".app-toast", { timeout: 8_000 });

        const failedStartState = await page.evaluate(() => {
          const toast = document.querySelector(".app-toast");
          const toastRect = toast?.getBoundingClientRect();
          return {
            modalCount: document.querySelectorAll(".share-modal").length,
            startButtonCount: Array.from(document.querySelectorAll("button")).filter(
              (button) => button.textContent?.replace(/\s+/g, " ").trim() === "Start session",
            ).length,
            inviteLinkCount: document.querySelectorAll(".share-link-display").length,
            stopSessionCount: Array.from(document.querySelectorAll("button")).filter(
              (button) => button.textContent?.replace(/\s+/g, " ").trim() === "Stop session",
            ).length,
            toastText: toast?.textContent?.replace(/\s+/g, " ").trim() ?? "",
            toastWidth: toastRect?.width ?? 0,
            toastScrollWidth: toast?.scrollWidth ?? 0,
            url: window.location.href,
          };
        });
        expect(
          startSamples.every((sample) => !new URL(sample.url).hash.startsWith("#room=")) &&
            !new URL(failedStartState.url).hash.startsWith("#room="),
          "Failed Start session should not flash or leave a room URL.",
        );
        expect(
          failedStartState.toastText === "Live collaboration isn’t available right now.",
          "Failed Start session should use short user-facing toast copy.",
        );
        expect(
          failedStartState.toastScrollWidth <= Math.ceil(failedStartState.toastWidth) + 1,
          "Failed Start session toast text should fit inside the toast.",
        );
        expect(
          startSamples.every((sample) => sample.inviteLinkCount === 0 && sample.stopSessionCount === 0) &&
            failedStartState.modalCount === 0 &&
            failedStartState.startButtonCount === 0 &&
            failedStartState.inviteLinkCount === 0 &&
            failedStartState.stopSessionCount === 0,
          "Failed Start session should close Share without showing invite-link controls.",
        );
        expect(
          (await page.locator(".share-live-status.failed").count()) === 0,
          "Failed Start session should not leave a failed live-room card in Share.",
        );
      });
    } finally {
      await startRoomServer();
    }
  }

  await withPage(browser, `/#room=browserroom,${validRoomKey}`, async (page) => {
    await page.waitForSelector(".live-room-loading-surface");
    const tabs = await getTabs(page);

    expect(
      tabs.every((tab) => !tab.title?.startsWith("Shared ")),
      `Opening an empty room should not expose the internal live-room placeholder as a document tab.\n${JSON.stringify(tabs, null, 2)}`,
    );
    expect(
      (await page.getByText(/^Shared browserroom/).count()) === 0,
      "Opening an empty room should not render the generated room placeholder title.",
    );
    expect(
      (await page.getByText("Opening live room...").count()) === 1,
      "Opening an empty room should show a quiet room-loading surface.",
    );
    expect(
      page.url().endsWith(`/#room=browserroom,${validRoomKey}`),
      "Opening a room should keep the room URL active.",
    );
  });

  await withPage(browser, "/", async (page) => {
    await openProjectMenu(page);

    const menuSurface = await page.evaluate(() => ({
      menuOpen: Boolean(document.querySelector(".workspace-menu-popover")),
      menuBorderTopWidth: getComputedStyle(document.querySelector(".workspace-menu-popover")).borderTopWidth,
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
    expect(menuSurface.menuBorderTopWidth === "0px", "Workspace menus should use elevation without static borders.");
    expect(menuSurface.templateButtonCount === 0, "Templates should not ship as a visible menu item yet.");
    expect(menuSurface.agentButtonCount === 0, "Agent should not ship as an inert menu item yet.");
    expect(menuSurface.templateSurfaceCount === 0, "Template detail surfaces should be removed until templates are real.");
    expect(
      menuSurface.menuRows.includes("New document") && menuSurface.menuRows.includes("Open Markdown file…"),
      "The menu should keep the must-have document start actions.",
    );

    await page.mouse.click(760, 420);
    expect(
      (await page.locator(".workspace-menu-popover").count()) === 0,
      "Clicking outside the workspace menu should close it.",
    );

    await openProjectMenu(page);
    await page.locator(".workspace-menu-popover").getByRole("button", { name: "New document", exact: true }).click();
    await waitForActiveTab(page, { startsWith: "Untitled" });
    await waitForEditorReady(page, { mode: "edit" });
    const tabs = await getTabs(page);
    const activeTab = tabs.find((tab) => tab.active);
    expect(activeTab?.title.startsWith("Untitled"), "Menu New document should create and activate the next blank document.");
    expect(!activeTab?.visibleTitle.endsWith(".md"), "New blank tabs should still hide the Markdown extension.");
  });

  await withPage(browser, "/", async (page) => {
    await openMarkdownFile(page, {
      content: "# Preview fixture\n\nThis document keeps its own view mode.",
    });
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForActiveTab(page, { exact: "README.md" });
    let tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.mode === "Preview", "Preview mode should be reflected in the active tab.");
    expect(
      JSON.stringify(await getViewModeActionLabels(page)) === JSON.stringify(["Edit", "Split", "Preview"]),
      "The view-mode control should keep Edit, Split, and Preview in a stable order.",
    );
    expect(
      JSON.stringify(await getViewModeSlots(page)) ===
        JSON.stringify([
          { viewMode: "edit", label: "Edit", active: false },
          { viewMode: "split", label: "Split", active: false },
          { viewMode: "preview", label: "Preview", active: true },
        ]),
      "Preview mode should select Preview without changing the control positions.",
    );
    expect(
      (await page.getByRole("button", { name: "Preview", exact: true }).getAttribute("aria-pressed")) === "true",
      "The active Preview mode should remain visible and selected.",
    );
    expect(
      (await page.getByRole("button", { name: "Split", exact: true }).count()) === 1,
      "Preview mode should expose Split for direct comparison.",
    );

    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.mode === "Edit", "New local tabs should start in Edit mode.");
    expect(
      JSON.stringify(await getViewModeActionLabels(page)) === JSON.stringify(["Edit", "Split", "Preview"]),
      "Edit mode should keep the stable view-mode order.",
    );
    expect(
      JSON.stringify(await getViewModeSlots(page)) ===
        JSON.stringify([
          { viewMode: "edit", label: "Edit", active: true },
          { viewMode: "split", label: "Split", active: false },
          { viewMode: "preview", label: "Preview", active: false },
        ]),
      "Edit mode should select Edit without changing the control positions.",
    );
    expect(
      (await page.getByRole("button", { name: "Edit", exact: true }).getAttribute("aria-pressed")) === "true",
      "The active Edit mode should remain visible and selected.",
    );

    await page.getByRole("button", { name: "Split", exact: true }).click();
    await waitForEditorReady(page, { mode: "split" });
    tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.mode === "Split", "Split should be reachable from Edit mode.");
    expect(
      JSON.stringify(await getViewModeActionLabels(page)) === JSON.stringify(["Edit", "Split", "Preview"]),
      "Split mode should keep the stable view-mode order.",
    );
    expect(
      JSON.stringify(await getViewModeSlots(page)) ===
        JSON.stringify([
          { viewMode: "edit", label: "Edit", active: false },
          { viewMode: "split", label: "Split", active: true },
          { viewMode: "preview", label: "Preview", active: false },
        ]),
      "Split mode should select Split without changing the control positions.",
    );

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.mode === "Edit", "Pressing Edit from Split should return to Edit mode.");

    await page.locator('.tab-item[data-file-name="README.md"] .tab-select-button').click();
    await waitForActiveTab(page, { exact: "README.md" });
    tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.mode === "Preview", "README tab should keep its Preview mode.");
  });
}

async function waitForEditorFocus(page) {
  try {
    await page.waitForFunction(
      () => {
        const editor = document.querySelector(".markdown-editor");
        return Boolean(editor?.contains(document.activeElement));
      },
      undefined,
      { timeout: 2_000 },
    );
  } catch (error) {
    throw new Error(`New file from the empty workbench should focus the Editor.\n${error.message}`);
  }
}
