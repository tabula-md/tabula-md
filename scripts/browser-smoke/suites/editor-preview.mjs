export const id = "editor-preview";
export const description = "Editor commands, Markdown preview rendering, toolbar behavior, and comments.";

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
    waitForEditorReady,
    waitForRenderFrame,
    waitForSelectionLayer,
    waitForText,
    withPage,
  } = ctx;

  await withPage(browser, "/", async (page) => {
    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText("alpha\nbeta\ncharlie");
    await waitForRenderFrame(page);

    expect((await page.locator(".cm-lineNumbers").count()) === 1, "Edit mode should show line numbers by default.");
    expect((await page.locator(".cm-activeLine").count()) >= 1, "Edit mode should highlight the active line.");
    expect((await page.locator(".cm-activeLineGutter").count()) >= 1, "Edit mode should highlight the active line number.");
    expect(
      (await page.locator(".cm-annotationGutter .cm-activeLineGutter").count()) >= 1,
      "Edit mode should include the left annotation gutter in the active line highlight.",
    );
    expect(
      (await page.locator(".cm-commentGutter .cm-activeLineGutter").count()) >= 1,
      "Edit mode should include the right comment gutter in the active line highlight.",
    );
    const editorRailLayout = await page.evaluate(() => {
      const getRect = (selector) => {
        const element = document.querySelector(selector);
        if (!(element instanceof Element)) {
          return null;
        }

        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
        };
      };
      const content = getRect(".cm-content");
      const activeLine = getRect(".cm-activeLine");
      const activeCommentGutterLine = getRect(".cm-gutters-after .cm-activeLineGutter");
      const editor = getRect(".cm-editor");
      const annotationGutter = getRect(".cm-annotationGutter");
      const lineNumberGutter = getRect(".cm-lineNumbers");
      const commentGutter = getRect(".cm-commentGutter");
      const bookmarkAction = getRect(".cm-annotationGutter .cm-activeLineGutter .cm-annotation-action");
      const commentAction = getRect(".cm-commentGutter .cm-activeLineGutter .cm-line-comment-action");

      return {
        leftRail: (annotationGutter?.width ?? 0) + (lineNumberGutter?.width ?? 0),
        rightRail: commentGutter?.width ?? 0,
        lineToCommentGutterGap:
          activeLine && activeCommentGutterLine ? activeCommentGutterLine.left - activeLine.right : Number.NaN,
        trailingFrameGap: editor && commentGutter ? editor.right - commentGutter.right : Number.NaN,
        leftActionDistance: content && bookmarkAction ? content.left - (bookmarkAction.left + bookmarkAction.width / 2) : Number.NaN,
        rightActionDistance:
          content && commentAction ? commentAction.left + commentAction.width / 2 - content.right : Number.NaN,
      };
    });
    expect(
      Math.abs(editorRailLayout.leftRail - editorRailLayout.rightRail) <= 1,
      "Editor annotation rails should reserve symmetric left and right space.",
    );
    expect(
      Math.abs(editorRailLayout.lineToCommentGutterGap) <= 1,
      "Active line background should meet the right comment gutter without a visible seam.",
    );
    expect(Math.abs(editorRailLayout.trailingFrameGap) <= 1, "Right comment gutter should close the editor frame.");
    expect(
      Math.abs(editorRailLayout.leftActionDistance - editorRailLayout.rightActionDistance) <= 4,
      "Left bookmark and right comment actions should sit at visually balanced distances from the text column.",
    );
    await page.mouse.move(12, 12);
    const activeAnnotationLaneOpacity = await page.evaluate(() => {
      const icon = document.querySelector(".cm-annotationGutter .cm-activeLineGutter .cm-annotation-icon");
      return icon ? getComputedStyle(icon).opacity : "";
    });
    expect(activeAnnotationLaneOpacity === "0", "Annotation lanes should stay hidden until the pointer enters the gutter.");
    const activeCommentLaneOpacity = await page.evaluate(() => {
      const icon = document.querySelector(".cm-commentGutter .cm-activeLineGutter .cm-annotation-icon");
      return icon ? getComputedStyle(icon).opacity : "";
    });
    expect(activeCommentLaneOpacity === "0", "Comment lanes should stay hidden until the pointer enters the right gutter.");
    const activeTextLinePoint = await page.evaluate(() => {
      const line = document.querySelector(".cm-activeLine");
      if (!(line instanceof HTMLElement)) {
        return null;
      }

      const rect = line.getBoundingClientRect();
      return {
        x: rect.left + Math.min(24, rect.width / 2),
        y: rect.top + rect.height / 2,
      };
    });
    expect(Boolean(activeTextLinePoint), "The active text line should have a hover point.");
    await page.mouse.move(activeTextLinePoint.x, activeTextLinePoint.y);
    await waitForRenderFrame(page);
    const textHoveredCommentLaneOpacity = await page.evaluate(() => {
      const icon = document.querySelector(".cm-commentGutter .cm-activeLineGutter .cm-annotation-icon");
      return icon ? getComputedStyle(icon).opacity : "";
    });
    expect(textHoveredCommentLaneOpacity === "0", "Hovering editor text should not reveal the right comment lane.");
    const activeAnnotationPoint = await page.evaluate(() => {
      const line = document.querySelector(".cm-annotationGutter .cm-activeLineGutter");
      if (!(line instanceof HTMLElement)) {
        return null;
      }

      const rect = line.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    });
    expect(Boolean(activeAnnotationPoint), "The active line should have an annotation gutter point.");
    await page.mouse.move(activeAnnotationPoint.x, activeAnnotationPoint.y);
    await waitForRenderFrame(page);
    const hoveredAnnotationLaneOpacity = await page.evaluate(() => {
      const icon = document.querySelector(".cm-annotationGutter .cm-activeLineGutter .cm-annotation-icon");
      return icon ? getComputedStyle(icon).opacity : "";
    });
    expect(hoveredAnnotationLaneOpacity !== "0", "Annotation lanes should appear when the pointer enters the gutter.");
    const activeCommentPoint = await page.evaluate(() => {
      const line = document.querySelector(".cm-commentGutter .cm-activeLineGutter");
      if (!(line instanceof HTMLElement)) {
        return null;
      }

      const rect = line.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    });
    expect(Boolean(activeCommentPoint), "The active line should have a right comment gutter point.");
    await page.mouse.move(activeCommentPoint.x, activeCommentPoint.y);
    await waitForRenderFrame(page);
    const hoveredCommentLaneOpacity = await page.evaluate(() => {
      const icon = document.querySelector(".cm-commentGutter .cm-activeLineGutter .cm-annotation-icon");
      return icon ? getComputedStyle(icon).opacity : "";
    });
    expect(hoveredCommentLaneOpacity !== "0", "Comment lanes should appear when the pointer enters the right gutter.");

    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    await page.getByRole("button", { name: "Line numbers" }).click();
    await waitForRenderFrame(page);
    expect((await page.locator(".cm-lineNumbers").count()) === 0, "Line numbers should turn off from Editor controls.");
    const lineNumberOffRailLayout = await page.evaluate(() => {
      const getWidth = (selector) => {
        const element = document.querySelector(selector);
        return element instanceof Element ? element.getBoundingClientRect().width : 0;
      };

      return {
        leftRail: getWidth(".cm-annotationGutter"),
        rightRail: getWidth(".cm-commentGutter"),
      };
    });
    expect(
      Math.abs(lineNumberOffRailLayout.leftRail - lineNumberOffRailLayout.rightRail) <= 1,
      "Editor annotation rails should remain symmetric when line numbers are hidden.",
    );
    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    await page.getByRole("button", { name: "Line numbers" }).click();
    await waitForRenderFrame(page);
    expect((await page.locator(".cm-lineNumbers").count()) === 1, "Line numbers should turn back on from Editor controls.");

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });
    expect(!(await page.locator(".cm-lineNumbers").isVisible()), "Preview mode should not show editor line numbers.");
  });

  await withPage(browser, "/", async (page) => {
    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText("alpha beta\nbeta gamma\nalpha beta");
    await waitForRenderFrame(page);

    const readSearchRowLayout = () =>
      page.evaluate(() => {
        const controls = document.querySelector(".editor-control-row");
        const row = document.querySelector(".file-search-row");
        const workspace = document.querySelector(".workspace");
        if (!(controls instanceof HTMLElement) || !(row instanceof HTMLElement) || !(workspace instanceof HTMLElement)) {
          return null;
        }

        const controlsRect = controls.getBoundingClientRect();
        const rowRect = row.getBoundingClientRect();
        const workspaceRect = workspace.getBoundingClientRect();
        const rowStyle = getComputedStyle(row);
        return {
          rowLeft: Math.round(rowRect.left),
          rowRight: Math.round(rowRect.right),
          rowTop: Math.round(rowRect.top),
          rowBottom: Math.round(rowRect.bottom),
          rowWidth: Math.round(rowRect.width),
          controlsLeft: Math.round(controlsRect.left),
          controlsRight: Math.round(controlsRect.right),
          controlsBottom: Math.round(controlsRect.bottom),
          controlsWidth: Math.round(controlsRect.width),
          workspaceTop: Math.round(workspaceRect.top),
          rowPosition: rowStyle.position,
          rowBorderTop: rowStyle.borderTopWidth,
          rowBorderBottom: rowStyle.borderBottomWidth,
          fileToolbarSeparators: document.querySelectorAll(".file-toolbar > .toolbar-separator").length,
        };
      });

    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForSelector(".file-search-row");
    const searchRowLayout = await readSearchRowLayout();
    expect(Boolean(searchRowLayout), "Search should render a measurable row.");
    expect(searchRowLayout.rowPosition === "relative", "Search should be a document row, not a floating popover.");
    expect(searchRowLayout.rowTop >= searchRowLayout.controlsBottom - 1, "Search row should sit below the editor controls.");
    expect(searchRowLayout.workspaceTop >= searchRowLayout.rowBottom - 1, "Workspace should start below the search row.");
    expect(
      Math.abs(searchRowLayout.rowLeft - searchRowLayout.controlsLeft) <= 1 &&
        Math.abs(searchRowLayout.rowRight - searchRowLayout.controlsRight) <= 1 &&
        Math.abs(searchRowLayout.rowWidth - searchRowLayout.controlsWidth) <= 1,
      "Search row should follow the same text-width layout as the top toolbar.",
    );
    expect(
      searchRowLayout.rowBorderTop === "0px" && searchRowLayout.rowBorderBottom === "0px",
      "Search row should not add splitter-style border lines.",
    );
    expect(searchRowLayout.fileToolbarSeparators === 0, "File toolbar controls should not use a splitter line.");

    await page.getByRole("button", { name: "Close search" }).click();
    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    await page.getByRole("button", { name: "Focus" }).click();
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.waitForSelector(".file-search-row");
    const focusedWidthSearchLayout = await readSearchRowLayout();
    expect(Boolean(focusedWidthSearchLayout), "Search row should be measurable after changing text width.");
    expect(
      Math.abs(focusedWidthSearchLayout.rowLeft - focusedWidthSearchLayout.controlsLeft) <= 1 &&
        Math.abs(focusedWidthSearchLayout.rowRight - focusedWidthSearchLayout.controlsRight) <= 1 &&
        Math.abs(focusedWidthSearchLayout.rowWidth - focusedWidthSearchLayout.controlsWidth) <= 1,
      "Search row should stay aligned after Text Width changes.",
    );

    const searchInput = page.getByRole("searchbox", { name: "Find in file" });
    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    expect((await page.locator(".file-search-row").count()) === 1, "Search should stay open while Editor Controls are opened.");
    expect((await page.locator('.file-tool-popover[aria-label="Editor controls"]').count()) === 1, "Editor Controls should open over the persistent search row.");
    await page.locator(".workspace").click({ position: { x: 20, y: 20 } });
    await waitForRenderFrame(page);
    expect((await page.locator('.file-tool-popover[aria-label="Editor controls"]').count()) === 0, "Outside click should close Editor Controls.");
    expect((await page.locator(".file-search-row").count()) === 1, "Outside click should not close Search.");

    await searchInput.click();
    await searchInput.type("bet");
    await waitForRenderFrame(page);
    expect((await page.locator(".file-search-count").textContent()) === "1/3", "Search should update result count while typing.");
    expect((await page.locator(".cm-search-match").count()) === 3, "Search should highlight all matches while typing.");
    expect((await page.locator(".cm-search-match.active").count()) === 1, "Search should highlight the active match.");
    const searchHighlightColors = await page.evaluate(() => {
      const match = document.querySelector(".cm-search-match:not(.active)") ?? document.querySelector(".cm-search-match");
      const activeMatch = document.querySelector(".cm-search-match.active");
      return {
        match: match instanceof HTMLElement ? getComputedStyle(match).backgroundColor : "",
        activeMatch: activeMatch instanceof HTMLElement ? getComputedStyle(activeMatch).backgroundColor : "",
      };
    });
    expect(
      searchHighlightColors.match.includes("118, 63, 200") &&
        searchHighlightColors.activeMatch.includes("118, 63, 200"),
      "Search highlights should use the Tabula purple accent scale.",
    );

    await page.keyboard.press("Enter");
    await waitForRenderFrame(page);
    expect((await page.locator(".file-search-count").textContent()) === "2/3", "Enter should move to the next search result.");
    expect((await searchInput.inputValue()) === "bet", "Enter should keep the search query in the input.");
    const activeSearchFocus = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
    expect(activeSearchFocus === "Find in file", "Enter should keep focus in the search input.");

    await page.locator(".workspace").click({ position: { x: 20, y: 20 } });
    await waitForRenderFrame(page);
    expect((await page.locator(".file-search-row").count()) === 1, "Search should stay open after clicking the document.");

    await searchInput.fill("zzz");
    await waitForRenderFrame(page);
    expect((await page.locator(".file-search-count").textContent()) === "0/0", "Search should show zero results as the query changes.");
    expect((await page.locator(".cm-search-match").count()) === 0, "Search should clear highlights when there are no matches.");

    await page.getByRole("button", { name: "Close search" }).click();
    await waitForRenderFrame(page);
    expect((await page.locator(".file-search-row").count()) === 0, "Closing search should remove the search row.");

    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    expect((await page.locator('.file-tool-popover[aria-label="Editor controls"]').count()) === 1, "Editor Controls should open as a popover.");
    await page.locator(".workspace").click({ position: { x: 20, y: 20 } });
    await waitForRenderFrame(page);
    expect((await page.locator('.file-tool-popover[aria-label="Editor controls"]').count()) === 0, "Editor Controls should close on outside click.");

    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    await page.getByRole("button", { name: "Line Wrapping" }).click();
    await waitForRenderFrame(page);
    expect((await page.locator('.file-tool-popover[aria-label="Editor controls"]').count()) === 0, "Editor Controls should close after choosing an action.");
  });

  await withPage(browser, "/", async (page) => {
    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText("Agent anchor\n\nWorking line");
    await waitForRenderFrame(page);

    await page.getByRole("button", { name: "Search", exact: true }).click();
    const searchInput = page.getByRole("searchbox", { name: "Find in file" });
    await searchInput.fill("Agent");
    await waitForRenderFrame(page);
    expect((await page.locator(".file-search-count").textContent()) === "1/1", "Search should find the Agent match before editing.");

    const workingLinePoint = await page.evaluate(() => {
      const line = Array.from(document.querySelectorAll(".cm-line")).find((element) =>
        element.textContent?.includes("Working line"),
      );
      if (!(line instanceof HTMLElement)) {
        return null;
      }

      const rect = line.getBoundingClientRect();
      return {
        x: rect.left + 20,
        y: rect.top + rect.height / 2,
      };
    });
    expect(Boolean(workingLinePoint), "The non-search editing line should be clickable.");
    await page.mouse.click(workingLinePoint.x, workingLinePoint.y);
    await page.keyboard.press("End");
    await page.keyboard.type(" typed", { delay: 25 });
    await waitForRenderFrame(page);

    const searchEditState = await page.evaluate(() => ({
      editorText: document.querySelector(".cm-content")?.textContent ?? "",
      searchCount: document.querySelector(".file-search-count")?.textContent ?? "",
      activeElementLabel: document.activeElement?.getAttribute("aria-label") ?? "",
    }));
    expect(searchEditState.editorText.includes("Agent anchor"), "Editing with Search open should not overwrite the matching Agent text.");
    expect(
      searchEditState.editorText.includes("Working line typed"),
      "Editing with Search open should keep typing on the line the user selected.",
    );
    expect(searchEditState.searchCount === "1/1", "Search should keep the same match count while unrelated text changes.");
    expect(searchEditState.activeElementLabel !== "Find in file", "Typing in the document should not be pulled back into the search input.");
  });

  await withPage(browser, "/", async (page) => {
    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText("alpha\nbeta\ncharlie");
    await waitForRenderFrame(page);

    const clickBookmarkLineAction = async (lineNumber) => {
      const point = await page.evaluate((targetLineNumber) => {
        const lineNumberElement = Array.from(document.querySelectorAll(".cm-lineNumbers .cm-gutterElement")).find(
          (element) => element.textContent?.trim() === String(targetLineNumber),
        );
        const annotationGutter = document.querySelector(".cm-annotationGutter");
        if (!(lineNumberElement instanceof HTMLElement) || !(annotationGutter instanceof HTMLElement)) {
          return null;
        }

        const lineRect = lineNumberElement.getBoundingClientRect();
        const gutterRect = annotationGutter.getBoundingClientRect();
        return {
          x: gutterRect.left + gutterRect.width / 2,
          y: lineRect.top + lineRect.height / 2,
        };
      }, lineNumber);
      expect(Boolean(point), `Line ${lineNumber} should have a bookmark gutter target.`);
      await page.mouse.move(point.x, point.y);
      await waitForRenderFrame(page);
      await page.mouse.click(point.x, point.y);
    };

    const clickLineCommentAction = async (lineNumber) => {
      const point = await page.evaluate((targetLineNumber) => {
        const action = document.querySelector(`.cm-line-comment-action[data-line-number="${targetLineNumber}"]`);
        if (!(action instanceof HTMLElement)) {
          return null;
        }

        const rect = action.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }, lineNumber);
      expect(Boolean(point), `Line ${lineNumber} should have a right-side comment target.`);
      await page.mouse.move(point.x, point.y);
      await waitForRenderFrame(page);
      await page.mouse.click(point.x, point.y);
    };

    await clickBookmarkLineAction(2);
    await waitForRenderFrame(page);
    const bookmarkedLineState = await page.evaluate(() => ({
      bookmarkMarkers: document.querySelectorAll(".cm-annotation-marker.has-bookmark").length,
      bookmarkColor: (() => {
        const action = document.querySelector(".cm-annotation-marker.has-bookmark .cm-annotation-action.bookmark");
        return action ? getComputedStyle(action).color : "";
      })(),
      lineActionPopoverVisible: Boolean(document.querySelector(".line-annotation-popover")),
      statusButtonVisible: Boolean(document.querySelector(".status-comment-button")),
    }));
    expect(bookmarkedLineState.bookmarkMarkers === 1, "Bookmarking a line should render a bookmark marker in the gutter.");
    expect(bookmarkedLineState.bookmarkColor === "rgb(118, 63, 200)", "Active bookmarks should use the shared annotation accent.");
    expect(!bookmarkedLineState.lineActionPopoverVisible, "Annotation gutter actions should not open a line action menu.");
    expect(!bookmarkedLineState.statusButtonVisible, "Selection comments should no longer use the status bar action.");

    await clickLineCommentAction(2);
    await waitForRenderFrame(page);
    await page.locator(".right-comment-input").fill("Line note");
    await page.locator(".right-comment-form .right-comment-submit").click();
    await waitForRenderFrame(page);

    const lineCommentState = await page.evaluate(() => ({
      commentActions: document.querySelectorAll(".cm-line-comment-marker.has-comment").length,
      commentActionInRightGutter: Boolean(document.querySelector(".cm-commentGutter .cm-line-comment-marker.has-comment")),
      commentActionInBody: Boolean(document.querySelector(".cm-line .cm-line-comment-action")),
      commentColor: (() => {
        const action = document.querySelector(".cm-line-comment-marker.has-comment .cm-line-comment-action");
        return action ? getComputedStyle(action).color : "";
      })(),
      selectionPopoverVisible: Boolean(document.querySelector(".selection-comment-popover")),
      markText: document.querySelector(".cm-comment-mark")?.textContent ?? "",
      panelText: document.querySelector(".right-panel-body")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(lineCommentState.commentActions === 1, "A line with a comment should render a right-side comment affordance.");
    expect(lineCommentState.commentActionInRightGutter, "Line comments should sit in the right gutter.");
    expect(!lineCommentState.commentActionInBody, "Line comments should not sit inside the editable text body.");
    expect(lineCommentState.commentColor === "rgb(118, 63, 200)", "Active line comments should use the shared annotation accent.");
    expect(!lineCommentState.selectionPopoverVisible, "Line comments should not also show the selected-text comment popover.");
    expect(lineCommentState.markText === "beta", "Line comments should anchor to the clicked line text.");
    expect(lineCommentState.panelText.includes("Line note"), "Line comments should use the existing comments panel.");

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.waitForSelector(".workspace.preview .preview-line-action.bookmark.has-bookmark", { timeout: 5_000 });
    await page.waitForSelector(".workspace.preview .preview-line-action.comment.has-comment", { timeout: 5_000 });
    const previewLineGutterState = await page.evaluate(() => {
      const previewDocument = document.querySelector(".workspace.preview .preview-document.with-line-gutters");
      const previewContent = document.querySelector(".workspace.preview .preview-document-content");
      const bookmarkAction = document.querySelector(".workspace.preview .preview-line-action.bookmark.has-bookmark");
      const commentAction = document.querySelector(".workspace.preview .preview-line-action.comment.has-comment");
      const previewDocumentRect = previewDocument?.getBoundingClientRect();
      const previewContentRect = previewContent?.getBoundingClientRect();
      const bookmarkRect = bookmarkAction?.getBoundingClientRect();
      const commentRect = commentAction?.getBoundingClientRect();
      return {
        hasPreviewLineGutter: Boolean(previewDocument && previewContent),
        bookmarkColor: bookmarkAction instanceof HTMLElement ? getComputedStyle(bookmarkAction).color : "",
        commentColor: commentAction instanceof HTMLElement ? getComputedStyle(commentAction).color : "",
        bookmarkLeftOfContent:
          Boolean(bookmarkRect && previewContentRect) && bookmarkRect.right <= previewContentRect.left + 1,
        commentRightOfContent:
          Boolean(commentRect && previewContentRect) && commentRect.left >= previewContentRect.right - 1,
        contentInsideDocument:
          Boolean(previewDocumentRect && previewContentRect) &&
          previewContentRect.left > previewDocumentRect.left &&
          previewContentRect.right < previewDocumentRect.right,
      };
    });
    expect(previewLineGutterState.hasPreviewLineGutter, "Preview mode should render line gutters around the document body.");
    expect(previewLineGutterState.bookmarkColor === "rgb(118, 63, 200)", "Preview bookmarks should use the shared annotation accent.");
    expect(previewLineGutterState.commentColor === "rgb(118, 63, 200)", "Preview comments should use the shared annotation accent.");
    expect(previewLineGutterState.bookmarkLeftOfContent, "Preview bookmark markers should sit in the left rail outside content.");
    expect(previewLineGutterState.commentRightOfContent, "Preview comment markers should sit in the right rail outside content.");
    expect(previewLineGutterState.contentInsideDocument, "Preview line gutters should frame the rendered document content.");
  });

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const mobilePage = await mobileContext.newPage();
  try {
    await mobilePage.goto(baseUrl);
    await mobilePage.getByTitle("New tab").click();
    await waitForEditorReady(mobilePage, { mode: "edit" });
    await focusMarkdownEditor(mobilePage);
    await mobilePage.keyboard.insertText("mobile\nwrite");
    await waitForRenderFrame(mobilePage);
    const mobileGutterDisplays = await mobilePage
      .locator(".cm-gutters")
      .evaluateAll((gutters) => gutters.map((gutter) => getComputedStyle(gutter).display));
    expect(
      mobileGutterDisplays.length > 0 && mobileGutterDisplays.every((display) => display === "none"),
      "Mobile write mode should hide editor gutters.",
    );
  } finally {
    await mobileContext.close();
  }

  await withPage(browser, "/", async (page) => {
    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    const scrollSmokeMarkdown = Array.from(
      { length: 42 },
      (_, index) => `## Scroll section ${index + 1}\n\nThis paragraph keeps the document tall enough for mode transition scroll checks.`,
    ).join("\n\n");
    await page.keyboard.insertText(scrollSmokeMarkdown);
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });

    const setWorkspaceRatio = async (ratio) =>
      page.evaluate((nextRatio) => {
        const workspace = document.querySelector(".workspace");
        if (!(workspace instanceof HTMLElement)) {
          return null;
        }
        const maxScrollTop = workspace.scrollHeight - workspace.clientHeight;
        workspace.scrollTop = Math.max(0, maxScrollTop) * nextRatio;
        return {
          ratio: maxScrollTop <= 0 ? 0 : workspace.scrollTop / maxScrollTop,
          scrollHeight: workspace.scrollHeight,
          clientHeight: workspace.clientHeight,
          top: Math.round(workspace.getBoundingClientRect().top),
        };
      }, ratio);

    const readWorkspaceRatio = async () =>
      page.evaluate(() => {
        const workspace = document.querySelector(".workspace");
        const topChrome = document.querySelector(".top-chrome");
        const status = document.querySelector(".file-status-bar");
        if (!(workspace instanceof HTMLElement) || !topChrome || !status) {
          return null;
        }
        const maxScrollTop = workspace.scrollHeight - workspace.clientHeight;
        return {
          ratio: maxScrollTop <= 0 ? 0 : workspace.scrollTop / maxScrollTop,
          scrollTop: workspace.scrollTop,
          scrollHeight: workspace.scrollHeight,
          clientHeight: workspace.clientHeight,
          topChromeTop: Math.round(topChrome.getBoundingClientRect().top),
          statusTop: Math.round(status.getBoundingClientRect().top),
        };
      });

    const previewBefore = await setWorkspaceRatio(0.62);
    expect(previewBefore && previewBefore.scrollHeight > previewBefore.clientHeight, "Preview should be scrollable for mode transition smoke.");

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    const writeAfter = await readWorkspaceRatio();
    expect(writeAfter, "Edit mode workspace should be measurable.");
    expect(
      Math.abs(writeAfter.ratio - previewBefore.ratio) < 0.1,
      "Preview -> Edit should preserve normalized document scroll position.",
    );
    expect(writeAfter.topChromeTop === 0, "Mode transition should not move the top chrome.");
    expect(writeAfter.statusTop > 0, "Mode transition should not detach the status row.");

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });
    const previewAfter = await readWorkspaceRatio();
    expect(previewAfter, "Preview mode workspace should be measurable after returning from Edit.");
    expect(
      Math.abs(previewAfter.ratio - writeAfter.ratio) < 0.1,
      "Edit -> Preview should preserve normalized document scroll position.",
    );
  });

  await withPage(browser, "/", async (page) => {
    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);

    await page.getByRole("button", { name: "Bold", exact: true }).click();
    await waitForRenderFrame(page);
    const emptySelectionFormat = await page.evaluate(() => ({
      editorText: document.querySelector(".cm-content")?.textContent ?? "",
      selectedText: document.getSelection()?.toString() ?? "",
      cursorPosition: document.querySelector(".status-cursor-position")?.textContent?.trim() ?? "",
      selectedWordsVisible: Boolean(document.querySelector(".status-selection")),
      editorFocused: Boolean(document.querySelector(".markdown-editor")?.contains(document.activeElement)),
    }));
    expect(
      emptySelectionFormat.editorText === "**bold text**",
      "Empty selection formatting should insert the command placeholder.",
    );
    expect(
      emptySelectionFormat.selectedText === "bold text",
      "Empty selection formatting should select the placeholder text.",
    );
    expect(
      emptySelectionFormat.cursorPosition.includes("(9 characters)"),
      "Empty selection formatting should update selected-character status.",
    );
    expect(!emptySelectionFormat.selectedWordsVisible, "Status bar should not show selected-word status.");
    expect(emptySelectionFormat.editorFocused, "Empty selection formatting should keep focus in the editor.");

    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText("const value = 1;");
    await page.keyboard.press("ControlOrMeta+A");
    await page.getByRole("button", { name: "Code block", exact: true }).click();
    await waitForRenderFrame(page);
    const codeBlockFormatting = await page.evaluate(() => {
      const editorText = Array.from(document.querySelectorAll(".cm-line"))
        .map((line) => line.textContent ?? "")
        .join("\n");
      return {
        editorText,
        selectedText: document.getSelection()?.toString() ?? "",
        buttonCount: document.querySelectorAll(".markdown-format-button").length,
      };
    });
    expect(
      codeBlockFormatting.editorText === "```language\nconst value = 1;\n```",
      "Code block toolbar button should wrap the selected Markdown source in a fenced block with a language placeholder.",
    );
    expect(
      codeBlockFormatting.selectedText === "language",
      "Code block formatting should select the language placeholder first.",
    );
    expect(codeBlockFormatting.buttonCount === 13, "Formatting toolbar should expose the complete core command set.");

    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.getByRole("button", { name: "Heading 1", exact: true }).click();
    await waitForRenderFrame(page);
    const headingOneFormatting = await page.evaluate(() => ({
      editorText: document.querySelector(".cm-content")?.textContent ?? "",
      selectedText: document.getSelection()?.toString() ?? "",
    }));
    expect(headingOneFormatting.editorText === "# Heading", "Heading 1 toolbar button should insert an H1 placeholder.");
    expect(headingOneFormatting.selectedText === "Heading", "Heading 1 toolbar button should select the placeholder text.");
    await page.keyboard.insertText("Subhead");
    await page.keyboard.press("ControlOrMeta+A");
    await page.getByRole("button", { name: "Heading 3", exact: true }).click();
    await waitForRenderFrame(page);
    const headingThreeFormatting = await page.locator(".cm-content").textContent();
    expect(headingThreeFormatting === "### Subhead", "Heading 3 toolbar button should convert selected heading text.");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText("alpha\nbeta");
    await page.keyboard.press("ControlOrMeta+A");
    await page.getByRole("button", { name: "Numbered list", exact: true }).click();
    await waitForRenderFrame(page);
    const numberedListFormatting = Array.from(await page.locator(".cm-line").allTextContents()).join("\n");
    expect(numberedListFormatting === "1. alpha\n2. beta", "Numbered list toolbar button should number selected lines.");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText("alpha\nbeta");
    await page.getByRole("button", { name: "Horizontal rule", exact: true }).click();
    await waitForRenderFrame(page);
    const horizontalRuleFormatting = Array.from(await page.locator(".cm-line").allTextContents()).join("\n");
    expect(
      horizontalRuleFormatting === "alpha\nbeta\n\n---",
      "Horizontal rule toolbar button should insert an independent Markdown divider after the current block.",
    );

    const pasteIntoEditor = async (clipboardText) => {
      await page.evaluate((text) => {
        const target = document.querySelector(".cm-content");
        const data = new DataTransfer();
        data.setData("text/plain", text);
        target?.dispatchEvent(
          new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: data,
          }),
        );
      }, clipboardText);
    };

    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText("Open docs");
    for (let index = 0; index < 4; index += 1) {
      await page.keyboard.press("Shift+ArrowLeft");
    }
    await pasteIntoEditor("https://example.com/docs");
    await waitForRenderFrame(page);
    const pastedLinkText = await page.locator(".cm-content").textContent();
    expect(
      pastedLinkText === "Open [docs](https://example.com/docs)",
      "Pasting a URL over selected text should create a Markdown link.",
    );

    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await pasteIntoEditor("“Title”\r\n\titem\r\n\r\n\r\nnext");
    await waitForRenderFrame(page);
    const normalizedPasteText = Array.from(await page.locator(".cm-line").allTextContents()).join("\n");
    expect(
      normalizedPasteText === '"Title"\n  item\n\nnext',
      "Paste normalization should clean smart quotes, tabs, CRLF, and excessive blank lines.",
    );

    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText("```ts\nconst value = 1;\n```");
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.waitForSelector(".preview-surface pre code", { timeout: 5_000 });
    const previewCodeBlock = await page.evaluate(() => {
      const pre = document.querySelector(".preview-surface pre");
      const code = document.querySelector(".preview-surface pre code");
      const codeBlock = document.querySelector(".preview-code-block");
      if (!(pre instanceof HTMLElement) || !(code instanceof HTMLElement)) {
        return null;
      }
      const preStyle = window.getComputedStyle(pre);
      const codeStyle = window.getComputedStyle(code);
      return {
        text: code.textContent ?? "",
        language: code.dataset.language ?? "",
        actionCount: document.querySelectorAll(".preview-code-action").length,
        wrapTitle: document.querySelector(".preview-code-action")?.getAttribute("title") ?? "",
        copyTitle: document.querySelectorAll(".preview-code-action")[1]?.getAttribute("title") ?? "",
        blockRadius: codeBlock instanceof HTMLElement ? window.getComputedStyle(codeBlock).borderRadius : "",
        blockBorderWidth: codeBlock instanceof HTMLElement ? window.getComputedStyle(codeBlock).borderTopWidth : "",
        blockBackground: codeBlock instanceof HTMLElement ? window.getComputedStyle(codeBlock).backgroundColor : "",
        preBackground: preStyle.backgroundColor,
        preRadius: preStyle.borderRadius,
        codeDisplay: codeStyle.display,
        ligatures: codeStyle.fontVariantLigatures,
        whiteSpace: codeStyle.whiteSpace,
      };
    });
    expect(previewCodeBlock?.text.includes("const value = 1;"), "Preview should render fenced code block contents.");
    expect(previewCodeBlock?.language === "ts", "Preview should preserve fenced code block language metadata.");
    expect(previewCodeBlock?.actionCount === 2, "Preview code blocks should expose word wrap and copy actions.");
    expect(previewCodeBlock?.wrapTitle === "Enable word wrap", "Preview code blocks should offer a word wrap control.");
    expect(previewCodeBlock?.copyTitle === "Copy code", "Preview code blocks should offer a copy code control.");
    expect(previewCodeBlock?.blockRadius !== "0px", "Preview code block controls should live inside the rounded code surface.");
    expect(previewCodeBlock?.blockBorderWidth === "1px", "Preview code blocks should use a document boundary.");
    expect(previewCodeBlock?.blockBackground === "rgb(251, 251, 251)", "Preview code blocks should stay quieter than filled gray cards.");
    expect(previewCodeBlock?.codeDisplay === "block", "Preview code blocks should render as stable block code.");
    expect(previewCodeBlock?.ligatures === "none", "Preview code blocks should preserve source-like character rendering.");
    expect(previewCodeBlock?.whiteSpace === "pre", "Preview code blocks should preserve source whitespace by default.");
    await page.getByRole("button", { name: "Enable word wrap", exact: true }).click();
    await waitForRenderFrame(page);
    const wrappedCodeBlock = await page.evaluate(() => {
      const code = document.querySelector(".preview-surface pre code");
      const wrapButton = document.querySelector(".preview-code-action");
      return {
        whiteSpace: code instanceof HTMLElement ? window.getComputedStyle(code).whiteSpace : "",
        wrapTitle: wrapButton?.getAttribute("title") ?? "",
        wrapPressed: wrapButton?.getAttribute("aria-pressed") ?? "",
      };
    });
    expect(wrappedCodeBlock.whiteSpace === "pre-wrap", "Preview word wrap should wrap code without changing the source.");
    expect(wrappedCodeBlock.wrapTitle === "Disable word wrap", "Preview word wrap should toggle the tooltip copy.");
    expect(wrappedCodeBlock.wrapPressed === "true", "Preview word wrap should expose pressed state.");
    await page.evaluate(() => {
      window.__tabulaCopiedCode = "";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.__tabulaCopiedCode = text;
          },
        },
      });
    });
    await page.getByRole("button", { name: "Copy code", exact: true }).click();
    await waitForRenderFrame(page);
    const copiedCodeBlock = await page.evaluate(() => ({
      copiedText: window.__tabulaCopiedCode ?? "",
      copyTitle: document.querySelectorAll(".preview-code-action")[1]?.getAttribute("title") ?? "",
    }));
    expect(copiedCodeBlock.copiedText === "const value = 1;", "Preview copy code should copy the raw code contents.");
    expect(copiedCodeBlock.copyTitle === "Copied", "Preview copy code should acknowledge the copied state.");

    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText(
      [
        "---",
        "title: Preview Surface Brief",
        "description: Frontmatter should support the document without becoming noisy.",
        "status: Draft",
        "owner: Product",
        "---",
        "",
        "# Preview Surface Brief",
        "",
        "The rendered body should remain the focus.",
      ].join("\n"),
    );
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.waitForSelector(".frontmatter-view", { timeout: 5_000 });
    const previewFrontmatterSurface = await page.evaluate(() => {
      const frontmatter = document.querySelector(".frontmatter-view");
      const bodyHeading = document.querySelector(".preview-document-content h1");
      const firstBodyParagraph = document.querySelector(".preview-document-content p");
      if (
        !(frontmatter instanceof HTMLElement) ||
        !(bodyHeading instanceof HTMLElement) ||
        !(firstBodyParagraph instanceof HTMLElement)
      ) {
        return null;
      }
      const frontmatterStyle = window.getComputedStyle(frontmatter);
      return {
        hasVisibleHeading: Boolean(frontmatter.querySelector("h2")),
        text: frontmatter.textContent ?? "",
        background: frontmatterStyle.backgroundColor,
        borderRadius: frontmatterStyle.borderRadius,
        bodyHeadingText: bodyHeading.textContent ?? "",
        firstBodyText: firstBodyParagraph.textContent ?? "",
      };
    });
    expect(!previewFrontmatterSurface?.hasVisibleHeading, "Preview frontmatter should not show a redundant Metadata label.");
    expect(previewFrontmatterSurface?.text.includes("status"), "Preview frontmatter should show user-authored fields beyond title and description.");
    expect(previewFrontmatterSurface?.text.includes("Draft"), "Preview frontmatter should preserve user-authored status values.");
    expect(previewFrontmatterSurface?.text.includes("owner"), "Preview frontmatter should not hide user-authored metadata keys.");
    expect(!previewFrontmatterSurface?.text.includes("hidden fields"), "Preview frontmatter should not replace user content with hidden-field hints.");
    expect(!previewFrontmatterSurface?.text.includes("future commands"), "Preview frontmatter should not expose internal command language.");
    expect(previewFrontmatterSurface?.background === "rgb(247, 247, 248)", "Preview frontmatter should stay grouped as a quiet metadata block.");
    expect(previewFrontmatterSurface?.borderRadius !== "0px", "Preview frontmatter should keep the original grouped surface shape.");
    expect(previewFrontmatterSurface?.bodyHeadingText === "Preview Surface Brief", "Preview should render the authored H1 as Markdown.");
    expect(previewFrontmatterSurface?.firstBodyText === "The rendered body should remain the focus.", "Preview should keep body content after the authored H1.");

    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    const tinyPngDataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=";
    await page.keyboard.insertText(
      [
        "[External](https://example.com)",
        "",
        `![Tiny swatch](${tinyPngDataUrl} "Rendered image")`,
        "",
        "![Missing asset](missing-image.png)",
        "",
        "> Quoted context",
        ">",
        "> > Nested context",
        ">",
        "> - Nested quoted item",
        "",
        "- [x] Shipped",
        "- [ ] Follow up",
        "- Parent item",
        "  - Nested item",
        "",
        "| Name | Count |",
        "| :--- | ---: |",
        "| Alpha | 2 |",
      ].join("\n"),
    );
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.waitForSelector(".preview-surface table", { timeout: 5_000 });
    await page.waitForSelector(".preview-image-frame.broken .preview-image-fallback", { timeout: 5_000 });
    const previewGfm = await page.evaluate(() => {
      const link = document.querySelector('.preview-surface a[href="https://example.com"]');
      const quote = document.querySelector(".preview-surface blockquote");
      const nestedQuote = document.querySelector(".preview-surface blockquote blockquote");
      const tableWrap = document.querySelector(".preview-table-wrap");
      const rightAlignedCell = document.querySelector(".preview-surface tbody tr td:last-child");
      const image = document.querySelector(".preview-image");
      const imageFrame = document.querySelector(".preview-image-frame");
      const imageCaption = document.querySelector(".preview-image-caption");
      const brokenImage = document.querySelector(".preview-image-frame.broken .preview-image-fallback");
      const nestedList = document.querySelector(".preview-surface li ul");
      const quoteStyle = quote instanceof HTMLElement ? window.getComputedStyle(quote) : null;
      const nestedQuoteStyle = nestedQuote instanceof HTMLElement ? window.getComputedStyle(nestedQuote) : null;
      const tableWrapStyle = tableWrap instanceof HTMLElement ? window.getComputedStyle(tableWrap) : null;
      const rightAlignedStyle = rightAlignedCell instanceof HTMLElement ? window.getComputedStyle(rightAlignedCell) : null;
      const imageStyle = image instanceof HTMLElement ? window.getComputedStyle(image) : null;
      const nestedListStyle = nestedList instanceof HTMLElement ? window.getComputedStyle(nestedList) : null;
      return {
        linkTarget: link?.getAttribute("target") ?? "",
        linkRel: link?.getAttribute("rel") ?? "",
        quoteBorderLeftWidth: quoteStyle?.borderLeftWidth ?? "",
        quoteBackground: quoteStyle?.backgroundColor ?? "",
        nestedQuoteBorderLeftColor: nestedQuoteStyle?.borderLeftColor ?? "",
        taskCheckboxCount: document.querySelectorAll(".preview-task-checkbox").length,
        checkedTaskCheckboxCount: document.querySelectorAll('.preview-task-checkbox[data-checked="true"]').length,
        nativeTaskInputCount: document.querySelectorAll('.preview-surface input[type="checkbox"]').length,
        tableWrapRadius: tableWrapStyle?.borderRadius ?? "",
        tableWrapBorderWidth: tableWrapStyle?.borderTopWidth ?? "",
        tableWrapBackground: tableWrapStyle?.backgroundColor ?? "",
        rightAlignedTextAlign: rightAlignedStyle?.textAlign ?? "",
        imageFrameCount: document.querySelectorAll(".preview-image-frame").length,
        imageLoading: image?.getAttribute("loading") ?? "",
        imageMaxWidth: imageStyle?.maxWidth ?? "",
        imageRadius: imageStyle?.borderRadius ?? "",
        imageCaption: imageCaption?.textContent ?? "",
        brokenImageText: brokenImage?.textContent ?? "",
        nestedListMarginTop: nestedListStyle?.marginTop ?? "",
        imageFrameDisplay: imageFrame instanceof HTMLElement ? window.getComputedStyle(imageFrame).display : "",
      };
    });
    expect(previewGfm.linkTarget === "_blank", "External preview links should open outside the workspace.");
    expect(previewGfm.linkRel === "noreferrer", "External preview links should avoid leaking opener context.");
    expect(previewGfm.quoteBorderLeftWidth === "2px", "Preview blockquotes should use a quiet Markdown quote rule.");
    expect(previewGfm.quoteBackground === "rgba(0, 0, 0, 0)", "Preview blockquotes should not read as separate cards.");
    expect(previewGfm.nestedQuoteBorderLeftColor !== "", "Nested preview blockquotes should keep visible depth.");
    expect(previewGfm.taskCheckboxCount === 2, "Preview checklists should render consistent non-native check indicators.");
    expect(previewGfm.checkedTaskCheckboxCount === 1, "Preview checklists should preserve checked task state.");
    expect(previewGfm.nativeTaskInputCount === 0, "Preview checklists should not expose interactive native checkboxes.");
    expect(previewGfm.tableWrapRadius !== "0px", "Preview tables should sit in the document surface system.");
    expect(previewGfm.tableWrapBorderWidth === "1px", "Preview tables should use an explicit document boundary.");
    expect(previewGfm.tableWrapBackground === "rgb(255, 255, 255)", "Preview tables should not look like filled gray cards.");
    expect(previewGfm.rightAlignedTextAlign === "right", "Preview tables should preserve GFM column alignment.");
    expect(previewGfm.imageFrameCount === 2, "Preview images should render through the Tabula.md image frame.");
    expect(previewGfm.imageLoading === "lazy", "Preview images should lazy-load.");
    expect(previewGfm.imageMaxWidth === "100%", "Preview images should not overflow the document width.");
    expect(previewGfm.imageRadius !== "0px", "Preview images should use the document surface radius.");
    expect(previewGfm.imageCaption === "Rendered image", "Preview images should surface the image title as a caption.");
    expect(previewGfm.brokenImageText === "Missing asset", "Broken preview images should fall back to readable alt text.");
    expect(previewGfm.nestedListMarginTop !== "0px", "Nested preview lists should have deliberate vertical spacing.");
    expect(previewGfm.imageFrameDisplay === "grid", "Standalone preview images should render as block-like document media.");

    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.type("plain");
    await waitForRenderFrame(page);
    await page.keyboard.press("Shift+Home");
    await page.getByRole("button", { name: "Bold", exact: true }).click();
    await waitForRenderFrame(page);
    const beforeUndo = await page.locator(".cm-content").textContent();
    expect(beforeUndo === "**plain**", "Toolbar formatting should wrap selected text before undo smoke.");
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await waitForRenderFrame(page);
    const afterUndo = await page.locator(".cm-content").textContent();
    expect(afterUndo === "plain", "Undo should revert a formatting command in one step.");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await waitForRenderFrame(page);
    const afterRedo = await page.locator(".cm-content").textContent();
    expect(afterRedo === "**plain**", "Redo should restore a formatting command in one step.");

    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("alpha");
    await page.getByRole("button", { name: "Split", exact: true }).click();
    await waitForEditorReady(page, { mode: "split" });
    await focusMarkdownEditor(page);
    await page.keyboard.press("Shift+Home");
    await page.getByRole("button", { name: "Bold", exact: true }).click();
    await page.waitForSelector(".preview-surface strong", { timeout: 5_000 });
    await page.waitForSelector(".workspace.split .preview-line-action-icon", { timeout: 5_000 });
    await page.mouse.move(1, 1);
    await waitForRenderFrame(page);
    const splitFormatting = await page.evaluate(() => {
      const toolbar = document.querySelector(".markdown-formatting-toolbar");
      const toolbarRow = document.querySelector(".markdown-formatting-row");
      const controlRow = document.querySelector(".editor-control-row.with-formatting");
      const fileToolbar = document.querySelector(".file-toolbar");
      const editor = document.querySelector(".workspace.split .editor-surface");
      const preview = document.querySelector(".workspace.split .preview-surface");
      const editorGutter = document.querySelector(".workspace.split .cm-gutters");
      const editorContent = document.querySelector(".workspace.split .cm-content");
      const activeLine = document.querySelector(".workspace.split .cm-activeLine");
      const activeCommentGutterLine = document.querySelector(".workspace.split .cm-gutters-after .cm-activeLineGutter");
      const commentGutter = document.querySelector(".workspace.split .cm-commentGutter");
      const previewDocument = document.querySelector(".workspace.split .preview-document.with-line-gutters");
      const previewContent = document.querySelector(".workspace.split .preview-document-content");
      const previewBookmarkGutter = document.querySelector(".workspace.split .preview-line-gutter.bookmark");
      const previewCommentGutter = document.querySelector(".workspace.split .preview-line-gutter.comment");
      const previewLineActions = Array.from(document.querySelectorAll(".workspace.split .preview-line-action"));
      const previewParagraph = document.querySelector(".workspace.split .preview-surface p");
      const toolbarRect = toolbar?.getBoundingClientRect();
      const toolbarRowRect = toolbarRow?.getBoundingClientRect();
      const controlRowRect = controlRow?.getBoundingClientRect();
      const fileToolbarRect = fileToolbar?.getBoundingClientRect();
      const editorRect = editor?.getBoundingClientRect();
      const previewRect = preview?.getBoundingClientRect();
      const editorGutterRect = editorGutter?.getBoundingClientRect();
      const editorContentRect = editorContent?.getBoundingClientRect();
      const activeLineRect = activeLine?.getBoundingClientRect();
      const activeCommentGutterLineRect = activeCommentGutterLine?.getBoundingClientRect();
      const commentGutterRect = commentGutter?.getBoundingClientRect();
      const previewDocumentRect = previewDocument?.getBoundingClientRect();
      const previewContentRect = previewContent?.getBoundingClientRect();
      const previewBookmarkGutterRect = previewBookmarkGutter?.getBoundingClientRect();
      const previewCommentGutterRect = previewCommentGutter?.getBoundingClientRect();
      const previewParagraphRect = previewParagraph?.getBoundingClientRect();
      const activeLineStyle = activeLine ? window.getComputedStyle(activeLine) : null;
      const editorStyle = editor ? window.getComputedStyle(editor) : null;
      const previewStyle = preview ? window.getComputedStyle(preview) : null;
      const editorScrollbarRail = Number.parseFloat(editorStyle?.paddingRight ?? "0");
      return {
        editorText: document.querySelector(".cm-content")?.textContent ?? "",
        previewStrongText: document.querySelector(".preview-surface strong")?.textContent ?? "",
        toolbarRailIsSingleLine:
          Boolean(toolbarRect && fileToolbarRect) && Math.abs(toolbarRect.top - fileToolbarRect.top) <= 1,
        toolbarRailSeparatesLeftAndRight:
          Boolean(toolbarRect && fileToolbarRect && controlRowRect) &&
          toolbarRect.left >= controlRowRect.left &&
          fileToolbarRect.right <= controlRowRect.right + 1 &&
          toolbarRect.right < fileToolbarRect.left,
        toolbarRailUsesDocumentWidth:
          Boolean(controlRowRect && editorRect && previewRect) &&
          controlRowRect.width > editorRect.width &&
          controlRowRect.width > previewRect.width,
        splitEditorGutterKeepsPaneStart:
          Boolean(editorRect && editorGutterRect) && Math.abs(editorGutterRect.left - editorRect.left) <= 1,
        splitEditorContentFollowsGutter:
          Boolean(editorGutterRect && editorContentRect) && editorContentRect.left >= editorGutterRect.right - 1,
        splitPreviewContentBreathesFromDivider:
          Boolean(previewRect && previewParagraphRect) &&
          previewParagraphRect.left - previewRect.left >= 52 &&
          previewParagraphRect.left - previewRect.left <= 66,
        splitPreviewHasInset:
          Boolean(previewStyle) && Number.parseFloat(previewStyle.paddingLeft) >= 20,
        splitPreviewHasLineGutters:
          Boolean(previewDocumentRect && previewContentRect && previewBookmarkGutterRect && previewCommentGutterRect) &&
          Math.abs(previewBookmarkGutterRect.left - previewDocumentRect.left) <= 1 &&
          Math.abs(previewBookmarkGutterRect.right - previewContentRect.left) <= 1 &&
          Math.abs(previewCommentGutterRect.left - previewContentRect.right) <= 1 &&
          Math.abs(previewCommentGutterRect.right - previewDocumentRect.right) <= 1,
        splitPreviewInactiveGutterIconsHidden:
          previewLineActions.length > 0 &&
          previewLineActions.every((action) => {
            const icon = action.querySelector(".preview-line-action-icon");
            if (!(action instanceof HTMLElement) || !(icon instanceof SVGElement)) {
              return false;
            }

            const isActive =
              action.classList.contains("has-bookmark") ||
              action.classList.contains("has-comment") ||
              action.classList.contains("active");
            return isActive || window.getComputedStyle(icon).opacity === "0";
          }),
        splitReadableColumnsBalanced:
          Boolean(editorContentRect && previewParagraphRect) &&
          Math.abs(editorContentRect.width - previewParagraphRect.width) <= 24,
        splitActiveLineUsesSolidRow:
          Boolean(activeLineStyle) && activeLineStyle.backgroundImage === "none",
        splitActiveLineMeetsCommentGutter:
          Boolean(activeLineRect && activeCommentGutterLineRect) &&
          Math.abs(activeCommentGutterLineRect.left - activeLineRect.right) <= 1,
        splitCommentGutterClosesEditorFrame:
          Boolean(editorRect && commentGutterRect) && Math.abs(editorRect.right - editorScrollbarRail - commentGutterRect.right) <= 1,
      };
    });
    expect(splitFormatting.editorText === "**alpha**", "Split toolbar command should update editor Markdown source.");
    expect(splitFormatting.previewStrongText === "alpha", "Split preview should update immediately after toolbar formatting.");
    expect(splitFormatting.toolbarRailIsSingleLine, "Formatting and file tools should sit on one toolbar rail.");
    expect(splitFormatting.toolbarRailSeparatesLeftAndRight, "Toolbar rail should separate formatting tools left and file tools right.");
    expect(splitFormatting.toolbarRailUsesDocumentWidth, "Toolbar rail should span the document controls width, not just one pane.");
    expect(splitFormatting.splitEditorGutterKeepsPaneStart, "Split editor gutter should start at the editor pane edge.");
    expect(splitFormatting.splitEditorContentFollowsGutter, "Split editor content should start after the line number gutter.");
    expect(splitFormatting.splitPreviewContentBreathesFromDivider, "Split preview content should breathe away from the divider.");
    expect(splitFormatting.splitPreviewHasInset, "Split preview should carry pane-specific left inset.");
    expect(splitFormatting.splitPreviewHasLineGutters, "Split preview should reserve bookmark and comment gutters around content.");
    expect(splitFormatting.splitPreviewInactiveGutterIconsHidden, "Split preview gutter icons should stay hidden until active or hovered.");
    expect(splitFormatting.splitReadableColumnsBalanced, "Split should balance the editor text column with preview content width.");
    expect(splitFormatting.splitActiveLineUsesSolidRow, "Split active line should use one solid row background.");
    expect(splitFormatting.splitActiveLineMeetsCommentGutter, "Split active line should meet the right comment gutter without a seam.");
    expect(splitFormatting.splitCommentGutterClosesEditorFrame, "Split comment gutter should close the editor frame before the scrollbar rail.");

    const splitResizeInitial = await page.evaluate(() => {
      const handle = document.querySelector(".split-resize-handle");
      const editor = document.querySelector(".workspace.split .editor-surface");
      const preview = document.querySelector(".workspace.split .preview-surface");
      const handleRect = handle?.getBoundingClientRect();
      const editorRect = editor?.getBoundingClientRect();
      const previewRect = preview?.getBoundingClientRect();
      const handleStyle = handle instanceof HTMLElement ? window.getComputedStyle(handle) : null;
      const handleLineStyle = handle instanceof HTMLElement ? window.getComputedStyle(handle, "::before") : null;
      const editorStyle = editor instanceof HTMLElement ? window.getComputedStyle(editor) : null;
      const previewStyle = preview instanceof HTMLElement ? window.getComputedStyle(preview) : null;

      return {
        handle: handleRect
          ? {
              x: handleRect.x,
              y: handleRect.y,
              width: handleRect.width,
              height: handleRect.height,
            }
          : null,
        editorWidth: editorRect?.width ?? 0,
        previewWidth: previewRect?.width ?? 0,
        cursor: handleStyle?.cursor ?? "",
        lineOpacity: handleLineStyle?.opacity ?? "",
        lineWidth: handleLineStyle?.width ?? "",
        editorScrollbarGutter: editorStyle?.scrollbarGutter ?? "",
        previewScrollbarGutter: previewStyle?.scrollbarGutter ?? "",
        editorPaddingRight: Number.parseFloat(editorStyle?.paddingRight ?? "0"),
        previewPaddingRight: Number.parseFloat(previewStyle?.paddingRight ?? "0"),
      };
    });
    expect(splitResizeInitial.handle && splitResizeInitial.handle.width >= 24, "Split should expose a generous magnetic resize hit area.");
    expect(splitResizeInitial.cursor === "col-resize", "Split resize handle should use the horizontal resize cursor.");
    expect(splitResizeInitial.lineOpacity === "0", "Split divider line should be hidden by default.");
    expect(splitResizeInitial.lineWidth === "1px", "Split divider should be a thin line when revealed.");
    expect(
      splitResizeInitial.editorScrollbarGutter === "stable" && splitResizeInitial.previewScrollbarGutter === "stable",
      "Split editor and preview panes should reserve stable scrollbar rails.",
    );
    expect(
      splitResizeInitial.editorPaddingRight >= 12 && splitResizeInitial.previewPaddingRight >= 12,
      "Split editor and preview panes should reserve a dedicated scrollbar rail.",
    );

    await page.mouse.move(
      splitResizeInitial.handle.x + splitResizeInitial.handle.width / 2,
      splitResizeInitial.handle.y + splitResizeInitial.handle.height / 2,
    );
    await page.waitForFunction(() => {
      const handle = document.querySelector(".split-resize-handle");
      return handle instanceof HTMLElement && window.getComputedStyle(handle, "::before").opacity === "1";
    });
    const splitResizeHover = await page.evaluate(() => {
      const handle = document.querySelector(".split-resize-handle");
      return handle instanceof HTMLElement ? window.getComputedStyle(handle, "::before").opacity : "";
    });
    expect(splitResizeHover === "1", "Split divider line should reveal when the pointer nears the divider.");

    await page.mouse.down();
    await page.mouse.move(
      splitResizeInitial.handle.x + splitResizeInitial.handle.width / 2 + 120,
      splitResizeInitial.handle.y + splitResizeInitial.handle.height / 2,
      { steps: 8 },
    );
    await page.mouse.up();
    await waitForRenderFrame(page);
    const splitResizeAfterDrag = await page.evaluate(() => {
      const handle = document.querySelector(".split-resize-handle");
      const editor = document.querySelector(".workspace.split .editor-surface");
      const preview = document.querySelector(".workspace.split .preview-surface");
      return {
        editorWidth: editor?.getBoundingClientRect().width ?? 0,
        previewWidth: preview?.getBoundingClientRect().width ?? 0,
        valueNow: handle?.getAttribute("aria-valuenow") ?? "",
      };
    });
    expect(
      splitResizeAfterDrag.editorWidth > splitResizeInitial.editorWidth + 40 &&
        splitResizeAfterDrag.previewWidth < splitResizeInitial.previewWidth - 40,
      "Dragging the split divider should resize the editor and preview panes.",
    );
    expect(Number(splitResizeAfterDrag.valueNow) > 50, "Split divider aria value should reflect the adjusted editor width.");

    const splitResizeAfterDragHandle = await page.evaluate(() => {
      const handle = document.querySelector(".split-resize-handle");
      const rect = handle?.getBoundingClientRect();
      return rect
        ? {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          }
        : null;
    });
    expect(Boolean(splitResizeAfterDragHandle), "Split resize handle should remain available after resizing.");
    await page.mouse.move(
      splitResizeAfterDragHandle.x + splitResizeAfterDragHandle.width / 2,
      splitResizeAfterDragHandle.y + splitResizeAfterDragHandle.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      splitResizeInitial.handle.x + splitResizeInitial.handle.width / 2 + 4,
      splitResizeInitial.handle.y + splitResizeInitial.handle.height / 2,
      { steps: 8 },
    );
    await page.mouse.up();
    await waitForRenderFrame(page);
    const splitResizeAfterSnap = await page.evaluate(() => {
      const handle = document.querySelector(".split-resize-handle");
      const editor = document.querySelector(".workspace.split .editor-surface");
      const preview = document.querySelector(".workspace.split .preview-surface");
      return {
        editorWidth: editor?.getBoundingClientRect().width ?? 0,
        previewWidth: preview?.getBoundingClientRect().width ?? 0,
        valueNow: handle?.getAttribute("aria-valuenow") ?? "",
      };
    });
    expect(
      Number(splitResizeAfterSnap.valueNow) === 50 &&
        Math.abs(splitResizeAfterSnap.editorWidth - splitResizeInitial.editorWidth) <= 8 &&
        Math.abs(splitResizeAfterSnap.previewWidth - splitResizeInitial.previewWidth) <= 8,
      "Dragging near the center should magnetically snap split panes back to 50/50.",
    );

    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    const longMarkdown = Array.from({ length: 80 }, (_, index) => `## Section ${index + 1}\n\nBody ${index + 1}`).join("\n\n");
    await page.keyboard.insertText(longMarkdown);
    await waitForRenderFrame(page);
    const splitScrollPrepared = await page.evaluate(() => {
      const editor = document.querySelector(".workspace.split .editor-surface");
      const preview = document.querySelector(".workspace.split .preview-surface");
      if (!(editor instanceof HTMLElement) || !(preview instanceof HTMLElement)) {
        return null;
      }

      const getRatio = (element) => {
        const maxScrollTop = element.scrollHeight - element.clientHeight;
        return maxScrollTop <= 0 ? 0 : element.scrollTop / maxScrollTop;
      };
      const maxEditorScrollTop = editor.scrollHeight - editor.clientHeight;
      if (maxEditorScrollTop <= 1 || preview.scrollHeight - preview.clientHeight <= 1) {
        return {
          scrollable: false,
          editorRatio: getRatio(editor),
          previewRatio: getRatio(preview),
        };
      }

      editor.scrollTop = maxEditorScrollTop * 0.55;
      editor.dispatchEvent(new Event("scroll", { bubbles: true }));
      return {
        scrollable: true,
        editorRatio: getRatio(editor),
        previewRatio: getRatio(preview),
      };
    });
    expect(splitScrollPrepared?.scrollable, "Split editor and preview should be scrollable for toolbar-height scroll smoke.");
    await page.waitForFunction(
      ({ tolerance }) => {
        const editor = document.querySelector(".workspace.split .editor-surface");
        const preview = document.querySelector(".workspace.split .preview-surface");
        if (!(editor instanceof HTMLElement) || !(preview instanceof HTMLElement)) {
          return false;
        }

        const getRatio = (element) => {
          const maxScrollTop = element.scrollHeight - element.clientHeight;
          return maxScrollTop <= 0 ? 0 : element.scrollTop / maxScrollTop;
        };

        return Math.abs(getRatio(preview) - getRatio(editor)) < tolerance;
      },
      { tolerance: 0.12 },
    );
    const splitScrollSync = await page.evaluate(() => {
      const editor = document.querySelector(".workspace.split .editor-surface");
      const preview = document.querySelector(".workspace.split .preview-surface");
      if (!(editor instanceof HTMLElement) || !(preview instanceof HTMLElement)) {
        return null;
      }

      const getRatio = (element) => {
        const maxScrollTop = element.scrollHeight - element.clientHeight;
        return maxScrollTop <= 0 ? 0 : element.scrollTop / maxScrollTop;
      };

      return {
        scrollable: editor.scrollHeight - editor.clientHeight > 1 && preview.scrollHeight - preview.clientHeight > 1,
        editorRatio: getRatio(editor),
        previewRatio: getRatio(preview),
      };
    });
    expect(splitScrollSync?.scrollable, "Split editor and preview should be scrollable for toolbar-height scroll smoke.");
    expect(
      Math.abs(splitScrollSync.previewRatio - splitScrollSync.editorRatio) < 0.12,
      "Split scroll sync should still work with the formatting toolbar row present.",
    );

    const readDocumentControlAlignment = async () =>
      page.evaluate(() => {
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
            background: style.backgroundColor,
          };
        };

        const workspace = document.querySelector(".workspace");
        const workspaceStyle = workspace ? window.getComputedStyle(workspace) : null;
        const body =
          workspace?.classList.contains("split") && workspaceStyle?.display !== "block"
            ? readRect(".workspace.split")
            : readRect(".workspace.split .editor-surface") ??
              readRect(".workspace.preview .preview-surface") ??
              readRect(".workspace.edit .editor-surface");
        const rail = readRect(".editor-control-row");
        const fileToolbar = readRect(".file-toolbar");
        const formattingToolbar = readRect(".markdown-formatting-toolbar");
        const status = readRect(".file-status-bar");
        if (!body || !rail || !fileToolbar || !status) {
          return null;
        }
        return {
          body,
          rail,
          fileToolbar,
          formattingToolbar,
          status,
        };
      });

    const splitAlignment = await readDocumentControlAlignment();
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });
    const previewAlignment = await readDocumentControlAlignment();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    const writeAlignment = await readDocumentControlAlignment();

    for (const [name, alignment] of Object.entries({ splitAlignment, previewAlignment, writeAlignment })) {
      expect(alignment, `${name} should be measurable while switching document modes.`);
      expect(
        Math.abs(alignment.rail.x - alignment.body.x) <= 1 &&
          Math.abs(alignment.rail.width - alignment.body.width) <= 1,
        `${name} toolbar rail should follow the active document body width.`,
      );
      expect(
        Math.abs(alignment.status.x - alignment.body.x) <= 1 &&
          Math.abs(alignment.status.width - alignment.body.width) <= 1,
        `${name} status bar should follow the active document body width.`,
      );
    }
    expect(
      splitAlignment.rail.height === previewAlignment.rail.height && previewAlignment.rail.height === writeAlignment.rail.height,
      "Switching Edit, Preview, and Split should keep the toolbar rail height consistent.",
    );
    expect(
      splitAlignment.rail.background === "rgba(0, 0, 0, 0)" &&
        previewAlignment.rail.background === "rgba(0, 0, 0, 0)" &&
        writeAlignment.rail.background === "rgba(0, 0, 0, 0)",
      "The toolbar rail row should stay transparent in Edit, Preview, and Split.",
    );
    expect(
      splitAlignment.fileToolbar.height === previewAlignment.fileToolbar.height &&
        previewAlignment.fileToolbar.height === writeAlignment.fileToolbar.height &&
        previewAlignment.fileToolbar.height === 34,
      "The visible file toolbar surface should keep the same 34px background height in every document mode.",
    );
    expect(
      splitAlignment.fileToolbar.background === previewAlignment.fileToolbar.background &&
        previewAlignment.fileToolbar.background === writeAlignment.fileToolbar.background &&
        previewAlignment.fileToolbar.background !== "rgba(0, 0, 0, 0)",
      "The visible file toolbar surface should carry the same background in Edit, Preview, and Split.",
    );
    expect(
      splitAlignment.formattingToolbar?.height === 34 &&
        writeAlignment.formattingToolbar?.height === 34 &&
        splitAlignment.formattingToolbar?.background === splitAlignment.fileToolbar.background &&
        writeAlignment.formattingToolbar?.background === writeAlignment.fileToolbar.background,
      "Edit and Split formatting toolbars should use the same 34px surface as the file toolbar.",
    );

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.locator('button[title="Editor controls"]').click();
    const previewToolbarState = await page.evaluate(() => ({
      formattingToolbarCount: document.querySelectorAll(".markdown-formatting-toolbar").length,
      editorControlsText: document.querySelector('.file-tool-popover[aria-label="Editor controls"]')?.textContent ?? "",
    }));
    expect(previewToolbarState.formattingToolbarCount === 0, "Preview mode should hide Markdown formatting tools.");
    expect(
      !previewToolbarState.editorControlsText.includes("Line Wrapping"),
      "Preview mode should hide edit-only line wrapping controls.",
    );
  });

  await withPage(browser, "/", async (page) => {
    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText("a\n\nmuch longer selected line\nb");
    const lineMetricsBeforeSelection = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".cm-line")).map((line) => {
        const rect = line.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          height: Math.round(rect.height),
        };
      }),
    );
    await page.keyboard.press("ControlOrMeta+A");
    await waitForSelectionLayer(page, { minSegments: 4 });

    const selectionSurfaceState = await page.evaluate(() => {
      const activeLine = document.querySelector(".cm-activeLine");
      const activeGutter = document.querySelector(".cm-activeLineGutter");
      const selectionBackground = document.querySelector(".cm-selectionBackground");
      const segments = Array.from(document.querySelectorAll(".cm-user-selection-segment"));
      const textSegments = segments.filter((segment) => !segment.classList.contains("cm-user-selection-bridge"));
      const lines = Array.from(document.querySelectorAll(".cm-line"));
      const maxLineWidth = Math.max(...lines.map((line) => line.getBoundingClientRect().width));
      const segmentRects = textSegments.map((segment) => {
        const rect = segment.getBoundingClientRect();
        const style = getComputedStyle(segment);
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          background: style.backgroundColor,
          className: segment.className,
          topLeftRadius: style.borderTopLeftRadius,
          bottomLeftRadius: style.borderBottomLeftRadius,
          topRightRadius: style.borderTopRightRadius,
          bottomRightRadius: style.borderBottomRightRadius,
        };
      });
      const lineMetricsAfterSelection = Array.from(document.querySelectorAll(".cm-line")).map((line) => {
        const rect = line.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          height: Math.round(rect.height),
        };
      });
      const exposedMiddleLineSegment = segmentRects.find((segment) => segment.width > 180);

      return {
        hasSelectionClass: Boolean(document.querySelector(".editor-surface.has-text-selection")),
        activeLineBackground: activeLine instanceof HTMLElement ? getComputedStyle(activeLine).backgroundColor : "",
        activeGutterBackground: activeGutter instanceof HTMLElement ? getComputedStyle(activeGutter).backgroundColor : "",
        selectionBackground:
          selectionBackground instanceof HTMLElement ? getComputedStyle(selectionBackground).backgroundColor : "",
        statusText: document.querySelector(".status-cursor-position")?.textContent?.trim() ?? "",
        segmentCount: textSegments.length,
        bridgeSegmentCount: segments.filter((segment) => segment.classList.contains("cm-user-selection-bridge")).length,
        emptySegmentCount: textSegments.filter((segment) => segment.classList.contains("cm-user-selection-empty")).length,
        segmentRects,
        exposedMiddleLineSegment,
        lineMetricsAfterSelection,
        maxLineWidth: Math.round(maxLineWidth),
      };
    });
    expect(
      JSON.stringify(selectionSurfaceState.lineMetricsAfterSelection) === JSON.stringify(lineMetricsBeforeSelection),
      "Text selection highlights should not change editor line positions or heights.",
    );
    expect(selectionSurfaceState.hasSelectionClass, "Editor surface should enter selected-text mode.");
    expect(
      selectionSurfaceState.activeLineBackground === "rgba(0, 0, 0, 0)" &&
        selectionSurfaceState.activeGutterBackground === "rgba(0, 0, 0, 0)",
      "Text selection should suppress active-line focus styling.",
    );
    expect(
      !selectionSurfaceState.selectionBackground || selectionSurfaceState.selectionBackground === "rgba(0, 0, 0, 0)",
      "Default full-line selection rectangles should not be visible.",
    );
    expect(selectionSurfaceState.segmentCount === 4, "Text selection should render one segment per selected line.");
    expect(selectionSurfaceState.bridgeSegmentCount > 0, "Text selection should render bridge segments between connected rows.");
    expect(
      selectionSurfaceState.segmentRects.every(
        (segment) =>
          segment.background === "rgb(228, 217, 244)" &&
          segment.width > 0 &&
          segment.width < selectionSurfaceState.maxLineWidth,
      ),
      "Selection segments should wrap selected text with the Tabula purple selection color.",
    );
    expect(selectionSurfaceState.emptySegmentCount === 1, "Text selection should cover selected empty lines.");
    expect(
      selectionSurfaceState.segmentRects.some(
        (segment) => segment.className.includes("selection-square-top-left") && segment.topLeftRadius === "0px",
      ) &&
        selectionSurfaceState.segmentRects.some(
          (segment) => segment.className.includes("selection-square-bottom-left") && segment.bottomLeftRadius === "0px",
        ),
      "Consecutive selected lines should share adjacent edges instead of rendering as fully separate rounded islands.",
    );
    expect(
      selectionSurfaceState.exposedMiddleLineSegment?.topRightRadius === "4px" &&
        selectionSurfaceState.exposedMiddleLineSegment?.bottomRightRadius === "4px",
      "A multi-line selection should keep exposed line ends rounded.",
    );
    expect(
      selectionSurfaceState.statusText.includes("(4 lines,"),
      "Status bar should include line count and character count for multi-line selections.",
    );

    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    const longWrappedLine = Array.from({ length: 42 }, (_, index) => `wrapped-${index + 1}`).join(" ");
    await page.keyboard.insertText(`top\n${longWrappedLine}\nbottom`);
    const wrappedLineMetricsBeforeSelection = await page.evaluate(() =>
      Array.from(document.querySelectorAll(".cm-line")).map((line) => {
        const rect = line.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          height: Math.round(rect.height),
        };
      }),
    );
    await page.keyboard.press("ControlOrMeta+A");
    await waitForSelectionLayer(page, { minSegments: 3 });
    const wrappedSelectionSurfaceState = await page.evaluate(() => {
      const segments = Array.from(document.querySelectorAll(".cm-user-selection-segment"));
      const textSegments = segments.filter((segment) => !segment.classList.contains("cm-user-selection-bridge"));
      const bridgeSegments = segments.filter((segment) => segment.classList.contains("cm-user-selection-bridge"));
      const lines = Array.from(document.querySelectorAll(".cm-line"));
      const lineRects = lines.map((line) => {
        const rect = line.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          height: Math.round(rect.height),
        };
      });
      const segmentRects = textSegments
        .map((segment) => {
          const rect = segment.getBoundingClientRect();
          const style = getComputedStyle(segment);
          return {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            className: segment.className,
            topLeftRadius: style.borderTopLeftRadius,
            bottomLeftRadius: style.borderBottomLeftRadius,
          };
        })
        .sort((first, second) => first.top - second.top || first.left - second.left);
      const visualRowCount = new Set(segmentRects.map((segment) => segment.top)).size;
      const noTextSegmentVerticalOverlap = segmentRects.every((segment, index) => {
        const nextSegment = segmentRects[index + 1];
        if (!nextSegment || nextSegment.top === segment.top) {
          return true;
        }

        return nextSegment.top >= segment.bottom - 1;
      });
      const connectedWrappedRows = segmentRects.some((segment, index) => {
        const nextSegment = segmentRects[index + 1];
        if (!nextSegment) {
          return false;
        }

        return (
          Math.abs(segment.left - nextSegment.left) <= 2 &&
          nextSegment.top > segment.top &&
          nextSegment.top - segment.top <= Math.max(segment.height, nextSegment.height) * 1.6 &&
          segment.bottomLeftRadius === "0px" &&
          nextSegment.topLeftRadius === "0px"
        );
      });

      return {
        logicalLineCount: lines.length,
        visualRowCount,
        bridgeSegmentCount: bridgeSegments.length,
        segmentCount: segmentRects.length,
        emptySegmentCount: textSegments.filter((segment) => segment.classList.contains("cm-user-selection-empty")).length,
        wrappedLineIsTallerThanSingleRow: lineRects[1]?.height > (lineRects[0]?.height ?? 0) * 1.5,
        noTextSegmentVerticalOverlap,
        connectedWrappedRows,
        lineMetricsAfterSelection: lineRects,
      };
    });
    expect(
      JSON.stringify(wrappedSelectionSurfaceState.lineMetricsAfterSelection) ===
        JSON.stringify(wrappedLineMetricsBeforeSelection),
      "Wrapped text selection highlights should not change editor line positions or heights.",
    );
    expect(wrappedSelectionSurfaceState.wrappedLineIsTallerThanSingleRow, "Smoke document should contain a wrapped logical line.");
    expect(
      wrappedSelectionSurfaceState.visualRowCount > wrappedSelectionSurfaceState.logicalLineCount,
      "A wrapped logical line should render selection by visual rows.",
    );
    expect(wrappedSelectionSurfaceState.segmentCount >= wrappedSelectionSurfaceState.visualRowCount, "Every visual row should receive a selection segment.");
    expect(wrappedSelectionSurfaceState.bridgeSegmentCount > 0, "Wrapped visual rows should receive bridge segments.");
    expect(wrappedSelectionSurfaceState.noTextSegmentVerticalOverlap, "Wrapped text selection segments should not overlap each other.");
    expect(wrappedSelectionSurfaceState.emptySegmentCount === 0, "Wrapped lines should not create fake empty-line connector segments.");
    expect(wrappedSelectionSurfaceState.connectedWrappedRows, "Wrapped visual rows should share adjacent selection edges.");
  });

  await withPage(browser, "/", async (page) => {
    await openProjectMenu(page);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });

    const readLeftPanelModeLayout = () => {
      const readRect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          x: Math.round(rect.x),
          width: Math.round(rect.width),
          display: style.display,
        };
      };
      const readContentRect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) {
          return null;
        }
        const rect = element.getBoundingClientRect();
        return {
          x: Math.round(rect.x),
          width: Math.round(rect.width),
        };
      };

      return {
        workspaceClass: document.querySelector(".workspace")?.className ?? "",
        body:
          readRect(".workspace.split") ??
          readRect(".workspace.edit .editor-surface") ??
          readRect(".workspace.preview .preview-surface"),
        editor: readRect(".workspace.split .editor-surface") ?? readRect(".workspace.edit .editor-surface"),
        preview: readRect(".workspace.split .preview-surface") ?? readRect(".workspace.preview .preview-surface"),
        editorContent: readContentRect(".workspace.split .cm-content"),
        previewContent: readContentRect(".workspace.split .preview-surface p"),
        rail: readRect(".editor-control-row"),
        status: readRect(".file-status-bar"),
      };
    };

    const leftWriteLayout = await page.evaluate(readLeftPanelModeLayout);
    await page.getByRole("button", { name: "Split", exact: true }).click();
    await waitForEditorReady(page, { mode: "split" });
    const leftSplitLayout = await page.evaluate(readLeftPanelModeLayout);

    for (const [name, layout] of Object.entries({ leftWriteLayout, leftSplitLayout })) {
      expect(layout.body && layout.rail && layout.status, `${name} should expose document body chrome.`);
      expect(
        Math.abs(layout.body.x - layout.rail.x) <= 1 &&
          Math.abs(layout.body.width - layout.rail.width) <= 1 &&
          Math.abs(layout.status.x - layout.rail.x) <= 1 &&
          Math.abs(layout.status.width - layout.rail.width) <= 1,
        `${name} rail and status should align to the document lane.`,
      );
    }
    expect(
      leftSplitLayout.workspaceClass.includes("split") &&
        leftSplitLayout.body.display === "grid" &&
        Math.abs(leftSplitLayout.body.x - leftWriteLayout.body.x) <= 1 &&
        Math.abs(leftSplitLayout.body.width - leftWriteLayout.body.width) <= 1,
      "Opening the workspace menu should not move or stack the document when switching Edit to Split.",
    );
    expect(
      leftSplitLayout.editor &&
        leftSplitLayout.preview &&
        leftSplitLayout.editor.width > leftSplitLayout.preview.width &&
        Math.abs(leftSplitLayout.editor.width + leftSplitLayout.preview.width - leftWriteLayout.body.width) <= 1,
      "Split should keep one document lane while giving the editor pane rail-aware width.",
    );
    expect(
      leftSplitLayout.editorContent &&
        leftSplitLayout.previewContent &&
        Math.abs(leftSplitLayout.editorContent.width - leftSplitLayout.previewContent.width) <= 24,
      "Split should balance the editable text column with the rendered preview content column.",
    );
  });

  await withPage(
    browser,
    "/",
    async (page) => {
      await page.getByTitle("New tab").click();
      await waitForEditorReady(page, { mode: "edit" });
      const mobileToolbar = await page.evaluate(() => {
        const toolbar = document.querySelector(".markdown-formatting-toolbar");
        const row = document.querySelector(".markdown-formatting-row");
        const buttons = Array.from(document.querySelectorAll(".markdown-format-button"));
        const toolbarRect = toolbar?.getBoundingClientRect();
        const rowRect = row?.getBoundingClientRect();
        const buttonRects = buttons.map((button) => {
          const rect = button.getBoundingClientRect();
          return {
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          };
        });
        return {
          toolbarVisible: Boolean(toolbar && toolbarRect && toolbarRect.width > 0 && toolbarRect.height > 0),
          toolbarOverflowX: toolbar ? window.getComputedStyle(toolbar).overflowX : "",
          rowLeft: Math.round(rowRect?.left ?? -1),
          rowRight: Math.round(rowRect?.right ?? -1),
          viewportWidth: window.innerWidth,
          buttonCount: buttons.length,
          buttonRects,
        };
      });
      expect(mobileToolbar.toolbarVisible, "Formatting toolbar should remain visible on mobile edit screens.");
      expect(mobileToolbar.buttonCount === 13, "Mobile formatting toolbar should keep the core command set.");
      expect(mobileToolbar.toolbarOverflowX === "auto", "Mobile formatting toolbar should allow horizontal overflow.");
      expect(mobileToolbar.rowLeft >= 16, "Mobile formatting toolbar should keep page-edge padding.");
      expect(
        mobileToolbar.rowRight <= mobileToolbar.viewportWidth - 16,
        "Mobile formatting toolbar should not exceed the viewport.",
      );
      expect(
        mobileToolbar.buttonRects.every((rect) => rect.width === 28 && rect.height === 28),
        "Mobile formatting toolbar buttons should keep stable icon-button dimensions.",
      );
      expect(
        mobileToolbar.buttonRects.every((rect, index, rects) => index === 0 || rect.left >= rects[index - 1].right),
        "Mobile formatting toolbar buttons should not overlap.",
      );
    },
    { viewport: { width: 390, height: 800 } },
  );

  await withPage(browser, "/", async (page) => {
    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText(["x", "---", "###", "=>", "===", "___"].join("\n"));
    await waitForRenderFrame(page);
    const sourceTokenRendering = await page.evaluate(() => {
      const measureLineText = (line) => {
        const clone = line.cloneNode(true);
        if (!(clone instanceof HTMLElement)) {
          return 0;
        }

        clone.querySelectorAll(".cm-line-comment-action, .cm-widgetBuffer").forEach((element) => element.remove());
        clone.style.position = "absolute";
        clone.style.left = "-10000px";
        clone.style.top = "0";
        clone.style.width = "auto";
        clone.style.padding = "0";
        clone.style.whiteSpace = "pre";
        line.parentElement?.append(clone);
        const range = document.createRange();
        range.selectNodeContents(clone);
        const width = range.getBoundingClientRect().width;
        range.detach();
        clone.remove();
        return width;
      };
      const lines = Array.from(document.querySelectorAll(".cm-line")).slice(0, 6);
      const style = window.getComputedStyle(lines[1] ?? document.body);
      const lineMetrics = lines.map((line) => ({
        text: line.textContent ?? "",
        width: measureLineText(line),
      }));
      return {
        fontFeatureSettings: style.fontFeatureSettings,
        fontVariantLigatures: style.fontVariantLigatures,
        lineMetrics,
      };
    });
    const charWidth = sourceTokenRendering.lineMetrics[0]?.width ?? 0;
    expect(charWidth > 0, "Source token smoke should measure a single editor character.");
    expect(
      sourceTokenRendering.fontVariantLigatures === "none",
      "Markdown source editor should disable font ligatures.",
    );
    expect(
      sourceTokenRendering.fontFeatureSettings.includes('"liga" 0') &&
        sourceTokenRendering.fontFeatureSettings.includes('"calt" 0'),
      "Markdown source editor should disable font alternate features that collapse Markdown syntax.",
    );
    for (const metric of sourceTokenRendering.lineMetrics.slice(1)) {
      expect(metric.text.length > 0, "Source token smoke should read editor token text.");
      expect(
        metric.width >= charWidth * metric.text.length * 0.85,
        `${metric.text} should render close to its literal source width, not as a collapsed ligature.`,
      );
    }
  });

  await withPage(browser, "/", async (page) => {
    const replaceEditorText = async (text) => {
      await focusMarkdownEditor(page);
      await page.keyboard.press("ControlOrMeta+A");
      await page.keyboard.press("Backspace");
      await page.keyboard.insertText(text);
    };
    const readEditorText = () =>
      page.$$eval(".cm-line", (lines) =>
        lines
          .map((line) => {
            const clone = line.cloneNode(true);
            if (!(clone instanceof HTMLElement)) {
              return line.textContent ?? "";
            }
            clone.querySelectorAll(".cm-placeholder, .cm-widgetBuffer").forEach((element) => element.remove());
            return clone.textContent ?? "";
          })
          .join("\n"),
      );

    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await replaceEditorText("- item");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("next");
    expect((await readEditorText()) === "- item\n- next", "Enter should continue bullet list markers.");

    await replaceEditorText("1. item");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("next");
    expect((await readEditorText()) === "1. item\n2. next", "Enter should continue numbered list markers.");

    await replaceEditorText("- [x] done");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("next");
    expect((await readEditorText()) === "- [x] done\n- [ ] next", "Enter should continue checklists as unchecked items.");

    await replaceEditorText("> quote");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("next");
    expect((await readEditorText()) === "> quote\n> next", "Enter should continue blockquotes.");

    await replaceEditorText("- ");
    await page.keyboard.press("Enter");
    expect((await readEditorText()) === "", "Enter on an empty list item should remove the marker.");

    await replaceEditorText("- item");
    await page.keyboard.press("Tab");
    expect((await readEditorText()) === "  - item", "Tab should indent the current Markdown list item.");
    await page.keyboard.press("Shift+Tab");
    expect((await readEditorText()) === "- item", "Shift+Tab should outdent the current Markdown list item.");

    await replaceEditorText("- one\n- two");
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Tab");
    expect((await readEditorText()) === "  - one\n  - two", "Tab should indent selected Markdown list items.");
    await page.keyboard.press("Shift+Tab");
    expect((await readEditorText()) === "- one\n- two", "Shift+Tab should outdent selected Markdown list items.");
  });

  await withPage(browser, "/", async (page) => {
    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.type("Alpha target omega");
    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press("ArrowLeft");
    }
    for (let index = 0; index < 6; index += 1) {
      await page.keyboard.press("Shift+ArrowLeft");
    }
    await waitForSelectionLayer(page, { minSegments: 1 });

    await page.getByRole("button", { name: "Italic", exact: true }).click();
    await waitForSelectionLayer(page, { minSegments: 1 });
    const selectionAfterToolbarFormat = await page.evaluate(() => ({
      editorText: document.querySelector(".cm-content")?.textContent ?? "",
      selectedText: document.getSelection()?.toString() ?? "",
      cursorPosition: document.querySelector(".status-cursor-position")?.textContent?.trim() ?? "",
      addSelectionCommentVisible: Boolean(document.querySelector(".selection-comment-button")),
      editorFocused: Boolean(document.querySelector(".markdown-editor")?.contains(document.activeElement)),
    }));
    expect(
      selectionAfterToolbarFormat.editorText === "Alpha _target_ omega",
      "Formatting a selection from the toolbar should update the Markdown source.",
    );
    expect(
      selectionAfterToolbarFormat.cursorPosition.includes("(6 characters)"),
      "Toolbar formatting should keep the selected text available for comment creation.",
    );
    expect(
      selectionAfterToolbarFormat.addSelectionCommentVisible,
      "Toolbar formatting should not remove the inline action for adding a selection comment.",
    );
    expect(selectionAfterToolbarFormat.editorFocused, "Toolbar formatting should return focus to the Markdown editor.");

    await page.locator(".selection-comment-button").click();
    await waitForRenderFrame(page);
    await page.locator(".right-comment-input").fill("Review target");
    await page.locator(".right-comment-form .right-comment-submit").click();
    await waitForRenderFrame(page);
    const commentAfterCreate = await page.evaluate(() => ({
      markCount: document.querySelectorAll(".cm-comment-mark").length,
      activeMarkCount: document.querySelectorAll(".cm-comment-mark.active").length,
      markText: document.querySelector(".cm-comment-mark")?.textContent ?? "",
      quoteText: document.querySelector(".right-comment-quote")?.textContent ?? "",
      cardCount: document.querySelectorAll(".right-comment-card").length,
      panelTab: document.querySelector(".right-panel-tab.active")?.getAttribute("aria-label") ?? "",
    }));
    expect(commentAfterCreate.markCount === 1, "Creating a selection comment should render one editor comment mark.");
    expect(commentAfterCreate.activeMarkCount === 1, "The newly created selection comment should activate its editor mark.");
    expect(commentAfterCreate.markText === "target", "The editor comment mark should wrap the selected quote.");
    expect(commentAfterCreate.quoteText === "target", "The comment panel should preserve the selected quote.");
    expect(commentAfterCreate.cardCount === 1, "The comment panel should show the created comment.");
    expect(commentAfterCreate.panelTab === "Comments", "Creating a selection comment should open the Comments panel.");

    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+A");
    await page.getByRole("button", { name: "Bold", exact: true }).click();
    await waitForRenderFrame(page);
    const commentAfterOffsetShift = await page.evaluate(() => ({
      editorText: document.querySelector(".cm-content")?.textContent ?? "",
      markCount: document.querySelectorAll(".cm-comment-mark").length,
      activeMarkCount: document.querySelectorAll(".cm-comment-mark.active").length,
      markText: document.querySelector(".cm-comment-mark")?.textContent ?? "",
      cursorPosition: document.querySelector(".status-cursor-position")?.textContent?.trim() ?? "",
    }));
    expect(
      commentAfterOffsetShift.editorText === "**Alpha _target_ omega**",
      "Formatting surrounding text should wrap the Markdown source.",
    );
    expect(
      commentAfterOffsetShift.markCount === 1 && commentAfterOffsetShift.markText === "target",
      "Comment anchors should survive formatting that shifts their stored offsets.",
    );
    expect(commentAfterOffsetShift.activeMarkCount === 1, "Comment anchors should keep active focus after text edits.");
    expect(
      commentAfterOffsetShift.cursorPosition.includes("characters"),
      "Formatting command selection should continue to update the cursor selection state.",
    );

    await closeProjectContext(page);
    expect((await page.locator(".right-panel").count()) === 0, "The right panel should close before comment-mark click smoke.");
    const commentMarkPoint = await page.evaluate(() => {
      const mark = document.querySelector(".cm-comment-mark");
      if (!(mark instanceof HTMLElement)) {
        return null;
      }

      const rect = mark.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    });
    expect(Boolean(commentMarkPoint), "Editor comment mark should have a clickable point.");
    await page.mouse.click(commentMarkPoint.x, commentMarkPoint.y);
    await waitForRenderFrame(page);
    const commentMarkClickState = await page.evaluate(() => ({
      rightPanelOpen: Boolean(document.querySelector(".right-panel")),
      activeTab: document.querySelector(".right-panel-tab.active")?.getAttribute("aria-label") ?? "",
      activeCards: document.querySelectorAll(".right-comment-card.active").length,
      activeMarks: document.querySelectorAll(".cm-comment-mark.active").length,
      quoteText: document.querySelector(".right-comment-quote")?.textContent ?? "",
    }));
    expect(commentMarkClickState.rightPanelOpen, "Clicking a comment mark should reopen the right panel.");
    expect(commentMarkClickState.activeTab === "Comments", "Clicking a comment mark should show the Comments section.");
    expect(commentMarkClickState.activeCards === 1, "Clicking a comment mark should focus the matching comment card.");
    expect(commentMarkClickState.activeMarks === 1, "Clicking a comment mark should keep the source mark active.");
    expect(commentMarkClickState.quoteText === "target", "Clicking a shifted comment mark should still resolve the original quote.");

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.waitForSelector(".preview-comment-mark", { timeout: 5_000 });
    const previewCommentMarkState = await page.evaluate(() => ({
      markCount: document.querySelectorAll(".preview-comment-mark").length,
      activeMarkCount: document.querySelectorAll(".preview-comment-mark.active").length,
      markText: document.querySelector(".preview-comment-mark")?.textContent ?? "",
      workspacePreview: Boolean(document.querySelector(".workspace.preview")),
    }));
    expect(previewCommentMarkState.workspacePreview, "Preview mode should be active before preview comment mark smoke.");
    expect(previewCommentMarkState.markCount === 1, "Preview should render the anchored comment mark.");
    expect(previewCommentMarkState.activeMarkCount === 1, "Preview should reflect the active comment mark.");
    expect(previewCommentMarkState.markText === "target", "Preview comment mark should wrap the rendered quote text.");

    await closeProjectContext(page);
    expect((await page.locator(".right-panel").count()) === 0, "The right panel should close before preview comment-mark click smoke.");
    await page.locator(".preview-comment-mark").click();
    await waitForRenderFrame(page);
    const previewMarkClickState = await page.evaluate(() => ({
      rightPanelOpen: Boolean(document.querySelector(".right-panel")),
      activeTab: document.querySelector(".right-panel-tab.active")?.getAttribute("aria-label") ?? "",
      activeCards: document.querySelectorAll(".right-comment-card.active").length,
      activePreviewMarks: document.querySelectorAll(".preview-comment-mark.active").length,
      workspacePreview: Boolean(document.querySelector(".workspace.preview")),
    }));
    expect(previewMarkClickState.rightPanelOpen, "Clicking a preview comment mark should reopen the right panel.");
    expect(previewMarkClickState.activeTab === "Comments", "Clicking a preview comment mark should show Comments.");
    expect(previewMarkClickState.activeCards === 1, "Clicking a preview comment mark should focus the matching comment.");
    expect(previewMarkClickState.activePreviewMarks === 1, "Clicking a preview comment mark should keep the preview mark active.");
    expect(previewMarkClickState.workspacePreview, "Clicking a preview comment mark should keep Preview mode.");

    await page.getByRole("button", { name: "Show quoted text", exact: true }).click();
    await waitForRenderFrame(page);
    const quoteClickInPreviewState = await page.evaluate(() => ({
      workspacePreview: Boolean(document.querySelector(".workspace.preview")),
      activePreviewMarks: document.querySelectorAll(".preview-comment-mark.active").length,
      activeCards: document.querySelectorAll(".right-comment-card.active").length,
    }));
    expect(quoteClickInPreviewState.workspacePreview, "Clicking a comment quote in Preview should keep Preview mode.");
    expect(quoteClickInPreviewState.activePreviewMarks === 1, "Clicking a comment quote should keep the preview quote marked.");
    expect(quoteClickInPreviewState.activeCards === 1, "Clicking a comment quote should keep the matching comment focused.");

    const previewSelectionState = await page.evaluate(() => {
      const targetSpan = Array.from(document.querySelectorAll(".preview-source-text")).find((span) =>
        span.textContent?.includes("omega"),
      );
      if (!targetSpan?.firstChild) {
        return null;
      }

      const start = targetSpan.textContent?.indexOf("omega") ?? -1;
      if (start < 0) {
        return null;
      }

      const range = document.createRange();
      range.setStart(targetSpan.firstChild, start);
      range.setEnd(targetSpan.firstChild, start + "omega".length);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      targetSpan.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      return {
        selectedText: selection?.toString() ?? "",
        sourceStart: targetSpan.getAttribute("data-source-start") ?? "",
        sourceEnd: targetSpan.getAttribute("data-source-end") ?? "",
      };
    });
    expect(previewSelectionState?.selectedText === "omega", "Preview smoke should select rendered preview text.");
    await waitForRenderFrame(page);
    const previewSelectionStatus = await page.evaluate(() => ({
      cursorPosition: document.querySelector(".status-cursor-position")?.textContent?.trim() ?? "",
      addSelectionCommentVisible: Boolean(document.querySelector(".selection-comment-button")),
    }));
    expect(previewSelectionStatus.cursorPosition.includes("(5 characters)"), "Preview selection should update the status bar.");
    expect(previewSelectionStatus.addSelectionCommentVisible, "Preview selection should expose Add comment.");

    await page.locator(".selection-comment-button").click();
    await waitForRenderFrame(page);
    await page.locator(".right-comment-input").fill("Preview note");
    await page.locator(".right-comment-form .right-comment-submit").click();
    await waitForRenderFrame(page);
    const previewSelectionCommentState = await page.evaluate(() => ({
      workspacePreview: Boolean(document.querySelector(".workspace.preview")),
      previewMarkTexts: Array.from(document.querySelectorAll(".preview-comment-mark")).map((mark) => mark.textContent ?? ""),
      quoteTexts: Array.from(document.querySelectorAll(".right-comment-quote")).map((quote) => quote.textContent ?? ""),
      visibleText: document.querySelector(".right-panel-body")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(previewSelectionCommentState.workspacePreview, "Adding a preview selection comment should keep Preview mode.");
    expect(previewSelectionCommentState.previewMarkTexts.includes("omega"), "Preview selection comments should create a preview mark.");
    expect(previewSelectionCommentState.quoteTexts.includes("omega"), "Preview selection comments should preserve the rendered quote.");
    expect(previewSelectionCommentState.visibleText.includes("Preview note"), "Preview selection comment should render in the comments panel.");
  });

  await withPage(browser, "/", async (page) => {
    await page.getByTitle("New tab").click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.type("Alpha **target** omega.");
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.waitForSelector(".preview-source-text", { timeout: 5_000 });

    const previewFormattedSelection = await page.evaluate(() => {
      const sourceSpans = Array.from(document.querySelectorAll(".preview-source-text"));
      const firstSpan = sourceSpans.find((span) => span.textContent === "Alpha ");
      const lastSpan = sourceSpans.find((span) => span.textContent === " omega.");
      if (!firstSpan?.firstChild || !lastSpan?.firstChild) {
        return null;
      }

      const end = lastSpan.textContent?.indexOf(".") ?? -1;
      if (end < 0) {
        return null;
      }

      const range = document.createRange();
      range.setStart(firstSpan.firstChild, 0);
      range.setEnd(lastSpan.firstChild, end);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      lastSpan.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

      return {
        selectedText: selection?.toString() ?? "",
        firstSourceStart: firstSpan.getAttribute("data-source-start") ?? "",
        lastSourceEnd: lastSpan.getAttribute("data-source-end") ?? "",
      };
    });
    expect(
      previewFormattedSelection?.selectedText === "Alpha target omega",
      "Preview should allow selecting rendered text across Markdown formatting boundaries.",
    );

    await waitForRenderFrame(page);
    await page.locator(".selection-comment-button").click();
    await waitForRenderFrame(page);
    await page.locator(".right-comment-input").fill("Review formatted preview");
    await page.locator(".right-comment-form .right-comment-submit").click();
    await waitForRenderFrame(page);

    const formattedPreviewCommentState = await page.evaluate(() => ({
      previewMarkText: Array.from(document.querySelectorAll(".preview-comment-mark"))
        .map((mark) => mark.textContent ?? "")
        .join(""),
      quoteText: document.querySelector(".right-comment-quote")?.textContent ?? "",
      visibleText: document.querySelector(".right-panel-body")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(
      formattedPreviewCommentState.previewMarkText === "Alpha target omega",
      "Preview comment marks should follow rendered text across formatted source spans.",
    );
    expect(
      formattedPreviewCommentState.quoteText === "Alpha target omega",
      "Preview comments should store the rendered quote for the comment panel.",
    );
    expect(
      formattedPreviewCommentState.visibleText.includes("Review formatted preview"),
      "Preview comments across formatting should render in the comments panel.",
    );

    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    const formattedEditorCommentState = await page.evaluate(() => ({
      markCount: document.querySelectorAll(".cm-comment-mark").length,
      markText: document.querySelector(".cm-comment-mark")?.textContent ?? "",
    }));
    expect(formattedEditorCommentState.markCount === 1, "Formatted preview comments should resolve back to one source mark.");
    expect(
      formattedEditorCommentState.markText === "Alpha **target** omega",
      "Formatted preview comments should preserve the Markdown source anchor.",
    );
  });
}
