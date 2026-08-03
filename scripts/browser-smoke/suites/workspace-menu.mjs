import {
  getViewModeActionLabels,
  getViewModeSlots,
  selectDocumentViewMode,
} from "../support/view-mode.mjs";
export const id = "workspace";
export const requiresRoomService = true;
export const description = "First screen, tabs, empty state, share, templates, and view-mode chrome.";
const validRoomKey = "A".repeat(43);

export async function run(ctx) {
  const {
    appNewFileShortcut,
    browser,
    expect,
    externalUrl,
    getTabs,
    openMarkdownFile,
    openProjectMenu,
    waitForActiveTab,
    waitForEditorReady,
    waitForFileCount,
    waitForLeftPanel,
    waitForSavedLocally,
    waitForShareDialogState,
    waitForText,
    startRoomServer,
    stopRoomServer,
    withPage,
  } = ctx;
  const ensureWorkspacePanelOpen = async (page) => {
    if ((await page.locator(".left-panel").count()) === 0) {
      await page.getByRole("button", { name: "Workspace panel", exact: true }).click();
    }
    await waitForLeftPanel(page, "Workspace panel");
  };

  await withPage(browser, "/", async (page) => {
    await page.locator(".empty-file-state").waitFor({ state: "visible" });
    expect(
      (await page.getByText("Tabula couldn’t open this workspace.", { exact: true }).count()) === 0,
      "Browser storage write failures should not replace the workspace with a fatal error.",
    );
  }, {
    initScript: () => {
      Storage.prototype.setItem = () => {
        throw new DOMException("Storage quota exceeded", "QuotaExceededError");
      };
    },
  });

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
    expect((await page.locator(".share-trigger").count()) === 0, "Share should stay hidden until the workspace has a document.");
    expect((await page.locator(".right-panel-trigger").count()) === 0, "Document context should stay hidden until a document is active.");
    expect((await page.getByRole("button", { name: "More document actions" }).count()) === 0, "Document controls should not expose a single-command More menu.");
    await page.evaluate(() => {
      window.__tabulaClipboard = [];
      navigator.clipboard.writeText = async (text) => {
        window.__tabulaClipboard.push(text);
      };
    });
    await page.getByRole("button", { name: "Search", exact: true }).click();
    const emptyLauncher = page.getByRole("dialog", {
      name: "Search",
      exact: true,
    });
    await emptyLauncher.waitFor({ state: "visible" });
    expect(
      await emptyLauncher.getByRole("option", { name: /New document/ }).isVisible() &&
        (await emptyLauncher.getByRole("option", { name: /Workspace search/ }).count()) === 0,
      "Search should remain useful as a launcher before the workspace has documents.",
    );
    await page.keyboard.press("Escape");
    await emptyLauncher.waitFor({ state: "detached" });
    expect((await page.locator(".live-button").count()) === 0, "Live should live inside Share, not as a separate top-right action.");
    expect((await page.locator(".blank-document-action").count()) === 0, "The first screen should not show canvas-style onboarding actions.");
    expect((await page.locator(".empty-feature-callout").count()) === 0, "The first screen should not show canvas-style callouts.");
    await page.locator(".empty-file-actions").getByRole("button", { name: "New document" }).click();
    await waitForActiveTab(page, { exact: "Untitled.md" });
    await selectDocumentViewMode(page, "Edit");
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
    expect(
      (await page.getByRole("button", { name: "Manage open tabs", exact: true }).count()) === 1,
      "Open-tab management should stay available with a single document.",
    );
    await page.getByRole("button", { name: "Manage open tabs", exact: true }).click();
    await page.locator(".open-tabs-menu").waitFor({ state: "visible" });
    expect(
      (await page.getByRole("menuitemradio", { name: "Untitled", exact: true }).count()) === 1,
      "Open-tab management should list the current document.",
    );
    expect(
      await page.getByRole("menuitem", { name: "Close other", exact: true }).isDisabled(),
      "Close other should be unavailable when only one document is open.",
    );
    expect(
      await page.getByRole("menuitem", { name: "Reopen last closed", exact: true }).isDisabled(),
      "Reopen should be unavailable before any tab has been closed.",
    );
    const openTabsMenuOrder = await page.locator(".open-tabs-menu")
      .locator('[role="menuitem"], [role="menuitemradio"]')
      .allTextContents();
    expect(
      openTabsMenuOrder.map((label) => label.trim()).join("|") ===
        "Close other|Close all|Reopen last closed|Untitled",
      "Tab management should lead with concise actions, then list open documents.",
    );
    expect(
      (await page.locator(".open-tabs-menu [role='separator']").count()) === 1,
      "Tab management should separate actions from the open-document list.",
    );
    await page.keyboard.press("Escape");
    expect((await page.locator(".intro-action-button").count()) === 0, "Blank writing documents should not show README actions.");

    await ensureWorkspacePanelOpen(page);
    await page.getByRole("button", { name: "More actions for Untitled.md" }).click();
    expect(
      (await page.locator(".workspace-file-action-menu").evaluate((menu) => getComputedStyle(menu).borderTopWidth)) === "0px",
      "File action menus should use elevation without a static border.",
    );
    await page.getByRole("menuitem", { name: "Copy Markdown" }).click();
    expect((await page.evaluate(() => window.__tabulaClipboard.at(-1) ?? "")) === "", "Blank file copy should preserve its source.");
    await page.locator(".left-panel").getByRole("button", { name: "Workspace panel", exact: true }).click();

    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForActiveTab(page, { startsWith: "Untitled" });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    nextTabs = await getTabs(page);
    expect(nextTabs.find((tab) => tab.active)?.mode === "Edit", "New documents should open as blank Edit documents.");
    expect(
      (await page.locator(".tabbar").getByRole("button", { name: "Manage open tabs", exact: true }).count()) === 1 &&
        (await page.locator(".top-right-zone").getByRole("button", { name: "Manage open tabs", exact: true }).count()) === 0,
      "Open-tab management should lead the tab strip instead of sitting with workspace actions.",
    );
    const tabManagementPosition = await page.evaluate(() => {
      const tabbar = document.querySelector(".tabbar");
      const trigger = tabbar?.querySelector(".open-tabs-trigger");
      const firstTab = tabbar?.querySelector(".tab-item");
      const triggerRect = trigger?.getBoundingClientRect();
      const firstTabRect = firstTab?.getBoundingClientRect();
      return Boolean(
        tabbar &&
        trigger &&
        firstTab &&
        tabbar.firstElementChild === trigger &&
        triggerRect &&
        firstTabRect &&
        triggerRect.right <= firstTabRect.left &&
        firstTabRect.left - triggerRect.right <= 12,
      );
    });
    expect(
      tabManagementPosition,
      "Open-tab management should sit immediately before the first tab.",
    );
    await page.getByRole("button", { name: "Manage open tabs", exact: true }).click();
    await page.locator(".open-tabs-menu").waitFor({ state: "visible" });
    expect(
      (await page.getByRole("menuitemradio").count()) === 2,
      "Open-tab management should list every open document.",
    );
    await page.getByRole("menuitemradio", { name: "Untitled", exact: true }).click();
    await waitForActiveTab(page, { exact: "Untitled.md" });

    await page.getByRole("button", { name: "Manage open tabs", exact: true }).click();
    await page.locator(".open-tabs-menu").waitFor({ state: "visible" });
    await page.getByRole("menuitem", { name: "Close other", exact: true }).click();
    expect((await page.locator(".tab-item").count()) === 1, "Close other should preserve only the active document.");

    await page.getByRole("button", { name: "Manage open tabs", exact: true }).click();
    await page.locator(".open-tabs-menu").waitFor({ state: "visible" });
    await page.getByRole("menuitem", { name: "Reopen last closed", exact: true }).click();
    await waitForActiveTab(page, { exact: "Untitled 2.md" });
    expect((await page.locator(".tab-item").count()) === 2, "Reopen should restore the most recently closed tab.");

    await page.getByRole("button", { name: "Manage open tabs", exact: true }).click();
    await page.locator(".open-tabs-menu").waitFor({ state: "visible" });
    await page.getByRole("menuitem", { name: "Close all", exact: true }).click();
    await page.locator(".empty-file-state").waitFor({ state: "visible" });
    expect((await page.locator(".tab-item").count()) === 0, "Close all tabs should clear the open-document state.");
    expect(
      (await page.getByRole("button", { name: "Manage open tabs", exact: true }).count()) === 1,
      "Tab management should remain available after closing all tabs so the last tab can be reopened.",
    );
    await ensureWorkspacePanelOpen(page);
    expect(
      (await page.locator(".workspace-file-tree-row.file").count()) === 2,
      "Close all tabs should leave the workspace documents available in Files.",
    );
  });

  await withPage(browser, "/", async (page) => {
    const marker = "Referral navigation keeps this local document.";
    await page.locator(".empty-file-actions").getByRole("button", { name: "New document" }).click();
    await waitForActiveTab(page, { exact: "Untitled.md" });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await page.locator(".cm-content").click();
    await page.keyboard.insertText(marker);
    await page.waitForTimeout(600);
    await waitForSavedLocally(page);

    const referralUrl = new URL(page.url());
    referralUrl.searchParams.set("ref", "linkedin");
    await page.goto(referralUrl.toString());
    await page.waitForSelector(".tabbar");
    await waitForActiveTab(page, { exact: "Untitled.md" });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });

    expect(new URL(page.url()).searchParams.get("ref") === "linkedin", "Referral navigation should keep its source label.");
    expect(
      (await page.locator(".cm-content").textContent())?.includes(marker),
      "Referral query navigation should restore the existing local workspace from the same origin.",
    );
  });

  await withPage(browser, "/", async (page) => {
    await page.keyboard.press(appNewFileShortcut);
    await waitForActiveTab(page, { exact: "Untitled.md" });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await page.locator(".cm-content").click();
    await page.keyboard.insertText("# Browser draft");

    await page.locator('input[aria-label="Import folder"]').evaluate((input) => {
      const dataTransfer = new DataTransfer();
      const launchNotes = new File(["# Launch notes\n\nReady."], "Launch notes.md", { type: "text/markdown" });
      const questions = new File(["# Questions"], "Questions.md", { type: "text/markdown" });
      const query = new File(["SELECT 1;"], "query.sql", { type: "text/plain" });
      const notes = new File(["preserved"], "notes.txt", { type: "text/plain" });
      Object.defineProperty(launchNotes, "webkitRelativePath", { value: "Workspace/Planning/Launch notes.md" });
      Object.defineProperty(questions, "webkitRelativePath", { value: "Workspace/Planning/Research/Questions.md" });
      Object.defineProperty(query, "webkitRelativePath", { value: "Workspace/references/query.sql" });
      Object.defineProperty(notes, "webkitRelativePath", { value: "Workspace/Planning/notes.txt" });
      dataTransfer.items.add(launchNotes);
      dataTransfer.items.add(questions);
      dataTransfer.items.add(query);
      dataTransfer.items.add(notes);
      Object.defineProperty(input, "files", { configurable: true, value: dataTransfer.files });
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await page.getByRole("dialog", { name: "Import folder" }).waitFor();
    const detectedWorkspace = page.getByRole("region", {
      name: "Detected workspace",
    });
    expect(
      await detectedWorkspace.getByText("Plain Markdown", {
        exact: true,
      }).isVisible() &&
        await detectedWorkspace.getByText(
          "2 Markdown · 2 assets",
          { exact: true },
        ).isVisible(),
      "Folder import should distinguish Markdown documents from preserved bundle assets before replacing local state.",
    );
    expect(
      (await page.getByText("Planning/Research/Questions.md", { exact: true }).count()) === 1 &&
        (await page.getByText("references/query.sql", { exact: true }).count()) === 1 &&
        (await page.getByText("Planning/notes.txt", { exact: true }).count()) === 1,
      "Folder import should preview Markdown documents and every preserved bundle asset before replacing local state.",
    );
    expect(
      await page.getByText(
        "Importing replaces the current browser workspace, including its documents and comments. Export it first if you may need it again.",
        { exact: true },
      ).isVisible(),
      "Folder import should explicitly warn that it replaces the current browser workspace.",
    );
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", {
      name: "Export current workspace",
      exact: true,
    }).click();
    const currentWorkspaceDownload = await downloadPromise;
    expect(
      (await currentWorkspaceDownload.suggestedFilename()).endsWith(".zip"),
      "Folder import should let people export the current browser workspace before replacement.",
    );
    await page.getByRole("button", { name: "Import and replace", exact: true }).click();
    await page.locator(".empty-file-state").waitFor({ state: "visible" });
    expect(
      (await page.locator(".tab-item").count()) === 0 &&
        (await page.getByRole("dialog", {
          name: "OKF workspace imported",
        }).count()) === 0,
      "A plain Markdown import should preserve its tree without opening tabs or adding OKF orientation.",
    );
    await ensureWorkspacePanelOpen(page);
    await page.getByRole("button", { name: "Open Launch notes.md" }).click();
    await waitForActiveTab(page, { exact: "Launch notes.md" });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });

    await page.locator(".tab-item.active").hover();
    await page.locator(".tab-item.active .tab-action-button.close").click();
    await page.locator(".empty-file-state").waitFor({ state: "visible" });
    expect(
      (await page.locator(".share-trigger").count()) === 1,
      "Share should remain available when workspace files exist but every document tab is closed.",
    );
    await page.locator(".share-trigger").click();
    const startSessionButton = page.getByRole("button", { name: "Start session" });
    expect(
      await startSessionButton.isEnabled(),
      "Workspace collaboration should start when documents exist even if every document tab is closed.",
    );
    await startSessionButton.click();
    await page.waitForFunction(() => window.location.hash.startsWith("#room="));
    expect(
      (await page.locator(".tab-item").count()) === 0,
      "Starting workspace collaboration should not force a document tab open.",
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
    expect(
      await page.getByRole("button", { name: "Export workspace (.zip)", exact: true }).isEnabled(),
      "The workspace menu should export a ZIP when the workspace has documents.",
    );
    await page.getByRole("button", { name: "Close Workspace menu", exact: true }).click();
    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    const documentDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export document (.md)", exact: true }).click();
    const documentDownload = await documentDownloadPromise;
    expect(
      documentDownload.suggestedFilename() === "Untitled.md",
      "Document export should download the active Markdown file.",
    );
    await openProjectMenu(page);
    await openProjectMenu(page);
    const workspaceDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export workspace (.zip)", exact: true }).click();
    const workspaceDownload = await workspaceDownloadPromise;
    expect(
      workspaceDownload.suggestedFilename() === "Project.zip",
      "Workspace export should use the workspace identity as the ZIP filename.",
    );
    await openProjectMenu(page);
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
    await ensureWorkspacePanelOpen(page);
    const remainingFiles = await page.locator(".workspace-file-tree-row.file").evaluateAll((rows) =>
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
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await page.locator(".share-trigger").click();
    await waitForShareDialogState(page, { panel: "Share link" });
    expect(await page.locator("#root").evaluate((root) => root.inert), "An open modal should make the app root inert.");
    expect(
      (await page.locator("#root").getAttribute("aria-hidden")) === "true",
      "An open modal should hide the background app from assistive technology.",
    );
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
  });

  await withPage(browser, "/", async (page) => {
    if ((await page.locator(".tab-item").count()) === 0) {
      await page.locator(".empty-file-actions").getByRole("button", { name: "New document" }).click();
      await selectDocumentViewMode(page, "Edit");
      await waitForEditorReady(page, { mode: "edit" });
    }

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
    expect(
      (await page.locator(".share-trigger").count()) === 1,
      "A workspace with closed tabs should keep workspace sharing available.",
    );

    const emptyChromeState = await page.evaluate(() => {
      const rightPanelButton = document.querySelector('button[aria-label="Toggle side panel"]');
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
        "Open Markdown. Share one link. Edit with people or agents.",
      ) &&
        !emptyChromeState.workspaceText.includes("Start with Markdown.") &&
        !emptyChromeState.workspaceText.includes("Tabula turns Markdowns into collaborative documents for people and agents.") &&
        emptyChromeState.workspaceText.includes("New document") &&
        emptyChromeState.workspaceText.includes("Open Markdown file") &&
        emptyChromeState.workspaceText.includes("Import folder") &&
        !emptyChromeState.workspaceText.includes("Browse project files") &&
        !emptyChromeState.workspaceText.includes("Help") &&
        !emptyChromeState.workspaceText.includes("Import document") &&
        !emptyChromeState.workspaceText.includes("Export workspace") &&
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
      emptyTypography.every(({ fontSize }) => fontSize === 12 || fontSize === 13 || fontSize === 15),
      `No-open-file state should use the shared 12px secondary, 13px body, and 15px surface-heading type scale (${JSON.stringify(emptyTypography)}).`,
    );

    await ensureWorkspacePanelOpen(page);
    expect((await page.locator(".left-panel").count()) === 1, "The Workspace panel should expose project files.");
    const closedTabFileState = await page.evaluate(() => ({
      fileRows: Array.from(document.querySelectorAll(".workspace-file-tree-row.file")).map((row) => ({
        title: row.getAttribute("data-file-name") ?? "",
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
        "Open Markdown. Share one link. Edit with people or agents.",
      ),
      "Reloading with no open tabs should keep the branded start state.",
    );

    if ((await page.locator(".left-panel").count()) === 0) {
      await ensureWorkspacePanelOpen(page);
    }
    await page.getByRole("button", { name: "Open Untitled.md" }).click();
    await waitForActiveTab(page, { exact: "Untitled.md" });
    const reopenedTabs = await getTabs(page);
    expect(reopenedTabs.length === 1, "Selecting a file in the side panel should reopen it as a tab.");
    expect(reopenedTabs[0]?.title === "Untitled.md", "The Files panel should reopen the selected document.");
    expect(reopenedTabs[0]?.active, "Reopened file should become active.");

    await page.locator(".tab-item.active").hover();
    await page.locator(".tab-item.active .tab-action-button.close").click();
    await waitForFileCount(page, 0);
    await page.keyboard.press(appNewFileShortcut);
    await waitForFileCount(page, 1);
    await waitForEditorReady(page, { mode: "visual" });
    await waitForSavedLocally(page);
    let nextTabs = await getTabs(page);
    expect(nextTabs.length === 1, "New document shortcut from the empty workbench should open one tab.");
    expect(nextTabs[0]?.active, "New document shortcut from the empty workbench should activate the new tab.");

    await page.locator(".tab-item.active").hover();
    await page.locator(".tab-item.active .tab-action-button.close").click();
    await waitForFileCount(page, 0);
    await page.locator(".empty-file-actions").getByRole("button", { name: "New document" }).click();
    await waitForFileCount(page, 1);
    await waitForEditorReady(page, { mode: "visual" });
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
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await page.locator(".cm-content").click();
    await page.keyboard.insertText("Live preview transition stays visible.");
    await selectDocumentViewMode(page, "Preview");
    await page.locator(".preview-surface").getByText("Live preview transition stays visible.").waitFor();
    await page.evaluate(() => {
      window.__tabulaSawEmptyPreview = false;
      window.__tabulaPreviewObserver = new MutationObserver(() => {
        if (document.body.textContent?.includes("Nothing to preview")) {
          window.__tabulaSawEmptyPreview = true;
        }
      });
      window.__tabulaPreviewObserver.observe(document.body, { childList: true, subtree: true });
    });
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
    expect((await page.getByText("Open a live collaboration room", { exact: true }).count()) > 0, "Share modal should lead with an explicit live-room action.");
    expect((await page.locator(".share-included-documents").count()) === 0, "Share modal should not expose document-level sharing scope.");
    expect((await page.getByText("Invite agent").count()) === 0, "Share modal should not invite agents before a room exists.");
    expect((await page.getByText("Create link").count()) > 0, "Share modal should expose link export as a first-class local action.");
    expect(
      (await page.getByText(
        "Create an encrypted copy of the workspace, including comments. People with the link can open that snapshot, but later changes won’t sync.",
        { exact: true },
      ).count()) === 1,
      "Export link should describe an independent encrypted copy.",
    );
    expect((await page.getByRole("button", { name: "Create link" }).count()) === 1, "Share modal should export the whole workspace to a link.");
    expect((await page.getByText(/unavailable in this build/i).count()) === 0, "Share modal should not expose build-status copy to users.");
    expect((await page.getByText("Not live").count()) === 0, "Share link should not show redundant pre-live state text.");
    expect((await page.getByRole("button", { name: "Start session" }).count()) === 1, "Share should start a workspace room.");
    expect(
      (await page.getByLabel("Your collaboration name").count()) === 0,
      "Share link should not ask for a name before a session exists.",
    );
    expect((await page.locator(".share-export-section .share-choice-title").getByText("Share a snapshot by link", { exact: true }).count()) === 1, "Share should present snapshot sharing as the alternative to live collaboration.");
    expect((await page.getByRole("button", { name: /File \.md/ }).count()) === 0, "Share modal should not expose a current-file download.");
    expect((await page.getByRole("button", { name: /Copy File/ }).count()) === 0, "Share modal should not copy files from Export.");
    expect((await page.getByRole("button", { name: /Export to file/ }).count()) === 0, "Share should keep local ZIP export in the workspace menu.");
    const exportOptions = await page.locator(".share-export-section .share-choice-action").evaluateAll((options) =>
      options.map((option) => option.textContent?.replace(/\s+/g, " ").trim() ?? ""),
    );
    expect(exportOptions.length === 1, "Share should contain only the link export row.");
    expect(
      exportOptions[0]?.includes("Create link"),
      "The link export row should contain the link action.",
    );
    expect((await page.locator(".live-popover").count()) === 0, "Live should not use a separate popover.");
    await waitForShareDialogState(page, { panel: "Share link" });
    const shareModalStyle = await page.evaluate(() => {
      const modal = document.querySelector(".share-modal");
      const title = document.querySelector("#share-modal-title");
      const choiceActions = Array.from(document.querySelectorAll(".share-choice-action"));
      const firstChoiceAction = choiceActions[0];
      const exportSection = document.querySelector(".share-export-section");
      const chooserNote = document.querySelector(".share-chooser-note");
      const tabs = document.querySelector(".share-modal-tabs");
      const activeTab = document.querySelector(".share-modal-tabs button.active");
      const modalStyle = modal ? window.getComputedStyle(modal) : null;
      const titleStyle = title ? window.getComputedStyle(title) : null;
      const choiceStyle = firstChoiceAction ? window.getComputedStyle(firstChoiceAction) : null;
      const exportSectionStyle = exportSection ? window.getComputedStyle(exportSection) : null;
      const chooserNoteStyle = chooserNote ? window.getComputedStyle(chooserNote) : null;
      const tabsStyle = tabs ? window.getComputedStyle(tabs) : null;
      const activeTabStyle = activeTab ? window.getComputedStyle(activeTab) : null;
      const modalRect = modal?.getBoundingClientRect();

      return {
        text: modal?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        modalBackground: modalStyle?.backgroundColor ?? "",
        modalOutlineStyle: modalStyle?.outlineStyle ?? "",
        titleText: title?.textContent?.trim() ?? "",
        titleFontSize: titleStyle?.fontSize ?? "",
        titleFontWeight: titleStyle?.fontWeight ?? "",
        titleColor: titleStyle?.color ?? "",
        choiceActionBackground: choiceStyle?.backgroundColor ?? "",
        choiceActionCount: choiceActions.length,
        choiceActionHeights: choiceActions.map((action) => action.getBoundingClientRect().height),
        choiceActionWidths: choiceActions.map((action) => action.getBoundingClientRect().width),
        tabCount: tabs?.querySelectorAll("button").length ?? 0,
        tabsBackground: tabsStyle?.backgroundColor ?? "none",
        activeTabBackground: activeTabStyle?.backgroundColor ?? "none",
        dividerCount: modal?.querySelectorAll(".share-modal-divider").length ?? 0,
        shareDividerCount: modal?.querySelectorAll(".share-section-divider").length ?? 0,
        chooserOrCount: modal?.querySelectorAll(".share-chooser-or").length ?? 0,
        exportBorderLeftWidth: exportSectionStyle?.borderLeftWidth ?? "",
        noteBorderTopWidth: chooserNoteStyle?.borderTopWidth ?? "",
        liveIconCount: modal?.querySelectorAll(".share-live-section .lucide-radio").length ?? 0,
        exportHeadingIconCount: modal?.querySelectorAll(".share-export-section .lucide-file-output").length ?? 0,
        choiceArrowCount: modal?.querySelectorAll(".share-choice-cta .lucide-arrow-right").length ?? 0,
        modalHeight: modalRect?.height ?? 0,
        modalWidth: modalRect?.width ?? 0,
      };
    });
    expect(shareModalStyle.titleText === "Share", "Share modal title should not depend on the current file.");
    expect(
      shareModalStyle.modalBackground !== "rgb(255, 255, 255)",
      "Share modal should follow the active dark app theme.",
    );
    expect(
      shareModalStyle.modalOutlineStyle === "none",
      "Programmatic dialog focus should not draw a browser-default outline around the whole Share panel.",
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
    expect(shareModalStyle.choiceActionCount === 2, "Share should expose exactly two full-surface choices.");
    expect(
      shareModalStyle.choiceActionHeights.every((height) => height >= 100) &&
        Math.abs(shareModalStyle.choiceActionHeights[0] - shareModalStyle.choiceActionHeights[1]) <= 1,
      "Live and Export should use equally sized, generous action surfaces.",
    );
    expect(
      shareModalStyle.choiceActionWidths.every((width) => width >= shareModalStyle.modalWidth - 80),
      "Each Share choice should fill the modal content width.",
    );
    expect(
      shareModalStyle.choiceActionBackground !== "rgba(0, 0, 0, 0)",
      "Share choices should have a quiet interactive surface before hover.",
    );
    expect(shareModalStyle.tabCount === 0, "Share modal should not expose legacy purpose tabs.");
    expect(shareModalStyle.dividerCount === 0, "Share modal should not use legacy stacked Or dividers.");
    expect(shareModalStyle.shareDividerCount === 0, "Share choices should not use a ruled divider.");
    expect(shareModalStyle.chooserOrCount === 0, "The two Share choices should not need an Or label.");
    expect(
      shareModalStyle.exportBorderLeftWidth === "0px" &&
        shareModalStyle.noteBorderTopWidth === "0px",
      "Share choices and the security note should remain unboxed and rule-free.",
    );
    expect(
      shareModalStyle.liveIconCount === 1 &&
        shareModalStyle.exportHeadingIconCount === 1 &&
        shareModalStyle.choiceArrowCount === 2,
      "Each Share choice should pair its semantic icon with the same trailing action cue.",
    );
    expect(
      /workspace’s documents and comments/i.test(shareModalStyle.text),
      "Share modal should make the workspace-wide live scope explicit.",
    );
    expect(/encrypted copy of the workspace/i.test(shareModalStyle.text), "Snapshot sharing should be described as an independent encrypted copy.");
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
    await waitForShareDialogState(page, { panel: "Share link" });
    await page.getByRole("button", { name: "Start session" }).click();
    await page.waitForSelector(".share-link-display");
    await page.waitForFunction(() => window.location.hash.startsWith("#room="));
    await page.waitForFunction(() => document.activeElement?.classList.contains("share-mode-header"));
    expect(
      await page.locator(".share-mode-header").evaluate((header) => header === document.activeElement),
      "A successful live transition should move focus to the result heading without showing an intermediate surface.",
    );
    const liveModalRect = await page.locator(".share-modal").evaluate((modal) => {
      const rect = modal.getBoundingClientRect();
      return { height: rect.height, width: rect.width };
    });
    expect(
      Math.abs(liveModalRect.width - shareModalStyle.modalWidth) <= 1 &&
        Math.abs(liveModalRect.height - shareModalStyle.modalHeight) <= 1,
      "Starting a live session should not resize the Share panel shell.",
    );
    const previewTransition = await page.evaluate(() => {
      window.__tabulaPreviewObserver?.disconnect();
      return {
        sawEmptyPreview: Boolean(window.__tabulaSawEmptyPreview),
        previewText: document.querySelector(".preview-surface")?.textContent ?? "",
      };
    });
    expect(!previewTransition.sawEmptyPreview, "Starting a live room should not flash the empty Preview state.");
    expect(
      previewTransition.previewText.includes("Live preview transition stays visible."),
      "Starting a live room should preserve the visible Preview until the Yjs projection is ready.",
    );
    expect(
      new URL(page.url()).hash.startsWith("#room="),
      "Live -> Start session should move the current tab to the canonical room URL.",
    );
    expect(
      (await page.getByText("Open a live collaboration room", { exact: true }).count()) > 0,
      "Starting live should keep the Share link panel heading stable.",
    );
    expect(
      (await page.locator(".share-mode-header > div > p").count()) === 1 &&
        (await page.getByText(
          "This private room keeps the workspace’s documents and comments in sync while people are connected. You can also invite an agent with the prompt.",
          { exact: true },
        ).count()) === 1,
      "Starting live should preserve the mode heading and description from the chooser.",
    );
    expect(
      (await page.getByText(/Room stays open while someone is connected/).count()) === 0 &&
        (await page.getByText(/Whole workspace · \d+ documents? · comments included/).count()) === 0,
      "Live results should move agent guidance into the mode description without adding metadata below the link.",
    );
    expect(
      (await page.locator(".share-result-details").count()) === 1 &&
        (await page.locator(".share-result-link-field").count()) === 1 &&
        (await page.locator(".share-result-footer").count()) === 1 &&
        (await page.locator(".share-result-main").evaluate(
          (main) => main.firstElementChild?.classList.contains("share-result-link-field"),
        )),
      "Live results should use the shared result structure.",
    );
    expect(
      (await page.locator(".share-link-actions").getByRole("button").count()) === 2 &&
        (await page.locator(".share-live-agent-row").count()) === 0,
      "Live should keep Copy link and Copy prompt together instead of adding a separate agent row.",
    );
    const liveActionLayout = await page.evaluate(() => {
      const promptButton = document.querySelector(".share-copy-prompt");
      const nameRow = document.querySelector(".share-live-name-row");
      const sessionActions = document.querySelector(".share-live-session-actions");
      const leaveButton = sessionActions?.querySelector(".share-modal-danger");
      const promptStyle = promptButton ? window.getComputedStyle(promptButton) : null;
      const nameRect = nameRow?.getBoundingClientRect();
      const actionsRect = sessionActions?.getBoundingClientRect();
      const leaveRect = leaveButton?.getBoundingClientRect();

      return {
        promptBackground: promptStyle?.backgroundColor ?? "",
        nameBottom: nameRect?.bottom ?? 0,
        actionsCenter: actionsRect ? actionsRect.left + actionsRect.width / 2 : 0,
        actionsVerticalCenter: actionsRect ? actionsRect.top + actionsRect.height / 2 : 0,
        leaveCenter: leaveRect ? leaveRect.left + leaveRect.width / 2 : 0,
        leaveVerticalCenter: leaveRect ? leaveRect.top + leaveRect.height / 2 : 0,
        leaveTop: leaveRect?.top ?? 0,
        footerLeaveCount: document.querySelectorAll(
          ".share-result-footer .share-modal-danger",
        ).length,
      };
    });
    expect(
      liveActionLayout.promptBackground === "rgba(0, 0, 0, 0)",
      "Copy prompt should read as a transparent secondary action beside Copy link.",
    );
    expect(
      liveActionLayout.leaveTop >= liveActionLayout.nameBottom &&
        Math.abs(liveActionLayout.leaveCenter - liveActionLayout.actionsCenter) <= 1 &&
        Math.abs(
          liveActionLayout.leaveVerticalCenter -
            liveActionLayout.actionsVerticalCenter,
        ) <= 1 &&
        liveActionLayout.footerLeaveCount === 0,
      "Leave room should use the available space centered below the name field instead of sitting beside the security note.",
    );
    expect(
      (await page.evaluate(() => window.__tabulaClipboard.length)) === 0,
      "Starting a room should not copy an agent invite implicitly.",
    );
    expect(
      (await page.getByRole("link", { name: "Set up Tabula MCP" }).count()) === 0,
      "Live results should not interrupt sharing with MCP setup documentation.",
    );
    await page.getByRole("button", { name: "Copy prompt" }).click();
    const copiedAgentInvite = await page.evaluate(() => window.__tabulaClipboard.at(-1));
    expect(copiedAgentInvite.includes("Use your Tabula tools to join this room"), "Agent invite should state the user intent without protocol instructions.");
    expect(
      copiedAgentInvite.includes("https://tabula.md/agent-install.txt"),
      "Agent invite should recover through the official setup runbook when Tabula tools are missing.",
    );
    expect(
      copiedAgentInvite.includes("paste this invite again"),
      "Agent invite should explain how to resume after a client restart.",
    );
    expect(copiedAgentInvite.includes(page.url()), "Agent invite should include the current room URL only after an explicit copy.");
    expect(!copiedAgentInvite.match(/Task:|Scope:|Target document:|Yjs|binary protocol|Markdown/), "Agent invite should not expose task orchestration, fake scopes, or protocol internals.");
    expect(
      (await page.evaluate(() => window.__tabulaClipboard.length)) === 1,
      "Agent invitation should require exactly one explicit clipboard action.",
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
      shareLinkTitle === null && new URL(page.url()).hash.startsWith("#room="),
      "Live modal should keep the bearer-secret URL out of hover text.",
    );
    await page.evaluate(() => {
      navigator.clipboard.writeText = async () => {
        throw new DOMException("Clipboard permission denied", "NotAllowedError");
      };
    });
    await page.getByRole("button", { name: "Copy link" }).click();
    await waitForText(page.locator(".app-toast"), "Couldn’t copy. Try again.");
    expect(
      (await page.getByRole("button", { name: "Copy link" }).count()) === 1,
      "A rejected clipboard write should keep the copy action available.",
    );
    await page.evaluate(() => {
      navigator.clipboard.writeText = async (text) => {
        window.__tabulaClipboard.push(text);
      };
    });
    const liveLinkLayout = await page.evaluate(() => {
      const linkField = document.querySelector(".share-result-link-field");
      const linkLabel = document.querySelector(".share-result-link-field .share-modal-field-label");
      const linkRow = document.querySelector(".share-modal-link-row");
      const linkPreview = document.querySelector(".share-link-display");
      const copyButton = document.querySelector(".share-modal-link-row button");
      const nameInput = document.querySelector(".share-live-name-row input");

      return {
        fieldWidth: linkField?.getBoundingClientRect().width ?? 0,
        labelWidth: linkLabel?.getBoundingClientRect().width ?? 0,
        rowWidth: linkRow?.getBoundingClientRect().width ?? 0,
        linkWidth: linkPreview?.getBoundingClientRect().width ?? 0,
        buttonWidth: copyButton?.getBoundingClientRect().width ?? 0,
        nameInputWidth: nameInput?.getBoundingClientRect().width ?? 0,
      };
    });
    expect(
      Math.abs(liveLinkLayout.rowWidth - liveLinkLayout.fieldWidth) <= 2 &&
        liveLinkLayout.labelWidth <= 1,
      "Live invite-link row should span the content width without a visible form label.",
    );
    expect(
      liveLinkLayout.rowWidth > liveLinkLayout.nameInputWidth,
      "The primary invite link should be wider than the secondary name setting.",
    );
    expect(
      liveLinkLayout.linkWidth > liveLinkLayout.buttonWidth,
      "Live invite-link preview should receive more width than the copy button.",
    );
    expect((await page.getByRole("button", { name: "Leave room" }).count()) === 1, "Live modal should offer a leave-room action.");

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
        await selectDocumentViewMode(page, "Edit");
        await waitForEditorReady(page, { mode: "edit" });
        await page.locator(".share-trigger").click();
        await waitForShareDialogState(page, { panel: "Share link" });
        await page.getByRole("button", { name: "Start session" }).click();
        await page.waitForSelector(".app-toast", { timeout: 8_000 });

        await page.waitForFunction(
          () =>
            !window.location.hash.startsWith("#room=") &&
            document.querySelectorAll(".share-modal").length === 0,
          undefined,
          { timeout: 8_000 },
        );

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
              (button) => button.textContent?.replace(/\s+/g, " ").trim() === "Leave room",
            ).length,
            toastText: toast?.textContent?.replace(/\s+/g, " ").trim() ?? "",
            toastWidth: toastRect?.width ?? 0,
            toastScrollWidth: toast?.scrollWidth ?? 0,
            url: window.location.href,
          };
        });
        expect(
          !new URL(failedStartState.url).hash.startsWith("#room="),
          "A locally unavailable room service should leave the workspace on its local URL.",
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
          failedStartState.modalCount === 0 &&
            failedStartState.startButtonCount === 0 &&
            failedStartState.inviteLinkCount === 0 &&
            failedStartState.stopSessionCount === 0,
          "A failed optimistic Start should return to the local workspace and close Share.",
        );
        const failedStartTabs = await getTabs(page);
        expect(
          failedStartTabs.some((tab) => tab.active && !tab.live && tab.title?.startsWith("Untitled")),
          "A failed optimistic Start should preserve the active local document.",
        );
        expect(
          (await page.locator(".share-live-status").count()) === 0,
          "Share should not render a connection-status card.",
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
    await page.locator(".app-toast").getByText("This live room can’t be opened.", { exact: true }).waitFor({
      state: "visible",
      timeout: 10_000,
    });
    expect(
      (await page.locator(".live-room-loading-surface").count()) === 0 &&
        (await page.locator(".live-room-unavailable-center").count()) === 0,
      "An unavailable room should return to the local workspace instead of rendering a full-screen failure.",
    );
    expect(
      (await page.getByRole("button", { name: "Try again", exact: true }).count()) === 0,
      "An unavailable room toast should not offer a retry loop.",
    );
    expect(
      (await page.locator(".share-trigger").count()) === 0,
      "An unavailable empty room should return to a local workspace without a document-level Share action.",
    );
    expect(
      !page.url().includes("#room="),
      "An unavailable room should be removed from the URL automatically.",
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

    expect(menuSurface.menuOpen, "The workspace menu should open from the Workspace panel header.");
    expect(menuSurface.menuBorderTopWidth === "0px", "Workspace menus should use elevation without static borders.");
    expect(menuSurface.templateButtonCount === 0, "Templates should not ship as a visible menu item yet.");
    expect(menuSurface.agentButtonCount === 0, "Agent should not ship as an inert menu item yet.");
    expect(menuSurface.templateSurfaceCount === 0, "Template detail surfaces should be removed until templates are real.");
    expect(
      !menuSurface.menuRows.includes("New document") && !menuSurface.menuRows.includes("Import document (.md)…"),
      "Document creation and import should stay in the launcher and Files surface, not the workspace menu.",
    );
    expect(
      !menuSurface.menuRows.includes("Export document (.md)") && menuSurface.menuRows.includes("Export workspace (.zip)"),
      "The workspace menu should own workspace export while document export remains a document control.",
    );
    expect(
      await page.getByRole("button", { name: "Export workspace (.zip)", exact: true }).isDisabled(),
      "Workspace export should stay disabled while the workspace has no documents.",
    );

    await page.mouse.click(760, 420);
    expect(
      (await page.locator(".workspace-menu-popover").count()) === 0,
      "Clicking outside the workspace menu should close it.",
    );

    await page.locator('.workspace-search-trigger[aria-label="Search"]').click();
    await page.getByRole("option", { name: "New document", exact: true }).click();
    await waitForActiveTab(page, { startsWith: "Untitled" });
    await waitForEditorReady(page, { mode: "visual" });
    const tabs = await getTabs(page);
    const activeTab = tabs.find((tab) => tab.active);
    expect(activeTab?.title.startsWith("Untitled"), "Launcher New document should create and activate the next blank document.");
    expect(activeTab?.mode === "Visual", "New blank documents should start in Visual edit.");
    expect(!activeTab?.visibleTitle.endsWith(".md"), "New blank tabs should still hide the Markdown extension.");
  });

  await withPage(browser, "/", async (page) => {
    await openMarkdownFile(page, {
      content: "# Preview fixture\n\nThis document keeps its own view mode.",
    });
    await selectDocumentViewMode(page, "Preview");
    await waitForActiveTab(page, { exact: "README.md" });
    await page.waitForFunction(
      () => document.querySelector(".tab-item.active")?.getAttribute("data-view-mode") === "preview",
    );
    let tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.mode === "Preview", "Preview mode should be reflected in the active tab.");
    expect(
      JSON.stringify(await getViewModeActionLabels(page)) ===
        JSON.stringify(["Visual edit", "Preview"]),
      "Visual editing should expose only Visual edit and Preview toggles.",
    );
    expect(
      JSON.stringify(await getViewModeSlots(page)) ===
        JSON.stringify([
          { viewMode: "visual", label: "Visual edit", active: false },
          { viewMode: "preview", label: "Preview", active: true },
        ]),
      "Preview should retain Visual as its return editor.",
    );
    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    expect(
      JSON.stringify(
        await page
          .locator(".document-controls-popover [data-editing-mode]")
          .evaluateAll((items) =>
            items.map((item) => ({
              editingMode: item.getAttribute("data-editing-mode"),
              active: item.getAttribute("aria-pressed") === "true",
            })),
          ),
      ) ===
        JSON.stringify([
          { editingMode: "visual", active: true },
          { editingMode: "source", active: false },
        ]),
      "Editor controls should choose the persistent Visual or Source editing mode.",
    );
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "visual" });
    tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.mode === "Visual", "New local tabs should start in Visual edit.");
    expect(
      JSON.stringify(await getViewModeActionLabels(page)) ===
        JSON.stringify(["Visual edit", "Preview"]),
      "New Visual tabs should keep the compact Visual edit and Preview pair.",
    );

    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    expect(
      JSON.stringify(await getViewModeSlots(page)) ===
        JSON.stringify([
          { viewMode: "edit", label: "Source edit", active: true },
          { viewMode: "split", label: "Split", active: false },
          { viewMode: "preview", label: "Preview", active: false },
        ]),
      "Source editing should expose Source edit, Split, and Preview.",
    );

    await selectDocumentViewMode(page, "Split");
    await waitForEditorReady(page, { mode: "split" });
    tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.mode === "Split", "Split should be reachable from Edit mode.");
    expect(
      JSON.stringify(await getViewModeActionLabels(page)) ===
        JSON.stringify(["Source edit", "Split", "Preview"]),
      "Split should retain the Source editing controls.",
    );
    expect(
      JSON.stringify(await getViewModeSlots(page)) ===
        JSON.stringify([
          { viewMode: "edit", label: "Source edit", active: false },
          { viewMode: "split", label: "Split", active: true },
          { viewMode: "preview", label: "Preview", active: false },
        ]),
      "Split should be selected between Source edit and Preview.",
    );

    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.mode === "Edit", "Pressing Edit from Split should return to Edit mode.");

    await page.locator('.tab-item[data-file-name="README.md"] .tab-select-button').click();
    await waitForActiveTab(page, { exact: "README.md" });
    tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.mode === "Preview", "README tab should keep its Preview mode and Visual return editor.");
  });

  await withPage(browser, "/", async (page) => {
    await page.setViewportSize({ width: 390, height: 700 });
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "visual" });
    await page.locator(".share-trigger").click();
    const mobileClose = page.getByRole("button", { name: "Close Share" });
    expect(await mobileClose.isVisible(), "Mobile Share should expose an explicit close action.");
    await mobileClose.click();
    expect((await page.locator(".share-modal").count()) === 0, "The mobile close action should dismiss Share.");
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
