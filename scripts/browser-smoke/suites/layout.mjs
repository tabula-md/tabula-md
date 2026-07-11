export const id = "layout";
export const description =
  "Tab persistence, import collision, document chrome, split layout, and side-panel alignment.";

export async function run(ctx) {
  const {
    browser,
    expect,
    getTabs,
    openProjectContext,
    openProjectMenu,
    waitForActiveTab,
    waitForEditorReady,
    waitForFileCount,
    withPage,
  } = ctx;

  await withPage(browser, "/", async (page) => {
    const initialTabCount = (await getTabs(page)).length;
    await page.getByTitle("New document").click();
    await waitForFileCount(page, initialTabCount + 1);
    await waitForActiveTab(page, { startsWith: "Untitled" });
    let tabs = await getTabs(page);
    const firstCreatedTitle = tabs.find((tab) => tab.active)?.title ?? "";
    expect(
      firstCreatedTitle.startsWith("Untitled"),
      "First created blank file should be active before creating another file.",
    );

    await page.getByTitle("New document").click();
    await waitForFileCount(page, initialTabCount + 2);
    tabs = await getTabs(page);
    const secondCreatedTitle = tabs.find((tab) => tab.active)?.title ?? "";
    expect(
      secondCreatedTitle.startsWith("Untitled") &&
        secondCreatedTitle !== firstCreatedTitle,
      "Second created blank file should be active before close.",
    );

    await page.locator(".tab-item.active").hover();
    await page.locator(".tab-item.active .tab-action-button.close").click();
    await waitForFileCount(page, initialTabCount + 1);
    tabs = await getTabs(page);
    expect(
      tabs.length === initialTabCount + 1,
      "Closing the active file should remove exactly one tab.",
    );
    expect(
      tabs.find((tab) => tab.active)?.title === firstCreatedTitle,
      "Closing the last active tab should activate the previous file.",
    );

    await page.locator('.tab-item[data-file-name="README.md"] .tab-select-button').click();
    await waitForActiveTab(page, { exact: "README.md" });
    await page.locator(".tab-item.active").hover();
    await page.locator(".tab-item.active .tab-action-button.close").click();
    await waitForFileCount(page, initialTabCount);
    tabs = await getTabs(page);
    expect(
      !tabs.some((tab) => tab.title === "README.md"),
      "README should be closable like a normal file.",
    );
    expect(
      tabs.length === initialTabCount,
      "Closing README should leave the remaining open files.",
    );
    expect(
      tabs.some((tab) => tab.active && tab.title !== "README.md"),
      "Closing active README should activate a remaining file.",
    );
  });

  await withPage(browser, "/", async (page) => {
    await openProjectMenu(page);
    await page
      .locator('input[aria-label="Import file"]')
      .setInputFiles({
        name: "README.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("# Imported README\n\nImported body."),
      });
    await waitForActiveTab(page, { exact: "README 2.md" });
    await waitForEditorReady(page, { mode: "edit" });
    const importedState = await page.evaluate(() => {
      const activeTab = document.querySelector(".tab-item.active");
      const editorText =
        document.querySelector(".cm-content")?.textContent ?? "";
      return {
        activeFileName: activeTab?.getAttribute("data-file-name") ?? "",
        visibleTitle:
          activeTab?.querySelector(".tab-title")?.textContent?.trim() ?? "",
        fileNames: Array.from(document.querySelectorAll(".tab-item")).map(
          (item) => item.getAttribute("data-file-name"),
        ),
        editorText,
      };
    });
    expect(
      importedState.activeFileName === "README 2.md",
      "Importing README.md should create a collision-safe filename.",
    );
    expect(
      importedState.visibleTitle === "README 2",
      "Imported collision file should still hide the .md extension.",
    );
    expect(
      importedState.fileNames.filter((fileName) =>
        fileName?.startsWith("README"),
      ).length === 2,
      "Import collision should keep both README files.",
    );
    expect(
      importedState.editorText.includes("Imported body."),
      "Imported Markdown content should become the active file text.",
    );
  });

  await withPage(browser, "/", async (page) => {
    await page.waitForSelector(".file-shell");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });

    const measureContentWidth = () => {
      const element =
        document.querySelector(".workspace.edit .cm-content") ??
        document.querySelector(".workspace.preview .preview-document-content");
      if (!element) {
        return null;
      }

      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        width: Math.round(rect.width),
      };
    };

    for (const widthLabel of ["Focus", "Standard"]) {
      await page
        .getByRole("button", { name: "Editor controls", exact: true })
        .click();
      await page.getByRole("button", { name: widthLabel, exact: true }).click();
      await waitForEditorReady(page, { mode: "edit" });
      const editLayout = await page.evaluate(measureContentWidth);

      await page.getByRole("button", { name: "Preview", exact: true }).click();
      await waitForEditorReady(page, { mode: "preview" });
      const previewLayout = await page.evaluate(measureContentWidth);

      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await waitForEditorReady(page, { mode: "edit" });

      expect(
        editLayout && previewLayout,
        `${widthLabel} content width should be measurable in Edit and Preview.`,
      );
      expect(
        Math.abs(editLayout.x - previewLayout.x) <= 1 &&
          Math.abs(editLayout.width - previewLayout.width) <= 1,
        `${widthLabel} Text Width should keep the same content column when switching Edit and Preview. ` +
          `Edit=${JSON.stringify(editLayout)} Preview=${JSON.stringify(previewLayout)}`,
      );
    }
  });

  await withPage(browser, "/", async (page) => {
    await page.waitForSelector(".file-shell");
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });

    const measureDocumentControls = () =>
      page.evaluate(() => {
        const row = document.querySelector(".document-toolbar-row");
        const controls = document.querySelector(".document-controls");
        if (!(row instanceof HTMLElement) || !(controls instanceof HTMLElement)) {
          return null;
        }

        const rowRect = row.getBoundingClientRect();
        const controlsRect = controls.getBoundingClientRect();
        return {
          rowLeft: Math.round(rowRect.left),
          rowRight: Math.round(rowRect.right),
          controlsLeft: Math.round(controlsRect.left),
          controlsRight: Math.round(controlsRect.right),
        };
      });

    const editControls = await measureDocumentControls();

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });
    const previewControls = await measureDocumentControls();

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await page.getByRole("button", { name: "Split", exact: true }).click();
    await waitForEditorReady(page, { mode: "split" });
    const splitControls = await measureDocumentControls();

    expect(
      editControls && previewControls && splitControls,
      "DocumentControls should be measurable in Edit, Preview, and Split.",
    );

    for (const [mode, controls] of Object.entries({
      Preview: previewControls,
      Split: splitControls,
    })) {
      expect(
        Math.abs(editControls.rowLeft - controls.rowLeft) <= 1 &&
          Math.abs(editControls.rowRight - controls.rowRight) <= 1,
        `${mode} should keep the same document toolbar lane as Edit.`,
      );
      expect(
        Math.abs(editControls.controlsLeft - controls.controlsLeft) <= 1 &&
          Math.abs(editControls.controlsRight - controls.controlsRight) <= 1,
        `${mode} should not move DocumentControls relative to Edit.`,
      );
    }
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
        documentZone: readRect(".top-document-zone"),
        right: readRect(".top-right-zone"),
        actionRow: readRect(".document-toolbar-row"),
        tabs: readRect(".tabbar"),
        panelToggles: readRect(".top-panel-toggle"),
        workspaceMenu: readRect(".workspace-menu-popover"),
        centerWorkbench: readRect(".center-workbench"),
        toolbar: readRect(".document-controls"),
        toolbarWrap: readRect(".document-controls-wrap"),
        share: readRect(".share-trigger"),
        workspace: readRect(".workspace"),
        status: readRect(".file-status-bar"),
        bottomPanelCount: document.querySelectorAll(".bottom-panel").length,
        floatingStatusCount: document.querySelectorAll(".floating-status-layer")
          .length,
        topLeftMenuCount: document.querySelectorAll(".workspace-menu-button")
          .length,
      };
    });

    for (const [name, rect] of Object.entries({
      left: chrome.left,
      documentZone: chrome.documentZone,
      right: chrome.right,
      actionRow: chrome.actionRow,
      tabs: chrome.tabs,
      panelToggles: chrome.panelToggles,
      centerWorkbench: chrome.centerWorkbench,
      toolbar: chrome.toolbar,
      toolbarWrap: chrome.toolbarWrap,
      share: chrome.share,
    })) {
      expect(
        rect && rect.width > 0 && rect.height > 0,
        `${name} chrome should be visible.`,
      );
      expect(
        rect.y >= 0 && rect.y < 120,
        `${name} chrome should sit near the top of the document.`,
      );
    }

    expect(
      chrome.workspace && chrome.workspace.height > 0,
      "Document workspace should be visible.",
    );
    expect(
      chrome.status && chrome.status.height > 0,
      "Document status bar should be visible.",
    );
    expect(
      chrome.topLeftMenuCount === 1,
      "The top-left workspace menu button should render.",
    );
    expect(
      !chrome.workspaceMenu,
      "The workspace menu popover should start closed so the document reads as one workbench.",
    );
    expect(
      chrome.bottomPanelCount === 0,
      "The bottom panel should not render until it has a clear product purpose.",
    );
    expect(
      chrome.centerWorkbench.x <= 1,
      "The closed-panel workbench should start at the left edge.",
    );
    expect(
      chrome.floatingStatusCount === 0,
      "Status controls should not render as floating canvas chips.",
    );
    expect(
      chrome.documentZone.x >= chrome.left.x + chrome.left.width + 8,
      "The top tab lane should start after the workspace menu.",
    );
    expect(
      chrome.documentZone.x + chrome.documentZone.width <=
        chrome.centerWorkbench.x + chrome.centerWorkbench.width + 1,
      "The top tab lane should stay inside the workbench chrome.",
    );
    expect(
      chrome.tabs.x >= chrome.documentZone.x - 1,
      "Tabs should start inside the top tab lane.",
    );
    expect(
      chrome.tabs.x + chrome.tabs.width <= chrome.right.x - 8,
      "Tabs should leave a stable slot for Share.",
    );
    expect(
      chrome.actionRow.y > chrome.tabs.y + chrome.tabs.height,
      "Document actions should be in a row below tabs.",
    );
    expect(
      chrome.toolbar.y >= chrome.actionRow.y,
      "Document tools should sit inside the document action row.",
    );
    expect(
      chrome.right.y < chrome.actionRow.y,
      "Share should stay in the top tab row.",
    );
    expect(
      chrome.share.y < chrome.actionRow.y,
      "Share should not sit inside the document toolbar row.",
    );
    expect(
      chrome.toolbar.x + chrome.toolbar.width >=
        chrome.actionRow.x + chrome.actionRow.width - 6,
      "Document tools should attach to the active document header's right edge.",
    );
    expect(
      chrome.status.y > chrome.workspace.y,
      "Document status should sit below the writing workspace.",
    );
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
        actionRow: readRect(".document-toolbar-row"),
        status: readRect(".file-status-bar"),
        tabs: readRect(".tabbar"),
        documentZone: readRect(".top-document-zone"),
        right: readRect(".top-right-zone"),
        documentSurface:
          readRect(".workspace.preview .preview-surface") ??
          readRect(".workspace.edit .editor-surface") ??
          readRect(".workspace.split"),
        previewSurface: readRect(".preview-surface"),
        workspace: readRect(".workspace"),
        menu: readRect(".workspace-menu-popover"),
        rightPanel: readRect(".right-panel"),
      };
    };

    const closedLayout = await page.evaluate(readStableDocumentLayout);
    await openProjectMenu(page);
    const menuLayout = await page.evaluate(readStableDocumentLayout);
    await openProjectContext(page);
    const rightPanelLayout = await page.evaluate(readStableDocumentLayout);

    expect(
      menuLayout.tabs && rightPanelLayout.tabs,
      "Top tabs should stay measurable while menu surfaces are open.",
    );

    for (const [name, rect] of Object.entries({
      menuDocument: menuLayout.documentSurface,
      rightPanelDocument: rightPanelLayout.documentSurface,
      menuWorkspace: menuLayout.workspace,
      rightPanelWorkspace: rightPanelLayout.workspace,
      menuActionRow: menuLayout.actionRow,
      rightPanelActionRow: rightPanelLayout.actionRow,
      menuStatus: menuLayout.status,
      rightPanelStatus: rightPanelLayout.status,
      menuDocumentZone: menuLayout.documentZone,
      rightPanelDocumentZone: rightPanelLayout.documentZone,
      menuRightChrome: menuLayout.right,
      rightPanelRightChrome: rightPanelLayout.right,
      menuPopover: menuLayout.menu,
      rightPanel: rightPanelLayout.rightPanel,
    })) {
      expect(
        rect,
        `${name} should be measurable while menu surfaces are open.`,
      );
    }

    for (const [name, layout] of Object.entries({
      closedLayout,
      menuLayout,
      rightPanelLayout,
    })) {
      expect(
        layout.documentSurface.x >= layout.actionRow.x - 1 &&
          layout.documentSurface.x + layout.documentSurface.width <=
            layout.actionRow.x + layout.actionRow.width + 1,
        `${name} document body should sit inside the document chrome lane.`,
      );
      expect(
        Math.abs(layout.status.x - layout.actionRow.x) <= 1 &&
          Math.abs(layout.status.width - layout.actionRow.width) <= 1,
        `${name} status bar should follow the document chrome lane.`,
      );
      expect(
        layout.tabs.x >= layout.documentZone.x - 1 &&
          layout.tabs.x + layout.tabs.width <= layout.right.x - 8,
        `${name} top tab lane should behave as app chrome while document controls follow the body.`,
      );
    }

    expect(
      Math.abs(menuLayout.documentSurface.x - closedLayout.documentSurface.x) <=
        1 &&
        Math.abs(
          menuLayout.documentSurface.width - closedLayout.documentSurface.width,
        ) <= 1,
      "Opening the workspace menu should not shift or resize the document frame.",
    );
    expect(
      rightPanelLayout.documentSurface.x +
        rightPanelLayout.documentSurface.width <=
        rightPanelLayout.rightPanel.x - 20,
      "Opening Project Context should keep the document frame clear of the right panel.",
    );
    expect(
      rightPanelLayout.documentZone.x + rightPanelLayout.documentZone.width <=
        rightPanelLayout.rightPanel.x - 8,
      "Opening Project Context should keep top chrome controls clear of the right panel.",
    );
    expect(
      Math.abs(menuLayout.workspace.x - closedLayout.workspace.x) <= 1 &&
        Math.abs(menuLayout.workspace.width - closedLayout.workspace.width) <=
          1 &&
        Math.abs(rightPanelLayout.workspace.x - closedLayout.workspace.x) <=
          1 &&
        Math.abs(
          rightPanelLayout.workspace.width - closedLayout.workspace.width,
        ) <= 1,
      "Opening menu surfaces should keep the document workspace viewport stable.",
    );
  });

  await withPage(
    browser,
    "/",
    async (page) => {
      await openProjectContext(page);
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await waitForEditorReady(page, { mode: "edit" });
      await page.getByRole("button", { name: "Split", exact: true }).click();
      await waitForEditorReady(page, { mode: "split" });

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
          actionRow: readRect(".document-toolbar-row"),
          status: readRect(".file-status-bar"),
          workspace: readRect(".workspace.split"),
          editor: readRect(".workspace.split .editor-surface"),
          preview: readRect(".workspace.split .preview-surface"),
          frontmatterRow: readRect(".workspace.split .frontmatter-row"),
        };
      });

      expect(
        splitLayout.mainClass.includes("right-panel-open") &&
          !splitLayout.mainClass.includes("left-panel-open"),
        "Split layout smoke should run with Project Context open and no left side panel.",
      );
      expect(
        splitLayout.workspace?.display === "block",
        "Split should stack when Project Context narrows the document safe area.",
      );
      expect(
        splitLayout.workspace?.overflowY === "auto",
        "Stacked split should use the document workspace as the scroll root.",
      );
      expect(
        splitLayout.editor &&
          splitLayout.preview &&
          splitLayout.preview.y >
            splitLayout.editor.y + splitLayout.editor.height - 2,
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
    },
    { viewport: { width: 1100, height: 800 } },
  );
}
