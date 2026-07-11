export const id = "editor-preview";
export const description = "Editor chrome, Markdown preview rendering, toolbar behavior, and source editing.";

export async function run(ctx) {
  const {
    baseUrl,
    browser,
    expect,
    focusMarkdownEditor,
    waitForEditorReady,
    waitForRenderFrame,
    waitForShareDialogState,
    withPage,
  } = ctx;

  const startLiveSession = async (page) => {
    await page.locator(".share-trigger").click();
    await waitForShareDialogState(page, { panel: "Share link" });
    await page.getByRole("button", { name: "Start session" }).click();
    await waitForShareDialogState(page, { text: "Invite link" });
    await page.keyboard.press("Escape");
    await waitForShareDialogState(page, { open: false });
    await page.waitForSelector(".tab-item.active[data-room-id]:not([data-room-id=''])", { timeout: 5_000 });
  };

  const createDocument = async (page) => {
    await page.getByTitle("New document").click();
    const sharedDocument = page.getByRole("menuitem", { name: "Shared document" });
    if ((await sharedDocument.count()) === 1) await sharedDocument.click();
  };

  await withPage(browser, "/", async (page) => {
    await createDocument(page);
    await waitForEditorReady(page, { mode: "edit" });
    await startLiveSession(page);
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
    await page.waitForFunction(() => {
      const icon = document.querySelector(".cm-annotationGutter .cm-activeLineGutter .cm-annotation-icon");
      return icon ? getComputedStyle(icon).opacity !== "0" : false;
    });
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
    await page.waitForFunction(() => {
      const icon = document.querySelector(".cm-commentGutter .cm-activeLineGutter .cm-annotation-icon");
      return icon ? getComputedStyle(icon).opacity !== "0" : false;
    });
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

    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText(
      Array.from({ length: 36 }, (_, index) => `long-unwrapped-segment-${index + 1}`).join(" "),
    );
    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    await page.getByRole("button", { name: "Line Wrapping" }).click();
    await waitForRenderFrame(page);
    const unwrappedGutterState = await page.evaluate(() => {
      const scroller = document.querySelector(".cm-scroller");
      const gutters = document.querySelector(".cm-gutters");
      const activeGutter = document.querySelector(".cm-lineNumbers .cm-activeLineGutter");
      if (scroller instanceof HTMLElement) {
        scroller.scrollLeft = 180;
      }

      const gutterStyle = gutters instanceof HTMLElement ? getComputedStyle(gutters) : null;
      const activeGutterStyle = activeGutter instanceof HTMLElement ? getComputedStyle(activeGutter) : null;
      const gutterRect = gutters instanceof HTMLElement ? gutters.getBoundingClientRect() : null;
      const railElement = gutterRect
        ? document.elementFromPoint(gutterRect.left + Math.min(12, Math.max(1, gutterRect.width - 2)), gutterRect.top + 24)
        : null;
      return {
        scrollLeft: scroller instanceof HTMLElement ? scroller.scrollLeft : 0,
        gutterBackground: gutterStyle?.backgroundColor ?? "",
        gutterBoxShadow: gutterStyle?.boxShadow ?? "",
        gutterZIndex: gutterStyle?.zIndex ?? "",
        activeGutterBackground: activeGutterStyle?.backgroundColor ?? "",
        railElementClassName: railElement instanceof HTMLElement ? railElement.className : "",
      };
    });
    expect(unwrappedGutterState.scrollLeft > 0, "Wrapping-off editor content should be horizontally scrollable.");
    expect(
      unwrappedGutterState.gutterBackground !== "" &&
        unwrappedGutterState.gutterBackground !== "rgba(0, 0, 0, 0)",
      "Line number gutters should stay opaque when wrapping is disabled.",
    );
    expect(Number(unwrappedGutterState.gutterZIndex) >= 1, "Line number gutters should stay above scrolled text.");
    expect(
      unwrappedGutterState.gutterBoxShadow !== "" && unwrappedGutterState.gutterBoxShadow !== "none",
      "Line number gutters should visually separate from horizontally scrolled text.",
    );
    expect(
      String(unwrappedGutterState.railElementClassName).includes("cm-gutter"),
      "Horizontally scrolled text should not cover the line-number rail.",
    );
    expect(
      unwrappedGutterState.activeGutterBackground !== "" &&
        unwrappedGutterState.activeGutterBackground !== "rgba(0, 0, 0, 0)",
      "Active line number gutters should not expose darker overlapped text underneath.",
    );
    await page.getByRole("button", { name: "Editor controls", exact: true }).click();
    await page.getByRole("button", { name: "Line Wrapping" }).click();
    await waitForRenderFrame(page);

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });
    expect(!(await page.locator(".cm-lineNumbers").isVisible()), "Preview mode should not show editor line numbers.");
  });

  await withPage(browser, "/", async (page) => {
    await createDocument(page);
    await waitForEditorReady(page, { mode: "edit" });
    await startLiveSession(page);
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
      bookmarkTagName:
        document.querySelector(".cm-annotation-marker.has-bookmark .cm-annotation-action.bookmark")?.tagName ?? "",
      bookmarkAriaLabel:
        document.querySelector(".cm-annotation-marker.has-bookmark .cm-annotation-action.bookmark")?.getAttribute("aria-label") ?? "",
      lineActionPopoverVisible: Boolean(document.querySelector(".line-annotation-popover")),
      statusButtonVisible: Boolean(document.querySelector(".status-comment-button")),
    }));
    expect(bookmarkedLineState.bookmarkMarkers === 1, "Bookmarking a line should render a bookmark marker in the gutter.");
    expect(bookmarkedLineState.bookmarkColor === "rgb(118, 63, 200)", "Active bookmarks should use the shared annotation accent.");
    expect(bookmarkedLineState.bookmarkTagName === "BUTTON", "Active editor bookmarks should expose a real button.");
    expect(
      bookmarkedLineState.bookmarkAriaLabel === "Remove line bookmark",
      "Active editor bookmarks should have a useful accessibility label.",
    );
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
      commentTagName:
        document.querySelector(".cm-line-comment-marker.has-comment .cm-line-comment-action")?.tagName ?? "",
      commentAriaLabel:
        document.querySelector(".cm-line-comment-marker.has-comment .cm-line-comment-action")?.getAttribute("aria-label") ?? "",
      selectionPopoverVisible: Boolean(document.querySelector(".selection-comment-popover")),
      markText: document.querySelector(".cm-comment-mark")?.textContent ?? "",
      panelText: document.querySelector(".right-panel-body")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
    }));
    expect(lineCommentState.commentActions === 1, "A line with a comment should render a right-side comment affordance.");
    expect(lineCommentState.commentActionInRightGutter, "Line comments should sit in the right gutter.");
    expect(!lineCommentState.commentActionInBody, "Line comments should not sit inside the editable text body.");
    expect(lineCommentState.commentColor === "rgb(118, 63, 200)", "Active line comments should use the shared annotation accent.");
    expect(lineCommentState.commentTagName === "BUTTON", "Active editor line comments should expose a real button.");
    expect(
      lineCommentState.commentAriaLabel === "Open line comments",
      "Active editor line comments should have a useful accessibility label.",
    );
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
        softBreakCount: previewContent?.querySelectorAll("p br").length ?? 0,
        bookmarkColor: bookmarkAction instanceof HTMLElement ? getComputedStyle(bookmarkAction).color : "",
        commentColor: commentAction instanceof HTMLElement ? getComputedStyle(commentAction).color : "",
        bookmarkTagName: bookmarkAction?.tagName ?? "",
        commentTagName: commentAction?.tagName ?? "",
        bookmarkAriaLabel: bookmarkAction?.getAttribute("aria-label") ?? "",
        commentAriaLabel: commentAction?.getAttribute("aria-label") ?? "",
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
    expect(previewLineGutterState.softBreakCount >= 2, "Preview line gutters should tolerate preserved soft line breaks.");
    expect(previewLineGutterState.bookmarkColor === "rgb(118, 63, 200)", "Preview bookmarks should use the shared annotation accent.");
    expect(previewLineGutterState.commentColor === "rgb(118, 63, 200)", "Preview comments should use the shared annotation accent.");
    expect(previewLineGutterState.bookmarkTagName === "BUTTON", "Active preview bookmarks should expose a real button.");
    expect(previewLineGutterState.commentTagName === "BUTTON", "Active preview comments should expose a real button.");
    expect(
      previewLineGutterState.bookmarkAriaLabel === "Remove preview line bookmark",
      "Active preview bookmarks should have a useful accessibility label.",
    );
    expect(
      previewLineGutterState.commentAriaLabel === "Open preview line comments",
      "Active preview comments should have a useful accessibility label.",
    );
    expect(previewLineGutterState.bookmarkLeftOfContent, "Preview bookmark markers should sit in the left rail outside content.");
    expect(previewLineGutterState.commentRightOfContent, "Preview comment markers should sit in the right rail outside content.");
    expect(previewLineGutterState.contentInsideDocument, "Preview line gutters should frame the rendered document content.");
  });

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 760 } });
  const mobilePage = await mobileContext.newPage();
  try {
    await mobilePage.goto(baseUrl);
    await createDocument(mobilePage);
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
    await createDocument(page);
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
    await createDocument(page);
    await waitForEditorReady(page, { mode: "edit" });
    await startLiveSession(page);
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

    await createDocument(page);
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
        primaryFormattingCommandCount: document.querySelectorAll(
          '.formatting-toolbar [data-format-command]:not([data-format-command="undo"]):not([data-format-command="redo"]):not([data-format-command="more-formatting"])',
        ).length,
        hasOverflowTrigger: Boolean(document.querySelector('.formatting-toolbar [data-format-command="more-formatting"]')),
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
    expect(
      codeBlockFormatting.primaryFormattingCommandCount === 13,
      "Formatting toolbar should preserve the complete primary command set.",
    );
    expect(codeBlockFormatting.hasOverflowTrigger, "Formatting toolbar should expose overflow commands through the registry trigger.");

    await createDocument(page);
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

    await createDocument(page);
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

    await createDocument(page);
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await pasteIntoEditor("“Title”\r\n\titem\r\n\r\n\r\nnext");
    await waitForRenderFrame(page);
    const sourcePasteText = Array.from(await page.locator(".cm-line").allTextContents()).join("\n");
    expect(
      sourcePasteText === "“Title”\n  item\n\n\nnext",
      "Pasting source-sensitive text should preserve quotes and blank lines while normalizing leading tabs.",
    );

    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText("-o\noo");
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });
    const softLineBreakState = await page.evaluate(() => {
      const paragraph = document.querySelector(".preview-surface p");
      return {
        text: paragraph?.textContent ?? "",
        breakCount: paragraph?.querySelectorAll("br").length ?? 0,
      };
    });
    expect(
      softLineBreakState.text === "-o\noo" && softLineBreakState.breakCount === 1,
      "Preview should preserve author-entered soft line breaks for reading convenience.",
    );
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);

    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.insertText("```ts\nconst value = 1;\n```");
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.waitForSelector(".preview-surface pre code", { timeout: 5_000 });
    await page.mouse.move(0, 0);
    await page.waitForFunction(() => {
      const actions = document.querySelector(".preview-code-actions");
      return actions instanceof HTMLElement && window.getComputedStyle(actions).opacity === "0";
    });
    const previewCodeBlock = await page.evaluate(() => {
      const pre = document.querySelector(".preview-surface pre");
      const code = document.querySelector(".preview-surface pre code");
      const codeBlock = document.querySelector(".preview-code-block");
      const actions = document.querySelector(".preview-code-actions");
      const wrapIcon = document.querySelector('button.preview-code-action[aria-label="Enable word wrap"] svg');
      if (!(pre instanceof HTMLElement) || !(code instanceof HTMLElement)) {
        return null;
      }
      const preStyle = window.getComputedStyle(pre);
      const codeStyle = window.getComputedStyle(code);
      const actionsStyle = actions instanceof HTMLElement ? window.getComputedStyle(actions) : null;
      const surfaceProbe = document.createElement("span");
      surfaceProbe.style.background = "var(--surface-panel)";
      document.body.append(surfaceProbe);
      const surfacePanelBackground = window.getComputedStyle(surfaceProbe).backgroundColor;
      surfaceProbe.remove();
      return {
        text: code.textContent ?? "",
        language: code.dataset.language ?? "",
        actionCount: document.querySelectorAll(".preview-code-action").length,
        actionsOpacity: actionsStyle?.opacity ?? "",
        actionsPointerEvents: actionsStyle?.pointerEvents ?? "",
        wrapTitle: document.querySelector(".preview-code-action")?.getAttribute("title") ?? "",
        copyTitle: document.querySelectorAll(".preview-code-action")[1]?.getAttribute("title") ?? "",
        wrapIconClass: wrapIcon?.getAttribute("class") ?? "",
        wrapOffMarkCount: document.querySelectorAll(".preview-code-action-off-mark").length,
        blockRadius: codeBlock instanceof HTMLElement ? window.getComputedStyle(codeBlock).borderRadius : "",
        blockBorderWidth: codeBlock instanceof HTMLElement ? window.getComputedStyle(codeBlock).borderTopWidth : "",
        blockBackground: codeBlock instanceof HTMLElement ? window.getComputedStyle(codeBlock).backgroundColor : "",
        surfacePanelBackground,
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
    expect(previewCodeBlock?.actionsOpacity === "0", "Preview code block actions should stay hidden until hover or focus.");
    expect(previewCodeBlock?.actionsPointerEvents === "none", "Hidden preview code block actions should not intercept the document.");
    expect(previewCodeBlock?.wrapTitle === "Enable word wrap", "Preview code blocks should offer a word wrap control.");
    expect(
      previewCodeBlock?.wrapIconClass.includes("lucide-wrap-text"),
      "Preview code blocks should show the wrap icon before word wrap is enabled.",
    );
    expect(previewCodeBlock?.wrapOffMarkCount === 0, "Preview code blocks should not show the wrap-off mark before wrapping is enabled.");
    expect(previewCodeBlock?.copyTitle === "Copy code", "Preview code blocks should offer a copy code control.");
    expect(previewCodeBlock?.blockRadius !== "0px", "Preview code block controls should live inside the rounded code surface.");
    expect(previewCodeBlock?.blockBorderWidth === "0px", "Preview code blocks should not draw a document boundary.");
    expect(
      previewCodeBlock?.blockBackground === previewCodeBlock?.surfacePanelBackground,
      "Preview code blocks should stay quieter than filled gray cards.",
    );
    expect(previewCodeBlock?.codeDisplay === "block", "Preview code blocks should render as stable block code.");
    expect(previewCodeBlock?.ligatures === "none", "Preview code blocks should preserve source-like character rendering.");
    expect(previewCodeBlock?.whiteSpace === "pre", "Preview code blocks should preserve source whitespace by default.");
    await page.locator(".preview-code-block").hover();
    await page.waitForFunction(() => {
      const actions = document.querySelector(".preview-code-actions");
      return actions instanceof HTMLElement && window.getComputedStyle(actions).opacity === "1";
    });
    const hoveredCodeActions = await page.evaluate(() => {
      const actions = document.querySelector(".preview-code-actions");
      const actionsStyle = actions instanceof HTMLElement ? window.getComputedStyle(actions) : null;
      return {
        opacity: actionsStyle?.opacity ?? "",
        pointerEvents: actionsStyle?.pointerEvents ?? "",
      };
    });
    expect(hoveredCodeActions.opacity === "1", "Preview code block actions should appear on hover.");
    expect(hoveredCodeActions.pointerEvents === "auto", "Hovered preview code block actions should accept pointer input.");
    await page.waitForFunction(() => document.querySelector('button.preview-code-action[aria-label="Enable word wrap"]'));
    await page.evaluate(() => {
      const wrapButton = document.querySelector('button.preview-code-action[aria-label="Enable word wrap"]');
      if (!(wrapButton instanceof HTMLButtonElement)) {
        throw new Error("Preview word wrap button was not available.");
      }

      wrapButton.click();
    });
    await page.waitForFunction(() => {
      const code = document.querySelector(".preview-surface pre code");
      return code instanceof HTMLElement && window.getComputedStyle(code).whiteSpace === "pre-wrap";
    });
    const wrappedCodeBlock = await page.evaluate(() => {
      const code = document.querySelector(".preview-surface pre code");
      const wrapButton = document.querySelector(".preview-code-action");
      const wrapIcon = wrapButton?.querySelector("svg");
      const wrapOffMark = wrapButton?.querySelector(".preview-code-action-off-mark");
      return {
        whiteSpace: code instanceof HTMLElement ? window.getComputedStyle(code).whiteSpace : "",
        wrapTitle: wrapButton?.getAttribute("title") ?? "",
        wrapPressed: wrapButton?.getAttribute("aria-pressed") ?? "",
        wrapIconClass: wrapIcon?.getAttribute("class") ?? "",
        wrapOffMarkClass: wrapOffMark?.getAttribute("class") ?? "",
      };
    });
    expect(wrappedCodeBlock.whiteSpace === "pre-wrap", "Preview word wrap should wrap code without changing the source.");
    expect(wrappedCodeBlock.wrapTitle === "Disable word wrap", "Preview word wrap should toggle the tooltip copy.");
    expect(wrappedCodeBlock.wrapPressed === "true", "Preview word wrap should expose pressed state.");
    expect(
      wrappedCodeBlock.wrapIconClass.includes("lucide-wrap-text") &&
        wrappedCodeBlock.wrapOffMarkClass.includes("preview-code-action-off-mark"),
      "Preview word wrap should show a distinct wrap-off icon after wrapping is enabled.",
    );
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
    await page.getByRole("button", { name: "Copy code", exact: true }).click({ force: true });
    await page.waitForFunction(() => window.__tabulaCopiedCode === "const value = 1;");
    const copiedCodeBlock = await page.evaluate(() => ({
      copiedText: window.__tabulaCopiedCode ?? "",
    }));
    expect(copiedCodeBlock.copiedText === "const value = 1;", "Preview copy code should copy the raw code contents.");

    await createDocument(page);
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
        bodyHeadingText: Array.from(bodyHeading.childNodes)
          .filter((node) => !(node instanceof HTMLElement && node.classList.contains("preview-heading-anchor")))
          .map((node) => node.textContent ?? "")
          .join("")
          .trim(),
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
    await page.getByRole("button", { name: "Split", exact: true }).click();
    await waitForEditorReady(page, { mode: "split" });
    const readPreviewHeadingSourceLine = () =>
      page.evaluate(() => {
        const heading = document.querySelector(".workspace.split .preview-document-content h1");
        const sourceLine = heading?.getAttribute("data-preview-line-start");
        return sourceLine ? Number(sourceLine) : null;
      });
    const sourceLineBeforeFrontmatterPadding = await readPreviewHeadingSourceLine();
    expect(
      Number.isFinite(sourceLineBeforeFrontmatterPadding),
      "Split preview heading should expose a source line before frontmatter edits.",
    );
    await page.evaluate(() => {
      const content = document.querySelector(".cm-content");
      const view =
        content?.cmView?.view ??
        content?.cmTile?.view ??
        content?.parentElement?.cmView?.view ??
        content?.parentElement?.cmTile?.view ??
        document.querySelector(".cm-editor")?.cmView?.view;
      const docText = view?.state?.doc?.toString?.() ?? "";
      const closingFrontmatterMarker = docText.indexOf("\n---", 3);
      if (!view || closingFrontmatterMarker < 0) {
        throw new Error("Frontmatter source was not available for source-line offset smoke.");
      }

      view.dispatch({
        changes: { from: closingFrontmatterMarker, to: closingFrontmatterMarker, insert: "\n" },
        selection: { anchor: closingFrontmatterMarker + 1 },
        scrollIntoView: true,
      });
    });
    await page.waitForFunction(
      (expectedSourceLine) => {
        const heading = document.querySelector(".workspace.split .preview-document-content h1");
        const sourceLine = heading?.getAttribute("data-preview-line-start");
        return Number(sourceLine) === expectedSourceLine;
      },
      sourceLineBeforeFrontmatterPadding + 1,
    );
    expect(
      (await readPreviewHeadingSourceLine()) === sourceLineBeforeFrontmatterPadding + 1,
      "Preview source-line markers should update when frontmatter line count changes without body text changes.",
    );

    await createDocument(page);
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
    const previewGfm = await page.evaluate(() => {
      const link = document.querySelector('.preview-surface a[href="https://example.com"]');
      const quote = document.querySelector(".preview-surface blockquote");
      const nestedQuote = document.querySelector(".preview-surface blockquote blockquote");
      const tableWrap = document.querySelector(".preview-table-wrap");
      const rightAlignedCell = document.querySelector(".preview-surface tbody tr td:last-child");
      const image = document.querySelector(".preview-image");
      const imageFrame = document.querySelector(".preview-image-frame");
      const imageCaption = document.querySelector(".preview-image-caption");
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
        nestedListMarginTop: nestedListStyle?.marginTop ?? "",
        imageFrameDisplay: imageFrame instanceof HTMLElement ? window.getComputedStyle(imageFrame).display : "",
      };
    });
    expect(previewGfm.linkTarget === "_blank", "External preview links should open outside the workspace.");
    expect(previewGfm.linkRel === "noreferrer", "External preview links should avoid leaking opener context.");
    expect(previewGfm.quoteBorderLeftWidth === "4px", "Preview blockquotes should use a legible Markdown quote rule.");
    expect(previewGfm.quoteBackground === "rgba(0, 0, 0, 0)", "Preview blockquotes should not read as separate cards.");
    expect(previewGfm.nestedQuoteBorderLeftColor !== "", "Nested preview blockquotes should keep visible depth.");
    expect(previewGfm.taskCheckboxCount === 2, "Preview checklists should render consistent non-native check indicators.");
    expect(previewGfm.checkedTaskCheckboxCount === 1, "Preview checklists should preserve checked task state.");
    expect(previewGfm.nativeTaskInputCount === 0, "Preview checklists should not expose interactive native checkboxes.");
    expect(previewGfm.tableWrapRadius !== "0px", "Preview tables should sit in the document surface system.");
    expect(previewGfm.tableWrapBorderWidth === "0px", "Preview tables should not draw an explicit document boundary.");
    expect(previewGfm.tableWrapBackground === "rgb(255, 255, 255)", "Preview tables should not look like filled gray cards.");
    expect(previewGfm.rightAlignedTextAlign === "right", "Preview tables should preserve GFM column alignment.");
    expect(previewGfm.imageFrameCount === 1, "Preview images should render through the Tabula.md image frame.");
    expect(previewGfm.imageLoading === "lazy", "Preview images should lazy-load.");
    expect(previewGfm.imageMaxWidth === "100%", "Preview images should not overflow the document width.");
    expect(previewGfm.imageRadius !== "0px", "Preview images should use the document surface radius.");
    expect(previewGfm.imageCaption === "Rendered image", "Preview images should surface the image title as a caption.");
    expect(previewGfm.nestedListMarginTop !== "0px", "Nested preview lists should have deliberate vertical spacing.");
    expect(previewGfm.imageFrameDisplay === "grid", "Standalone preview images should render as block-like document media.");

    await createDocument(page);
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
    expect(
      afterUndo === "plain",
      `Undo should revert a formatting command in one step. Actual: ${JSON.stringify(afterUndo)}`,
    );
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await waitForRenderFrame(page);
    const afterRedo = await page.locator(".cm-content").textContent();
    expect(afterRedo === "**plain**", "Redo should restore a formatting command in one step.");
    const toolbarRegistryState = await page.evaluate(() => ({
      boldCommand:
        document
          .querySelector('.formatting-toolbar [data-format-command="bold"]')
          ?.getAttribute("aria-label") ?? "",
      moreFormattingExpanded:
        document
          .querySelector('.formatting-toolbar [data-format-command="more-formatting"]')
          ?.getAttribute("aria-expanded") ?? "",
    }));
    expect(toolbarRegistryState.boldCommand === "Bold", "Primary toolbar commands should expose stable registry ids.");
    expect(
      toolbarRegistryState.moreFormattingExpanded === "false",
      "Overflow formatting command should expose a stable registry trigger.",
    );

    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("obsolete");
    await page.keyboard.press("Shift+Home");
    await page.getByRole("button", { name: "More formatting", exact: true }).click();
    await page.getByRole("menuitem", { name: "Strikethrough", exact: true }).click();
    await waitForRenderFrame(page);
    const afterOverflowInlineCommand = await page.locator(".cm-content").textContent();
    expect(
      afterOverflowInlineCommand === "~~obsolete~~",
      "Overflow formatting commands should apply to the current editor selection.",
    );

    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await page.getByRole("button", { name: "More formatting", exact: true }).click();
    await page.getByRole("menuitem", { name: "Table", exact: true }).click();
    await waitForRenderFrame(page);
    const afterOverflowInsertCommand = await page.locator(".cm-content").textContent();
    expect(
      afterOverflowInsertCommand.startsWith("| Column 1 | Column 2 |"),
      "Overflow insert commands should apply through the same toolbar command path.",
    );

    await focusMarkdownEditor(page);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("alpha");
    await page.waitForSelector(".tab-item.active[data-room-id]:not([data-room-id=''])");
    await focusMarkdownEditor(page);
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
      const toolbar = document.querySelector(".formatting-toolbar");
      const controlRow = document.querySelector(".document-toolbar-row.with-formatting");
      const documentControls = document.querySelector(".document-controls");
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
      const editorLineActions = Array.from(document.querySelectorAll(".workspace.split .cm-annotation-action"));
      const previewParagraph = document.querySelector(".workspace.split .preview-surface p");
      const toolbarRect = toolbar?.getBoundingClientRect();
      const controlRowRect = controlRow?.getBoundingClientRect();
      const documentControlsRect = documentControls?.getBoundingClientRect();
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
          Boolean(toolbarRect && documentControlsRect) && Math.abs(toolbarRect.top - documentControlsRect.top) <= 1,
        toolbarRailSeparatesLeftAndRight:
          Boolean(toolbarRect && documentControlsRect && controlRowRect) &&
          toolbarRect.left >= controlRowRect.left &&
          documentControlsRect.right <= controlRowRect.right + 1 &&
          toolbarRect.right < documentControlsRect.left,
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
        splitPreviewInactiveGutterActionsHiddenFromAccessibility:
          previewLineActions.length > 0 &&
          previewLineActions.every((action) => {
            if (!(action instanceof HTMLElement)) {
              return false;
            }

            const isActive =
              action.classList.contains("has-bookmark") ||
              action.classList.contains("has-comment") ||
              action.classList.contains("active");
            return (
              isActive ||
              (action.tagName === "SPAN" &&
                action.getAttribute("aria-hidden") === "true" &&
                !action.hasAttribute("aria-label"))
            );
          }),
        splitEditorInactiveGutterActionsHiddenFromAccessibility:
          editorLineActions.length > 0 &&
          editorLineActions.every((action) => {
            if (!(action instanceof HTMLElement)) {
              return false;
            }

            const isActive =
              action.closest(".cm-annotation-marker.has-bookmark") ||
              action.closest(".cm-line-comment-marker.has-comment");
            return (
              Boolean(isActive) ||
              (action.tagName === "SPAN" &&
                action.getAttribute("aria-hidden") === "true" &&
                !action.hasAttribute("role") &&
                !action.hasAttribute("aria-label"))
            );
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
    expect(
      splitFormatting.splitPreviewInactiveGutterActionsHiddenFromAccessibility,
      "Inactive split preview gutter affordances should stay out of the accessibility tree.",
    );
    expect(
      splitFormatting.splitEditorInactiveGutterActionsHiddenFromAccessibility,
      "Inactive split editor gutter affordances should stay out of the accessibility tree.",
    );
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
    await page.waitForFunction(
      () => {
        const editor = document.querySelector(".workspace.split .cm-scroller");
        const preview = document.querySelector(".workspace.split .preview-surface");
        return (
          editor instanceof HTMLElement &&
          preview instanceof HTMLElement &&
          editor.scrollHeight - editor.clientHeight > 1 &&
          preview.scrollHeight - preview.clientHeight > 1
        );
      },
      null,
      { timeout: 2_000 },
    );
    const splitScrollPrepared = await page.evaluate(() => {
      const editorScroller = document.querySelector(".workspace.split .cm-scroller");
      const preview = document.querySelector(".workspace.split .preview-surface");
      if (!(editorScroller instanceof HTMLElement) || !(preview instanceof HTMLElement)) {
        return null;
      }

      const getRatio = (element) => {
        const maxScrollTop = element.scrollHeight - element.clientHeight;
        return maxScrollTop <= 0 ? 0 : element.scrollTop / maxScrollTop;
      };
      const maxEditorScrollTop = editorScroller.scrollHeight - editorScroller.clientHeight;
      if (maxEditorScrollTop <= 1 || preview.scrollHeight - preview.clientHeight <= 1) {
        return {
          scrollable: false,
          editorRatio: getRatio(editorScroller),
          previewRatio: getRatio(preview),
        };
      }

      editorScroller.scrollTop = maxEditorScrollTop * 0.55;
      editorScroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      return {
        scrollable: true,
        editorRatio: getRatio(editorScroller),
        previewRatio: getRatio(preview),
      };
    });
    expect(splitScrollPrepared?.scrollable, "Split editor and preview should be scrollable for toolbar-height scroll smoke.");
    await page.waitForFunction(
      ({ tolerance }) => {
        const editor = document.querySelector(".workspace.split .cm-scroller");
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
      const editor = document.querySelector(".workspace.split .cm-scroller");
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

    await page.getByRole("button", { name: "Layout controls", exact: true }).click();
    const syncToggleInitialState = await page
      .getByRole("button", { name: "Sync Scrolling", exact: true })
      .getAttribute("aria-pressed");
    expect(syncToggleInitialState === "true", "Split sync scrolling should be enabled by default.");
    await page.getByRole("button", { name: "Sync Scrolling", exact: true }).click();
    await waitForRenderFrame(page);

    const syncDisabledEditorScroll = await page.evaluate(() => {
      const editor = document.querySelector(".workspace.split .cm-scroller");
      const preview = document.querySelector(".workspace.split .preview-surface");
      if (!(editor instanceof HTMLElement) || !(preview instanceof HTMLElement)) {
        return null;
      }

      const maxEditorScrollTop = editor.scrollHeight - editor.clientHeight;
      const editorBefore = editor.scrollTop;
      const previewBefore = preview.scrollTop;
      editor.scrollTop = Math.min(maxEditorScrollTop, editor.scrollTop + Math.max(260, editor.clientHeight * 0.65));
      editor.dispatchEvent(new Event("scroll", { bubbles: true }));
      return {
        editorBefore,
        editorAfter: editor.scrollTop,
        previewBefore,
        scrollable: maxEditorScrollTop > 1 && preview.scrollHeight - preview.clientHeight > 1,
      };
    });
    await waitForRenderFrame(page);
    await waitForRenderFrame(page);
    const syncDisabledPreviewAfterEditorScroll = await page.evaluate(() => {
      const preview = document.querySelector(".workspace.split .preview-surface");
      return preview instanceof HTMLElement ? preview.scrollTop : Number.NaN;
    });
    expect(syncDisabledEditorScroll?.scrollable, "Split panes should be scrollable for sync toggle smoke.");
    expect(
      Math.abs((syncDisabledEditorScroll?.editorAfter ?? 0) - (syncDisabledEditorScroll?.editorBefore ?? 0)) > 20,
      "Editor scroll should move while sync scrolling is disabled.",
    );
    expect(
      Math.abs(syncDisabledPreviewAfterEditorScroll - (syncDisabledEditorScroll?.previewBefore ?? 0)) <= 2,
      "Disabled sync scrolling should stop editor scroll from moving preview.",
    );

    const previewManualScroll = await page.evaluate(() => {
      const editor = document.querySelector(".workspace.split .cm-scroller");
      const preview = document.querySelector(".workspace.split .preview-surface");
      if (!(editor instanceof HTMLElement) || !(preview instanceof HTMLElement)) {
        return null;
      }

      const maxPreviewScrollTop = preview.scrollHeight - preview.clientHeight;
      const editorBefore = editor.scrollTop;
      const previewBefore = preview.scrollTop;
      preview.scrollTop = Math.min(maxPreviewScrollTop, preview.scrollTop + Math.max(220, preview.clientHeight * 0.4));
      preview.dispatchEvent(new Event("scroll", { bubbles: true }));
      return {
        editorBefore,
        previewBefore,
        previewAfter: preview.scrollTop,
      };
    });
    await waitForRenderFrame(page);
    await waitForRenderFrame(page);
    const editorAfterPreviewManualScroll = await page.evaluate(() => {
      const editor = document.querySelector(".workspace.split .cm-scroller");
      return editor instanceof HTMLElement ? editor.scrollTop : Number.NaN;
    });
    expect(Boolean(previewManualScroll), "Preview manual scroll state should be readable.");
    expect(
      Math.abs((previewManualScroll?.previewAfter ?? 0) - (previewManualScroll?.previewBefore ?? 0)) > 20,
      "Preview manual scroll should move preview while sync scrolling is disabled.",
    );
    expect(
      Math.abs(editorAfterPreviewManualScroll - (previewManualScroll?.editorBefore ?? 0)) <= 2,
      "Preview manual scroll should never move the editor.",
    );

    await page.getByRole("button", { name: "Layout controls", exact: true }).click();
    const syncToggleDisabledState = await page
      .getByRole("button", { name: "Sync Scrolling", exact: true })
      .getAttribute("aria-pressed");
    expect(syncToggleDisabledState === "false", "Sync scrolling toggle should persist its disabled state.");
    await page.getByRole("button", { name: "Sync Scrolling", exact: true }).click();
    await waitForRenderFrame(page);
    const syncReenabledEditorScroll = await page.evaluate(() => {
      const editor = document.querySelector(".workspace.split .cm-scroller");
      const preview = document.querySelector(".workspace.split .preview-surface");
      if (!(editor instanceof HTMLElement) || !(preview instanceof HTMLElement)) {
        return null;
      }

      const maxEditorScrollTop = editor.scrollHeight - editor.clientHeight;
      const currentRatio = maxEditorScrollTop <= 0 ? 0 : editor.scrollTop / maxEditorScrollTop;
      const nextRatio = currentRatio > 0.5 ? 0.15 : 0.85;
      const previewBefore = preview.scrollTop;
      editor.scrollTop = maxEditorScrollTop * nextRatio;
      editor.dispatchEvent(new Event("scroll", { bubbles: true }));
      return {
        previewBefore,
        scrollable: maxEditorScrollTop > 1 && preview.scrollHeight - preview.clientHeight > 1,
      };
    });
    expect(syncReenabledEditorScroll?.scrollable, "Split panes should stay scrollable after sync scrolling is re-enabled.");
    const syncReenabledPreviewBefore = syncReenabledEditorScroll?.previewBefore ?? 0;
    await page.waitForFunction(
      ({ previewBefore }) => {
        const preview = document.querySelector(".workspace.split .preview-surface");
        return preview instanceof HTMLElement && Math.abs(preview.scrollTop - previewBefore) > 8;
      },
      { previewBefore: syncReenabledPreviewBefore },
      { timeout: 2_000 },
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
        const rail = readRect(".document-toolbar-row");
        const documentControls = readRect(".document-controls");
        const formattingToolbar = readRect(".formatting-toolbar");
        const status = readRect(".file-status-bar");
        if (!body || !rail || !documentControls || !status) {
          return null;
        }
        return {
          body,
          rail,
          documentControls,
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
      splitAlignment.documentControls.height === previewAlignment.documentControls.height &&
        previewAlignment.documentControls.height === writeAlignment.documentControls.height &&
        previewAlignment.documentControls.height === 34,
      "The visible document controls surface should keep the same 34px background height in every document mode.",
    );
    expect(
      splitAlignment.documentControls.background === previewAlignment.documentControls.background &&
        previewAlignment.documentControls.background === writeAlignment.documentControls.background &&
        previewAlignment.documentControls.background !== "rgba(0, 0, 0, 0)",
      "The visible document controls surface should carry the same background in Edit, Preview, and Split.",
    );
    expect(
      splitAlignment.formattingToolbar?.height === 34 &&
        writeAlignment.formattingToolbar?.height === 34 &&
        splitAlignment.formattingToolbar?.background === splitAlignment.documentControls.background &&
        writeAlignment.formattingToolbar?.background === writeAlignment.documentControls.background,
      "Edit and Split formatting toolbars should use the same 34px surface as the document controls.",
    );

    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await page.locator('button[title="View controls"]').click();
    const previewToolbarState = await page.evaluate(() => ({
      formattingToolbarCount: document.querySelectorAll(".formatting-toolbar").length,
      editorControlsText: document.querySelector('.document-controls-popover[aria-label="View controls"]')?.textContent ?? "",
    }));
    expect(previewToolbarState.formattingToolbarCount === 0, "Preview mode should hide Formatting tools.");
    expect(
      !previewToolbarState.editorControlsText.includes("Line Wrapping"),
      "Preview mode should hide edit-only line wrapping controls.",
    );
  });

  await withPage(
    browser,
    "/",
    async (page) => {
      await createDocument(page);
      await waitForEditorReady(page, { mode: "edit" });
      const mobileToolbar = await page.evaluate(() => {
        const toolbar = document.querySelector(".formatting-toolbar");
        const row = document.querySelector(".formatting-row");
        const primaryCommands = Array.from(document.querySelectorAll(
          '.formatting-toolbar [data-format-command]:not([data-format-command="undo"]):not([data-format-command="redo"]):not([data-format-command="more-formatting"])',
        ));
        const buttons = Array.from(document.querySelectorAll(".formatting-toolbar .formatting-button"));
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
          primaryCommandCount: primaryCommands.length,
          buttonRects,
        };
      });
      expect(mobileToolbar.toolbarVisible, "Formatting toolbar should remain visible on mobile edit screens.");
      expect(mobileToolbar.primaryCommandCount === 13, "Mobile formatting toolbar should keep the core command set.");
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
    await createDocument(page);
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
    const readEditorText = async () =>
      (await page.evaluate(() => {
        const content = document.querySelector(".cm-content");
        const view = content?.cmView?.view ?? content?.cmTile?.view;
        const docText = view?.state?.doc?.toString?.();
        return typeof docText === "string" ? docText : null;
      })) ??
      (await page.$$eval(".cm-line", (lines) =>
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
      ));
    const pasteText = async (text) => {
      await page.evaluate((value) => {
        const content = document.querySelector(".cm-content");
        if (!content) {
          throw new Error("Markdown editor content was not available for paste.");
        }

        const clipboardData = new DataTransfer();
        clipboardData.setData("text/plain", value);
        const event = new ClipboardEvent("paste", {
          bubbles: true,
          cancelable: true,
          clipboardData,
        });
        if (!event.clipboardData) {
          Object.defineProperty(event, "clipboardData", { value: clipboardData });
        }
        content.dispatchEvent(event);
      }, text);
      await waitForRenderFrame(page);
    };

    await createDocument(page);
    await waitForEditorReady(page, { mode: "edit" });
    await replaceEditorText("- item");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("next");
    expect((await readEditorText()) === "- item\n- next", "Enter should continue bullet list markers.");

    await replaceEditorText("- item");
    await page.keyboard.press("Enter");
    expect((await readEditorText()) === "- item\n- ", "Enter should create one empty bullet marker.");
    await page.keyboard.press("Enter");
    expect((await readEditorText()) === "- item\n", "Enter on an empty bullet marker should exit the list.");

    await replaceEditorText("1. item");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("next");
    expect((await readEditorText()) === "1. item\n2. next", "Enter should continue numbered list markers.");

    await replaceEditorText("- [x] done");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("next");
    expect((await readEditorText()) === "- [x] done\n- [ ] next", "Enter should continue checklists as unchecked items.");

    await replaceEditorText("- [x] done");
    await page.keyboard.press("Enter");
    expect((await readEditorText()) === "- [x] done\n- [ ] ", "Enter should create one empty checklist marker.");
    await page.keyboard.press("Enter");
    expect((await readEditorText()) === "- [x] done\n", "Enter on an empty checklist marker should exit the checklist.");

    await replaceEditorText("> quote");
    await page.keyboard.press("Enter");
    await page.keyboard.insertText("next");
    expect((await readEditorText()) === "> quote\n> next", "Enter should continue blockquotes.");

    await replaceEditorText("> quote");
    await page.keyboard.press("Enter");
    expect((await readEditorText()) === "> quote\n> ", "Enter should create one empty blockquote marker.");
    await page.keyboard.press("Enter");
    expect((await readEditorText()) === "> quote\n", "Enter on an empty blockquote marker should exit the blockquote.");

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

    await replaceEditorText("Open docs");
    for (let index = 0; index < 4; index += 1) {
      await page.keyboard.press("Shift+ArrowLeft");
    }
    await pasteText("https://example.com/docs");
    expect(
      (await readEditorText()) === "Open [docs](https://example.com/docs)",
      "Pasting a URL over selected prose should use CodeMirror's Markdown link paste behavior.",
    );

    await replaceEditorText("");
    await pasteText("Title\r\n\titem\r\n\r\nnext");
    expect(
      (await readEditorText()) === "Title\n  item\n\nnext",
      "Pasting source-like Markdown should normalize CRLF line endings and leading tabs.",
    );
  });

  await withPage(browser, "/", async (page) => {
    const docsMarkdown = `> ## Documentation Index
> Fetch the complete documentation index at: https://modelcontextprotocol.io/llms.txt

# What is the Model Context Protocol (MCP)?

MCP connects AI applications to external systems.

> [!NOTE]
> Useful information that users should know, even when skimming content.

Term
: Definition with **strong** text.

21^st^ century and H~2~O use ==marked text==.

Inline math $C_L$ and a display equation:

$$
L = \\frac{1}{2} \\rho v^2 S C_L
$$

Footnote reference[^mcp].

[^mcp]: Footnote content.

\`\`\`js
const protocol = "mcp";
console.log(protocol);
\`\`\`

| Column 1 | Column 2 |
| --- | --- |
| Value 1 | Value 2 |

\`\`\`mermaid
flowchart LR
  Client --> Server
\`\`\`

<Frame>
  <img src="https://mintcdn.com/mcp/bEUxYpZqie0DsluH/images/mcp-simple-diagram.png?fit=max&auto=format&q=85" width="3840" height="1500" data-path="images/mcp-simple-diagram.png" />
</Frame>

<CardGroup cols={2}>
  <Card title="Build servers" icon="server" href="/docs/develop/build-server">
    Create MCP servers to expose your data and tools
  </Card>

  <Card title="Build clients" icon="computer" href="javascript:alert(1)">
    Develop applications that connect to MCP servers
  </Card>
</CardGroup>

<script>window.__tabulaUnsafePreview = true</script>
<img src="javascript:alert(1)" alt="unsafe image" onerror="window.__tabulaUnsafeImage = true" />`;

    await createDocument(page);
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText(docsMarkdown);
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await waitForEditorReady(page, { mode: "preview" });
    await waitForRenderFrame(page);
    await page.waitForSelector(".preview-mermaid-svg svg", { timeout: 15_000 });
    await page.waitForSelector(".preview-math-inline .katex", { timeout: 10_000 });
    const forceTheme = async (theme) => {
      await page.evaluate((nextTheme) => {
        document.documentElement.setAttribute("data-theme", nextTheme);
      }, theme);
      await page.waitForFunction(() => {
        const block = document.querySelector(".preview-mermaid-block");
        return block?.textContent?.includes("Client") && block.textContent.includes("Server");
      });
      await page.waitForSelector(".preview-mermaid-block .preview-mermaid-svg svg", { timeout: 15_000 });
      await waitForRenderFrame(page);
    };
    const readPreviewBorderState = async () =>
      page.evaluate(() => {
        const readElementBorder = (selector) => {
          const element = document.querySelector(selector);
          if (!(element instanceof Element)) {
            return null;
          }

          const style = window.getComputedStyle(element);
          return {
            borderWidths: [
              style.borderTopWidth,
              style.borderRightWidth,
              style.borderBottomWidth,
              style.borderLeftWidth,
            ],
            text: element.textContent?.replace(/\s+/g, " ").trim() ?? "",
          };
        };

        return {
          codeBlock: readElementBorder(".preview-code-block"),
          tableBodyCell: readElementBorder(".preview-table-wrap td"),
          tableHeaderCell: readElementBorder(".preview-table-wrap th"),
          tableWrap: readElementBorder(".preview-table-wrap"),
        };
      });
    const readMermaidVisualState = async () =>
      page.evaluate(() => {
        const block = document.querySelector(".preview-mermaid-block");
        const blockStyle = block instanceof HTMLElement ? window.getComputedStyle(block) : null;
        const readElement = (selector) => {
          const element = block?.querySelector(selector);
          if (!(element instanceof Element)) {
            return null;
          }

          const style = window.getComputedStyle(element);
          return {
            color: style.color,
            fill: style.fill,
            stroke: style.stroke,
            text: element.textContent?.replace(/\s+/g, " ").trim() ?? "",
          };
        };

        return {
          blockBackground: blockStyle?.backgroundColor ?? "",
          blockBorderStyle: blockStyle?.borderTopStyle ?? "",
          blockBorderWidth: blockStyle?.borderTopWidth ?? "",
          edge: readElement(".edgePath .path, .flowchart-link"),
          label: readElement(".nodeLabel, .label text, text"),
          labelsText: block?.textContent?.replace(/\s+/g, " ").trim() ?? "",
          marker: readElement("marker path, .arrowMarkerPath"),
          node: readElement(".node rect, .node circle, .node ellipse, .node polygon, .node path"),
        };
      });
    const expectReadableMermaid = (state, theme) => {
      expect(
        state.labelsText.includes("Client") && state.labelsText.includes("Server"),
        `${theme} Mermaid diagram should preserve node labels.`,
      );
      expect(Boolean(state.node), `${theme} Mermaid diagram should expose a node shape.`);
      expect(Boolean(state.edge), `${theme} Mermaid diagram should expose an edge path.`);
      expect(Boolean(state.label), `${theme} Mermaid diagram should expose a label element.`);
      expect(
        state.blockBorderStyle === "none" && state.blockBorderWidth === "0px",
        `${theme} Mermaid container should not draw its own border.`,
      );
      expect(
        state.node.fill !== state.blockBackground && state.node.stroke !== state.node.fill,
        `${theme} Mermaid node fill and border should remain distinguishable from the preview panel.`,
      );
      expect(
        state.edge.stroke !== "none" &&
          state.edge.stroke !== state.node.fill &&
          state.edge.stroke !== state.blockBackground,
        `${theme} Mermaid edges should stay visible against node and panel surfaces.`,
      );
      expect(
        state.label.fill !== state.node.fill || state.label.color !== state.node.fill,
        `${theme} Mermaid labels should stay visible against node surfaces.`,
      );
    };
    const expectNoVisibleBorder = (state, label) => {
      expect(Boolean(state), `${label} should render before checking its border.`);
      expect(
        state.borderWidths.every((width) => Number.parseFloat(width) === 0),
        `${label} should not draw a border.`,
      );
    };

    expect((await page.locator("h1[id] .preview-heading-anchor").count()) >= 1, "Preview should add heading anchors.");
    expect((await page.locator(".markdown-alert.markdown-alert-note").count()) === 1, "Preview should render GitHub-style alert blocks.");
    expect((await page.locator(".markdown-alert-title").filter({ hasText: "NOTE" }).count()) === 1, "Preview alert should include a title.");
    expect((await page.locator("dl dt").filter({ hasText: "Term" }).count()) === 1, "Preview should render definition list terms.");
    expect((await page.locator("dl dd").filter({ hasText: "Definition" }).count()) === 1, "Preview should render definition list details.");
    expect((await page.locator("sup").filter({ hasText: "st" }).count()) >= 1, "Preview should render superscript syntax.");
    expect((await page.locator("sub").filter({ hasText: "2" }).count()) >= 1, "Preview should render subscript syntax.");
    expect((await page.locator("mark").filter({ hasText: "marked text" }).count()) === 1, "Preview should render marked text syntax.");
    expect((await page.locator(".preview-math-inline .katex").count()) >= 1, "Preview should render inline math with KaTeX.");
    expect((await page.locator(".preview-math-block .katex-display").count()) >= 1, "Preview should render display math with KaTeX.");
    expect((await page.locator("section[data-footnotes]").count()) === 1, "Preview should render footnotes.");
    expect((await page.locator("pre code.hljs.language-js").count()) === 1, "Preview should syntax highlight fenced code blocks.");
    expect((await page.locator("pre code .hljs-keyword").count()) >= 1, "Preview code highlighting should include token spans.");
    expect((await page.locator(".preview-table-wrap table").count()) === 1, "Preview should render Markdown tables.");
    expect((await page.locator(".preview-table-wrap").filter({ hasText: "Value 1" }).count()) === 1, "Preview tables should preserve body cells.");
    const previewBorderState = await readPreviewBorderState();
    expectNoVisibleBorder(previewBorderState.codeBlock, "Preview code block");
    expectNoVisibleBorder(previewBorderState.tableWrap, "Preview table container");
    expectNoVisibleBorder(previewBorderState.tableHeaderCell, "Preview table header cell");
    expectNoVisibleBorder(previewBorderState.tableBodyCell, "Preview table body cell");
    expect((await page.locator(".preview-mermaid-block .preview-mermaid-svg svg").count()) === 1, "Preview should render Mermaid diagrams.");
    expect(
      (await page.locator(".preview-mermaid-block").filter({ hasText: "Client" }).count()) === 1 &&
        (await page.locator(".preview-mermaid-block").filter({ hasText: "Server" }).count()) === 1,
      "Preview Mermaid diagrams should keep node labels visible.",
    );
    await forceTheme("light");
    expectReadableMermaid(await readMermaidVisualState(), "Light");
    await forceTheme("dark");
    expectReadableMermaid(await readMermaidVisualState(), "Dark");
    expect((await page.locator(".preview-mermaid-block script").count()) === 0, "Preview should not keep executable Mermaid script nodes.");
    expect((await page.locator(".preview-mermaid-block foreignObject").count()) === 0, "Preview should not keep Mermaid foreignObject nodes.");
    expect((await page.locator(".preview-docs-frame").count()) === 1, "Preview should render docs-style Frame components.");
    expect(
      (await page.locator('.preview-docs-frame img[src^="https://mintcdn.com/"]').count()) === 1,
      "Preview should render safe raw HTML images inside Frame components.",
    );
    expect((await page.locator(".preview-docs-card-group").count()) === 1, "Preview should render docs-style CardGroup components.");
    expect((await page.locator(".preview-docs-card").count()) === 2, "Preview should render docs-style Card components.");
    expect(
      (await page.locator(".preview-docs-card").filter({ hasText: "Build servers" }).count()) === 1,
      "Preview cards should preserve card titles.",
    );
    expect((await page.locator('a.preview-docs-card[href^="javascript:"]').count()) === 0, "Unsafe card hrefs should be stripped.");
    expect((await page.locator(".preview-surface script").count()) === 0, "Preview should strip script tags from raw HTML.");
    expect((await page.locator('.preview-surface img[src^="javascript:"]').count()) === 0, "Preview should strip unsafe image URLs.");
  });
}
