export const id = "panels";
export const description = "Project menu, files, outline, comments, switcher, and right-panel file actions.";

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
    await openProjectMenu(page);

    const workbenchPanels = await page.evaluate(() => ({
      topLeftMenuCount: document.querySelectorAll(".workspace-menu-button").length,
      leftOpen: Boolean(document.querySelector(".left-sidebar")),
      largeWorkspaceHeadingCount: document.querySelectorAll(".left-panel-header-main h2").length,
      leftTabLabels: Array.from(document.querySelectorAll(".left-panel-tabs button")).map((button) =>
        button.getAttribute("aria-label"),
      ),
      leftTabTitles: Array.from(document.querySelectorAll(".left-panel-tabs button")).map((button) =>
        button.getAttribute("title"),
      ),
      leftTabGeometry: Array.from(document.querySelectorAll(".left-panel-tabs button")).map((button) => {
        const rect = button.getBoundingClientRect();
        const style = window.getComputedStyle(button);
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          fontWeight: style.fontWeight,
        };
      }),
      menuHeadingCount: document.querySelectorAll(".left-panel-content > .left-panel-header h2").length,
      fileSearchCount: document.querySelectorAll(".left-panel-search").length,
      fileRowCount: document.querySelectorAll(".left-file-item").length,
      actionHeadingCount: document.querySelectorAll(".left-workspace-actions h3").length,
      actionRows: Array.from(document.querySelectorAll(".left-workspace-actions button")).map((item) => {
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
        };
      }),
      focusOrder: Array.from(
        document.querySelectorAll(".left-sidebar button, .left-sidebar input, .left-sidebar a"),
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
    }));
    // P7: left panel menu/templates product contract.
    expect(workbenchPanels.topLeftMenuCount === 0, "Project actions should move out of the top-left chrome.");
    expect(workbenchPanels.leftOpen, "The left project menu should open from the top-right panel toggle.");
    expect(workbenchPanels.largeWorkspaceHeadingCount === 0, "The left panel should not show a large Project title.");
    expect(
      workbenchPanels.leftTabLabels.join("|") === "Menu|Templates",
      "The left panel should expose only menu and templates.",
    );
    expect(
      workbenchPanels.leftTabTitles.join("|") === "Menu|Templates",
      "Icon-only panel segmented controls should keep matching title attributes.",
    );
    expect(
      workbenchPanels.leftTabGeometry.every(
        (tab) =>
          Math.abs(tab.width - workbenchPanels.leftTabGeometry[0].width) <= 1 &&
          Math.abs(tab.height - workbenchPanels.leftTabGeometry[0].height) <= 1 &&
          tab.fontWeight === workbenchPanels.leftTabGeometry[0].fontWeight,
      ),
      "Panel segmented controls should keep stable size and weight across active/inactive states.",
    );
    expect(workbenchPanels.menuHeadingCount === 0, "Menu view should not render a repeated section heading.");
    expect(workbenchPanels.fileSearchCount === 0, "File search should live in the right project context panel.");
    expect(workbenchPanels.fileRowCount === 0, "File rows should live in the right project context panel.");
    expect(workbenchPanels.actionHeadingCount === 0, "Project actions should not render a heading.");
    expect(
      workbenchPanels.actionRows.map((row) => row.text).join("|") ===
        "Import Markdown|Export current file|Download project|Import project|Settings|Keyboard shortcuts",
      "Project actions should keep the focused import/export/settings menu rows.",
    );
    expect(
      workbenchPanels.actionRows.every((row) => row.iconCount === 1),
      "Project action rows should be icon plus label only.",
    );
    expect(
      workbenchPanels.actionRows.every((row) => row.height >= 30 && row.height <= 34),
      "Project action rows should stay compact.",
    );
    expect(
      workbenchPanels.actionRows.every((row) => row.fontWeight === workbenchPanels.actionRows[0].fontWeight),
      "Project action rows should use one regular text weight.",
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
      "Project action rows should use one compact row token set.",
    );
    const focusIndex = (label) => workbenchPanels.focusOrder.indexOf(label);
    expect(focusIndex("Menu") !== -1, "Keyboard order should include the Menu segmented control.");
    expect(focusIndex("Templates") !== -1, "Keyboard order should include the Templates segmented control.");
    expect(focusIndex("Import Markdown") !== -1, "Keyboard order should include project action rows.");
    expect(
      focusIndex("Menu") <
        focusIndex("Templates") &&
        focusIndex("Templates") <
          focusIndex("Import Markdown"),
      "Left panel keyboard order should be Menu, Templates, then project action rows.",
    );
    expect(workbenchPanels.statusVisible, "The document status bar should remain visible.");
    expect(workbenchPanels.panelToggleCount === 1, "Top chrome should expose the remaining closed-panel toggle while Project Menu is open.");
    expect(workbenchPanels.bottomPanelCount === 0, "The bottom panel should stay removed; status bar owns bottom status.");

    const workspaceActions = page.locator(".left-workspace-actions");
    await workspaceActions.getByRole("button", { name: "Settings", exact: true }).click();
    await page.waitForTimeout(80);
    const settingsPanel = await page.evaluate(() => ({
      leftOpen: Boolean(document.querySelector(".left-sidebar")),
      settingsHeading: document.querySelector(".left-panel-header h2")?.textContent?.trim() ?? "",
      detailLabels: Array.from(document.querySelectorAll(".left-detail-list div")).map((item) =>
        item.textContent?.replace(/\s+/g, " ").trim(),
      ),
    }));
    expect(settingsPanel.leftOpen, "Settings should open inside the same left panel.");
    expect(settingsPanel.settingsHeading === "Settings", "Settings detail should stay scoped to the left panel.");
    expect(settingsPanel.detailLabels.length > 0, "Settings detail should render compact panel rows.");

    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
    const settingsEscapeState = await page.evaluate(() => ({
      leftOpen: Boolean(document.querySelector(".left-sidebar")),
      menuActionsVisible: document.querySelectorAll(".left-workspace-actions button").length > 0,
      settingsHeading: document.querySelector(".left-panel-header h2")?.textContent?.trim() ?? "",
    }));
    expect(settingsEscapeState.leftOpen, "Escape from Settings should keep the left panel open.");
    expect(settingsEscapeState.menuActionsVisible, "Escape from Settings should return to Menu view.");
    expect(settingsEscapeState.settingsHeading !== "Settings", "Escape from Settings should exit the detail view.");

    await workspaceActions.getByRole("button", { name: "Keyboard shortcuts", exact: true }).click();
    await page.waitForTimeout(80);
    const shortcutsPanel = await page.evaluate(() => ({
      leftOpen: Boolean(document.querySelector(".left-sidebar")),
      shortcutsHeading: document.querySelector(".left-panel-header h2")?.textContent?.trim() ?? "",
      shortcutRows: document.querySelectorAll(".left-shortcut-row").length,
    }));
    expect(shortcutsPanel.leftOpen, "Keyboard shortcuts should open inside the same left panel.");
    expect(
      shortcutsPanel.shortcutsHeading === "Keyboard shortcuts",
      "Keyboard shortcuts detail should stay scoped to the left panel.",
    );
    expect(shortcutsPanel.shortcutRows > 0, "Keyboard shortcuts detail should render compact panel rows.");

    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
    const shortcutsEscapeState = await page.evaluate(() => ({
      leftOpen: Boolean(document.querySelector(".left-sidebar")),
      menuActionsVisible: document.querySelectorAll(".left-workspace-actions button").length > 0,
      shortcutsHeading: document.querySelector(".left-panel-header h2")?.textContent?.trim() ?? "",
    }));
    expect(shortcutsEscapeState.leftOpen, "Escape from Keyboard shortcuts should keep the left panel open.");
    expect(shortcutsEscapeState.menuActionsVisible, "Escape from Keyboard shortcuts should return to Menu view.");
    expect(
      shortcutsEscapeState.shortcutsHeading !== "Keyboard shortcuts",
      "Escape from Keyboard shortcuts should exit the detail view.",
    );

    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
    const leftEscapeState = await page.evaluate(() => ({
      leftOpen: Boolean(document.querySelector(".left-sidebar")),
    }));
    expect(!leftEscapeState.leftOpen, "Escape from Menu view should close the left panel.");

    const rightPanelToggleContract = await page.evaluate(() => {
      const button = document.querySelector('button[aria-label="Open Project Context"]');
      return {
        ariaLabel: button?.getAttribute("aria-label") ?? "",
        title: button?.getAttribute("title") ?? "",
      };
    });
    expect(
      rightPanelToggleContract.ariaLabel === "Open Project Context",
      `The right panel toggle should use product-facing terminology. Got: ${rightPanelToggleContract.ariaLabel}`,
    );
    expect(
      rightPanelToggleContract.title === rightPanelToggleContract.ariaLabel,
      "The right panel toggle title should match the product-facing terminology.",
    );

    await openProjectContext(page);
    const rightPanelState = await page.evaluate(() => ({
      open: Boolean(document.querySelector(".right-panel")),
      ariaLabel: document.querySelector(".right-panel")?.getAttribute("aria-label") ?? "",
      sectionsLabel: document.querySelector(".right-panel-tabs")?.getAttribute("aria-label") ?? "",
      tabs: Array.from(document.querySelectorAll(".right-panel-tab")).map((button) => button.getAttribute("aria-label")),
      headingCount: document.querySelectorAll(".right-panel .right-panel-content h2").length,
      documentCardCount: document.querySelectorAll(".right-panel .panel-document-card").length,
      countPillCount: document.querySelectorAll(".right-panel .panel-count-pill").length,
      fileSearchRow: (() => {
        const row = document.querySelector(".right-file-search-row");
        const input = document.querySelector(".right-panel-search");
        const importButton = document.querySelector(".right-file-import-button");
        const createButton = document.querySelector(".right-file-create-button");
        if (!row || !input || !importButton || !createButton) {
          return null;
        }
        const inputRect = input.getBoundingClientRect();
        const importButtonRect = importButton.getBoundingClientRect();
        const createButtonRect = createButton.getBoundingClientRect();
        const inputStyle = window.getComputedStyle(input);
        return {
          inputHeight: Math.round(inputRect.height),
          importButtonWidth: Math.round(importButtonRect.width),
          importButtonHeight: Math.round(importButtonRect.height),
          createButtonWidth: Math.round(createButtonRect.width),
          createButtonHeight: Math.round(createButtonRect.height),
          inputBorderTopWidth: inputStyle.borderTopWidth,
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
      bodyText: document.querySelector(".right-panel-body")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(rightPanelState.open, "The right panel should open from the top-right panel toggle.");
    expect(rightPanelState.ariaLabel === "Project Context", "The right panel should use product-facing terminology.");
    expect(
      rightPanelState.sectionsLabel === "Project context sections",
      "The right panel sections nav should use scoped terminology.",
    );
    expect(
      rightPanelState.tabs.join("|") === "Files|Outline|Comments",
      "The right panel should put file management first, then document context.",
    );
    expect(rightPanelState.bodyText.includes("Project"), "The right panel should expose the project file tree by default.");
    expect(rightPanelState.headingCount === 0, "The right panel should not render large panel headings.");
    expect(rightPanelState.documentCardCount === 0, "The right panel should not use document cards.");
    expect(rightPanelState.countPillCount === 0, "The right panel should not use count pills.");
    expect(
      rightPanelState.fileSearchRow?.inputHeight >= 30 && rightPanelState.fileSearchRow?.inputHeight <= 32,
      "Right Files search input should use a compact 30-32px control height.",
    );
    expect(
      rightPanelState.fileSearchRow?.importButtonWidth === 28 &&
        rightPanelState.fileSearchRow?.importButtonHeight === 30 &&
        rightPanelState.fileSearchRow?.createButtonWidth === 28 &&
        rightPanelState.fileSearchRow?.createButtonHeight === 30,
      "Right Files import and new-file controls should sit as compact icon buttons beside search.",
    );
    expect(rightPanelState.fileSearchRow?.inputBorderTopWidth === "0px", "Right Files search input should be borderless.");
    expect(rightPanelState.fileRows.length > 0, "Right Files should render file rows.");
    expect(
      rightPanelState.fileRows.every((row) => row.height >= 30 && row.height <= 34 && row.fontWeight === "400"),
      "Right Files rows should stay compact and regular weight.",
    );
    expect(
      !rightPanelState.fileRows.some((row) => /\b(Preview|Edit|Split|Local|Live|Offline|Connecting)\b/.test(row.text)),
      "Right Files rows should not repeat mode/status labels.",
    );

    await page.getByRole("searchbox", { name: "Search files" }).fill("read");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
    const searchEscapeState = await page.evaluate(() => ({
      value: document.querySelector(".right-panel-search")?.value ?? "",
      panelOpen: Boolean(document.querySelector(".right-panel")),
    }));
    expect(searchEscapeState.value === "", "Escape in Files search should clear the query first.");
    expect(searchEscapeState.panelOpen, "Escape with a Files search query should not close the right panel.");

    await page.getByRole("searchbox", { name: "Search files" }).focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(80);
    const firstKeyboardFileFocus = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
    expect(firstKeyboardFileFocus.startsWith("Open "), "ArrowDown in Files search should focus the first file row.");
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(80);
    const secondKeyboardFileFocus = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
    expect(
      secondKeyboardFileFocus.startsWith("Open ") && secondKeyboardFileFocus !== firstKeyboardFileFocus,
      "ArrowDown on a file row should move focus to the next file row.",
    );
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(80);
    const restoredKeyboardFileFocus = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
    expect(restoredKeyboardFileFocus === firstKeyboardFileFocus, "ArrowUp on a file row should move focus back.");

    await page.getByRole("button", { name: "Outline", exact: true }).click();
    await page.waitForTimeout(80);
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

    await page.getByRole("button", { name: "Comments", exact: true }).click();
    await page.waitForTimeout(80);
    const emptyCommentsState = await page.evaluate(() => ({
      contextLabels: Array.from(document.querySelectorAll(".right-comments-context span")).map(
        (span) => span.textContent?.replace(/\s+/g, " ").trim() ?? "",
      ),
      switchButtonText: document.querySelector(".right-comments-switch")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      switchPressed: document.querySelector(".right-comments-switch")?.getAttribute("aria-pressed") ?? "",
      emptyText: document.querySelector(".right-comments-empty")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      inputCount: document.querySelectorAll(".right-comment-input").length,
      identityInputCount: document.querySelectorAll('[aria-label="Comment author name"]').length,
      identityInputValue: document.querySelector('[aria-label="Comment author name"]')?.value ?? "",
      submitText: document.querySelector(".right-comment-submit")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      submitDisabled: Boolean(document.querySelector(".right-comment-submit:disabled")),
      visibleText: document.querySelector(".right-panel-body")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      cardCount: document.querySelectorAll(".right-comment-card").length,
      actionCount: document.querySelectorAll(".right-comment-action").length,
    }));
    expect(emptyCommentsState.cardCount === 0, "Comments should start without comment cards.");
    expect(emptyCommentsState.actionCount === 0, "Comment actions should not appear when there are no comments.");
    expect(Boolean(emptyCommentsState.contextLabels[0]), "Comments should identify the active scope.");
    expect(!emptyCommentsState.contextLabels[0]?.startsWith("Comments on"), "Comments scope title should avoid repeated helper copy.");
    expect(!emptyCommentsState.contextLabels[0]?.endsWith(".md"), "Comments should hide .md in the active-file label.");
    expect(
      emptyCommentsState.switchButtonText.replace(/\d+$/, "") === "All comments",
      "Current-file comments should expose All comments as a secondary switch.",
    );
    expect(emptyCommentsState.switchPressed === "false", "Comments should default to the current file scope.");
    expect(
      emptyCommentsState.emptyText.includes("No comments") || emptyCommentsState.visibleText.includes("Resolved ·"),
      "Comments should expose a quiet empty or resolved-only state.",
    );
    expect(
      !emptyCommentsState.emptyText.includes("add a file comment below"),
      "Current-file empty state should stay short and avoid explaining the composer.",
    );
    expect(
      emptyCommentsState.emptyText.includes("Select text to anchor a note."),
      "Current-file empty state should describe the primary anchored-comment action.",
    );
    expect(emptyCommentsState.inputCount === 1, "Comments composer should keep one focused textarea available.");
    expect(emptyCommentsState.identityInputCount === 1, "Comments composer should expose the active comment identity.");
    expect(Boolean(emptyCommentsState.identityInputValue), "Comment identity should start with a usable local name.");
    expect(emptyCommentsState.submitText === "Comment", "Comments composer should use a direct submit action.");
    expect(emptyCommentsState.submitDisabled, "Comments composer submit should stay disabled until text is entered.");
    expect(
      !/\b(Reply|Resolve|Reopen|Delete)\b/.test(emptyCommentsState.visibleText),
      "Comment card actions should not appear when there are no comments.",
    );

    await page.getByLabel("Comment author name").fill("Taeha");
    await page.getByLabel("Comment author name").blur();
    await page.getByLabel("Add comment to README.md").fill("Review this intro.");
    await page.locator(".right-comment-form .right-comment-submit").click();
    await page.waitForTimeout(120);
    const commentsAfterAdd = await page.evaluate(() => ({
      cardCount: document.querySelectorAll(".right-comment-card").length,
      emptyCount: document.querySelectorAll(".right-comments-empty").length,
      fileHeaderCount: document.querySelectorAll(".right-comment-file").length,
      actionText: document.querySelector(".right-comment-actions")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      visibleText: document.querySelector(".right-panel-body")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      authorText: document.querySelector(".right-comment-meta .right-comment-author strong")?.textContent?.trim() ?? "",
    }));
    expect(commentsAfterAdd.cardCount === 1, "Adding a comment should create one comment card.");
    expect(commentsAfterAdd.emptyCount === 0, "Adding a comment should hide the comments empty state.");
    expect(commentsAfterAdd.fileHeaderCount === 0, "Active-file comments should not repeat the file header.");
    expect(commentsAfterAdd.actionText === "ReplyResolveDelete", "Comment cards should expose direct reply, resolve, and delete actions.");
    expect(commentsAfterAdd.visibleText.includes("Review this intro."), "Added comment should render in the comments panel.");
    expect(commentsAfterAdd.authorText === "Taeha", "New comments should use the editable local identity.");
    expect(
      commentsAfterAdd.actionText.includes("Reply") && commentsAfterAdd.actionText.includes("Resolve"),
      "Comment card actions should be available without opening a menu.",
    );

    await page.getByRole("button", { name: "Reply", exact: true }).click();
    await page.locator(".right-comment-reply-form textarea").fill("Reply back.");
    await page.locator(".right-comment-reply-form .right-comment-submit").click();
    await page.waitForTimeout(120);
    const commentReplyState = await page.evaluate(() => ({
      replyCount: document.querySelectorAll(".right-comment-reply").length,
      replyAvatarCount: document.querySelectorAll(".right-comment-reply .right-comment-avatar").length,
      replyText: document.querySelector(".right-comment-reply")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      replyAuthorVariant: document.querySelector(".right-comment-reply .right-comment-author")?.className ?? "",
      replyIndent: window.getComputedStyle(document.querySelector(".right-comment-replies")).paddingLeft,
    }));
    expect(commentReplyState.replyCount === 1, "Reply should render under its parent comment.");
    expect(commentReplyState.replyAvatarCount === 0, "Replies should not repeat the full comment avatar treatment.");
    expect(commentReplyState.replyText.includes("Taeha") && commentReplyState.replyText.includes("Reply back."), "Reply should keep author and body readable.");
    expect(commentReplyState.replyAuthorVariant.includes("reply"), "Replies should use the compact author variant.");
    expect(commentReplyState.replyIndent !== "0px", "Replies should be visually nested under the root comment.");

    await page.getByTitle("New tab").click();
    await page.waitForTimeout(120);
    await page.locator(".right-comment-input").fill("Later file note.");
    await page.locator(".right-comment-form .right-comment-submit").click();
    await page.waitForTimeout(120);
    const laterCommentFile = await page.evaluate(
      () => document.querySelector(".tab-item.active .tab-title")?.textContent?.trim() ?? "",
    );
    expect(Boolean(laterCommentFile), "Creating a later file comment should leave a readable active file title.");

    await page.getByRole("button", { name: "Show all comments", exact: true }).click();
    await page.waitForTimeout(80);
    const allCommentsScopeState = await page.evaluate(() => ({
      scopeTitle: document.querySelector(".right-comments-context")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      switchText: document.querySelector(".right-comments-switch")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      switchPressed: document.querySelector(".right-comments-switch")?.getAttribute("aria-pressed") ?? "",
      inputCount: document.querySelectorAll(".right-comment-input").length,
      fileHeaders: Array.from(document.querySelectorAll(".right-comment-file .right-row-label")).map(
        (item) => item.textContent?.trim() ?? "",
      ),
      cards: document.querySelectorAll(".right-comment-card").length,
      cardTexts: Array.from(document.querySelectorAll(".right-comment-card")).map(
        (card) => card.textContent?.replace(/\s+/g, " ").trim() ?? "",
      ),
    }));
    expect(allCommentsScopeState.switchPressed === "true", "All comments scope should become active when selected.");
    expect(
      allCommentsScopeState.switchText.replace(/\d+$/, "") === "Current file",
      "All comments should expose Current file as the way back.",
    );
    expect(allCommentsScopeState.scopeTitle.includes("All comments"), "All comments scope should use a scope title, not the active file title.");
    expect(allCommentsScopeState.inputCount === 0, "All comments is an inbox view and should not show the current-file composer.");
    expect(allCommentsScopeState.cards >= 2, "All comments scope should include comments from multiple files.");
    expect(
      allCommentsScopeState.fileHeaders.length >= 1 &&
        allCommentsScopeState.fileHeaders.every((title) => !title.endsWith(".md")),
      "All files scope should show compact file headers without .md.",
    );
    expect(
      allCommentsScopeState.fileHeaders[0] === laterCommentFile,
      "All comments should sort file groups by latest comment activity.",
    );
    expect(
      allCommentsScopeState.cardTexts[0]?.includes("Later file note."),
      "All comments should show the latest active comment first inside the newest file group.",
    );

    await page.getByRole("button", { name: "Show current file comments", exact: true }).click();
    await page.waitForTimeout(80);

    await page.getByRole("button", { name: "Resolve" }).click();
    await page.waitForTimeout(120);
    const commentsAfterResolve = await page.evaluate(() => ({
      openCardCount: document.querySelectorAll(".right-comment-group:not(.resolved) .right-comment-card").length,
      resolvedHeader: document.querySelector(".right-resolved-comments-header")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
      actionText: document.querySelector(".right-comment-actions")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(commentsAfterResolve.openCardCount === 0, "Resolved comments should leave the open comments list.");
    expect(commentsAfterResolve.resolvedHeader === "Resolved · 1", "Resolved comments should collapse behind a quiet archive row.");
    expect(commentsAfterResolve.actionText === "", "Resolved comments should stay hidden until the resolved row is opened.");

    await page.getByRole("button", { name: "Show resolved comments" }).click();
    await page.waitForTimeout(80);
    const resolvedCommentActions = await page.evaluate(() => ({
      actionText: document.querySelector(".right-comment-actions")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(resolvedCommentActions.actionText === "ReopenDelete", "Resolved comments should expose direct reopen and delete actions.");
    await page.getByRole("button", { name: "Reopen" }).click();
    await page.waitForTimeout(120);
    const commentsAfterReopen = await page.evaluate(() => ({
      openCardCount: document.querySelectorAll(".right-comment-group .right-comment-card:not(.resolved)").length,
      resolvedHeaderCount: document.querySelectorAll(".right-resolved-comments-header").length,
    }));
    expect(commentsAfterReopen.openCardCount === 1, "Reopening should return the comment to the open comments list.");
    expect(commentsAfterReopen.resolvedHeaderCount === 0, "Reopening the only resolved comment should hide the resolved row.");

    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
    const rightEscapeState = await page.evaluate(() => ({
      rightOpen: Boolean(document.querySelector(".right-panel")),
    }));
    expect(!rightEscapeState.rightOpen, "Escape should close the right panel.");

    for (let index = 0; index < 10; index += 1) {
      await page.getByTitle("New tab").click();
    }
    await page.waitForTimeout(120);

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
      const activeTitleRect = activeTab.querySelector(".tab-title")?.getBoundingClientRect();
      const activeModeIconStyle = activeTab.querySelector(".tab-mode-icon")
        ? window.getComputedStyle(activeTab.querySelector(".tab-mode-icon"))
        : null;
      const inactiveTitleInsets = Array.from(document.querySelectorAll(".tab-item:not(.active)"))
        .slice(0, 4)
        .map((tab) => {
          const tabRect = tab.getBoundingClientRect();
          const titleRect = tab.querySelector(".tab-title")?.getBoundingClientRect();
          return titleRect ? titleRect.left - tabRect.left : null;
        })
        .filter((inset) => inset !== null);
      const inactiveModeIconDisplays = Array.from(document.querySelectorAll(".tab-item:not(.active) .tab-mode-icon"))
        .slice(0, 4)
        .map((icon) => window.getComputedStyle(icon).display);
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
        activeTitleInset: activeTitleRect ? activeTitleRect.left - activeRect.left : null,
        inactiveTitleInsets,
        activeModeIconDisplay: activeModeIconStyle?.display ?? "",
        inactiveModeIconDisplays,
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
    expect(overflow.activeModeIconDisplay === "grid", "Active tab mode icon should keep its layout slot.");
    expect(
      overflow.inactiveModeIconDisplays.every((display) => display === overflow.activeModeIconDisplay),
      "Inactive tab mode icons should keep the same layout slot as the active tab.",
    );
    expect(
      overflow.inactiveTitleInsets.every((inset) => Math.abs(inset - overflow.activeTitleInset) <= 1),
      "Focused tabs should keep title text aligned with neighboring tabs.",
    );
    expect(overflow.activeCloseCentered, "Close buttons should stay vertically centered inside tabs.");
    expect(overflow.activeTabVisible, "Active overflow tab should remain visible.");
    expect(!overflow.activeCloseVisible, "Close actions should stay hidden until hover or focus.");
    expect(overflow.addButtonVisible, "New tab button should stay visible when tabs overflow.");
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
    await page.mouse.dblclick(activeTabBeforeRename.titleClickX, activeTabBeforeRename.titleClickY);
    await page.waitForTimeout(120);
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
    await page.waitForTimeout(80);
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
    await page.waitForTimeout(80);
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
    await page.waitForTimeout(80);

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
    await page.waitForTimeout(120);
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
    await page.waitForTimeout(80);

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
    await page.waitForTimeout(120);
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
    await page.waitForTimeout(80);

    await page.evaluate(() => {
      const tabsScroll = document.querySelector(".tabs-scroll");
      tabsScroll?.scrollTo({ left: 0 });
      tabsScroll?.dispatchEvent(new Event("scroll"));
    });
    await page.waitForTimeout(120);
    const activeReturnButton = await page.evaluate(() => {
      const leftButton = document.querySelector(".tabbar > .tab-scroll-button");
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
        highlighted: rightButton.classList.contains("has-current-tab"),
        leftHighlighted: Boolean(leftButton?.classList.contains("has-current-tab")),
        activeHiddenRight: activeRect.left > scrollRect.right - 4,
        label: rightButton.getAttribute("aria-label") ?? "",
      };
    });
    expect(activeReturnButton?.visible, "The tab scroll button should remain visible when the active tab is outside the viewport.");
    expect(activeReturnButton?.highlighted, "The scroll button toward the hidden active tab should be highlighted.");
    expect(!activeReturnButton?.leftHighlighted, "Only the direction toward the hidden active tab should be highlighted.");
    expect(activeReturnButton?.activeHiddenRight, "The smoke setup should hide the active tab to the right.");
    expect(activeReturnButton?.label.includes(overflow.activeFileName), "The highlighted scroll button should name the active document.");

    const activeReturnButtonLocator = page.locator(".tab-scroll-button.has-current-tab");
    expect((await activeReturnButtonLocator.count()) === 1, "There should be one highlighted active-tab scroll button.");
    await activeReturnButtonLocator.click();
    await page.waitForTimeout(220);
    const returnedToActiveTab = await page.evaluate(() => {
      const activeReturnButton = document.querySelector(".tab-scroll-button.has-current-tab");
      const tabsScroll = document.querySelector(".tabs-scroll");
      const activeTab = document.querySelector(".tab-item.active");
      if (!tabsScroll || !activeTab) {
        return null;
      }

      const scrollRect = tabsScroll.getBoundingClientRect();
      const activeRect = activeTab.getBoundingClientRect();
      return {
        activeReturnVisible: Boolean(activeReturnButton),
        activeVisible: activeRect.left >= scrollRect.left - 1 && activeRect.right <= scrollRect.right + 1,
      };
    });
    expect(returnedToActiveTab?.activeVisible, "Clicking the highlighted scroll button should scroll the active tab back into view.");
    expect(!returnedToActiveTab?.activeReturnVisible, "The scroll button highlight should disappear once the active tab is visible.");

    if ((await page.locator(".right-panel").count()) === 0) {
      await openProjectContext(page);
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
      const input = panel?.querySelector("input");
      const inputRect = input?.getBoundingClientRect();
      const target =
        inputRect &&
        document.elementFromPoint(inputRect.left + inputRect.width / 2, inputRect.top + inputRect.height / 2);

      return {
        open: Boolean(panel),
        visibleAtInput: Boolean(target?.closest(".right-panel")),
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
    expect(switcher.open, "All files should open in the right project context panel.");
    expect(switcher.visibleAtInput, "All files should be visible inside the right project context panel.");
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
    await page.getByTitle("New tab").click();
    await page.waitForTimeout(120);
    const rightFilesInitialTabs = await getTabs(page);
    const rightFilesActiveTitle = rightFilesInitialTabs.find((tab) => tab.active)?.title ?? "";
    expect(rightFilesActiveTitle, "Right Files action test should have an active file tab.");
    await openProjectContext(page);
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
      importCount: document.querySelectorAll('.right-file-import-button[aria-label="Import Markdown"]').length,
      visibleText: document.querySelector(".right-panel-body")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(fileActionContract.closeTabCount >= 2, "Right Files should expose close-tab actions for open files.");
    expect(fileActionContract.moreActionCount >= 2, "Right Files should expose compact more-action menus for project files.");
    expect(fileActionContract.renameCount === 0, "Right Files should hide rename behind a more-action menu.");
    expect(fileActionContract.duplicateCount === 0, "Right Files should hide duplicate behind a more-action menu.");
    expect(fileActionContract.deleteCount === 0, "Right Files should hide delete behind a more-action menu.");
    expect(fileActionContract.openMenuCount === 0, "Right Files should keep row menus closed by default.");
    expect(fileActionContract.importCount === 1, "Right Files should expose one Markdown import control.");
    expect(
      !/\b(Close tab|Rename|Duplicate|Delete|Import Markdown)\b/.test(fileActionContract.visibleText),
      "Right Files action labels should stay icon-only in visible panel text.",
    );

    await page.getByRole("button", { name: "Close tab README.md" }).click();
    await page.waitForTimeout(120);
    const filesAfterCloseTab = await page.evaluate(() => ({
      hasReadmeRow: Boolean(document.querySelector('.right-file-tree-row.file[title="README.md"]')),
      hasReadmeTab: Boolean(document.querySelector('.tab-item[data-file-name="README.md"]')),
      closeReadmeActionCount: document.querySelectorAll('.right-file-action[aria-label="Close tab README.md"]').length,
    }));
    expect(filesAfterCloseTab.hasReadmeRow, "Right Files close-tab action should keep the project file row.");
    expect(!filesAfterCloseTab.hasReadmeTab, "Right Files close-tab action should remove only the open tab.");
    expect(filesAfterCloseTab.closeReadmeActionCount === 0, "Closed files should no longer show a close-tab action.");

    await page.getByRole("button", { name: "Open README.md" }).click();
    await page.waitForTimeout(120);
    const filesAfterReopenClosedTab = await page.evaluate(() => ({
      hasReadmeTab: Boolean(document.querySelector('.tab-item[data-file-name="README.md"]')),
      activeTabTitle: document.querySelector(".tab-item.active")?.getAttribute("data-file-name") ?? "",
    }));
    expect(filesAfterReopenClosedTab.hasReadmeTab, "Selecting a closed file should reopen it as a tab.");
    expect(filesAfterReopenClosedTab.activeTabTitle === "README.md", "Selecting a closed file should activate the reopened tab.");

    await page.getByRole("button", { name: `Open ${rightFilesActiveTitle}` }).click();
    await page.waitForTimeout(120);

    await openRightFileMenu(rightFilesActiveTitle);
    expect((await page.getByRole("menuitem", { name: "Rename" }).count()) === 1, "Right Files menu should expose rename.");
    expect((await page.getByRole("menuitem", { name: "Duplicate" }).count()) === 1, "Right Files menu should expose duplicate.");
    expect((await page.getByRole("menuitem", { name: "Delete" }).count()) === 1, "Right Files menu should expose delete.");
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByRole("textbox", { name: `Rename ${rightFilesActiveTitle} in Files` }).fill("README");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
    const duplicateRename = await page.evaluate(() => ({
      inputValue: document.querySelector(".right-file-rename-input")?.value ?? "",
      toastText: document.querySelector(".app-toast")?.textContent?.trim() ?? "",
      toastError: Boolean(document.querySelector(".app-toast.error")),
      panelOpen: Boolean(document.querySelector(".right-panel")),
    }));
    expect(duplicateRename.inputValue === "README", "Right Files duplicate rename should keep the typed value open.");
    expect(duplicateRename.toastText === "File name already exists.", "Right Files duplicate rename should use the app toast.");
    expect(duplicateRename.toastError, "Right Files duplicate rename toast should use the error tone.");
    expect(duplicateRename.panelOpen, "Right Files duplicate rename should not close the panel.");

    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
    expect(
      (await page.locator(".right-file-rename-input").count()) === 0,
      "Escape in Right Files rename should cancel rename without closing the panel.",
    );
    expect((await page.locator(".right-panel").count()) === 1, "Right Files panel should remain open after canceling rename.");

    await openRightFileMenu(rightFilesActiveTitle);
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await page.getByRole("textbox", { name: `Rename ${rightFilesActiveTitle} in Files` }).fill("Right Panel");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(120);
    let filesAfterRename = await page.evaluate(() => ({
      hasRenamedRow: Boolean(document.querySelector('.right-file-tree-row.file[title="Right Panel.md"]')),
      activeTabTitle: document.querySelector(".tab-item.active")?.getAttribute("data-file-name") ?? "",
    }));
    expect(filesAfterRename.hasRenamedRow, "Right Files rename should update the project file row.");
    expect(filesAfterRename.activeTabTitle === "Right Panel.md", "Right Files rename should update the open tab title.");

    await openRightFileMenu("Right Panel.md");
    await page.getByRole("menuitem", { name: "Duplicate" }).click();
    await page.waitForTimeout(120);
    const filesAfterDuplicate = await page.evaluate(() => ({
      hasDuplicateRow: Boolean(document.querySelector('.right-file-tree-row.file[title="Right Panel 2.md"]')),
      activeTabTitle: document.querySelector(".tab-item.active")?.getAttribute("data-file-name") ?? "",
      toastText: document.querySelector(".app-toast")?.textContent?.trim() ?? "",
    }));
    expect(filesAfterDuplicate.hasDuplicateRow, "Right Files duplicate should add a new project file row.");
    expect(filesAfterDuplicate.activeTabTitle === "Right Panel 2.md", "Right Files duplicate should open the new file as a tab.");
    expect(filesAfterDuplicate.toastText === "File duplicated.", "Right Files duplicate should confirm with the app toast.");

    await openRightFileMenu("Right Panel 2.md");
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.waitForTimeout(120);
    const filesAfterDelete = await page.evaluate(() => ({
      hasDeletedRow: Boolean(document.querySelector('.right-file-tree-row.file[title="Right Panel 2.md"]')),
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
    await page.waitForTimeout(120);
    const filesAfterUndoDelete = await page.evaluate(() => ({
      hasRestoredRow: Boolean(document.querySelector('.right-file-tree-row.file[title="Right Panel 2.md"]')),
      hasRestoredTab: Boolean(document.querySelector('.tab-item[data-file-name="Right Panel 2.md"]')),
      activeTabTitle: document.querySelector(".tab-item.active")?.getAttribute("data-file-name") ?? "",
      toastText: document.querySelector(".app-toast")?.textContent?.trim() ?? "",
    }));
    expect(filesAfterUndoDelete.hasRestoredRow, "Undo delete should restore the project file row.");
    expect(filesAfterUndoDelete.hasRestoredTab, "Undo delete should restore the open tab when it was open before delete.");
    expect(filesAfterUndoDelete.activeTabTitle === "Right Panel 2.md", "Undo delete should restore focus to the deleted active file.");
    expect(filesAfterUndoDelete.toastText === "File restored.", "Undo delete should confirm restoration.");

    const fileChooserPromise = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import Markdown" }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles([
      {
        name: "Panel Import.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("# Imported from Files\n\nRight panel import check."),
      },
    ]);
    await page.waitForTimeout(160);
    const filesAfterImport = await page.evaluate(() => ({
      hasImportedRow: Boolean(document.querySelector('.right-file-tree-row.file[title="Panel Import.md"]')),
      activeTabTitle: document.querySelector(".tab-item.active")?.getAttribute("data-file-name") ?? "",
      editorText: document.querySelector(".cm-content")?.textContent ?? "",
    }));
    expect(filesAfterImport.hasImportedRow, "Right Files import should add the imported Markdown to project files.");
    expect(filesAfterImport.activeTabTitle === "Panel Import.md", "Right Files import should open the imported file as a tab.");
    expect(filesAfterImport.editorText.includes("Imported from Files"), "Right Files import should load the Markdown content.");
  });
}
