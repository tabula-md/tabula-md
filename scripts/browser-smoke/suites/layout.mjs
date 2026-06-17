export const id = "layout";
export const description = "Tab persistence, import collision, document chrome, split layout, and side-panel alignment.";

export async function run(ctx) {
  const {
    appNewFileShortcut,
    baseUrl,
    browser,
    expect,
    externalUrl,
    focusMarkdownEditor,
    getTabs,
    getViewModeActionLabels,
    getViewModeSlots,
    openProjectContext,
    closeProjectContext,
    openProjectMenu,
    waitForText,
    withPage,
  } = ctx;

  await withPage(browser, "/", async (page) => {
    await page.getByTitle("New tab").click();
    await page.getByTitle("New tab").click();
    await page.waitForTimeout(120);
    let tabs = await getTabs(page);
    expect(tabs.find((tab) => tab.active)?.title === "Untitled 3.md", "Second created blank file should be active before close.");

    await page.locator(".tab-item.active").hover();
    await page.locator(".tab-item.active .tab-action-button.close").click();
    await page.waitForTimeout(120);
    tabs = await getTabs(page);
    expect(tabs.length === 3, "Closing the active file should remove exactly one tab.");
    expect(tabs.find((tab) => tab.active)?.title === "Untitled 2.md", "Closing the last active tab should activate the previous file.");

    await page.locator('.tab-select-button[title^="README.md ·"]').click();
    await page.locator(".tab-item.active").hover();
    await page.locator(".tab-item.active .tab-action-button.close").click();
    await page.waitForTimeout(120);
    tabs = await getTabs(page);
    expect(!tabs.some((tab) => tab.title === "README.md"), "README should be closable like a normal file.");
    expect(tabs.length === 2, "Closing README should leave the remaining local files.");
    expect(tabs.find((tab) => tab.active)?.title === "Untitled.md", "Closing active README should activate the remaining file.");
  });

  await withPage(browser, "/", async (page) => {
    await openProjectMenu(page);
    await page.locator('input[aria-label="Import Markdown file"]').setInputFiles({
      name: "README.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# Imported README\n\nImported body."),
    });
    await page.waitForTimeout(160);
    const importedState = await page.evaluate(() => {
      const activeTab = document.querySelector(".tab-item.active");
      const editorText = document.querySelector(".cm-content")?.textContent ?? "";
      return {
        activeFileName: activeTab?.getAttribute("data-file-name") ?? "",
        visibleTitle: activeTab?.querySelector(".tab-title")?.textContent?.trim() ?? "",
        fileNames: Array.from(document.querySelectorAll(".tab-item")).map((item) => item.getAttribute("data-file-name")),
        editorText,
      };
    });
    expect(importedState.activeFileName === "README 2.md", "Importing README.md should create a collision-safe filename.");
    expect(importedState.visibleTitle === "README 2", "Imported collision file should still hide the .md extension.");
    expect(
      importedState.fileNames.filter((fileName) => fileName?.startsWith("README")).length === 2,
      "Import collision should keep both README files.",
    );
    expect(importedState.editorText.includes("Imported body."), "Imported Markdown content should become the active file text.");
  });

  await withPage(browser, "/", async (page) => {
    const chrome = await page.evaluate(() => {
      const readRect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }
        const rect = element.getBoundingClientRect();
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      };

      return {
        left: readRect(".top-left-zone"),
        right: readRect(".top-right-zone"),
        actionRow: readRect(".editor-control-row"),
        tabs: readRect(".tabbar"),
        panelToggles: readRect(".top-panel-toggle"),
        leftSidebar: readRect(".left-sidebar"),
        centerWorkbench: readRect(".center-workbench"),
        toolbar: readRect(".file-toolbar"),
        toolbarWrap: readRect(".file-toolbar-wrap"),
        share: readRect(".share-trigger"),
        workspace: readRect(".workspace"),
        status: readRect(".file-status-bar"),
        bottomPanelCount: document.querySelectorAll(".bottom-panel").length,
        floatingStatusCount: document.querySelectorAll(".floating-status-layer").length,
        topLeftMenuCount: document.querySelectorAll(".workspace-menu-button").length,
      };
    });

    for (const [name, rect] of Object.entries({
      left: chrome.left,
      right: chrome.right,
      actionRow: chrome.actionRow,
      tabs: chrome.tabs,
      panelToggles: chrome.panelToggles,
      centerWorkbench: chrome.centerWorkbench,
      toolbar: chrome.toolbar,
      toolbarWrap: chrome.toolbarWrap,
      share: chrome.share,
    })) {
      expect(rect && rect.width > 0 && rect.height > 0, `${name} chrome should be visible.`);
      expect(rect.y >= 0 && rect.y < 120, `${name} chrome should sit near the top of the document.`);
    }

    expect(chrome.workspace && chrome.workspace.height > 0, "Document workspace should be visible.");
    expect(chrome.status && chrome.status.height > 0, "Document status bar should be visible.");
    expect(chrome.topLeftMenuCount === 0, "The old top-left project menu should not render.");
    expect(!chrome.leftSidebar, "The left project panel should start closed so tabs and the document read as one workbench.");
    expect(chrome.bottomPanelCount === 0, "The bottom panel should not render until it has a clear product purpose.");
    expect(chrome.centerWorkbench.x <= 1, "The closed-panel workbench should start at the left edge.");
    expect(chrome.floatingStatusCount === 0, "Status controls should not render as floating canvas chips.");
    expect(chrome.left.width > chrome.right.width * 2, "The top row should prioritize document tabs over actions.");
    expect(chrome.tabs.width > chrome.toolbar.width * 3, "Tabs should get the primary width in the top row.");
    expect(chrome.actionRow.y > chrome.tabs.y + chrome.tabs.height, "Document actions should be in a row below tabs.");
    expect(chrome.toolbar.y >= chrome.actionRow.y, "Document tools should sit inside the document action row.");
    expect(chrome.right.y < chrome.actionRow.y, "Share should stay in the top tab row.");
    expect(chrome.share.y < chrome.actionRow.y, "Share should not sit inside the document toolbar row.");
    expect(
      chrome.toolbar.x + chrome.toolbar.width >= chrome.actionRow.x + chrome.actionRow.width - 6,
      "Document tools should attach to the active document header's right edge.",
    );
    expect(chrome.status.y > chrome.workspace.y, "Document status should sit below the writing workspace.");
    expect(
      chrome.status.y >= chrome.workspace.y + chrome.workspace.height - 1,
      "Document status should be a bottom layout row, not an overlay.",
    );
    expect(
      chrome.toolbarWrap.y > chrome.tabs.y + chrome.tabs.height,
      "Document tools should sit below the tab row, not inside it.",
    );

    const readStableDocumentLayout = () => {
      const readRect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }
        const rect = element.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      };

      return {
        actionRow: readRect(".editor-control-row"),
        status: readRect(".file-status-bar"),
        tabs: readRect(".tabbar"),
        documentSurface:
          readRect(".workspace.preview .preview-surface") ??
          readRect(".workspace.edit .editor-surface") ??
          readRect(".workspace.split"),
        previewSurface: readRect(".preview-surface"),
        workspace: readRect(".workspace"),
      };
    };

    const closedLayout = await page.evaluate(readStableDocumentLayout);
    await openProjectMenu(page);
    const leftPanelLayout = await page.evaluate(readStableDocumentLayout);
    await openProjectContext(page);
    const bothPanelsLayout = await page.evaluate(readStableDocumentLayout);

    expect(
      leftPanelLayout.tabs && closedLayout.tabs && leftPanelLayout.tabs.x > closedLayout.tabs.x + 240,
      "Opening the left panel should move the top tabs into the available chrome area.",
    );
    expect(
      bothPanelsLayout.tabs && closedLayout.tabs && bothPanelsLayout.tabs.width < closedLayout.tabs.width,
      "Opening side panels should constrain the top tab chrome.",
    );

    for (const [name, rect] of Object.entries({
      leftPanelDocument: leftPanelLayout.documentSurface,
      bothPanelsDocument: bothPanelsLayout.documentSurface,
      leftPanelWorkspace: leftPanelLayout.workspace,
      bothPanelsWorkspace: bothPanelsLayout.workspace,
      leftPanelActionRow: leftPanelLayout.actionRow,
      bothPanelsActionRow: bothPanelsLayout.actionRow,
      leftPanelStatus: leftPanelLayout.status,
      bothPanelsStatus: bothPanelsLayout.status,
    })) {
      expect(rect, `${name} should be measurable while panels are open.`);
    }

    for (const [name, layout] of Object.entries({
      closedLayout,
      leftPanelLayout,
      bothPanelsLayout,
    })) {
      expect(
        Math.abs(layout.actionRow.x - layout.documentSurface.x) <= 1 &&
          Math.abs(layout.actionRow.width - layout.documentSurface.width) <= 1,
        `${name} toolbar rail should follow the document body width.`,
      );
      expect(
        Math.abs(layout.status.x - layout.documentSurface.x) <= 1 &&
          Math.abs(layout.status.width - layout.documentSurface.width) <= 1,
        `${name} status bar should follow the document body width.`,
      );
    }

    expect(
      Math.abs(leftPanelLayout.documentSurface.x - closedLayout.documentSurface.x) <= 1 &&
        Math.abs(leftPanelLayout.documentSurface.width - closedLayout.documentSurface.width) <= 1 &&
        Math.abs(bothPanelsLayout.documentSurface.x - closedLayout.documentSurface.x) <= 1 &&
        Math.abs(bothPanelsLayout.documentSurface.width - closedLayout.documentSurface.width) <= 1,
      "Opening side panels should not move or resize the document body.",
    );
    expect(
      Math.abs(leftPanelLayout.workspace.x - closedLayout.workspace.x) <= 1 &&
        Math.abs(leftPanelLayout.workspace.width - closedLayout.workspace.width) <= 1 &&
        Math.abs(bothPanelsLayout.workspace.x - closedLayout.workspace.x) <= 1 &&
        Math.abs(bothPanelsLayout.workspace.width - closedLayout.workspace.width) <= 1,
      "Opening side panels should keep the document workspace viewport stable.",
    );
    expect(
      Math.abs(leftPanelLayout.actionRow.x - closedLayout.actionRow.x) <= 1 &&
        Math.abs(leftPanelLayout.actionRow.width - closedLayout.actionRow.width) <= 1 &&
        Math.abs(bothPanelsLayout.actionRow.x - closedLayout.actionRow.x) <= 1 &&
        Math.abs(bothPanelsLayout.actionRow.width - closedLayout.actionRow.width) <= 1,
      "Opening side panels should not move or resize the single-document toolbar rail.",
    );
    expect(
      Math.abs(leftPanelLayout.status.x - closedLayout.status.x) <= 1 &&
        Math.abs(leftPanelLayout.status.width - closedLayout.status.width) <= 1 &&
        Math.abs(bothPanelsLayout.status.x - closedLayout.status.x) <= 1 &&
        Math.abs(bothPanelsLayout.status.width - closedLayout.status.width) <= 1,
      "Opening side panels should not move or resize the single-document status bar.",
    );
  });

  await withPage(browser, "/", async (page) => {
    await openProjectMenu(page);
    await openProjectContext(page);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.waitForTimeout(120);
    await page.getByRole("button", { name: "Split", exact: true }).click();
    await page.waitForTimeout(120);

    const splitLayout = await page.evaluate(() => {
      const readRect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          display: style.display,
          overflowY: style.overflowY,
        };
      };

      return {
        mainClass: document.querySelector(".main-panel")?.className ?? "",
        actionRow: readRect(".editor-control-row"),
        status: readRect(".file-status-bar"),
        workspace: readRect(".workspace.split"),
        editor: readRect(".workspace.split .editor-surface"),
        preview: readRect(".workspace.split .preview-surface"),
        frontmatterRow: readRect(".workspace.split .frontmatter-row"),
      };
    });

    expect(
      splitLayout.mainClass.includes("left-panel-open") && splitLayout.mainClass.includes("right-panel-open"),
      "Split layout smoke should run with both side panels open.",
    );
    expect(splitLayout.workspace?.display === "block", "Split should stack when side panels narrow the document safe area.");
    expect(splitLayout.workspace?.overflowY === "auto", "Stacked split should use the document workspace as the scroll root.");
    expect(
      splitLayout.editor && splitLayout.preview && splitLayout.preview.y > splitLayout.editor.y + splitLayout.editor.height - 2,
      "Stacked split should place the preview below the editor when side panels narrow the safe area.",
    );
    expect(
      splitLayout.actionRow &&
        splitLayout.editor &&
        Math.abs(splitLayout.actionRow.x - splitLayout.editor.x) <= 1 &&
        Math.abs(splitLayout.actionRow.width - splitLayout.editor.width) <= 1,
      "Stacked split toolbar rail should follow the visible split document width.",
    );
    expect(
      splitLayout.status &&
        splitLayout.editor &&
        Math.abs(splitLayout.status.x - splitLayout.editor.x) <= 1 &&
        Math.abs(splitLayout.status.width - splitLayout.editor.width) <= 1,
      "Stacked split status bar should follow the visible split document width.",
    );
    expect(
      splitLayout.preview && splitLayout.preview.width >= 560,
      "Stacked split preview should keep enough width for readable frontmatter.",
    );
    expect(
      splitLayout.frontmatterRow && splitLayout.frontmatterRow.height <= 28,
      "Split frontmatter should not wrap into tall one-character columns.",
    );
  });
}
