import { selectDocumentViewMode } from "../support/view-mode.mjs";
export const id = "panels";
export const description = "Project menu, files, outline, comments, switcher, and right-panel file actions.";
export const scenarios = [
  "exposes project context panels and the document switcher",
  "runs direct Files actions without leaving the panel",
  "resolves workspace links and previews in project context",
];

export async function run(ctx) {
  const {
    baseUrl,
    browser,
    expect,
    getTabs,
    openMarkdownFile,
    ensureSidePanelOpen,
    openProjectMenu,
    waitForActiveTab,
    waitForEditorReady,
    waitForFileCount,
    waitForLeftPanel,
    waitForPanelTab,
    waitForRenderFrame,
    withPage,
  } = ctx;

  await withPage(browser, "/", async (page) => {
    await page.locator(".empty-file-actions").getByRole("button", { name: "New document" }).click();
    await waitForActiveTab(page, { startsWith: "Untitled" });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await selectDocumentViewMode(page, "Preview");
    await waitForEditorReady(page, { mode: "preview" });
    await openProjectMenu(page);

    const workbenchPanels = await page.evaluate(() => ({
      menuButtonCount: document.querySelectorAll(".workspace-menu-button").length,
      menuButtonInWorkspacePanel: Boolean(document.querySelector(".left-panel .workspace-menu-button")),
      topChromeMenuButtonCount: document.querySelectorAll(".workspace-controls .workspace-menu-button").length,
      workspacePanelLabel: document.querySelector(".left-panel")?.getAttribute("aria-label") ?? "",
      menuOpen: Boolean(document.querySelector(".workspace-menu-popover")),
      leftPanelCount: document.querySelectorAll(".left-sidebar").length,
      leftTabCount: document.querySelectorAll(".workspace-panel-tabs button").length,
      leftTabLabels: Array.from(document.querySelectorAll(".workspace-panel-tabs button"))
        .map((button) => button.getAttribute("aria-label") ?? ""),
      leftVisibleTabLabelCount: document.querySelectorAll(".workspace-panel-tab-label").length,
      templateRowCount: document.querySelectorAll(".left-library-item").length,
      menuText: document.querySelector(".workspace-menu-popover")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      publicLinks: Array.from(document.querySelectorAll(".workspace-menu-popover a")).map((link) => ({
        text: link.textContent?.replace(/\s+/g, " ").trim() ?? "",
        href: link.getAttribute("href") ?? "",
        ariaLabel: link.getAttribute("aria-label") ?? "",
        svgPath: link.querySelector("svg path")?.getAttribute("d") ?? "",
        svgFill: link.querySelector("svg")?.getAttribute("fill") ?? "",
      })),
      fileSearchCount: document.querySelectorAll(".left-panel-search").length,
      fileRowCount: document.querySelectorAll(".left-file-item").length,
      actionRows: Array.from(document.querySelectorAll(".workspace-menu-row")).map((item) => {
        const rect = item.getBoundingClientRect();
        const style = window.getComputedStyle(item);
        const icon = item.querySelector("svg");
        const iconStyle = icon ? window.getComputedStyle(icon) : null;
        return {
          text: item.textContent?.replace(/\s+/g, " ").trim() ?? "",
          height: Math.round(rect.height),
          borderRadius: style.borderRadius,
          color: style.color,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          paddingLeft: style.paddingLeft,
          iconColor: iconStyle?.color ?? "",
          iconCount: item.querySelectorAll("svg").length,
          disabled: item.disabled,
        };
      }),
      focusOrder: Array.from(
        document.querySelectorAll(".workspace-menu-popover button, .workspace-menu-popover input, .workspace-menu-popover a"),
      )
        .filter((element) => {
          const style = window.getComputedStyle(element);
          return !element.disabled && element.tabIndex >= 0 && style.display !== "none" && style.visibility !== "hidden";
        })
        .map(
          (element) =>
            element.getAttribute("aria-label") ??
            element.getAttribute("title") ??
            element.textContent?.replace(/\s+/g, " ").trim() ??
            element.tagName,
        ),
      statusVisible: Boolean(document.querySelector(".file-status-bar")),
      panelToggleCount: document.querySelectorAll(".top-panel-toggle").length,
      bottomPanelCount: document.querySelectorAll(".bottom-panel").length,
      laneGeometry: (() => {
        const rectOf = (selector) => {
          const rect = document.querySelector(selector)?.getBoundingClientRect();
          return rect
            ? {
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width),
              }
            : null;
        };
        return {
          menu: rectOf(".workspace-menu-popover"),
          toolbar: rectOf(".document-toolbar-row"),
          preview: rectOf(".preview-surface") ?? rectOf(".editor-surface"),
          status: rectOf(".file-status-bar"),
        };
      })(),
    }));
    // P7: workspace menu product contract.
    expect(workbenchPanels.menuButtonCount === 1, "The Workspace panel should expose one workspace menu button.");
    expect(workbenchPanels.menuButtonInWorkspacePanel, "The workspace menu button should belong to the Workspace panel header.");
    expect(workbenchPanels.topChromeMenuButtonCount === 0, "Top chrome should not duplicate the workspace menu button.");
    expect(workbenchPanels.workspacePanelLabel === "Workspace panel", "The left panel should identify itself as the Workspace panel, not the Files panel.");
    expect(workbenchPanels.menuOpen, "The workspace menu should open from the Workspace panel header.");
    expect(workbenchPanels.leftPanelCount === 0, "The app should not render a left side panel for future surfaces.");
    expect(workbenchPanels.leftTabCount === 2, "The Workspace panel should expose Files and Libraries as peer views.");
    expect(workbenchPanels.leftTabLabels.join("|") === "Files|Libraries", "Workspace views should use explicit Files and Libraries tabs.");
    expect(workbenchPanels.leftVisibleTabLabelCount === 0, "Workspace views should match the icon-only right-panel tab treatment.");
    expect(workbenchPanels.templateRowCount === 0, "Templates should not ship as a visible surface yet.");
    expect(!workbenchPanels.menuText.includes("Agent"), "Agent should not ship as an inert menu surface.");
    expect(workbenchPanels.fileSearchCount === 0, "File search should live in the side panel.");
    expect(workbenchPanels.fileRowCount === 0, "File rows should live in the side panel.");
    expect(
      workbenchPanels.actionRows.map((row) => row.text).join("|") ===
        "New document|Import document (.md)…|Import folder…|Export document (.md)|Export workspace (.zip)|Preferences|About|Help|Follow us|GitHub|Clear local workspace…",
      "The workspace menu should expose file entry points, preferences, support, and public links without duplicating Share.",
    );
    const xPublicLink = workbenchPanels.publicLinks.find((link) => link.text === "Follow us");
    expect(xPublicLink?.href === "https://x.com/tabula_md", "Follow us should point to the Tabula X profile.");
    expect(xPublicLink?.ariaLabel === "Open Tabula.md on X", "Follow us should expose an explicit X destination label.");
    expect(
      xPublicLink?.svgFill === "currentColor" && xPublicLink?.svgPath.startsWith("M18.901"),
      "Follow us should use the X logo icon, not a letter or generic close icon.",
    );
    expect(
      workbenchPanels.actionRows.every((row) => row.iconCount >= 1 && row.iconCount <= 2),
      "Workspace menu rows should be icon plus label, with chevrons only for nested surfaces.",
    );
    expect(
      workbenchPanels.actionRows.every((row) => row.height >= 30 && row.height <= 34),
      "Workspace menu rows should stay compact.",
    );
    expect(
      workbenchPanels.actionRows.every((row) => row.fontWeight === workbenchPanels.actionRows[0].fontWeight),
      "Workspace menu rows should use one regular text weight.",
    );
    expect(
      workbenchPanels.actionRows.every(
        (row) =>
          row.height === workbenchPanels.actionRows[0].height &&
          row.borderRadius === workbenchPanels.actionRows[0].borderRadius &&
          row.paddingLeft === workbenchPanels.actionRows[0].paddingLeft &&
          row.fontSize === workbenchPanels.actionRows[0].fontSize &&
          row.color === workbenchPanels.actionRows[0].color,
      ),
      "Workspace menu rows should use one compact row token set.",
    );
    const focusIndex = (label) => workbenchPanels.focusOrder.indexOf(label);
    expect(focusIndex("New document") !== -1, "Keyboard order should include document creation.");
    expect(focusIndex("Import document (.md)…") !== -1, "Keyboard order should include document import.");
    expect(focusIndex("Import folder…") !== -1, "Keyboard order should include opening a folder.");
    expect(focusIndex("Export document (.md)") !== -1, "Keyboard order should include document export.");
    expect(focusIndex("Export workspace (.zip)") !== -1, "Keyboard order should include workspace export.");
    expect(focusIndex("Live collaboration…") === -1, "Live collaboration should have one entry point in Share.");
    expect(focusIndex("Preferences") !== -1, "Keyboard order should include Preferences.");
    expect(focusIndex("About") !== -1, "Keyboard order should include About.");
    expect(focusIndex("Help") !== -1, "Keyboard order should include Help.");
    expect(
      focusIndex("New document") <
        focusIndex("Import document (.md)…") &&
        focusIndex("Import document (.md)…") < focusIndex("Import folder…") &&
        focusIndex("Import folder…") < focusIndex("Export document (.md)") &&
        focusIndex("Export document (.md)") < focusIndex("Export workspace (.zip)") &&
        focusIndex("Export workspace (.zip)") < focusIndex("Preferences") &&
        focusIndex("Preferences") < focusIndex("About") &&
        focusIndex("About") < focusIndex("Help"),
      "Workspace menu keyboard order should move from file actions to support actions.",
    );
    expect(workbenchPanels.statusVisible, "The document status bar should remain visible.");
    expect(workbenchPanels.panelToggleCount >= 1, "Top chrome should retain global search and document-context controls.");
    expect(workbenchPanels.bottomPanelCount === 0, "The bottom panel should stay removed; status bar owns bottom status.");
    expect(
      workbenchPanels.laneGeometry.menu.width <= 320,
      "The workspace menu should stay a compact popover, not a side panel.",
    );
    expect(
      workbenchPanels.laneGeometry.toolbar.left < workbenchPanels.laneGeometry.preview.left + 2,
      "Opening the workspace menu should not shift the document toolbar lane.",
    );
    expect(
      workbenchPanels.laneGeometry.status.left < workbenchPanels.laneGeometry.preview.left + 2,
      "Opening the workspace menu should not shift the document status lane.",
    );

    const supportActions = page.locator(".workspace-menu-popover");
    expect((await supportActions.getByRole("button", { name: "Tabula +", exact: true }).count()) === 0, "Tabula + should not appear in the left menu yet.");

    await supportActions.getByRole("button", { name: "Preferences", exact: true }).click();
    await waitForRenderFrame(page);
    const preferencesPanel = await page.evaluate(() => ({
      menuOpen: Boolean(document.querySelector(".workspace-menu-popover")),
      preferencesOpen: Boolean(document.querySelector(".workspace-preferences-panel")),
      surfaceLabel: document.querySelector(".workspace-preferences-panel")?.getAttribute("aria-label") ?? "",
      preferenceLabels: Array.from(document.querySelectorAll(".workspace-preferences-setting > span")).map((item) =>
        item.textContent?.replace(/\s+/g, " ").trim(),
      ),
      segmentRows: Array.from(document.querySelectorAll(".workspace-preferences-segmented")).map((segment) =>
        Array.from(segment.querySelectorAll("button"))
          .map(
            (button) =>
              button.getAttribute("aria-label") ??
              button.textContent?.replace(/\s+/g, " ").trim(),
          )
          .join("|"),
      ),
      languageOptions: Array.from(document.querySelectorAll(".workspace-preferences-select option")).map((option) =>
        option.textContent?.replace(/\s+/g, " ").trim(),
      ),
      languageSelectCount: document.querySelectorAll(".workspace-preferences-select select").length,
      switchRows: Array.from(document.querySelectorAll(".workspace-preferences-switch > span")).map((item) =>
        item.textContent?.replace(/\s+/g, " ").trim(),
      ),
      internalLabelLeak:
        document.querySelector(".workspace-preferences-panel")?.textContent?.includes("Browser project") ?? false,
      storageSurfaceLeak:
        document.querySelector(".workspace-preferences-panel")?.textContent?.includes("Storage") ?? false,
      checkRowCount: document.querySelectorAll(".workspace-preferences-check").length,
      detailRowCount: document.querySelectorAll(".left-detail-list div").length,
      shortcutRowCount: document.querySelectorAll(".left-shortcut-row").length,
      keyboardShortcutsFooterCount: Array.from(document.querySelectorAll(".workspace-menu-row")).filter((button) =>
        button.textContent?.includes("Keyboard shortcuts"),
      ).length,
      preferenceFooterActive:
        Array.from(document.querySelectorAll(".workspace-menu-row"))
          .find((button) => button.textContent?.includes("Preferences"))
          ?.classList.contains("active") ?? false,
    }));
    expect(preferencesPanel.menuOpen, "Preferences should keep the workspace menu open.");
    expect(preferencesPanel.preferencesOpen, "Preferences should open as an inline menu surface.");
    expect(preferencesPanel.surfaceLabel === "Preferences", "The inline Preferences surface should be labeled Preferences.");
    expect(
      preferencesPanel.preferenceLabels.join("|") === "Theme|Language",
      "Preferences should only expose lightweight app-wide preferences.",
    );
    expect(
      preferencesPanel.segmentRows.join("/") === "System|Light|Dark",
      "Preferences should keep theme as a compact segmented control.",
    );
    expect(preferencesPanel.languageSelectCount === 1, "Preferences should expose language as one dropdown.");
    expect(
      preferencesPanel.languageOptions.join("|") === "English|한국어|日本語|中文|Español|Français|Deutsch",
      "Language dropdown should expose the supported app chrome languages.",
    );
    expect(preferencesPanel.switchRows.length === 0, "Preferences should not duplicate editor controls.");
    expect(!preferencesPanel.storageSurfaceLeak, "Preferences should not explain local storage as a configurable surface.");
    expect(!preferencesPanel.internalLabelLeak, "Preferences should not leak internal storage implementation names.");
    expect(preferencesPanel.checkRowCount === 0, "Preferences should use segmented controls instead of checkmark rows.");
    expect(preferencesPanel.detailRowCount === 0, "Preferences should not render as an in-panel detail list.");
    expect(preferencesPanel.shortcutRowCount === 0, "Keyboard shortcuts should move out of the left panel surface.");
    expect(preferencesPanel.keyboardShortcutsFooterCount === 0, "Keyboard shortcuts should be documented in HELP.md, not pinned.");
    expect(preferencesPanel.preferenceFooterActive, "The Preferences support row should stay selected while its surface is open.");

    const preferencesPanelSurface = page.locator(".workspace-preferences-panel");
    await preferencesPanelSurface.getByRole("button", { name: "Dark", exact: true }).click();
    await preferencesPanelSurface.locator(".workspace-preferences-select select").selectOption("ko");
    const rootPreferences = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      themePreference: document.documentElement.dataset.themePreference,
      language: document.documentElement.lang,
      menuText: document.querySelector(".workspace-menu-popover")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(rootPreferences.theme === "dark", "Choosing Dark should update the app theme contract.");
    expect(rootPreferences.themePreference === "dark", "Choosing Dark should persist the selected theme preference.");
    expect(rootPreferences.language === "ko", "Choosing Korean should update the document language contract.");
    expect(rootPreferences.menuText.includes("새 문서"), "Choosing Korean should update workspace menu copy.");
    await preferencesPanelSurface.locator(".workspace-preferences-select select").selectOption("en");
    await preferencesPanelSurface.getByRole("button", { name: "System", exact: true }).click();
    const restoredPreferences = await page.evaluate(() => ({
      theme: document.documentElement.dataset.theme,
      themePreference: document.documentElement.dataset.themePreference,
      language: document.documentElement.lang,
      menuText: document.querySelector(".workspace-menu-popover")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(
      restoredPreferences.theme === "light" || restoredPreferences.theme === "dark",
      "Choosing System should resolve to a concrete light or dark theme.",
    );
    expect(restoredPreferences.themePreference === "system", "Choosing System should preserve the selected preference.");
    expect(restoredPreferences.language === "en", "Choosing English should restore the document language contract.");
    expect(restoredPreferences.menuText.includes("New document"), "Choosing English should restore workspace menu copy.");

    await page.keyboard.press("Escape");
    await waitForRenderFrame(page);
    const preferencesEscapeState = await page.evaluate(() => ({
      menuOpen: Boolean(document.querySelector(".workspace-menu-popover")),
      preferencesOpen: Boolean(document.querySelector(".workspace-preferences-panel")),
      newActionsVisible: Array.from(document.querySelectorAll(".workspace-menu-row")).some((button) =>
        button.textContent?.includes("New document"),
      ),
    }));
    expect(preferencesEscapeState.menuOpen, "Escape from Preferences should keep the workspace menu open.");
    expect(!preferencesEscapeState.preferencesOpen, "Escape from Preferences should close only the inline Preferences surface.");
    expect(preferencesEscapeState.newActionsVisible, "Escape from Preferences should leave file creation available.");

    await supportActions.getByRole("button", { name: "New document", exact: true }).click();
    await waitForActiveTab(page, { startsWith: "Untitled" });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await openProjectMenu(page);
    await page.getByRole("button", { name: "About", exact: true }).click();
    await waitForRenderFrame(page);
    const aboutState = await page.evaluate(() => ({
      menuOpen: Boolean(document.querySelector(".workspace-menu-popover")),
      dialogOpen: Boolean(document.querySelector(".workspace-info-modal")),
      activeTab: document.querySelector(".tab-item.active")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(!aboutState.menuOpen, "About should close the workspace menu after opening the app dialog.");
    expect(aboutState.dialogOpen, "About should open an app dialog.");
    expect(
      aboutState.activeTab.includes("Untitled"),
      "About should leave the active user document unchanged.",
    );
    await page.getByRole("button", { name: "Close", exact: true }).click();

    await openProjectMenu(page);

    await page.locator(".workspace-menu-popover").getByRole("button", { name: "New document", exact: true }).click();
    await waitForActiveTab(page, { startsWith: "Untitled" });
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    const newFileState = await page.evaluate(() => ({
      fileShellClasses: document.querySelector(".file-shell")?.className ?? "",
      workspaceClasses: document.querySelector(".workspace")?.className ?? "",
      lineNumberGutterCount: document.querySelectorAll(".cm-lineNumbers").length,
    }));
    const newFileTabs = await getTabs(page);
    const activeNewFileTab = newFileTabs.find((tab) => tab.active);
    expect(
      activeNewFileTab?.mode === "Edit",
      `New files should keep the editor default view mode. Got: ${activeNewFileTab?.mode}`,
    );
    expect(
      newFileState.fileShellClasses.includes("reading-wide") && newFileState.workspaceClasses.includes("reading-wide"),
      "New files should keep the default reading width.",
    );
    expect(newFileState.lineNumberGutterCount > 0, "New files should keep line numbers visible by default.");
    await openMarkdownFile(page, {
      content: "# Tabula.md\n\n## Start here\n\n### Details\n\nA local-first Markdown workspace.",
    });
    await page.locator('.tab-item[data-file-name="README.md"] .tab-select-button').click();
    await waitForActiveTab(page, { exact: "README.md" });

    await openProjectMenu(page);
    await page.keyboard.press("Escape");
    await waitForRenderFrame(page);
    const menuEscapeState = await page.evaluate(() => ({
      menuOpen: Boolean(document.querySelector(".workspace-menu-popover")),
    }));
    expect(!menuEscapeState.menuOpen, "Escape from the workspace menu should close the menu popover.");

    const rightPanelToggleContract = await page.evaluate(() => {
      const button = document.querySelector('button[aria-label="Toggle side panel"]');
      return {
        ariaLabel: button?.getAttribute("aria-label") ?? "",
        tooltip: button?.getAttribute("data-tooltip") ?? "",
      };
    });
    expect(
      rightPanelToggleContract.ariaLabel === "Toggle side panel",
      `The right panel toggle should use product-facing terminology. Got: ${rightPanelToggleContract.ariaLabel}`,
    );
    expect(
      rightPanelToggleContract.tooltip === rightPanelToggleContract.ariaLabel,
      "The right panel toggle should expose the shared tooltip copy.",
    );

    if ((await page.locator(".left-panel").count()) === 0) {
      await page.getByRole("button", { name: "Workspace panel", exact: true }).click();
    }
    await waitForLeftPanel(page, "Workspace panel");
    await ensureSidePanelOpen(page);
    const rightPanelState = await page.evaluate(() => ({
      open: Boolean(document.querySelector(".left-panel")),
      ariaLabel: document.querySelector(".left-panel")?.getAttribute("aria-label") ?? "",
      labelledBy: document.querySelector(".left-panel")?.getAttribute("aria-labelledby") ?? "",
      sectionsLabel: document.querySelector(".right-panel-tabs")?.getAttribute("aria-label") ?? "",
      tabs: Array.from(document.querySelectorAll(".right-panel-tab")).map((button) => button.getAttribute("aria-label")),
      visibleTabLabelCount: document.querySelectorAll(".right-panel-tab-label").length,
      headingCount: document.querySelectorAll(".left-panel > .right-panel-title").length,
      documentCardCount: document.querySelectorAll(".left-panel .panel-document-card").length,
      countPillCount: document.querySelectorAll(".left-panel .panel-count-pill").length,
      fileToolbar: (() => {
        const row = document.querySelector(".right-file-toolbar");
        const importButton = document.querySelector('.right-file-toolbar-button[aria-label="Open Markdown file"]');
        const createButton = document.querySelector('.right-file-toolbar-button[aria-label="Create"]');
        if (!row || !importButton || !createButton) {
          return null;
        }
        const importButtonRect = importButton.getBoundingClientRect();
        const createButtonRect = createButton.getBoundingClientRect();
        return {
          importButtonWidth: Math.round(importButtonRect.width),
          importButtonHeight: Math.round(importButtonRect.height),
          createButtonWidth: Math.round(createButtonRect.width),
          createButtonHeight: Math.round(createButtonRect.height),
        };
      })(),
      fileRows: Array.from(document.querySelectorAll(".right-file-tree-row.file")).map((row) => {
        const rect = row.getBoundingClientRect();
        const style = window.getComputedStyle(row);
        return {
          text: row.textContent?.replace(/\s+/g, " ").trim() ?? "",
          title: row.getAttribute("title") ?? "",
          active: row.classList.contains("active"),
          height: Math.round(rect.height),
          borderRadius: style.borderRadius,
          color: style.color,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
        };
      }),
      laneGeometry: (() => {
        const rectOf = (selector) => {
          const rect = document.querySelector(selector)?.getBoundingClientRect();
          return rect
            ? {
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width),
              }
            : null;
        };
        return {
          leftPanel: rectOf(".left-panel"),
          rightPanel: rectOf(".right-panel"),
          toolbar: rectOf(".document-toolbar-row"),
          preview: rectOf(".preview-surface") ?? rectOf(".editor-surface"),
          status: rectOf(".file-status-bar"),
        };
      })(),
      workspaceName: document.querySelector(".right-file-workspace-name")?.textContent?.trim() ?? "",
      syntheticRootRowCount: Array.from(document.querySelectorAll(".right-file-tree-node.folder"))
        .filter((row) => row.querySelector(".right-row-label")?.textContent?.trim() === "Project")
        .length,
    }));
    expect(rightPanelState.open, "Files should open as workspace navigation from the top-left trigger.");
    expect(
      rightPanelState.ariaLabel === "Workspace panel" && rightPanelState.labelledBy === "",
      "Workspace navigation should expose its active section as its accessible name.",
    );
    expect(
      rightPanelState.sectionsLabel === "Side panel sections",
      "The side panel sections nav should use scoped terminology.",
    );
    expect(
      rightPanelState.tabs.join("|") === "Outline|Links|Comments|Properties",
      `The right panel should contain only document context. Found: ${rightPanelState.tabs.join("|")}`,
    );
    expect(
      (await page.locator(".document-utility-controls").getByRole("button", {
        name: "Properties",
        exact: true,
      }).count()) === 0,
      "Properties should live in the right panel instead of duplicating a document-toolbar action.",
    );
    expect(rightPanelState.visibleTabLabelCount === 0, "Side panel tabs should stay icon-only.");
    expect(rightPanelState.workspaceName === "Project", "Files should identify the current workspace.");
    expect(rightPanelState.syntheticRootRowCount === 0, "Root files should not be wrapped in a synthetic Project folder.");
    await page.getByRole("button", { name: "Rename Project in Files", exact: true }).click();
    const workspaceNameInput = page.getByRole("textbox", { name: "Rename Project in Files", exact: true });
    await workspaceNameInput.fill("knowledge-feature-lab");
    await workspaceNameInput.press("Enter");
    expect(
      (await page.getByRole("button", { name: "Rename knowledge-feature-lab in Files", exact: true }).count()) === 1,
      "Files should rename the workspace identity without adding a root folder row.",
    );
    expect(
      rightPanelState.headingCount === 0,
      "The active tab should identify the section without a redundant visible panel heading.",
    );
    expect(
      rightPanelState.fileRows.filter((row) => row.active).length === 1 &&
        rightPanelState.fileRows.some((row) => row.active && row.text.includes("README")),
      "Files should identify the active document through its selected tree row without repeating a label.",
    );
    expect(rightPanelState.documentCardCount === 0, "The right panel should not use document cards.");
    expect(rightPanelState.countPillCount === 0, "The right panel should not use count pills.");
    await page.locator(".right-panel").getByRole("button", {
      name: "Close side panel",
      exact: true,
    }).click();
    const rightPanelDivider = page.locator(
      '.left-panel-divider[role="separator"][aria-label="Resize side panel"]',
    );
    expect(
      (await rightPanelDivider.getAttribute("aria-valuemax")) === "920",
      "Workspace navigation should preserve room for the workbench while resizing.",
    );
    await rightPanelDivider.focus();
    for (let step = 0; step < 45; step += 1) {
      await rightPanelDivider.press("ArrowRight");
    }
    await page.waitForFunction(
      () => Math.round(document.querySelector(".left-panel")?.getBoundingClientRect().width ?? 0) === 920,
    );
    expect(
      (await rightPanelDivider.getAttribute("aria-valuenow")) === "920",
      "Keyboard resizing should reach the viewport-derived side-panel maximum.",
    );
    await rightPanelDivider.dblclick();
    await page.waitForFunction(
      () => Math.round(document.querySelector(".left-panel")?.getBoundingClientRect().width ?? 0) === 288,
    );
    expect(
      rightPanelState.fileToolbar?.importButtonWidth === 28 &&
        rightPanelState.fileToolbar?.importButtonHeight === 28 &&
        rightPanelState.fileToolbar?.createButtonWidth === 28 &&
        rightPanelState.fileToolbar?.createButtonHeight === 28,
      "Files toolbar controls should use 28px icon buttons.",
    );
    expect(rightPanelState.fileRows.length > 0, "Left Files should render file rows.");
    expect(
      rightPanelState.fileRows.every((row) => row.height === 34 && row.fontWeight === "400"),
      "Left Files rows should use the shared 34px row height and regular weight.",
    );
    expect(
      !rightPanelState.fileRows.some((row) => /\b(Preview|Edit|Split|Local|Live|Offline|Connecting)\b/.test(row.text)),
      "Left Files rows should not repeat mode/status labels.",
    );
    expect(
      rightPanelState.laneGeometry.preview.left >= rightPanelState.laneGeometry.leftPanel.right + 20 &&
        rightPanelState.laneGeometry.preview.right <= rightPanelState.laneGeometry.rightPanel.left - 20,
      "Workspace navigation and document context should leave the preview lane readable.",
    );
    expect(
      rightPanelState.laneGeometry.toolbar.left >= rightPanelState.laneGeometry.leftPanel.right &&
        rightPanelState.laneGeometry.toolbar.right <= rightPanelState.laneGeometry.rightPanel.left - 20,
      "The two panels should not clip the editor toolbar lane.",
    );
    expect(
      rightPanelState.laneGeometry.status.left >= rightPanelState.laneGeometry.leftPanel.right &&
        rightPanelState.laneGeometry.status.right <= rightPanelState.laneGeometry.rightPanel.left - 20,
      "The two panels should not clip the status bar lane.",
    );

    await ensureSidePanelOpen(page);
    await page.getByRole("button", { name: "Properties", exact: true }).click();
    await page.locator(".right-panel-properties").waitFor({
      state: "visible",
    });
    expect(
      (await page.getByRole("button", {
        name: "Workspace issues",
        exact: true,
      }).count()) === 0 &&
        (await page.getByRole("button", { name: "Browse", exact: true }).count()) === 0,
      "Properties should stay focused on the active document during editing.",
    );
    expect(
      (await page.locator(".right-compatibility-scroll").count()) === 0,
      "Compatibility repair controls should not interrupt ordinary Markdown editing.",
    );
    await page.locator('.workspace-search-trigger[aria-label="Search"]').click();
    await page.getByRole("dialog", { name: "Search", exact: true }).waitFor({
      state: "visible",
    });
    await page.getByRole("searchbox", {
      name: "Search documents and metadata",
      exact: true,
    }).waitFor({ state: "visible" });
    expect(
      await page.getByRole("searchbox", {
        name: "Search documents and metadata",
        exact: true,
      }).isVisible() &&
        await page.getByRole("button", { name: "Filters", exact: true }).isVisible() &&
        await page.locator(".right-properties-context").isVisible(),
      "Workspace Search should open as a modal retrieval surface over document context.",
    );

    await page.getByRole("button", { name: "Search settings", exact: true }).click();
    const matchCaseOption = page.getByRole("menuitemcheckbox", {
      name: /Match case/,
    });
    await matchCaseOption.waitFor({ state: "visible" });
    await matchCaseOption.click();
    expect(
      (await matchCaseOption.getAttribute("aria-checked")) === "true",
      "Search settings should render above the modal and update search options.",
    );
    await page.keyboard.press("Escape");
    await page.getByRole("dialog", { name: "Search", exact: true }).waitFor({
      state: "detached",
    });

    await page.setViewportSize({ width: 568, height: 800 });
    await page.locator('.workspace-search-trigger[aria-label="Search"]').click();
    await page.getByRole("dialog", { name: "Search", exact: true }).waitFor({
      state: "visible",
    });
    const closeWorkspaceSearch = page.getByRole("button", {
      name: "Close search",
      exact: true,
    });
    await closeWorkspaceSearch.waitFor({ state: "visible" });
    await closeWorkspaceSearch.click();
    await page.getByRole("dialog", { name: "Search", exact: true }).waitFor({
      state: "detached",
    });
    await page.setViewportSize({ width: 1440, height: 900 });

    await ensureSidePanelOpen(page);
    await page.getByRole("button", { name: "Links", exact: true }).click();
    await waitForPanelTab(page, "Links");
    const emptyOutgoingSection = page.locator('.right-links-section[aria-label="Outgoing"]');
    const emptyBacklinksSection = page.locator('.right-links-section[aria-label="Backlinks"]');
    expect(
      await emptyOutgoingSection.getByRole("button", {
        name: "Collapse Outgoing",
        exact: true,
      }).isVisible() &&
        (await emptyOutgoingSection.locator(".right-links-count").textContent()) === "0" &&
        await page.getByText("No outgoing links yet.", { exact: true }).isVisible() &&
        await emptyBacklinksSection.getByRole("button", {
          name: "Collapse Backlinks",
          exact: true,
        }).isVisible() &&
        (await emptyBacklinksSection.locator(".right-links-count").textContent()) === "0" &&
        await page.getByText("No documents link here yet.", { exact: true }).isVisible() &&
        (await page.locator('.right-links-section[aria-label="Issues"]').count()) === 0,
      "Links should preserve both relationship directions at zero without inventing an issue.",
    );
    expect(
      (await page.getByRole("button", { name: "Open map", exact: true }).count()) === 0,
      "Links should stay focused on the active document instead of owning a workspace map action.",
    );
    if (!(await page.locator(".left-panel").isVisible())) {
      await page.getByRole("button", { name: "Workspace panel", exact: true }).click();
    }
    await waitForLeftPanel(page, "Workspace panel");

    await openProjectMenu(page);
    const dualPanelGeometry = await page.evaluate(() => {
      const rectOf = (selector) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();
        return rect
          ? {
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            }
          : null;
      };
      return {
        menu: rectOf(".workspace-menu-popover"),
        leftPanel: rectOf(".left-panel"),
        rightPanel: rectOf(".right-panel"),
        toolbar: rectOf(".document-toolbar-row"),
        preview: rectOf(".preview-surface") ?? rectOf(".editor-surface"),
        status: rectOf(".file-status-bar"),
      };
    });
    expect(dualPanelGeometry.menu, "The workspace menu should be measurable while Project Context is open.");
    expect(
      dualPanelGeometry.preview.left >= dualPanelGeometry.leftPanel.right + 20 &&
        dualPanelGeometry.preview.right <= dualPanelGeometry.rightPanel.left - 20 &&
        dualPanelGeometry.preview.width >= 240,
      "The preview document lane should remain readable when Project Context is open.",
    );
    expect(
      dualPanelGeometry.toolbar.right <= dualPanelGeometry.rightPanel.left - 20,
      "The editor toolbar lane should stay clear of Project Context.",
    );
    expect(
      dualPanelGeometry.status.right <= dualPanelGeometry.rightPanel.left - 20,
      "The status bar lane should stay clear of Project Context.",
    );
    await page.getByRole("button", { name: "Close Workspace menu", exact: true }).click();
    await waitForRenderFrame(page);

    await page.getByRole("button", { name: "Properties", exact: true }).click();
    expect(
      await page.locator(".right-properties-context").isVisible() &&
        (await page.getByRole("button", { name: "Browse", exact: true }).count()) === 0 &&
        (await page.getByRole("button", {
          name: "Workspace issues",
          exact: true,
        }).count()) === 0 &&
        (await page.locator(".right-panel-search-field").count()) === 0 &&
       (await page.locator(".right-graph-panel").count()) === 0,
       "Properties should remain a stable active-document inspector instead of a catalog or dashboard.",
    );
    await page.getByRole("button", { name: "Close side panel", exact: true }).click();

    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await page.getByRole("button", { name: "Outline", exact: true }).click();
    await waitForPanelTab(page, "Outline");
    const rightOutlineState = await page.evaluate(() => ({
      outlineRows: Array.from(document.querySelectorAll(".right-outline-list button")).map((row) => {
        const rect = row.getBoundingClientRect();
        const style = window.getComputedStyle(row);
        return {
          height: Math.round(rect.height),
          fontWeight: style.fontWeight,
        };
      }),
      bodyText: document.querySelector(".right-panel-body")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(rightOutlineState.bodyText.includes("Start here"), "Outline should reflect the active file when selected.");
    expect(
      rightOutlineState.outlineRows.length > 0 &&
        rightOutlineState.outlineRows.every((row) => row.height >= 30 && row.height <= 34 && row.fontWeight === "400"),
      "The right panel outline rows should stay compact and regular weight.",
    );
    const rootOutlineHeading = page.getByRole("button", {
      name: "Tabula.md",
      exact: true,
    });
    const childOutlineHeading = page.getByRole("button", {
      name: "Start here",
      exact: true,
    });
    const rootOutlineLabelBox = await rootOutlineHeading
      .locator(".right-row-label").boundingBox();
    const childOutlineLabelBox = await childOutlineHeading
      .locator(".right-row-label").boundingBox();
    expect(
      rootOutlineLabelBox && childOutlineLabelBox &&
        Math.abs(childOutlineLabelBox.x - rootOutlineLabelBox.x - 12) <= 1,
      "Outline hierarchy should indent the complete heading row by one stable step.",
    );
    const rootOutlineRow = page.locator(".right-outline-row").filter({
      has: rootOutlineHeading,
    });
    const rootOutlineToggle = rootOutlineRow.getByRole("button", {
      name: "Collapse section",
      exact: true,
    });
    const rootOutlineToggleBox = await rootOutlineToggle.boundingBox();
    expect(
      (await rootOutlineToggle.locator(".right-outline-chevron").count()) === 1 &&
        (await rootOutlineToggle.locator(".lucide-chevron-right").count()) === 0 &&
        (await rootOutlineToggle.getAttribute("aria-expanded")) === "true" &&
        rootOutlineToggleBox &&
        rootOutlineToggleBox.width >= 28 &&
        rootOutlineToggleBox.height >= 30,
      "A collapsible outline heading should expose one rotating chevron with a forgiving hit target.",
    );
    await rootOutlineHeading.click();
    await waitForRenderFrame(page);
    expect(
      (await childOutlineHeading.count()) === 1 &&
        (await rootOutlineToggle.getAttribute("aria-expanded")) === "true" &&
        (await rootOutlineHeading.getAttribute("aria-current")) === "location",
      "Clicking an outline heading should navigate without changing its disclosure state.",
    );
    await rootOutlineToggle.click();
    await waitForRenderFrame(page);
    expect(
      (await childOutlineHeading.count()) === 0 &&
        (await rootOutlineRow.locator(".right-outline-toggle").getAttribute("aria-expanded")) === "false",
      "Clicking the disclosure control should hide the heading descendants.",
    );
    await page.getByRole("button", { name: "Links", exact: true }).click();
    await waitForPanelTab(page, "Links");
    await page.getByRole("button", { name: "Outline", exact: true }).click();
    await waitForPanelTab(page, "Outline");
    const persistedRootOutlineRow = page.locator(".right-outline-row").filter({
      has: page.getByRole("button", {
        name: "Tabula.md",
        exact: true,
      }),
    });
    const persistedRootOutlineToggle = persistedRootOutlineRow.getByRole("button", {
      name: "Expand section",
      exact: true,
    });
    expect(
      (await persistedRootOutlineToggle.getAttribute("aria-expanded")) === "false" &&
        (await childOutlineHeading.count()) === 0,
      "Outline collapse state should survive switching between right-panel tabs.",
    );
    await page.locator(
      '.tab-item:not([data-file-name="README.md"]) .tab-select-button',
    ).first().click();
    await waitForActiveTab(page, { startsWith: "Untitled" });
    await page.locator('.tab-item[data-file-name="README.md"] .tab-select-button').click();
    await waitForActiveTab(page, { exact: "README.md" });
    expect(
      (await persistedRootOutlineToggle.getAttribute("aria-expanded")) === "false" &&
        (await childOutlineHeading.count()) === 0,
      "Outline collapse state should be restored when returning to a document.",
    );
    await persistedRootOutlineToggle.click();
    await waitForRenderFrame(page);
    await page.getByRole("button", { name: "Start here", exact: true }).click();
    await waitForRenderFrame(page);
    expect(
      (await page.locator('.right-outline-link[aria-current="location"]').count()) === 1,
      "Outline should identify the heading that contains the editor cursor.",
    );
    await page.keyboard.press("ArrowRight");
    await waitForRenderFrame(page);

    expect((await page.getByRole("button", { name: "Comments", exact: true }).count()) === 1, "Comments should be available in local and live workspaces.");
    await page.getByRole("button", { name: "Comments", exact: true }).click();
    await waitForPanelTab(page, "Comments");
    const emptyCommentsState = await page.evaluate(() => ({
      contextLabel: document.querySelector(".right-comments-context-label")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      emptyText: document.querySelector(".right-comments-scroll .right-empty-state")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      inputCount: document.querySelectorAll(".right-comment-input").length,
      visibleText: document.querySelector(".right-panel-body")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      cardCount: document.querySelectorAll(".right-comment-card").length,
      actionCount: document.querySelectorAll(".right-comment-action").length,
      navigationCount: document.querySelectorAll(".right-panel-tab small").length,
      statusCount: document.querySelectorAll(".status-comments-button").length,
      fileCount: document.querySelectorAll(".right-file-tree-comment-count").length,
    }));
    expect(emptyCommentsState.cardCount === 0, "Comments should start without comment cards.");
    expect(emptyCommentsState.actionCount === 0, "Comment actions should not appear when there are no comments.");
    expect(
      (await page.locator(".right-comments-toolbar-action .lucide-plus").count()) === 0 &&
        (await page.locator(".right-comments-empty-state .lucide-message-square-plus").count()) === 1,
      "Empty Comments should replace the ambiguous toolbar plus with an instructional action.",
    );
    expect(Boolean(emptyCommentsState.contextLabel), "Comments should identify the active scope.");
    expect(!emptyCommentsState.contextLabel.startsWith("Comments on"), "Comments scope title should avoid repeated helper copy.");
    expect(!emptyCommentsState.contextLabel.endsWith(".md"), "Comments should hide .md in the active-file label.");
    expect(emptyCommentsState.navigationCount === 0, "Comments navigation should not carry an aggregate count badge.");
    expect(emptyCommentsState.statusCount === 0, "The status bar should not repeat the comment count.");
    expect(emptyCommentsState.fileCount === 0, "Files should not repeat comment count badges.");
    expect(
      emptyCommentsState.emptyText.includes("No comments") || emptyCommentsState.visibleText.includes("Resolved ·"),
      "Comments should expose a quiet empty or resolved-only state.",
    );
    expect(
      emptyCommentsState.emptyText.includes("Select text to comment on a passage") &&
        emptyCommentsState.emptyText.includes("Comment on document"),
      "The empty Comments panel should explain selection comments and expose a document comment action.",
    );
    expect(emptyCommentsState.inputCount === 0, "Comments composer should stay closed until the user starts a comment.");
    expect(
      !/\b(Reply|Resolve|Reopen|Delete)\b/.test(emptyCommentsState.visibleText),
      "Comment card actions should not appear when there are no comments.",
    );

    await page.getByRole("button", { name: "Comment scope", exact: true }).click();
    expect((await page.getByRole("menuitemradio", { name: "Current file", exact: true }).count()) === 1, "Comment scope should offer the current document.");
    expect((await page.getByRole("menuitemradio", { name: "All comments", exact: true }).count()) === 1, "Comment scope should offer all documents without a permanent segmented control.");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Comment on document", exact: true }).click();
    expect((await page.locator(".right-comment-input").count()) === 1, "Document comment command should open the composer on demand.");
    expect(
      (await page.locator(".right-comment-form .right-comment-text-button").count()) === 1,
      "An empty document comment composer should always offer Cancel.",
    );
    await page.locator(".right-comment-form .right-comment-text-button").click();
    await waitForRenderFrame(page);
    expect((await page.locator(".right-comment-input").count()) === 0, "Cancel should close an empty document comment composer.");

    await page.getByRole("button", { name: "Comment on document", exact: true }).click();
    expect((await page.locator(".right-comment-input").count()) === 1, "Document comment command should reopen the composer.");
    expect(
      (await page.locator(".right-comments-toolbar").getByRole("button", { name: "Cancel", exact: true }).count()) === 0,
      "The toolbar should not duplicate the composer Cancel action.",
    );
    await page.locator(".right-comment-form .right-comment-text-button").click();
    await waitForRenderFrame(page);

    await page.getByRole("button", { name: "Comment on document", exact: true }).click();
    await page.getByLabel("Add comment to README.md").press("Escape");
    await waitForRenderFrame(page);
    expect((await page.locator(".right-comment-input").count()) === 0, "Escape should close an empty document comment composer.");

    await page.getByRole("button", { name: "Comment on document", exact: true }).click();
    await page.getByLabel("Comment author name").fill("Local User");
    await page.getByLabel("Comment author name").blur();
    await page.getByLabel("Add comment to README.md").fill("Review this intro.");
    await page.locator(".right-comment-form .right-comment-submit").click();
    await waitForRenderFrame(page);
    const commentsAfterAdd = await page.evaluate(() => ({
      cardCount: document.querySelectorAll(".right-comment-card").length,
      emptyCount: document.querySelectorAll(".right-comments-scroll .right-empty-state").length,
      fileHeaderCount: document.querySelectorAll(".right-comment-file").length,
      actionText: document.querySelector(".right-comment-actions")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      actionOpacity: (() => {
        const actions = document.querySelector(".right-comment-actions");
        return actions instanceof HTMLElement ? getComputedStyle(actions).opacity : "";
      })(),
      visibleText: document.querySelector(".right-panel-body")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      authorText: document.querySelector(".right-comment-meta .right-comment-author strong")?.textContent?.trim() ?? "",
    }));
    expect(commentsAfterAdd.cardCount === 1, "Adding a comment should create one comment card.");
    expect(commentsAfterAdd.emptyCount === 0, "Adding a comment should hide the comments empty state.");
    expect(commentsAfterAdd.fileHeaderCount === 0, "Active-file comments should not repeat the file header.");
    expect(commentsAfterAdd.actionText === "Reply", "Comment cards should keep Reply as the only inline command.");
    expect(commentsAfterAdd.actionOpacity === "0", "Comment actions should stay quiet until the row is hovered or focused.");
    expect(commentsAfterAdd.visibleText.includes("Review this intro."), "Added comment should render in the comments panel.");
    expect(commentsAfterAdd.authorText === "Local User", "New comments should use the editable local identity.");
    expect(
      commentsAfterAdd.actionText === "Reply",
      "Secondary comment commands should stay in the contextual menu.",
    );

    await page.locator(".right-comment-card").hover();
    const moreCommentActions = page.getByRole("button", { name: /^More actions for comment:/ });
    expect((await moreCommentActions.count()) === 1, "Comment cards should expose a visible more-actions button.");
    await moreCommentActions.click();
    expect((await page.getByRole("menuitem", { name: "Resolve", exact: true }).count()) === 1, "Resolve should live in the comment actions menu.");
    expect((await page.getByRole("menuitem", { name: "Delete", exact: true }).count()) === 1, "Delete should live in the comment actions menu.");
    expect((await page.locator(".right-comment-more-menu.ui-command-menu").count()) === 1, "Comment actions should use the shared command-menu surface.");
    await page.keyboard.press("Escape");
    expect((await page.getByRole("menuitem", { name: "Delete", exact: true }).count()) === 0, "Escape should close comment actions.");

    await page.getByRole("button", { name: "Reply", exact: true }).click();
    await page.locator(".right-comment-reply-form textarea").fill("Reply back.");
    await page.locator(".right-comment-reply-form .right-comment-submit").click();
    await waitForRenderFrame(page);
    const commentReplyState = await page.evaluate(() => ({
      replyCount: document.querySelectorAll(".right-comment-reply").length,
      replyAvatarCount: document.querySelectorAll(".right-comment-reply .right-comment-avatar").length,
      replyText: document.querySelector(".right-comment-reply")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      replyAuthorVariant: document.querySelector(".right-comment-reply .right-comment-author")?.className ?? "",
      replyIndent: window.getComputedStyle(document.querySelector(".right-comment-replies")).paddingLeft,
    }));
    expect(commentReplyState.replyCount === 1, "Reply should render under its parent comment.");
    expect(commentReplyState.replyAvatarCount === 0, "Replies should not repeat the full comment avatar treatment.");
    expect(commentReplyState.replyText.includes("Local User") && commentReplyState.replyText.includes("Reply back."), "Reply should keep author and body readable.");
    expect(commentReplyState.replyAuthorVariant.includes("reply"), "Replies should use the compact author variant.");
    expect(commentReplyState.replyIndent !== "0px", "Replies should be visually nested under the root comment.");

    await page.locator(".right-comment-card").hover();
    await page.getByRole("button", { name: /^More actions for comment:/ }).click();
    await page.getByRole("menuitem", { name: "Resolve", exact: true }).click();
    await waitForRenderFrame(page);
    const commentsAfterResolve = await page.evaluate(() => ({
      openCardCount: document.querySelectorAll(".right-comment-group:not(.resolved) .right-comment-card").length,
      resolvedHeader: document.querySelector(".right-resolved-comments-header")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      actionText: document.querySelector(".right-comment-actions")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(commentsAfterResolve.openCardCount === 0, "Resolved comments should leave the open comments list.");
    expect(commentsAfterResolve.resolvedHeader === "Resolved · 1", "Resolved comments should collapse behind a quiet archive row.");
    expect(commentsAfterResolve.actionText === "", "Resolved comments should stay hidden until the resolved row is opened.");

    await page.getByRole("button", { name: "Show resolved comments" }).click();
    await waitForRenderFrame(page);
    const resolvedCommentActions = await page.evaluate(() => ({
      actionText: document.querySelector(".right-comment-actions")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(resolvedCommentActions.actionText === "", "Resolved comments should keep all commands in the actions menu.");
    expect((await page.getByRole("button", { name: /^More actions for comment:/ }).count()) === 1, "Resolved comments should retain their actions menu.");
    await page.locator(".right-comment-card").hover();
    await page.getByRole("button", { name: /^More actions for comment:/ }).click();
    await page.getByRole("menuitem", { name: "Reopen", exact: true }).click();
    await waitForRenderFrame(page);
    const commentsAfterReopen = await page.evaluate(() => ({
      openCardCount: document.querySelectorAll(".right-comment-group .right-comment-card:not(.resolved)").length,
      resolvedHeaderCount: document.querySelectorAll(".right-resolved-comments-header").length,
    }));
    expect(commentsAfterReopen.openCardCount === 1, "Reopening should return the comment to the open comments list.");
    expect(commentsAfterReopen.resolvedHeaderCount === 0, "Reopening the only resolved comment should hide the resolved row.");

    await page.locator(".right-comment-card").hover();
    await page.getByRole("button", { name: /^More actions for comment:/ }).click();
    await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await waitForRenderFrame(page);
    expect((await page.locator(".right-comment-card").count()) === 0, "Deleting a comment should remove its thread without a browser confirmation dialog.");
    expect((await page.locator(".app-toast-action").textContent()) === "Undo", "Comment deletion should expose the shared Undo action.");
    await page.locator(".app-toast-action").click();
    await waitForRenderFrame(page);
    const restoredCommentState = await page.evaluate(() => ({
      cardCount: document.querySelectorAll(".right-comment-card").length,
      replyCount: document.querySelectorAll(".right-comment-reply").length,
      toastText: document.querySelector(".app-toast")?.textContent?.trim() ?? "",
    }));
    expect(restoredCommentState.cardCount === 1, "Undo should restore the deleted comment.");
    expect(restoredCommentState.replyCount === 1, "Undo should restore the deleted comment replies.");
    expect(restoredCommentState.toastText === "Comment restored.", "Undo should confirm the restored comment.");

    await page.keyboard.press("Escape");
    await waitForRenderFrame(page);
    const rightEscapeState = await page.evaluate(() => ({
      rightOpen: Boolean(document.querySelector(".right-panel")),
    }));
    expect(!rightEscapeState.rightOpen, "Escape should close the right panel.");

    const overflowInitialTabCount = (await getTabs(page)).length;
    for (let index = 0; index < 10; index += 1) {
      await page.getByRole("button", { name: "New document", exact: true }).click();
    }
    await waitForFileCount(page, overflowInitialTabCount + 10);

    const overflow = await page.evaluate(() => {
      const tabsScroll = document.querySelector(".tabs-scroll");
      const tabbar = document.querySelector(".tabbar");
      const activeTab = document.querySelector(".tab-item.active");
      const readmeTab = document.querySelector('.tab-item[data-file-name="README.md"]');
      const activeTabActions = activeTab?.querySelector(".tab-actions");
      const readmeCloseButton = readmeTab?.querySelector(".tab-action-button.close");
      const activeCloseButton = activeTab?.querySelector(".tab-action-button.close");
      const addButton = document.querySelector(".add-tab-button");
      const tabbarActions = document.querySelector(".tabbar-actions");
      const switcherButton = document.querySelector(".tab-switcher-button");
      if (!tabsScroll || !tabbar || !activeTab || !readmeTab || !addButton || !tabbarActions) {
        return null;
      }

      const scrollRect = tabsScroll.getBoundingClientRect();
      const activeRect = activeTab.getBoundingClientRect();
      const readmeRect = readmeTab.getBoundingClientRect();
      const activeCloseRect = activeCloseButton?.getBoundingClientRect();
      const addRect = addButton.getBoundingClientRect();
      const actionsRect = tabbarActions.getBoundingClientRect();
      const activeActionsStyle = activeTabActions ? window.getComputedStyle(activeTabActions) : null;
      const readmeStyle = window.getComputedStyle(readmeTab);
      const activeStyle = window.getComputedStyle(activeTab);
      const tabsScrollStyle = window.getComputedStyle(tabsScroll);
      return {
        activeTabVisible:
          activeRect.left >= scrollRect.left - 1 &&
          activeRect.right <= actionsRect.left + 1 &&
          activeRect.top >= 0 &&
          activeRect.bottom <= window.innerHeight,
        rightFadeAnchored:
          actionsRect.left >= scrollRect.left &&
          actionsRect.left <= scrollRect.right + 4,
        overflowMask: tabsScrollStyle.webkitMaskImage || tabsScrollStyle.maskImage,
        readmePinned: readmeStyle.position === "sticky",
        readmeScrolledAway: readmeRect.right <= scrollRect.left + 2 || readmeRect.left < scrollRect.left - 2,
        addButtonVisible:
          addRect.left >= 0 &&
          addRect.right <= window.innerWidth &&
          addRect.top >= 0 &&
          addRect.bottom <= window.innerHeight,
        tabRowSwitcherAbsent: !switcherButton,
        canScrollLeft: tabbar.classList.contains("can-scroll-left"),
        dense: tabbar.classList.contains("tabbar-dense"),
        crowded: tabbar.classList.contains("tabbar-crowded"),
        activeCloseVisible: activeActionsStyle ? Number(activeActionsStyle.opacity) > 0.5 : false,
        readmeClosable: Boolean(readmeCloseButton),
        activeCloseCentered: activeCloseRect
          ? Math.abs(activeCloseRect.top + activeCloseRect.height / 2 - (activeRect.top + activeRect.height / 2)) <= 1
          : false,
        anyTabDocumentIcon: Boolean(document.querySelector(".tab-select-button > svg")),
        readmeVisibleTitle: readmeTab.querySelector(".tab-title")?.textContent?.trim() ?? "",
        readmeFileName: readmeTab.getAttribute("data-file-name") ?? "",
        activeFileName: activeTab.getAttribute("data-file-name") ?? "",
        activeWidth: activeRect.width,
        activeWeight: activeStyle.fontWeight,
        inactiveWidths: Array.from(document.querySelectorAll(".tab-item:not(.active)"))
          .slice(0, 4)
          .map((tab) => tab.getBoundingClientRect().width),
        inactiveWeights: Array.from(document.querySelectorAll(".tab-item:not(.active)"))
          .slice(0, 4)
          .map((tab) => window.getComputedStyle(tab).fontWeight),
        clientWidth: tabsScroll.clientWidth,
        scrollLeft: tabsScroll.scrollLeft,
        scrollWidth: tabsScroll.scrollWidth,
        tabCount: document.querySelectorAll(".tab-item").length,
      };
    });

    expect(overflow, "Tab overflow state should be measurable.");
    expect(overflow.tabCount >= 12, "Overflow smoke should create enough tabs.");
    expect(overflow.scrollWidth > overflow.clientWidth, "Tabs should overflow into a horizontal scroll region.");
    expect(overflow.scrollLeft > 0, "Active overflow tab should auto-scroll into view.");
    expect(!overflow.dense && !overflow.crowded, "Tab width should stay stable instead of switching density classes.");
    expect(overflow.rightFadeAnchored, "Tab overflow should end before the fixed tab actions.");
    expect(
      overflow.overflowMask.includes("gradient") && overflow.overflowMask.includes("rgba(0, 0, 0, 0)"),
      "Scrollable tabs should fade through a mask instead of overlay artifacts.",
    );
    expect(!overflow.readmePinned, "README.md should behave like a normal scrollable tab.");
    expect(overflow.readmeScrolledAway, "README.md should scroll away instead of staying pinned.");
    expect(overflow.readmeVisibleTitle === "README", "README tab should omit the .md extension visually.");
    expect(overflow.readmeFileName === "README.md", "README tab should retain the full file name in metadata.");
    expect(overflow.readmeClosable, "README.md should be closable from the tab row.");
    expect(!overflow.anyTabDocumentIcon, "Markdown-only tabs should not repeat document icons.");
    expect(
      overflow.inactiveWidths.every((width) => Math.abs(overflow.activeWidth - width) <= 1),
      "Focused tabs should keep the same width as neighboring tabs.",
    );
    expect(
      overflow.inactiveWeights.every((weight) => weight === overflow.activeWeight),
      "Focused tabs should keep the same font weight as neighboring tabs.",
    );
    expect(overflow.activeCloseCentered, "Close buttons should stay vertically centered inside tabs.");
    expect(overflow.activeTabVisible, "Active overflow tab should remain visible.");
    expect(!overflow.activeCloseVisible, "Close actions should stay hidden until hover or focus.");
    expect(overflow.addButtonVisible, "New document button should stay visible when tabs overflow.");
    expect(overflow.tabRowSwitcherAbsent, "All files should live in the right project context panel, not beside the new-tab button.");
    expect(overflow.canScrollLeft, "Overflowing tabs should show that earlier tabs are hidden.");

    const activeTabBeforeRename = await page.evaluate(() => {
      const activeTab = document.querySelector(".tab-item.active");
      const title = activeTab?.querySelector(".tab-title");
      if (!activeTab || !title) {
        return null;
      }

      const tabRect = activeTab.getBoundingClientRect();
      const titleRect = title.getBoundingClientRect();
      const tabStyle = window.getComputedStyle(activeTab);
      return {
        width: tabRect.width,
        titleInset: titleRect.left - tabRect.left,
        titleClickX: titleRect.left + Math.min(Math.max(titleRect.width / 2, 8), Math.max(titleRect.width - 4, 8)),
        titleClickY: titleRect.top + titleRect.height / 2,
        background: tabStyle.backgroundColor,
        fontWeight: tabStyle.fontWeight,
      };
    });
    expect(activeTabBeforeRename, "Active tab geometry should be measurable before rename.");
    await page.locator(".tab-item.active .tab-select-button").dblclick();
    await waitForRenderFrame(page);
    const activeTabDuringRename = await page.evaluate(() => {
      const activeTab = document.querySelector(".tab-item.active");
      const editableTitle = activeTab?.querySelector(".tab-rename-input");
      if (!activeTab || !editableTitle) {
        return null;
      }

      const tabRect = activeTab.getBoundingClientRect();
      const inputRect = editableTitle.getBoundingClientRect();
      const tabStyle = window.getComputedStyle(activeTab);
      const inputStyle = window.getComputedStyle(editableTitle);
      const inputValue = "value" in editableTitle ? editableTitle.value : (editableTitle.textContent ?? "");
      const allTextSelected =
        "selectionStart" in editableTitle &&
        editableTitle.selectionStart === 0 &&
        editableTitle.selectionEnd === inputValue.length;
      return {
        width: tabRect.width,
        inputInset: inputRect.left - tabRect.left,
        background: tabStyle.backgroundColor,
        inputBackground: inputStyle.backgroundColor,
        inputFontWeight: inputStyle.fontWeight,
        inputOutlineStyle: inputStyle.outlineStyle,
        inputOutlineWidth: inputStyle.outlineWidth,
        inputBoxShadow: inputStyle.boxShadow,
        inputValue,
        contentEditable: editableTitle.getAttribute("contenteditable"),
        allTextSelected,
      };
    });
    expect(activeTabDuringRename, "Active tab rename geometry should be measurable.");
    expect(
      Math.abs(activeTabDuringRename.width - activeTabBeforeRename.width) <= 1,
      "Double-click rename should keep the tab width stable.",
    );
    expect(
      Math.abs(activeTabDuringRename.inputInset - activeTabBeforeRename.titleInset) <= 1,
      "Double-click rename should keep text aligned with the tab title.",
    );
    expect(
      activeTabDuringRename.background === activeTabBeforeRename.background,
      "Double-click rename should keep the tab background unchanged.",
    );
    expect(
      activeTabDuringRename.inputBackground === "rgba(0, 0, 0, 0)",
      "Rename input should not add a separate field background.",
    );
    expect(
      activeTabDuringRename.inputFontWeight === activeTabBeforeRename.fontWeight,
      "Rename input should keep the same text weight as the tab.",
    );
    expect(
      activeTabDuringRename.inputOutlineStyle === "none" || activeTabDuringRename.inputOutlineWidth === "0px",
      "Rename input should not show the global focus outline.",
    );
    expect(activeTabDuringRename.inputBoxShadow === "none", "Rename input should not draw a native field shadow.");
    expect(!/\.md$/i.test(activeTabDuringRename.inputValue), "Rename input should preserve the tab display title without .md.");
    expect(activeTabDuringRename.contentEditable !== "true", "Rename should not use React-controlled contentEditable text.");
    expect(activeTabDuringRename.allTextSelected, "Double-click rename should select the title so typing replaces it cleanly.");
    await page.keyboard.type("A");
    await waitForRenderFrame(page);
    const activeTabAfterFirstCharacter = await page.evaluate(() => {
      const input = document.querySelector(".tab-item.active .tab-rename-input");
      return input && "value" in input
        ? {
            value: input.value,
            selectionStart: input.selectionStart,
            selectionEnd: input.selectionEnd,
          }
        : null;
    });
    expect(activeTabAfterFirstCharacter?.value === "A", "First rename character should replace the selected title.");
    expect(
      activeTabAfterFirstCharacter?.selectionStart === 1 && activeTabAfterFirstCharacter?.selectionEnd === 1,
      "After the first rename character, the caret should stay at the end.",
    );
    await page.keyboard.type("B");
    await waitForRenderFrame(page);
    const activeTabAfterSecondCharacter = await page.evaluate(() => {
      const input = document.querySelector(".tab-item.active .tab-rename-input");
      return input && "value" in input
        ? {
            value: input.value,
            selectionStart: input.selectionStart,
            selectionEnd: input.selectionEnd,
          }
        : null;
    });
    expect(
      activeTabAfterSecondCharacter?.value === "AB",
      "Second rename character should append after the first instead of moving to the front.",
    );
    expect(
      activeTabAfterSecondCharacter?.selectionStart === 2 && activeTabAfterSecondCharacter?.selectionEnd === 2,
      "After the second rename character, the caret should still stay at the end.",
    );
    await page.keyboard.type(" Smoke Rename");
    const activeTabAfterTyping = await page.evaluate(() => {
      const input = document.querySelector(".tab-item.active .tab-rename-input");
      return input && "value" in input ? input.value : "";
    });
    expect(activeTabAfterTyping === "AB Smoke Rename", "Typing while renaming should not prepend, append, or duplicate characters.");
    await page.keyboard.press("Escape");
    await waitForRenderFrame(page);

    const emptyRenameClick = await page.evaluate(() => {
      const title = document.querySelector(".tab-item.active .tab-title");
      if (!title) {
        return null;
      }

      const rect = title.getBoundingClientRect();
      return {
        x: rect.left + Math.min(Math.max(rect.width / 2, 8), Math.max(rect.width - 4, 8)),
        y: rect.top + rect.height / 2,
      };
    });
    expect(emptyRenameClick, "Active tab title should be available for empty rename.");
    await page.mouse.dblclick(emptyRenameClick.x, emptyRenameClick.y);
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Enter");
    await waitForRenderFrame(page);
    const emptyRename = await page.evaluate(() => {
      const activeTab = document.querySelector(".tab-item.active");
      const input = activeTab?.querySelector(".tab-rename-input");
      return {
        fileName: activeTab?.getAttribute("data-file-name") ?? "",
        inputValue: input && "value" in input ? input.value : "",
        toastText: document.querySelector(".app-toast")?.textContent?.trim() ?? "",
        toastError: document.querySelector(".app-toast")?.classList.contains("error") ?? false,
      };
    });
    expect(emptyRename.inputValue === "", "Empty rename should keep the input open.");
    expect(emptyRename.toastText === "File name cannot be empty.", "Empty rename should show an app toast.");
    expect(emptyRename.toastError, "Empty rename toast should use the error tone.");
    expect(emptyRename.fileName, "Empty rename should not erase the current file title.");
    await page.keyboard.press("Escape");
    await waitForRenderFrame(page);

    const duplicateRenameClick = await page.evaluate(() => {
      const title = document.querySelector(".tab-item.active .tab-title");
      if (!title) {
        return null;
      }

      const rect = title.getBoundingClientRect();
      return {
        x: rect.left + Math.min(Math.max(rect.width / 2, 8), Math.max(rect.width - 4, 8)),
        y: rect.top + rect.height / 2,
      };
    });
    expect(duplicateRenameClick, "Active tab title should be available for duplicate rename.");
    await page.mouse.dblclick(duplicateRenameClick.x, duplicateRenameClick.y);
    await page.keyboard.type("README");
    await page.keyboard.press("Enter");
    await waitForRenderFrame(page);
    const duplicateRename = await page.evaluate(() => {
      const activeTab = document.querySelector(".tab-item.active");
      const input = activeTab?.querySelector(".tab-rename-input");
      return {
        fileName: activeTab?.getAttribute("data-file-name") ?? "",
        inputValue: input && "value" in input ? input.value : "",
        toastText: document.querySelector(".app-toast")?.textContent?.trim() ?? "",
        toastError: document.querySelector(".app-toast")?.classList.contains("error") ?? false,
      };
    });
    expect(duplicateRename.inputValue === "README", "Duplicate rename should keep the typed title in edit state.");
    expect(duplicateRename.toastText === "File name already exists.", "Duplicate rename should show an app toast.");
    expect(duplicateRename.toastError, "Duplicate rename toast should use the error tone.");
    expect(duplicateRename.fileName !== "README.md", "Duplicate rename should not overwrite the current file title.");
    await page.keyboard.press("Escape");
    await waitForRenderFrame(page);

    await page.evaluate(() => {
      const tabsScroll = document.querySelector(".tabs-scroll");
      tabsScroll?.scrollTo({ left: 0 });
      tabsScroll?.dispatchEvent(new Event("scroll"));
    });
    await waitForRenderFrame(page);
    const manualScrollButton = await page.evaluate(() => {
      const rightButton = document.querySelector(".tabbar-actions .tab-scroll-button");
      const tabsScroll = document.querySelector(".tabs-scroll");
      const activeTab = document.querySelector(".tab-item.active");
      if (!rightButton || !tabsScroll || !activeTab) {
        return null;
      }

      const scrollRect = tabsScroll.getBoundingClientRect();
      const activeRect = activeTab.getBoundingClientRect();
      const buttonRect = rightButton.getBoundingClientRect();
      return {
        visible:
          buttonRect.left >= 0 &&
          buttonRect.right <= window.innerWidth &&
          buttonRect.top >= 0 &&
          buttonRect.bottom <= window.innerHeight,
        activeHiddenRight: activeRect.left > scrollRect.right - 4,
        label: rightButton.getAttribute("aria-label") ?? "",
        scrollLeft: tabsScroll.scrollLeft,
      };
    });
    expect(manualScrollButton?.visible, "The tab scroll button should remain visible when later tabs are outside the viewport.");
    expect(manualScrollButton?.activeHiddenRight, "The smoke setup should hide the active tab to the right.");
    expect(manualScrollButton?.label === "Scroll tabs right", "Tab arrows should remain plain navigation controls.");
    expect((await page.locator(".tab-scroll-button.has-current-tab").count()) === 0, "Tab arrows should not carry a second active-document state.");

    await page.locator(".tabbar-actions .tab-scroll-button").click();
    await page.locator(".tabs-scroll").evaluate((tabsScroll) =>
      new Promise((resolve) => {
        let previousScrollLeft = tabsScroll.scrollLeft;
        let stableFrameCount = 0;
        let frameCount = 0;
        const checkScrollSettled = () => {
          const nextScrollLeft = tabsScroll.scrollLeft;
          stableFrameCount = Math.abs(nextScrollLeft - previousScrollLeft) < 0.01
            ? stableFrameCount + 1
            : 0;
          previousScrollLeft = nextScrollLeft;
          frameCount += 1;
          if (stableFrameCount >= 4 || frameCount >= 120) {
            resolve();
            return;
          }
          requestAnimationFrame(checkScrollSettled);
        };
        requestAnimationFrame(checkScrollSettled);
      }),
    );
    const manualScrollResult = await page.evaluate(() => {
      const tabsScroll = document.querySelector(".tabs-scroll");
      return tabsScroll?.scrollLeft ?? null;
    });
    expect(
      typeof manualScrollResult === "number" && manualScrollResult > (manualScrollButton?.scrollLeft ?? 0),
      "Clicking the right tab arrow should advance the tab strip after smooth scrolling settles.",
    );

    if ((await page.locator(".right-panel").count()) === 0) {
      await ensureSidePanelOpen(page);
    }
    await waitForRenderFrame(page);
    const overflowPanelDivider = page.getByRole("separator", {
      name: "Resize side panel",
      exact: true,
    });
    const overflowDividerBox = await overflowPanelDivider.boundingBox();
    expect(overflowDividerBox, "The desktop side-panel divider should be available for resizing.");
    if (overflowDividerBox) {
      await page.evaluate(() => {
        const tabsScroll = document.querySelector(".tabs-scroll");
        window.__tabulaResizeScrollSamples = tabsScroll
          ? [tabsScroll.scrollLeft]
          : [];
        window.__tabulaResizeObserver = tabsScroll
          ? new ResizeObserver(() => {
              window.__tabulaResizeScrollSamples.push(tabsScroll.scrollLeft);
            })
          : null;
        window.__tabulaResizeObserver?.observe(tabsScroll);
      });
      await page.mouse.move(
        overflowDividerBox.x + overflowDividerBox.width / 2,
        overflowDividerBox.y + overflowDividerBox.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(580, overflowDividerBox.y + overflowDividerBox.height / 2, {
        steps: 12,
      });
      await page.mouse.up();
      await page.waitForTimeout(180);
      const resizeScrollSamples = await page.evaluate(() => {
        window.__tabulaResizeObserver?.disconnect();
        const tabsScroll = document.querySelector(".tabs-scroll");
        const samples = window.__tabulaResizeScrollSamples ?? [];
        if (tabsScroll) samples.push(tabsScroll.scrollLeft);
        delete window.__tabulaResizeObserver;
        delete window.__tabulaResizeScrollSamples;
        return samples;
      });
      expect(
        resizeScrollSamples.length > 1 &&
          Math.max(...resizeScrollSamples) - Math.min(...resizeScrollSamples) <= 1,
        "Resizing the side panel should not repeatedly realign and jiggle the document tabs.",
      );
      await overflowPanelDivider.dblclick();
      await page.waitForFunction(
        () => Math.round(document.querySelector(".right-panel")?.getBoundingClientRect().width ?? 0) === 288,
      );
    }
    await page.getByRole("button", { name: "Workspace panel", exact: true }).click();
    const switcher = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll(".right-file-tree-row.file")).map((item) => ({
        text: item.textContent?.replace(/\s+/g, " ").trim() ?? "",
        ariaLabel: item.getAttribute("aria-label") ?? "",
        title:
          item.getAttribute("title") ||
          item.querySelector(".right-file-open-button")?.getAttribute("title") ||
          item.querySelector(".right-file-open-button")?.getAttribute("aria-label")?.replace(/^Open\s+/, "") ||
          "",
        current: item.classList.contains("active"),
      }));
      const panel = document.querySelector(".right-panel");
      const toolbarButton = panel?.querySelector(".right-file-toolbar-button");
      const inputRect = toolbarButton?.getBoundingClientRect();
      const target =
        inputRect &&
        document.elementFromPoint(inputRect.left + inputRect.width / 2, inputRect.top + inputRect.height / 2);

      return {
        open: Boolean(panel),
        visibleAtToolbar: Boolean(target?.closest(".right-panel")),
        itemCount: items.length,
        titles: items.map((item) => item.title),
        hasReadme: items.some((item) => item.text.includes("README")),
        firstItem: items[0]?.text ?? "",
        firstTitle: items[0]?.title ?? "",
        currentItemCount: items.filter((item) => item.current).length,
        currentIndex: items.findIndex((item) => item.current),
        currentTitle: items.find((item) => item.current)?.title ?? "",
        firstCurrent: Boolean(items[0]?.current),
        modeLabelCount: items.filter((item) => /\b(Preview|Edit|Split|Local|Live|Offline|Connecting)\b/.test(item.text))
          .length,
        hasCurrentBadge: items.some((item) => item.text.includes("Current")),
        hasMarkdownExtensionInText: items.some((item) => /\.(md|markdown)\b/i.test(item.text)),
        hasMarkdownExtensionInTitle: items.some((item) => /\.(md|markdown)\b/i.test(item.title)),
      };
    });
    expect(switcher.open, "All files should open in the side panel.");
    expect(switcher.visibleAtToolbar, "All files should be visible inside the side panel.");
    expect(switcher.itemCount >= overflow.tabCount, "Document switcher should list open documents.");
    expect(switcher.hasReadme, "Document switcher should include README.");
    const sortedSwitcherTitles = [...switcher.titles].sort((firstTitle, secondTitle) =>
      firstTitle.localeCompare(secondTitle, undefined, { numeric: true, sensitivity: "base" }),
    );
    expect(
      switcher.titles.join("|") === sortedSwitcherTitles.join("|"),
      "Document switcher should keep the Files tree title sort order.",
    );
    expect(switcher.firstTitle === sortedSwitcherTitles[0], "Document switcher should expose the first sorted file first.");
    expect(switcher.firstTitle, "Document switcher should keep full filenames in title metadata.");
    expect(switcher.currentItemCount === 1, "Document switcher should mark exactly one active document with item state.");
    expect(
      switcher.currentIndex === sortedSwitcherTitles.indexOf(switcher.currentTitle),
      "Document switcher should mark the active file in sorted position instead of hoisting it.",
    );
    expect(switcher.modeLabelCount === 0, "Document switcher should not repeat view/status labels in each row.");
    expect(!switcher.hasCurrentBadge, "Document switcher should not add a Current text badge.");
    expect(!switcher.hasMarkdownExtensionInText, "Document switcher should hide Markdown extensions in visible row text.");
    expect(switcher.hasMarkdownExtensionInTitle, "Document switcher should keep full filenames available via title metadata.");
  });

  await withPage(browser, "/", async (page) => {
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    const rightFilesInitialTabs = await getTabs(page);
    const rightFilesActiveTitle = rightFilesInitialTabs.find((tab) => tab.active)?.title ?? "";
    expect(rightFilesActiveTitle, "Right Files action test should have an active file tab.");
    await ensureSidePanelOpen(page);
    await page.getByRole("button", { name: "Workspace panel", exact: true }).click();
    const openRightFileMenu = async (fileTitle) => {
      await page.getByRole("button", { name: `Open ${fileTitle}` }).hover();
      await page.getByRole("button", { name: `More actions for ${fileTitle}` }).click();
    };

    const fileActionContract = await page.evaluate(() => ({
      closeTabCount: document.querySelectorAll('.right-file-action[aria-label^="Close tab "]').length,
      moreActionCount: document.querySelectorAll('.right-file-action[aria-label^="More actions for "]').length,
      copyMarkdownCount: document.querySelectorAll('.right-file-action[aria-label^="Copy Markdown: "]').length,
      renameCount: document.querySelectorAll('.right-file-action[aria-label^="Rename "]').length,
      duplicateCount: document.querySelectorAll('.right-file-action[aria-label^="Duplicate "]').length,
      deleteCount: document.querySelectorAll('.right-file-action[aria-label^="Delete: "]').length,
      openMenuCount: document.querySelectorAll(".right-file-action-menu").length,
      importCount: document.querySelectorAll('.right-file-toolbar-button[aria-label="Open Markdown file"]').length,
      visibleText: document.querySelector(".right-panel-body")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(fileActionContract.closeTabCount === 0, "Right Files should leave tab closing to the document tabs.");
    expect(fileActionContract.moreActionCount >= 1, "Right Files should expose a compact more-action menu for each project file.");
    expect(fileActionContract.copyMarkdownCount === 0, "File rows should keep Copy Markdown in the more-action menu.");
    expect(fileActionContract.deleteCount === 0, "File rows should keep Delete in the more-action menu.");
    expect(fileActionContract.renameCount === 0, "Right Files should hide rename behind a more-action menu.");
    expect(fileActionContract.duplicateCount === 0, "Right Files should hide duplicate behind a more-action menu.");
    expect(fileActionContract.openMenuCount === 0, "Right Files should keep row menus closed by default.");
    expect(fileActionContract.importCount === 1, "Right Files should expose one file import control.");
    expect(
      !/\b(Close tab|Rename|Duplicate|Delete|Open Markdown file)\b/.test(fileActionContract.visibleText),
      "Right Files action labels should stay icon-only in visible panel text.",
    );

    await page.getByRole("button", { name: `Open ${rightFilesActiveTitle}` }).click();
    await waitForRenderFrame(page);
    await openRightFileMenu(rightFilesActiveTitle);
    await page.getByRole("menuitem", { name: "Copy Markdown", exact: true }).click();
    await page.getByRole("region", { name: "Document toolbar" }).hover();
    await page.waitForFunction((actionLabel) => {
      const button = Array.from(document.querySelectorAll(".right-file-action"))
        .find((candidate) => candidate.getAttribute("aria-label") === actionLabel);
      const actions = button?.closest(".right-file-actions");
      return actions ? getComputedStyle(actions).opacity === "0" : false;
    }, `More actions for ${rightFilesActiveTitle}`);
    expect(
      (await page.getByRole("button", { name: `More actions for ${rightFilesActiveTitle}` }).evaluate(
        (button) => getComputedStyle(button.closest(".right-file-actions")).opacity,
      )) === "0",
      "Pointer-activated file actions should hide after the pointer leaves the row.",
    );

    await openRightFileMenu(rightFilesActiveTitle);
    expect((await page.getByRole("menuitem", { name: "New document", exact: true }).count()) === 1, "File menus should create a sibling document.");
    expect((await page.getByRole("menuitem", { name: "New folder", exact: true }).count()) === 1, "File menus should create a sibling folder.");
    expect((await page.getByRole("menuitem", { name: "Rename" }).count()) === 1, "Right Files menu should expose rename.");
    expect((await page.getByRole("menuitem", { name: "Duplicate" }).count()) === 1, "Right Files menu should expose duplicate.");
    expect((await page.getByRole("menuitem", { name: "Delete" }).count()) === 1, "Right Files menu should expose delete.");
    expect((await page.getByText("Move to…", { exact: true }).count()) === 0, "Files should use drag-and-drop instead of a separate move command.");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: `Open ${rightFilesActiveTitle}` }).click({ button: "right" });
    expect((await page.getByRole("menuitem", { name: "New document", exact: true }).count()) === 1, "Right-clicking a file should expose New document.");
    expect((await page.getByRole("menuitem", { name: "New folder", exact: true }).count()) === 1, "Right-clicking a file should expose New folder.");
    expect((await page.getByRole("menuitem", { name: "Rename", exact: true }).count()) === 1, "Right-clicking a file should expose its file actions.");
    await page.keyboard.press("Escape");

    await page.locator(".right-files-panel").click({ button: "right", position: { x: 20, y: 360 } });
    expect((await page.getByRole("menuitem", { name: "New document", exact: true }).count()) === 1, "Right-clicking the Files panel should create a root document.");
    expect((await page.getByRole("menuitem", { name: "New folder", exact: true }).count()) === 1, "Right-clicking the Files panel should create a root folder.");
    expect((await page.getByRole("menuitem", { name: "Rename", exact: true }).count()) === 0, "The Files panel context menu should contain only workspace creation actions.");
    await page.keyboard.press("Escape");

    await openRightFileMenu(rightFilesActiveTitle);
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByRole("textbox", { name: `Rename ${rightFilesActiveTitle} in Files` }).fill("Untitled");
    await page.keyboard.press("Enter");
    await waitForRenderFrame(page);
    const duplicateRename = await page.evaluate(() => ({
      inputValue: document.querySelector(".right-file-rename-input")?.value ?? "",
      toastText: document.querySelector(".app-toast")?.textContent?.trim() ?? "",
      toastError: Boolean(document.querySelector(".app-toast.error")),
      panelOpen: Boolean(document.querySelector(".right-panel")),
    }));
    expect(duplicateRename.inputValue === "Untitled", "Right Files duplicate rename should keep the typed value open.");
    expect(duplicateRename.toastText === "File name already exists.", "Right Files duplicate rename should use the app toast.");
    expect(duplicateRename.toastError, "Right Files duplicate rename toast should use the error tone.");
    expect(duplicateRename.panelOpen, "Right Files duplicate rename should not close the panel.");

    await page.keyboard.press("Escape");
    await waitForRenderFrame(page);
    expect(
      (await page.locator(".right-file-rename-input").count()) === 0,
      "Escape in Right Files rename should cancel rename without closing the panel.",
    );
    expect((await page.locator(".right-panel").count()) === 1, "Right Files panel should remain open after canceling rename.");

    await openRightFileMenu(rightFilesActiveTitle);
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByRole("textbox", { name: `Rename ${rightFilesActiveTitle} in Files` }).fill("Right Panel");
    await page.keyboard.press("Enter");
    await waitForRenderFrame(page);
    let filesAfterRename = await page.evaluate(() => ({
      hasRenamedRow: Boolean(document.querySelector('.right-file-tree-row.file[data-file-name="Right Panel.md"]')),
      activeTabTitle: document.querySelector(".tab-item.active")?.getAttribute("data-file-name") ?? "",
    }));
    expect(filesAfterRename.hasRenamedRow, "Right Files rename should update the project file row.");
    expect(filesAfterRename.activeTabTitle === "Right Panel.md", "Right Files rename should update the open tab title.");

    await openRightFileMenu("Right Panel.md");
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await waitForRenderFrame(page);
    const filesAfterDuplicate = await page.evaluate(() => ({
      hasDuplicateRow: Boolean(document.querySelector('.right-file-tree-row.file[data-file-name="Right Panel 2.md"]')),
      activeTabTitle: document.querySelector(".tab-item.active")?.getAttribute("data-file-name") ?? "",
      toastText: document.querySelector(".app-toast")?.textContent?.trim() ?? "",
    }));
    expect(filesAfterDuplicate.hasDuplicateRow, "Right Files duplicate should add a new project file row.");
    expect(filesAfterDuplicate.activeTabTitle === "Right Panel 2.md", "Right Files duplicate should open the new file as a tab.");
    expect(filesAfterDuplicate.toastText === "File duplicated.", "Right Files duplicate should confirm with the app toast.");

    await openRightFileMenu("Right Panel 2.md");
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await waitForRenderFrame(page);
    const filesAfterDelete = await page.evaluate(() => ({
      hasDeletedRow: Boolean(document.querySelector('.right-file-tree-row.file[data-file-name="Right Panel 2.md"]')),
      hasDeletedTab: Boolean(document.querySelector('.tab-item[data-file-name="Right Panel 2.md"]')),
      activeTabTitle: document.querySelector(".tab-item.active")?.getAttribute("data-file-name") ?? "",
      toastText: document.querySelector(".app-toast")?.textContent?.trim() ?? "",
      undoVisible: Boolean(document.querySelector(".app-toast-action")),
    }));
    expect(!filesAfterDelete.hasDeletedRow, "Right Files delete should remove the project file row.");
    expect(!filesAfterDelete.hasDeletedTab, "Right Files delete should close the deleted file tab.");
    expect(
      filesAfterDelete.activeTabTitle && filesAfterDelete.activeTabTitle !== "Right Panel 2.md",
      "Right Files delete should return focus to a remaining open tab.",
    );
    expect(filesAfterDelete.toastText.includes("File deleted."), "Right Files delete should confirm with the app toast.");
    expect(filesAfterDelete.undoVisible, "Right Files delete should offer undo from the app toast.");

    await page.locator(".app-toast-action").click();
    await waitForRenderFrame(page);
    const filesAfterUndoDelete = await page.evaluate(() => ({
      hasRestoredRow: Boolean(document.querySelector('.right-file-tree-row.file[data-file-name="Right Panel 2.md"]')),
      hasRestoredTab: Boolean(document.querySelector('.tab-item[data-file-name="Right Panel 2.md"]')),
      activeTabTitle: document.querySelector(".tab-item.active")?.getAttribute("data-file-name") ?? "",
      toastText: document.querySelector(".app-toast")?.textContent?.trim() ?? "",
    }));
    expect(filesAfterUndoDelete.hasRestoredRow, "Undo delete should restore the project file row.");
    expect(filesAfterUndoDelete.hasRestoredTab, "Undo delete should restore the open tab when it was open before delete.");
    expect(filesAfterUndoDelete.activeTabTitle === "Right Panel 2.md", "Undo delete should restore focus to the deleted active file.");
    expect(filesAfterUndoDelete.toastText === "File restored.", "Undo delete should confirm restoration.");

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Open Markdown file" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([
      {
        name: "Panel Import.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("# Imported from Files\n\nRight panel import check."),
      },
    ]);
    await waitForRenderFrame(page);
    const filesAfterImport = await page.evaluate(() => ({
      hasImportedRow: Boolean(document.querySelector('.right-file-tree-row.file[data-file-name="Panel Import.md"]')),
      activeTabTitle: document.querySelector(".tab-item.active")?.getAttribute("data-file-name") ?? "",
      editorText: document.querySelector(".cm-content")?.textContent ?? "",
      tabTitleLeft: document.querySelector('.tab-item[data-file-name="Panel Import.md"] .tab-title')
        ?.getBoundingClientRect().left ?? 0,
    }));
    expect(filesAfterImport.hasImportedRow, "Right Files import should add the imported Markdown to project files.");
    expect(filesAfterImport.activeTabTitle === "Panel Import.md", "Right Files import should open the imported file as a tab.");
    expect(filesAfterImport.editorText.includes("Imported from Files"), "Right Files import should load the Markdown content.");

    await page.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("menuitem", { name: "New folder", exact: true }).click();
    const folderRenameInput = page.locator(".right-file-tree-node.folder .right-file-rename-input");
    await folderRenameInput.fill("Archive");
    await page.keyboard.press("Enter");
    await waitForRenderFrame(page);
    const archiveFolderToggle = page.locator(".right-file-tree-node.folder").filter({ hasText: "Archive" }).locator(".right-file-open-button");
    expect(
      (await page.locator('.right-file-action[aria-label="New document: Archive"]').count()) === 0 &&
        (await page.getByRole("button", { name: "More actions for Archive", exact: true }).count()) === 1,
      "Folder rows should keep creation commands in one more-action menu.",
    );
    expect((await archiveFolderToggle.locator(".lucide-folder-open").count()) === 1, "Expanded folders should use the open-folder icon.");
    expect((await archiveFolderToggle.locator(".lucide-chevron-down, .lucide-chevron-right").count()) === 0, "File tree folders should not duplicate state with chevrons.");
    await archiveFolderToggle.click();
    expect((await archiveFolderToggle.locator(".lucide-folder").count()) === 1, "Collapsed folders should use the closed-folder icon.");
    await archiveFolderToggle.click();
    await page.getByRole("button", { name: "More actions for Archive", exact: true }).click();
    expect((await page.getByRole("menuitem", { name: "New document", exact: true }).count()) === 1, "Folder menus should create a document inside the folder.");
    expect((await page.getByRole("menuitem", { name: "New folder", exact: true }).count()) === 1, "Folder menus should create a folder inside the folder.");
    expect((await page.getByText("New subfolder", { exact: true }).count()) === 0, "Folder menus should use the shared New folder command name.");
    await page.getByRole("menuitem", { name: "New document", exact: true }).click();
    const folderDocumentRenameInput = page.locator(".right-file-tree-node.file .right-file-rename-input");
    await folderDocumentRenameInput.waitFor({ state: "visible" });
    await folderDocumentRenameInput.fill("Archive note");
    await page.keyboard.press("Enter");
    await waitForRenderFrame(page);
    const folderDocumentState = await page.evaluate(() => {
      const activeTitle = document.querySelector(".tab-item.active")?.getAttribute("data-file-name") ?? "";
      const row = Array.from(document.querySelectorAll(".right-file-tree-row.file"))
        .find((candidate) => candidate.getAttribute("data-file-name") === activeTitle);
      return {
        activeTitle,
        level: row?.closest('[role="treeitem"]')?.getAttribute("aria-level") ?? "",
      };
    });
    expect(folderDocumentState.activeTitle === "Archive note.md", "Creating from Files should request the document name inline.");
    expect(folderDocumentState.level === "2", "Creating from a folder menu should place the document inside that folder.");
    await page.getByRole("button", { name: "More actions for Archive", exact: true }).click({ button: "right" });
    expect((await page.getByRole("menuitem", { name: "New document", exact: true }).count()) === 1, "Right-clicking a folder should expose New document.");
    expect((await page.getByRole("menuitem", { name: "New folder", exact: true }).count()) === 1, "Right-clicking a folder should expose New folder.");
    await page.keyboard.press("Escape");
    const importedFileNode = page.locator('.right-file-tree-node.file:has(.right-file-tree-row[data-file-name="Panel Import.md"])');
    const archiveFolderNode = page.locator(".right-file-tree-node.folder").filter({ hasText: "Archive" });
    const folderDropFeedback = await archiveFolderNode.evaluate((node) => {
      node.classList.add("drop-target");
      const row = node.querySelector(".right-file-tree-row");
      const style = row ? getComputedStyle(row) : null;
      const result = {
        backgroundColor: style?.backgroundColor ?? "",
        boxShadow: style?.boxShadow ?? "",
      };
      node.classList.remove("drop-target");
      return result;
    });
    const rootDropFeedback = await page.locator(".right-file-tree-scroll").evaluate((node) => {
      node.classList.add("root-drop-target");
      const style = getComputedStyle(node);
      const afterStyle = getComputedStyle(node, "::after");
      const result = {
        backgroundColor: style.backgroundColor,
        afterContent: afterStyle.content,
      };
      node.classList.remove("root-drop-target");
      return result;
    });
    expect(
      folderDropFeedback.backgroundColor !== "rgba(0, 0, 0, 0)" && folderDropFeedback.boxShadow === "none",
      "Folder drop feedback should highlight the row without drawing an insertion line.",
    );
    expect(
      rootDropFeedback.backgroundColor !== "rgba(0, 0, 0, 0)"
        && (rootDropFeedback.afterContent === "none" || rootDropFeedback.afterContent === "normal"),
      "Root drop feedback should highlight the empty tree area without drawing a bottom line.",
    );
    await importedFileNode.dragTo(archiveFolderNode);
    await waitForRenderFrame(page);
    const draggedFileState = await page.evaluate(() => {
      const row = document.querySelector('.right-file-tree-row.file[data-file-name="Panel Import.md"]');
      const treeItem = row?.closest('[role="treeitem"]');
      return {
        level: treeItem?.getAttribute("aria-level") ?? "",
        folderVisible: Array.from(document.querySelectorAll(".right-file-tree-node.folder"))
          .some((item) => item.textContent?.includes("Archive")),
        tabLocation: document.querySelector('.tab-item[data-file-name="Panel Import.md"] .tab-location')
          ?.textContent?.trim() ?? "",
        tabTitleLeft: document.querySelector('.tab-item[data-file-name="Panel Import.md"] .tab-title')
          ?.getBoundingClientRect().left ?? 0,
      };
    });
    expect(draggedFileState.folderVisible, "Right Files should keep the drag destination visible.");
    expect(draggedFileState.level === "2", "Dragging a file onto a folder should move it one level into the tree.");
    expect(
      draggedFileState.tabLocation === "Archive",
      "Moving an open document into a folder should update its tab location immediately.",
    );
    expect(
      Math.abs(draggedFileState.tabTitleLeft - filesAfterImport.tabTitleLeft) < 1,
      "Adding a folder location should not shift the document title within its tab.",
    );
  });

  await withPage(browser, "/", async (page) => {
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });
    await openMarkdownFile(page, {
      name: "Start.md",
      content: [
        "# Start",
        "",
        "Continue in [[Guide.md#Guide|Wiki guide]].",
        "",
        "![[Guide.md]]",
        "",
        "![[Guide.md#Details]]",
        "",
        "![[Missing Embed]]",
        "",
        "Broken [[Missing Wiki]].",
        "",
        "[Preview guide](./Guide.md#guide)",
        "",
        "[Back to start](#start)",
        "",
        "[Missing guide](./Missing.md)",
        "",
        "[Tabula website](https://tabula.md)",
        "",
        "[Email owner](mailto:owner@example.com)",
      ].join("\n"),
    });
    await openMarkdownFile(page, {
      name: "Guide.md",
      content: [
        "# Guide",
        "",
        "Linked from Start.",
        "",
        "## Details",
        "",
        "Section-only content.",
        "",
        "### Nested detail",
        "",
        "Nested section content.",
        "",
        "## Other",
        "",
        "Excluded from the section embed.",
        "",
        "![[Start.md]]",
      ].join("\n"),
    });
    await page.locator('.tab-item[data-file-name="Start.md"] .tab-select-button').click();
    await waitForActiveTab(page, { exact: "Start.md" });
    await selectDocumentViewMode(page, "Preview");
    await waitForEditorReady(page, { mode: "preview" });
    expect(
      (await page.getByRole("link", { name: "Preview guide", exact: true }).count()) === 1,
      "Preview should render resolved workspace Markdown destinations as links.",
    );
    expect(
      (await page.getByRole("link", { name: "Back to start", exact: true }).count()) === 1,
      "Preview should render same-document heading destinations as links.",
    );
    expect(
      (await page.getByRole("link", { name: "Tabula website", exact: true })
        .locator(".preview-external-link-mark").textContent()) === "↗",
      "Preview should distinguish external destinations with an outbound arrow.",
    );
    const workspaceLinkStyles = await page.evaluate(() => {
      const documentLink = [...document.querySelectorAll(".preview-surface a")]
        .find((link) => link.textContent?.trim() === "Preview guide");
      const headingLink = [...document.querySelectorAll(".preview-surface a")]
        .find((link) => link.textContent?.trim() === "Back to start");
      const documentLinkStyle = documentLink instanceof HTMLElement
        ? window.getComputedStyle(documentLink)
        : null;
      const headingLinkStyle = headingLink instanceof HTMLElement
        ? window.getComputedStyle(headingLink)
        : null;
      return {
        documentLinkBackground: documentLinkStyle?.backgroundColor ?? "",
        documentLinkDecoration: documentLinkStyle?.textDecorationLine ?? "",
        documentLinkStatus: documentLink?.getAttribute("data-workspace-link-status") ?? "",
        headingLinkBackground: headingLinkStyle?.backgroundColor ?? "",
        headingLinkDecoration: headingLinkStyle?.textDecorationLine ?? "",
      };
    });
    expect(
      workspaceLinkStyles.documentLinkStatus === "resolved" &&
        workspaceLinkStyles.documentLinkBackground === "rgba(0, 0, 0, 0)" &&
        workspaceLinkStyles.documentLinkDecoration === "none",
      `Resolved document links should reserve the internal-link surface for hover (${JSON.stringify(workspaceLinkStyles)}).`,
    );
    expect(
      workspaceLinkStyles.headingLinkBackground === "rgba(0, 0, 0, 0)" &&
        workspaceLinkStyles.headingLinkDecoration === "none",
      "Same-document heading links should stay quiet until hover.",
    );
    await page.getByRole("link", { name: "Preview guide", exact: true }).hover();
    await page.waitForTimeout(140);
    const hoveredDocumentLinkStyles = await page.getByRole("link", {
      name: "Preview guide",
      exact: true,
    }).evaluate((link) => {
      const style = window.getComputedStyle(link);
      return {
        background: style.backgroundColor,
        color: style.color,
      };
    });
    expect(
      hoveredDocumentLinkStyles.background === "rgb(234, 242, 251)" &&
        hoveredDocumentLinkStyles.color === "rgb(5, 80, 174)",
      `Resolved document links should reveal their blue surface and stronger color on hover (${JSON.stringify(hoveredDocumentLinkStyles)}).`,
    );
    await page.getByRole("link", { name: "Back to start", exact: true }).hover();
    await page.waitForTimeout(140);
    const hoveredHeadingLinkStyles = await page.getByRole("link", {
      name: "Back to start",
      exact: true,
    }).evaluate((link) => {
      const style = window.getComputedStyle(link);
      return {
        color: style.color,
        decoration: style.textDecorationLine,
      };
    });
    expect(
      hoveredHeadingLinkStyles.color === "rgb(5, 80, 174)" &&
        hoveredHeadingLinkStyles.decoration.includes("underline"),
      `Same-document heading links should gain a stronger color and underline on hover (${JSON.stringify(hoveredHeadingLinkStyles)}).`,
    );
    await page.getByRole("button", { name: "Visual edit", exact: true }).click();
    await waitForEditorReady(page, { mode: "visual" });
    await page.evaluate(() => {
      const content = document.querySelector(".cm-content");
      const view =
        content?.cmView?.view ??
        content?.cmTile?.view ??
        content?.parentElement?.cmView?.view ??
        content?.parentElement?.cmTile?.view ??
        document.querySelector(".cm-editor")?.cmView?.view;
      const target = view?.state?.doc?.toString?.().indexOf("[Preview guide]") ?? -1;
      if (!view || target < 0) {
        throw new Error("Visual workspace-link source was not available.");
      }
      view.dispatch({
        selection: { anchor: target + 2 },
        scrollIntoView: true,
      });
    });
    await waitForRenderFrame(page);
    const visualWorkspaceLinkStyles = await page.evaluate(() => {
      const documentLink = [...document.querySelectorAll(
        ".cm-visual-workspace-link-resolved",
      )]
        .find((link) => link.textContent?.trim() === "Preview guide");
      const headingLink =
        [...document.querySelectorAll(".cm-visual-link")]
          .find((link) => link.textContent?.trim() === "Back to start");
      const externalLink =
        [...document.querySelectorAll(".cm-visual-workspace-link-external")]
          .find((link) => link.textContent?.trim() === "Tabula website");
      const documentLinkStyle = documentLink instanceof HTMLElement
        ? window.getComputedStyle(documentLink)
        : null;
      const headingLinkStyle = headingLink instanceof HTMLElement
        ? window.getComputedStyle(headingLink)
        : null;
      return {
        documentLinkBackground: documentLinkStyle?.backgroundColor ?? "",
        documentLinkDecoration: documentLinkStyle?.textDecorationLine ?? "",
        documentLinkResolved: Boolean(documentLink),
        headingLinkBackground: headingLinkStyle?.backgroundColor ?? "",
        headingLinkDecoration: headingLinkStyle?.textDecorationLine ?? "",
        headingLinkSemantic:
          Boolean(
            headingLink?.classList.contains("cm-visual-workspace-link-heading") ||
              headingLink?.closest(".cm-visual-workspace-link-heading") ||
              headingLink?.querySelector(".cm-visual-workspace-link-heading"),
          ),
        externalLinkSemantic: Boolean(externalLink),
      };
    });
    expect(
      visualWorkspaceLinkStyles.documentLinkResolved &&
        visualWorkspaceLinkStyles.documentLinkBackground === "rgba(0, 0, 0, 0)" &&
        visualWorkspaceLinkStyles.documentLinkDecoration === "none",
      `Visual document links should reserve Preview's internal-link surface for hover (${JSON.stringify(visualWorkspaceLinkStyles)}).`,
    );
    expect(
      visualWorkspaceLinkStyles.headingLinkSemantic &&
        visualWorkspaceLinkStyles.headingLinkBackground === "rgba(0, 0, 0, 0)" &&
        visualWorkspaceLinkStyles.headingLinkDecoration === "none",
      `Visual same-document heading links should stay quiet until hover (${JSON.stringify(visualWorkspaceLinkStyles)}).`,
    );
    expect(
      visualWorkspaceLinkStyles.externalLinkSemantic,
      "Visual should distinguish external destinations with outbound-link semantics.",
    );
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });
    const wikiGuideLinkCount = await page.getByRole("link", {
      name: "Wiki guide",
      exact: true,
    }).count();
    const previewLinkDiagnostics = await page.locator(
      ".preview-surface a, .preview-surface [data-wikilink-target]",
    ).evaluateAll((links) =>
      links.map((link) => ({
        href: link.getAttribute("href"),
        status: link.getAttribute("data-workspace-link-status"),
        syntax: link.getAttribute("data-workspace-link-syntax"),
        text: link.textContent,
        wikiTarget: link.getAttribute("data-wikilink-target"),
      })));
    expect(
      wikiGuideLinkCount === 1,
      `Preview should render resolved wiki-link aliases as links. Found: ${JSON.stringify(previewLinkDiagnostics)}`,
    );
    const wholeDocumentEmbed = page.locator(
      '.preview-workspace-embed[data-workspace-embed-target="Guide.md"]',
    );
    const sectionEmbed = page.locator(
      '.preview-workspace-embed[data-workspace-embed-target="Guide.md#Details"]',
    );
    expect(
      (await wholeDocumentEmbed.getAttribute("data-workspace-embed-status")) === "resolved",
      "Preview should transclude a resolved whole-document wiki embed.",
    );
    expect(
      (await wholeDocumentEmbed.locator(".preview-workspace-embed-body")
        .getByText("Excluded from the section embed.", { exact: true }).count()) === 1,
      "Whole-document embeds should render the complete source body.",
    );
    expect(
      (await sectionEmbed.locator(".preview-workspace-embed-body")
        .getByText("Section-only content.", { exact: true }).count()) === 1 &&
      (await sectionEmbed.locator(".preview-workspace-embed-body")
        .getByText("Nested section content.", { exact: true }).count()) === 1 &&
      (await sectionEmbed.locator(".preview-workspace-embed-body")
        .getByText("Excluded from the section embed.", { exact: true }).count()) === 0,
      "Heading embeds should include nested headings and stop at the next peer heading.",
    );
    expect(
      (await wholeDocumentEmbed.locator('[data-workspace-embed-status="cycle"]').count()) === 1,
      "Nested embeds should stop when they would re-enter an ancestor document.",
    );
    expect(
      (await page.locator(
        '.preview-workspace-embed[data-workspace-embed-target="Missing Embed"]' +
        '[data-workspace-embed-status="broken"]',
      ).count()) === 1,
      "Preview should expose unresolved embeds as broken instead of rendering stale content.",
    );
    expect(
      (await page.locator('[data-workspace-link-status="broken"][data-workspace-link-syntax="wikilink"]')
        .filter({ hasText: "Missing Wiki" }).count()) === 1,
      "Preview should expose broken wiki links with the same status as the Links panel.",
    );
    await page.getByRole("link", { name: "Wiki guide", exact: true }).click();
    await waitForActiveTab(page, { exact: "Guide.md" });
    await waitForEditorReady(page, { mode: "preview" });
    await page.locator('.tab-item[data-file-name="Start.md"] .tab-select-button').click();
    await waitForActiveTab(page, { exact: "Start.md" });
    await page.getByRole("link", { name: "Back to start", exact: true }).click();
    await waitForRenderFrame(page);
    expect(
      (await page.locator('[data-workspace-link-status="broken"]').filter({ hasText: "Missing guide" }).count()) === 1,
      "Preview should retain a visible broken state for unresolved workspace destinations.",
    );
    expect(
      (await page.getByRole("link", { name: "Email owner", exact: true }).getAttribute("href")) ===
        "mailto:owner@example.com",
      "Preview should preserve safe mail links.",
    );
    await page.getByRole("link", { name: "Preview guide", exact: true }).click();
    await waitForActiveTab(page, { exact: "Guide.md" });
    await waitForEditorReady(page, { mode: "preview" });
    await page.locator('.tab-item[data-file-name="Start.md"] .tab-select-button').click();
    await waitForActiveTab(page, { exact: "Start.md" });
    await ensureSidePanelOpen(page);
    await page.getByRole("button", { name: "Links", exact: true }).click();
    await waitForPanelTab(page, "Links");
    expect(
      (await page.locator(".right-links-row svg").count()) === 0 &&
        (await page.locator(".right-links-section-direction svg").count()) === 2 &&
        (await page.locator(".right-links-section-chevron").count()) === 2,
      "Link rows should stay icon-free while relationship headings keep their direction icons.",
    );
    const outgoingSection = page.locator('.right-links-section[aria-label="Outgoing"]');
    expect(
      (await outgoingSection.getByText("Email owner", { exact: true }).count()) === 1 &&
        (await outgoingSection.getByText("Missing guide", { exact: true }).count()) === 1 &&
        (await page.locator('.right-links-section[aria-label="Issues"]').count()) === 0,
      "Every outgoing target should stay in one relationship section, including unresolved and external destinations.",
    );
    expect(
      (await outgoingSection.locator(".right-links-section-title .right-links-count").textContent()) === "6",
      "Outgoing counts should equal the number of visible target rows rather than raw mentions.",
    );
    const visibleLinkRows = outgoingSection.locator([
      ":scope > .right-links-list > div > .right-links-row",
      ":scope > .right-links-list > div > .right-links-target-with-resolver > .right-links-row",
    ].join(", "));
    expect(
      (await visibleLinkRows.count()) === 6 &&
        (await visibleLinkRows.locator(".right-links-row-title").count()) === 6 &&
        (await visibleLinkRows.locator(".right-links-row-target").count()) === 6,
      "Outgoing targets should share one two-line row structure.",
    );
    expect(
      !(await outgoingSection.locator(".right-links-row-target").allTextContents())
        .some((text) => text.includes(" · ")),
      "Link rows should not mix paths, relationship types, and mention counts in a metadata sentence.",
    );
    const websiteLink = outgoingSection.getByRole("link", {
      name: "Open external link Tabula website",
      exact: true,
    });
    expect(
      (await websiteLink.getAttribute("href")) === "https://tabula.md" &&
        (await websiteLink.getAttribute("target")) === "_blank",
      "Safe web destinations should open directly in a new tab.",
    );
    const missingGuideButton = outgoingSection.getByRole("button", {
      name: "Document not found — go to source: Missing guide",
      exact: true,
    });
    expect(
      (await missingGuideButton.count()) === 1 &&
        (await missingGuideButton.getByText("Not found", { exact: true }).count()) === 1,
      "Broken destinations should use a compact text state whose row returns to the source.",
    );
    await missingGuideButton.click();
    await selectDocumentViewMode(page, "Edit");
    await waitForEditorReady(page, { mode: "edit" });

    await page.getByRole("button", { name: "Open Guide.md", exact: true }).first().click();
    await waitForActiveTab(page, { exact: "Guide.md" });
    expect(
      await page.getByRole("button", { name: "Open Start.md", exact: true }).first().isVisible(),
      "Following an outgoing knowledge link should expose its source as a backlink.",
    );

    await page.getByRole("button", { name: "Open Start.md", exact: true }).first().click();
    await waitForActiveTab(page, { exact: "Start.md" });

    await page.getByRole("button", { name: "Properties", exact: true }).click();
    await page.getByRole("heading", { name: "Start", exact: true }).waitFor({
      state: "visible",
    });
    expect(
      await page.getByRole("heading", { name: "Start", exact: true }).isVisible() &&
        (await page.getByRole("button", { name: "Browse", exact: true }).count()) === 0 &&
        (await page.locator(".right-graph-panel").count()) === 0,
      "Properties should keep the active document in context without opening a graph.",
    );

    expect(
      (await page.locator(".workspace-issues-button").count()) === 0 &&
        (await page.getByRole("dialog", {
          name: "Workspace issues",
          exact: true,
        }).count()) === 0,
      "Project context should not introduce a separate workspace issue dashboard.",
    );
  });

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 820 } });
  const mobilePage = await mobileContext.newPage();
  try {
    await mobilePage.goto(baseUrl);
    await mobilePage.getByRole("button", { name: "New document", exact: true }).click();
    await selectDocumentViewMode(mobilePage, "Edit");
    await waitForEditorReady(mobilePage, { mode: "edit" });
    for (let index = 0; index < 4; index += 1) {
      await mobilePage.getByRole("button", { name: "New document", exact: true }).click();
    }
    await waitForRenderFrame(mobilePage);

    const mobileTabSwitcher = await mobilePage.evaluate(() => {
      const tabs = document.querySelector(".tabs-scroll");
      const active = document.querySelector(".tab-item.active");
      const trigger = document.querySelector(".open-tabs-trigger");
      const triggerTitle = trigger?.querySelector(".open-tabs-trigger-title");
      const share = document.querySelector(".share-trigger");
      if (!tabs || !active || !trigger || !triggerTitle || !share) return null;
      const triggerRect = trigger.getBoundingClientRect();
      const shareRect = share.getBoundingClientRect();
      return {
        tabsHidden: getComputedStyle(tabs).display === "none",
        activeLabel: active.querySelector(".tab-title")?.textContent?.trim() ?? "",
        triggerLabel: triggerTitle.textContent?.trim() ?? "",
        triggerVisible: triggerRect.width > 44 && triggerRect.right <= shareRect.left,
        shareIsTouchSized:
          Math.round(shareRect.width) === 44 && Math.round(shareRect.height) === 44,
        shareInsideViewport: shareRect.right <= window.innerWidth,
        visibleScrollButtonCount: Array.from(document.querySelectorAll(".tab-scroll-button")).filter(
          (button) => button instanceof HTMLElement && getComputedStyle(button).display !== "none",
        ).length,
      };
    });
    expect(mobileTabSwitcher?.tabsHidden, "Mobile layouts should replace the horizontal tab strip with one compact switcher.");
    expect(
      mobileTabSwitcher?.activeLabel &&
        mobileTabSwitcher?.triggerLabel === mobileTabSwitcher.activeLabel,
      "The mobile tab switcher should name the active document.",
    );
    expect(
      mobileTabSwitcher?.triggerVisible,
      "The mobile tab switcher should fit before the workspace actions.",
    );
    expect(
      mobileTabSwitcher?.shareIsTouchSized && mobileTabSwitcher?.shareInsideViewport,
      "Mobile Share should remain a fixed touch-sized icon inside the viewport.",
    );
    expect(
      mobileTabSwitcher?.visibleScrollButtonCount === 0,
      "Touch layouts should reserve tab width for documents instead of redundant previous/next buttons.",
    );

    await mobilePage.locator(".document-toolbar-row").getByRole("button", {
      name: "Search",
      exact: true,
    }).click();
    await mobilePage.locator(".document-search-row").waitFor({ state: "visible" });
    await ensureSidePanelOpen(mobilePage);
    const mobilePanel = await mobilePage.evaluate(() => {
      const panel = document.querySelector(".right-panel");
      const backdrop = document.querySelector(".right-panel-backdrop");
      const documentSearch = document.querySelector(".document-search-row");
      const shell = document.querySelector(".file-shell");
      const gutter = document.querySelector(".cm-gutters");
      const fileAction = document.querySelector(".right-file-tree-row.file .right-file-action");
      const workbench = document.querySelector(".center-workbench");
      if (!panel || !backdrop || !documentSearch || !shell || !gutter || !fileAction || !workbench) return null;
      const panelRect = panel.getBoundingClientRect();
      const searchRect = documentSearch.getBoundingClientRect();
      const fileActionRect = fileAction.getBoundingClientRect();
      const elementOverSearch = document.elementFromPoint(
        searchRect.left + searchRect.width / 2,
        searchRect.top + searchRect.height / 2,
      );
      return {
        panelLeft: Math.round(panelRect.left),
        panelRight: Math.round(panelRect.right),
        panelHeight: Math.round(panelRect.height),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        backdropDisplay: getComputedStyle(backdrop).display,
        documentSafeRight: getComputedStyle(shell).getPropertyValue("--document-safe-right").trim(),
        gutterDisplay: getComputedStyle(gutter).display,
        visibleTabLabelCount: document.querySelectorAll(".right-panel-tab-label").length,
        role: panel.getAttribute("role"),
        ariaModal: panel.getAttribute("aria-modal"),
        workbenchInert: workbench.hasAttribute("inert"),
        workbenchAriaHidden: workbench.getAttribute("aria-hidden"),
        focusInsidePanel: panel.contains(document.activeElement),
        fileActionSize: Math.min(fileActionRect.width, fileActionRect.height),
        fileActionOpacity: getComputedStyle(fileAction).opacity,
        documentSearchPreserved: getComputedStyle(documentSearch).display !== "none",
        documentSearchOccluded: !documentSearch.contains(elementOverSearch),
        documentSearchLayer: Number.parseInt(getComputedStyle(documentSearch).zIndex, 10),
        panelLayer: Number.parseInt(getComputedStyle(panel).zIndex, 10),
      };
    });
    expect(mobilePanel?.panelLeft === 0, "The mobile side panel should start at the left viewport edge.");
    expect(
      mobilePanel?.documentSearchPreserved &&
        mobilePanel.documentSearchOccluded &&
        mobilePanel.documentSearchLayer < mobilePanel.panelLayer,
      "The mobile side panel should cover document search without discarding its state.",
    );
    expect(
      await mobilePage.getByRole("button", { name: "Close side panel", exact: true }).isVisible(),
      "The mobile panel close control should describe its current action.",
    );
    expect(
      mobilePanel?.role === "dialog" &&
        mobilePanel.ariaModal === "true" &&
        mobilePanel.workbenchInert &&
        mobilePanel.workbenchAriaHidden === "true" &&
        mobilePanel.focusInsidePanel,
      "Overlay panels should trap focus and make the document behind them inert.",
    );
    expect(mobilePanel?.panelRight === mobilePanel?.viewportWidth, "The mobile side panel should fill the viewport width.");
    expect(mobilePanel?.panelHeight === mobilePanel?.viewportHeight, "The mobile side panel should fill the viewport height.");
    expect(mobilePanel?.backdropDisplay !== "none", "The mobile side panel should block the document behind it.");
    expect(mobilePanel?.documentSafeRight === "0px", "Overlay panels should not shrink the document lane.");
    expect(mobilePanel?.gutterDisplay === "none", "Mobile editors should not paint collapsed gutter content.");
    expect(mobilePanel?.visibleTabLabelCount === 0, "Mobile side panel tabs should stay icon-only.");
    expect(
      mobilePanel?.fileActionSize >= 40 && mobilePanel?.fileActionOpacity === "1",
      "Mobile file actions should remain visible with touch-sized targets.",
    );

    await mobilePage.getByRole("button", { name: "Create", exact: true }).click();
    expect(
      (await mobilePage.locator(".right-file-create-menu").evaluate((menu) => getComputedStyle(menu).borderTopWidth)) === "0px",
      "Side panel menus should use elevation without a static border.",
    );
    expect(
      (await mobilePage.getByRole("menuitem", { name: "New document", exact: true }).count()) === 1 &&
        (await mobilePage.getByRole("menuitem", { name: "New folder", exact: true }).count()) === 1,
      "Files should use one Create menu for documents and folders.",
    );
    await mobilePage.keyboard.press("Escape");
    expect(
      (await mobilePage.locator(".right-file-create-menu").count()) === 0 &&
        (await mobilePage.getByRole("dialog", { name: "Files" }).count()) === 1,
      "Escape should close the nested Create menu before dismissing the side panel.",
    );

    await mobilePage
      .getByRole("dialog", { name: "Files" })
      .getByRole("button", { name: "Close side panel" })
      .click();
    await waitForRenderFrame(mobilePage);
    expect((await mobilePage.locator(".right-panel-backdrop").count()) === 0, "Closing the side panel should remove its backdrop.");
  } finally {
    await mobileContext.close();
  }
}
