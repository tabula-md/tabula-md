export const id = "panels";
export const description = "Project menu, files, outline, comments, switcher, and right-panel file actions.";

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
    waitForPanelTab,
    waitForRenderFrame,
    withPage,
  } = ctx;

  await withPage(browser, "/", async (page) => {
    await page.locator(".empty-file-actions").getByRole("button", { name: "New document" }).click();
    await waitForActiveTab(page, { startsWith: "Untitled" });
    await waitForEditorReady(page, { mode: "edit" });
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });
    await openProjectMenu(page);

    const workbenchPanels = await page.evaluate(() => ({
      menuButtonCount: document.querySelectorAll(".workspace-menu-button").length,
      menuOpen: Boolean(document.querySelector(".workspace-menu-popover")),
      leftPanelCount: document.querySelectorAll(".left-sidebar").length,
      leftTabCount: document.querySelectorAll(".left-panel-tabs button").length,
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
    expect(workbenchPanels.menuButtonCount === 1, "Top chrome should expose one workspace menu button.");
    expect(workbenchPanels.menuOpen, "The workspace menu should open from the top-left menu button.");
    expect(workbenchPanels.leftPanelCount === 0, "The app should not render a left side panel for future surfaces.");
    expect(workbenchPanels.leftTabCount === 0, "The workspace menu should not expose New/Templates/Agent tabs.");
    expect(workbenchPanels.templateRowCount === 0, "Templates should not ship as a visible surface yet.");
    expect(!workbenchPanels.menuText.includes("Agent"), "Agent should not ship as an inert menu surface.");
    expect(workbenchPanels.fileSearchCount === 0, "File search should live in the side panel.");
    expect(workbenchPanels.fileRowCount === 0, "File rows should live in the side panel.");
    expect(
      workbenchPanels.actionRows.map((row) => row.text).join("|") ===
        "New document|Import document (.md)…|Open folder…|Export document (.md)|Export workspace (.zip)|Preferences|About|Help|Follow us|GitHub|Clear local workspace…",
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
    expect(focusIndex("Open folder…") !== -1, "Keyboard order should include opening a folder.");
    expect(focusIndex("Export document (.md)") !== -1, "Keyboard order should include document export.");
    expect(focusIndex("Export workspace (.zip)") !== -1, "Keyboard order should include workspace export.");
    expect(focusIndex("Live collaboration…") === -1, "Live collaboration should have one entry point in Share.");
    expect(focusIndex("Preferences") !== -1, "Keyboard order should include Preferences.");
    expect(focusIndex("About") !== -1, "Keyboard order should include About.");
    expect(focusIndex("Help") !== -1, "Keyboard order should include Help.");
    expect(
      focusIndex("New document") <
        focusIndex("Import document (.md)…") &&
        focusIndex("Import document (.md)…") < focusIndex("Open folder…") &&
        focusIndex("Open folder…") < focusIndex("Export document (.md)") &&
        focusIndex("Export document (.md)") < focusIndex("Export workspace (.zip)") &&
        focusIndex("Export workspace (.zip)") < focusIndex("Preferences") &&
        focusIndex("Preferences") < focusIndex("About") &&
        focusIndex("About") < focusIndex("Help"),
      "Workspace menu keyboard order should move from file actions to support actions.",
    );
    expect(workbenchPanels.statusVisible, "The document status bar should remain visible.");
    expect(workbenchPanels.panelToggleCount === 2, "Top chrome should keep both menu and side panel toggles visible.");
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

    await ensureSidePanelOpen(page);
    await waitForPanelTab(page, "Files");
    const rightPanelState = await page.evaluate(() => ({
      open: Boolean(document.querySelector(".right-panel")),
      ariaLabel: document.querySelector(".right-panel")?.getAttribute("aria-label") ?? "",
      sectionsLabel: document.querySelector(".right-panel-tabs")?.getAttribute("aria-label") ?? "",
      tabs: Array.from(document.querySelectorAll(".right-panel-tab")).map((button) => button.getAttribute("aria-label")),
      visibleTabLabelCount: document.querySelectorAll(".right-panel-tab-label").length,
      headingCount: document.querySelectorAll(".right-panel .right-panel-content h2").length,
      documentCardCount: document.querySelectorAll(".right-panel .panel-document-card").length,
      countPillCount: document.querySelectorAll(".right-panel .panel-count-pill").length,
      fileToolbar: (() => {
        const row = document.querySelector(".right-file-toolbar");
        const compatibilityButton = document.querySelector('.right-file-toolbar-button[aria-label="Check knowledge base compatibility"]');
        const importButton = document.querySelector('.right-file-toolbar-button[aria-label="Open Markdown file"]');
        const createButton = document.querySelector('.right-file-toolbar-button[aria-label="Create"]');
        if (!row || !compatibilityButton || !importButton || !createButton) {
          return null;
        }
        const compatibilityButtonRect = compatibilityButton.getBoundingClientRect();
        const importButtonRect = importButton.getBoundingClientRect();
        const createButtonRect = createButton.getBoundingClientRect();
        return {
          compatibilityButtonWidth: Math.round(compatibilityButtonRect.width),
          compatibilityButtonHeight: Math.round(compatibilityButtonRect.height),
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
          rightPanel: rectOf(".right-panel"),
          toolbar: rectOf(".document-toolbar-row"),
          preview: rectOf(".preview-surface") ?? rectOf(".editor-surface"),
          status: rectOf(".file-status-bar"),
        };
      })(),
      bodyText: document.querySelector(".right-panel-body")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(rightPanelState.open, "The right panel should open from the top-right panel toggle.");
    expect(rightPanelState.ariaLabel === "Side panel", "The side panel should use product-facing terminology.");
    expect(
      rightPanelState.sectionsLabel === "Side panel sections",
      "The side panel sections nav should use scoped terminology.",
    );
    expect(
      rightPanelState.tabs.join("|") === "Files|Outline|Links|Graph|Comments|Search",
      "The side panel should expose Files, Outline, Links, Graph, Comments, and document Search as peer views.",
    );
    expect(rightPanelState.visibleTabLabelCount === 0, "Side panel tabs should stay icon-only.");
    expect(!rightPanelState.bodyText.includes("Project"), "Root files should not be wrapped in a synthetic Project folder.");
    expect(rightPanelState.headingCount === 0, "The right panel should not render large panel headings.");
    expect(rightPanelState.documentCardCount === 0, "The right panel should not use document cards.");
    expect(rightPanelState.countPillCount === 0, "The right panel should not use count pills.");
    expect(
      rightPanelState.fileToolbar?.compatibilityButtonWidth === 28 &&
        rightPanelState.fileToolbar?.compatibilityButtonHeight === 28 &&
        rightPanelState.fileToolbar?.importButtonWidth === 28 &&
        rightPanelState.fileToolbar?.importButtonHeight === 28 &&
        rightPanelState.fileToolbar?.createButtonWidth === 28 &&
        rightPanelState.fileToolbar?.createButtonHeight === 28,
      "Files toolbar controls should use 28px icon buttons.",
    );
    expect(rightPanelState.fileRows.length > 0, "Right Files should render file rows.");
    expect(
      rightPanelState.fileRows.every((row) => row.height === 34 && row.fontWeight === "400"),
      "Right Files rows should use the shared 34px row height and regular weight.",
    );
    expect(
      !rightPanelState.fileRows.some((row) => /\b(Preview|Edit|Split|Local|Live|Offline|Connecting)\b/.test(row.text)),
      "Right Files rows should not repeat mode/status labels.",
    );
    expect(
      rightPanelState.laneGeometry.preview.right <= rightPanelState.laneGeometry.rightPanel.left - 20,
      "The side panel should not clip the preview document lane.",
    );
    expect(
      rightPanelState.laneGeometry.toolbar.right <= rightPanelState.laneGeometry.rightPanel.left - 20,
      "The side panel should not clip the editor toolbar lane.",
    );
    expect(
      rightPanelState.laneGeometry.status.right <= rightPanelState.laneGeometry.rightPanel.left - 20,
      "The side panel should not clip the status bar lane.",
    );

    const compatibilityActiveFile = (await getTabs(page)).find((tab) => tab.active)?.title ?? "";
    await page.getByRole("button", { name: "Check knowledge base compatibility", exact: true }).click();
    await page.locator(".right-compatibility-scroll").waitFor({ state: "visible" });
    const compatibilityState = await page.evaluate(() => ({
      title: document.querySelector(".right-compatibility-header h2")?.textContent?.trim() ?? "",
      standard: document.querySelector(".right-compatibility-standard")?.textContent?.trim() ?? "",
      status: document.querySelector(".right-compatibility-status strong")?.textContent?.trim() ?? "",
      issueTitles: Array.from(document.querySelectorAll(".right-compatibility-issue-title"))
        .map((element) => element.textContent?.trim() ?? ""),
      issuePaths: Array.from(document.querySelectorAll(".right-compatibility-issue-path"))
        .map((element) => element.textContent?.trim() ?? ""),
      fileTreeVisible: document.querySelector(".right-file-tree")?.getBoundingClientRect().height > 0,
      unchanged: document.querySelector(".right-compatibility-footnote")?.textContent?.trim() ?? "",
    }));
    expect(
      compatibilityState.title === "Knowledge base compatibility" && compatibilityState.standard === "OKF 0.1",
      "Files should expose OKF as an optional knowledge-base compatibility check.",
    );
    expect(
      /^\d+ required changes?$/.test(compatibilityState.status) &&
        compatibilityState.issueTitles.length >= 1 &&
        compatibilityState.issueTitles.every((title) => title === "Add YAML frontmatter") &&
        compatibilityState.issuePaths.every((path) => path.endsWith(".md")),
      `The compatibility check should turn OKF requirements into document-specific actions. Got: ${JSON.stringify(compatibilityState)}`,
    );
    expect(
      !compatibilityState.fileTreeVisible &&
        compatibilityState.unchanged === "The check is read-only. Files change only when you choose an action.",
      "The compatibility inspector should distinguish read-only checks from explicit fixes.",
    );
    const activeCompatibilityIssue = page.getByRole("button", {
      name: `Open ${compatibilityActiveFile}`,
      exact: true,
    });
    expect(
      compatibilityActiveFile.length > 0 && (await activeCompatibilityIssue.count()) === 1,
      "The compatibility inspector should expose an action for the active document.",
    );
    await activeCompatibilityIssue.click();
    await waitForRenderFrame(page);
    expect(
      (await page.locator(".right-compatibility-scroll").count()) === 1 &&
        (await page.getByRole("textbox", { name: "Concept type", exact: true }).count()) === 1,
      "Selecting a fixable issue should keep its document in context and expose the required type decision.",
    );
    await page.getByRole("textbox", { name: "Concept type", exact: true }).fill("note");
    await page.getByRole("button", { name: "Add frontmatter and type", exact: true }).click();
    await page.waitForFunction(
      (expectedCount) => document.querySelectorAll(".right-compatibility-issue-title").length === expectedCount,
      compatibilityState.issueTitles.length - 1,
    );
    expect(
      (await page.getByRole("button", { name: `Open ${compatibilityActiveFile}`, exact: true }).count()) === 0 &&
        (await page.getByRole("textbox", { name: "Concept type", exact: true }).count()) === 0,
      "Applying the selected type should resolve that document's OKF requirement.",
    );
    await page.getByRole("button", { name: "Back to workspace files", exact: true }).click();
    await waitForRenderFrame(page);
    expect(
      (await page.locator(".right-compatibility-scroll").count()) === 0 &&
        await page.locator(".right-file-tree").isVisible(),
      "The compatibility inspector should return to the preserved file tree on request.",
    );

    await page.getByRole("button", { name: "Links", exact: true }).click();
    await waitForPanelTab(page, "Links");
    expect(
      await page.getByText("No links in this document", { exact: true }).isVisible(),
      "Links should expose a quiet empty state for an unlinked document.",
    );
    await page.getByRole("button", { name: "Graph", exact: true }).click();
    await waitForPanelTab(page, "Graph");
    expect(
      await page.getByText("No connected documents", { exact: true }).isVisible(),
      "Graph should expose a quiet empty state for an isolated document.",
    );
    await page.getByRole("button", { name: "Files", exact: true }).click();
    await waitForPanelTab(page, "Files");

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
        rightPanel: rectOf(".right-panel"),
        toolbar: rectOf(".document-toolbar-row"),
        preview: rectOf(".preview-surface") ?? rectOf(".editor-surface"),
        status: rectOf(".file-status-bar"),
      };
    });
    expect(dualPanelGeometry.menu, "The workspace menu should be measurable while Project Context is open.");
    expect(
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

    const sidePanelNavigation = page.getByRole("navigation", { name: "Side panel sections" });
    await sidePanelNavigation.getByRole("button", { name: "Search", exact: true }).click();
    const workspaceSearch = page.locator(".right-panel-body.search").getByRole("searchbox", { name: "Search files" });
    await workspaceSearch.fill("Untitled");
    await page.locator(".right-panel-body.search .right-panel-search-results button").first().waitFor({ state: "visible" });
    const searchPanelState = await page.evaluate(() => ({
      searchRowCount: document.querySelectorAll(".right-panel-body.search .right-panel-search-results button").length,
      searchInputType: document.querySelector(".right-panel-body.search input")?.getAttribute("type") ?? "",
      firstResult: (() => {
        const row = document.querySelector(".right-panel-search-result");
        const icon = row?.querySelector("svg");
        const rowStyle = row ? getComputedStyle(row) : null;
        const iconStyle = icon ? getComputedStyle(icon) : null;
        return {
          background: rowStyle?.backgroundColor ?? "",
          color: rowStyle?.color ?? "",
          iconColor: iconStyle?.color ?? "",
          label: row?.textContent?.trim() ?? "",
          fileIconCount: row?.querySelectorAll(".lucide-file").length ?? 0,
          fileTextIconCount: row?.querySelectorAll(".lucide-file-text").length ?? 0,
        };
      })(),
      settingsBackground: (() => {
        const button = document.querySelector(".right-panel-search-settings-trigger");
        return button ? getComputedStyle(button).backgroundColor : "";
      })(),
      panelOpen: Boolean(document.querySelector(".right-panel")),
    }));
    expect(searchPanelState.searchRowCount >= 1, "Workspace Search should render matching file names inside the Search panel view.");
    expect(searchPanelState.searchInputType === "text", "Workspace Search should not expose a native search cancel control.");
    expect(
      searchPanelState.settingsBackground === "rgba(0, 0, 0, 0)",
      "Workspace Search settings should stay transparent at rest.",
    );
    expect(
      searchPanelState.firstResult.background === "rgba(0, 0, 0, 0)" &&
        searchPanelState.firstResult.color === searchPanelState.firstResult.iconColor,
      "File search results should use primary text and icon color on a transparent row.",
    );
    expect(
      searchPanelState.firstResult.fileIconCount === 1 &&
        searchPanelState.firstResult.fileTextIconCount === 0,
      "File search results should use the same file icon as the Files panel.",
    );
    expect(
      !/\.(?:md|markdown)$/i.test(searchPanelState.firstResult.label),
      "File search results should hide Markdown extensions like the Files panel.",
    );
    expect(searchPanelState.panelOpen, "Using Workspace Search should keep the side panel open.");
    await workspaceSearch.fill("workspace");
    await waitForRenderFrame(page);
    expect(
      await page.getByText("No matches found", { exact: true }).isVisible(),
      "Workspace Search should not match text that exists only inside a document.",
    );
    await workspaceSearch.fill("Untitled");
    await workspaceSearch.blur();
    const workspaceSearchSurfaceBeforePointerFocus = await page.locator(".right-panel-search-field").evaluate((field) => {
      const style = window.getComputedStyle(field);
      return { background: style.backgroundColor, boxShadow: style.boxShadow };
    });
    await workspaceSearch.click();
    const workspaceSearchSurfaceAfterPointerFocus = await page.locator(".right-panel-search-field").evaluate((field) => {
      const style = window.getComputedStyle(field);
      return { background: style.backgroundColor, boxShadow: style.boxShadow };
    });
    expect(
      JSON.stringify(workspaceSearchSurfaceAfterPointerFocus) === JSON.stringify(workspaceSearchSurfaceBeforePointerFocus),
      "Workspace Search pointer focus should not recolor the field or draw an underline.",
    );
    await page.getByRole("button", { name: "Search settings", exact: true }).click();
    const matchCaseSetting = page.getByRole("menuitemcheckbox", { name: "Match case", exact: true });
    expect(
      await matchCaseSetting.isVisible(),
      "Workspace Search should expose search settings.",
    );
    await matchCaseSetting.click();
    expect(
      (await matchCaseSetting.getAttribute("aria-checked")) === "true",
      "Workspace Search settings should expose persistent options as checked menu items.",
    );
    expect(
      (await page.locator(".right-panel-search-settings-trigger .right-panel-control-status-dot").count()) === 1,
      "Workspace Search should mark the settings trigger when an option is active.",
    );
    await page.keyboard.press("Escape");
    await workspaceSearch.fill("a query that cannot match any workspace document");
    await waitForRenderFrame(page);
    expect(
      await page.getByText("No matches found", { exact: true }).isVisible(),
      "Workspace Search should show a quiet empty result inside the panel.",
    );
    await page.getByRole("button", { name: "Files", exact: true }).click();

    await page.getByRole("button", { name: "Edit", exact: true }).click();
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
    await waitForRenderFrame(page);
    const manualScrollResult = await page.evaluate(() => {
      const tabsScroll = document.querySelector(".tabs-scroll");
      return tabsScroll?.scrollLeft ?? null;
    });
    expect(
      typeof manualScrollResult === "number" && manualScrollResult > (manualScrollButton?.scrollLeft ?? 0),
      "Clicking the right tab arrow should advance the tab strip.",
    );

    if ((await page.locator(".right-panel").count()) === 0) {
      await ensureSidePanelOpen(page);
    }
    await page.getByRole("button", { name: "Files", exact: true }).click();
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
    await waitForEditorReady(page, { mode: "edit" });
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    const rightFilesInitialTabs = await getTabs(page);
    const rightFilesActiveTitle = rightFilesInitialTabs.find((tab) => tab.active)?.title ?? "";
    expect(rightFilesActiveTitle, "Right Files action test should have an active file tab.");
    await ensureSidePanelOpen(page);
    await page.getByRole("button", { name: "Files", exact: true }).click();
    const openRightFileMenu = async (fileTitle) => {
      await page.getByRole("button", { name: `Open ${fileTitle}` }).hover();
      await page.getByRole("button", { name: `More actions for ${fileTitle}` }).click();
    };

    const fileActionContract = await page.evaluate(() => ({
      closeTabCount: document.querySelectorAll('.right-file-action[aria-label^="Close tab "]').length,
      moreActionCount: document.querySelectorAll('.right-file-action[aria-label^="More actions for "]').length,
      renameCount: document.querySelectorAll('.right-file-action[aria-label^="Rename "]').length,
      duplicateCount: document.querySelectorAll('.right-file-action[aria-label^="Duplicate "]').length,
      deleteCount: document.querySelectorAll('.right-file-action[aria-label^="Delete "]').length,
      openMenuCount: document.querySelectorAll(".right-file-action-menu").length,
      importCount: document.querySelectorAll('.right-file-toolbar-button[aria-label="Open Markdown file"]').length,
      visibleText: document.querySelector(".right-panel-body")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(fileActionContract.closeTabCount === 0, "Right Files should leave tab closing to the document tabs.");
    expect(fileActionContract.moreActionCount >= 1, "Right Files should expose a compact more-action menu for each project file.");
    expect(fileActionContract.renameCount === 0, "Right Files should hide rename behind a more-action menu.");
    expect(fileActionContract.duplicateCount === 0, "Right Files should hide duplicate behind a more-action menu.");
    expect(fileActionContract.deleteCount === 0, "Right Files should hide delete behind a more-action menu.");
    expect(fileActionContract.openMenuCount === 0, "Right Files should keep row menus closed by default.");
    expect(fileActionContract.importCount === 1, "Right Files should expose one file import control.");
    expect(
      !/\b(Close tab|Rename|Duplicate|Delete|Open Markdown file)\b/.test(fileActionContract.visibleText),
      "Right Files action labels should stay icon-only in visible panel text.",
    );

    await page.getByRole("button", { name: `Open ${rightFilesActiveTitle}` }).click();
    await waitForRenderFrame(page);

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
    await importedFileNode.dragTo(archiveFolderNode);
    await waitForRenderFrame(page);
    const draggedFileState = await page.evaluate(() => {
      const row = document.querySelector('.right-file-tree-row.file[data-file-name="Panel Import.md"]');
      const treeItem = row?.closest('[role="treeitem"]');
      return {
        level: treeItem?.getAttribute("aria-level") ?? "",
        folderVisible: Array.from(document.querySelectorAll(".right-file-tree-node.folder"))
          .some((item) => item.textContent?.includes("Archive")),
      };
    });
    expect(draggedFileState.folderVisible, "Right Files should keep the drag destination visible.");
    expect(draggedFileState.level === "2", "Dragging a file onto a folder should move it one level into the tree.");
  });

  await withPage(browser, "/", async (page) => {
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await openMarkdownFile(page, {
      name: "Start.md",
      content: [
        "# Start",
        "",
        "Continue in [[Guide.md]].",
        "",
        "[Preview guide](./Guide.md#guide)",
        "",
        "[Back to start](#start)",
        "",
        "[Missing guide](./Missing.md)",
        "",
        "[Email owner](mailto:owner@example.com)",
      ].join("\n"),
    });
    await openMarkdownFile(page, {
      name: "Guide.md",
      content: "# Guide\n\nLinked from Start.",
    });
    await page.locator('.tab-item[data-file-name="Start.md"] .tab-select-button').click();
    await waitForActiveTab(page, { exact: "Start.md" });
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });
    expect(
      (await page.getByRole("link", { name: "Preview guide", exact: true }).count()) === 1,
      "Preview should render resolved workspace Markdown destinations as links.",
    );
    expect(
      (await page.getByRole("link", { name: "Back to start", exact: true }).count()) === 1,
      "Preview should render same-document heading destinations as links.",
    );
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

    await page.getByRole("button", { name: "Open Guide.md", exact: true }).first().click();
    await waitForActiveTab(page, { exact: "Guide.md" });
    expect(
      await page.getByRole("button", { name: "Open Start.md", exact: true }).first().isVisible(),
      "Following an outgoing knowledge link should expose its source as a backlink.",
    );

    await page.getByRole("button", { name: "Open Start.md", exact: true }).first().click();
    await waitForActiveTab(page, { exact: "Start.md" });

    await page.getByRole("button", { name: "Graph", exact: true }).click();
    await waitForPanelTab(page, "Graph");
    expect(
      await page.getByText("Local graph", { exact: true }).isVisible(),
      "Graph should identify the active document's local knowledge graph.",
    );
    await page.getByRole("button", { name: "Open Guide.md", exact: true }).click();
    await waitForActiveTab(page, { exact: "Guide.md" });
    await page.getByRole("button", { name: "Open Start.md", exact: true }).click();
    await waitForActiveTab(page, { exact: "Start.md" });
  });

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 820 } });
  const mobilePage = await mobileContext.newPage();
  try {
    await mobilePage.goto(baseUrl);
    await mobilePage.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(mobilePage, { mode: "edit" });
    for (let index = 0; index < 4; index += 1) {
      await mobilePage.getByRole("button", { name: "New document", exact: true }).click();
    }
    await waitForRenderFrame(mobilePage);

    const mobileActiveTab = await mobilePage.evaluate(() => {
      const tabs = document.querySelector(".tabs-scroll");
      const active = document.querySelector(".tab-item.active");
      if (!tabs || !active) return null;
      const tabsRect = tabs.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      return {
        visible: activeRect.left >= tabsRect.left - 1 && activeRect.right <= tabsRect.right + 1,
        alignedToStart: Math.abs(activeRect.left - tabsRect.left) <= 1,
        label: active.querySelector(".tab-title")?.textContent?.trim() ?? "",
        visibleScrollButtonCount: Array.from(document.querySelectorAll(".tab-scroll-button")).filter(
          (button) => button instanceof HTMLElement && getComputedStyle(button).display !== "none",
        ).length,
      };
    });
    expect(mobileActiveTab?.visible, "Creating a mobile document should keep the active tab visible.");
    expect(mobileActiveTab?.alignedToStart, "Mobile tabs should align the active document without leaking clipped tab text.");
    expect(mobileActiveTab?.label, "The visible mobile tab should name the active document.");
    expect(
      mobileActiveTab?.visibleScrollButtonCount === 0,
      "Touch layouts should reserve tab width for documents instead of redundant previous/next buttons.",
    );

    await ensureSidePanelOpen(mobilePage);
    const mobilePanel = await mobilePage.evaluate(() => {
      const panel = document.querySelector(".right-panel");
      const backdrop = document.querySelector(".right-panel-backdrop");
      const shell = document.querySelector(".file-shell");
      const gutter = document.querySelector(".cm-gutters");
      const fileAction = document.querySelector(".right-file-tree-row.file .right-file-action");
      if (!panel || !backdrop || !shell || !gutter || !fileAction) return null;
      const panelRect = panel.getBoundingClientRect();
      const fileActionRect = fileAction.getBoundingClientRect();
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
        fileActionSize: Math.min(fileActionRect.width, fileActionRect.height),
        fileActionOpacity: getComputedStyle(fileAction).opacity,
      };
    });
    expect(mobilePanel?.panelLeft === 0, "The mobile side panel should start at the left viewport edge.");
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

    await mobilePage
      .getByRole("complementary", { name: "Side panel" })
      .getByRole("button", { name: "Toggle side panel" })
      .click();
    await waitForRenderFrame(mobilePage);
    expect((await mobilePage.locator(".right-panel-backdrop").count()) === 0, "Closing the side panel should remove its backdrop.");
  } finally {
    await mobileContext.close();
  }
}
