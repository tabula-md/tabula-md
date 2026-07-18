export const id = "editor-selection-comments";
export const requiresRoomService = true;
export const description = "Text selection surfaces, selection comments, and editor/preview comment anchors.";

export async function run(ctx) {
  const {
    browser,
    expect,
    focusMarkdownEditor,
    ensureSidePanelClosed,
    waitForEditorReady,
    waitForRenderFrame,
    waitForSelectionLayer,
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
    await page.waitForSelector(".markdown-editor-shell.collaboration-bound", { timeout: 5_000 });
    await waitForRenderFrame(page);
  };

  await withPage(browser, "/", async (page) => {
    const diagnostics = [];
    page.on("console", (message) => {
      if (message.type() === "error") diagnostics.push(`console.error: ${message.text()}`);
    });
    page.on("pageerror", (error) => diagnostics.push(`pageerror: ${error.message}`));

    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.type("rapid-input ".repeat(50), { delay: 0 });
    await waitForRenderFrame(page);

    expect(
      diagnostics.length === 0,
      `Rapid editor input should not trigger a React update loop.\n${diagnostics.join("\n")}`,
    );
  });

  await withPage(browser, "/", async (page) => {
    await page.getByRole("button", { name: "New document", exact: true }).click();
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
    await waitForSelectionLayer(page);

    const selectionSurfaceState = await page.evaluate(() => {
      const activeLine = document.querySelector(".cm-activeLine");
      const activeGutter = document.querySelector(".cm-activeLineGutter");
      const segments = Array.from(document.querySelectorAll(".cm-selectionLayer .cm-selectionBackground"));
      const segmentRects = segments.map((segment) => {
        const rect = segment.getBoundingClientRect();
        const style = getComputedStyle(segment);
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          background: style.backgroundColor,
        };
      });
      const lineMetricsAfterSelection = Array.from(document.querySelectorAll(".cm-line")).map((line) => {
        const rect = line.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          height: Math.round(rect.height),
        };
      });
      return {
        hasSelectionClass: Boolean(document.querySelector(".editor-surface.has-text-selection")),
        activeLineBackground: activeLine instanceof HTMLElement ? getComputedStyle(activeLine).backgroundColor : "",
        activeGutterBackground: activeGutter instanceof HTMLElement ? getComputedStyle(activeGutter).backgroundColor : "",
        statusText: document.querySelector(".status-cursor-position")?.textContent?.trim() ?? "",
        segmentCount: segments.length,
        segmentRects,
        lineMetricsAfterSelection,
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
    expect(selectionSurfaceState.segmentCount >= 1, "CodeMirror should render the selected text.");
    expect(
      selectionSurfaceState.segmentRects.every(
        (segment) =>
          segment.background === "rgb(182, 215, 255)" &&
          segment.height > 0,
      ) && selectionSurfaceState.segmentRects.some((segment) => segment.width > 0),
      `CodeMirror selection rectangles should use the standard blue selection color without changing layout. Actual: ${JSON.stringify(selectionSurfaceState.segmentRects)}`,
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
    await waitForSelectionLayer(page);
    const wrappedSelectionSurfaceState = await page.evaluate(() => {
      const segments = Array.from(document.querySelectorAll(".cm-selectionLayer .cm-selectionBackground"));
      const lines = Array.from(document.querySelectorAll(".cm-line"));
      const lineRects = lines.map((line) => {
        const rect = line.getBoundingClientRect();
        return {
          top: Math.round(rect.top),
          height: Math.round(rect.height),
        };
      });
      const segmentRects = segments
        .map((segment) => {
          const rect = segment.getBoundingClientRect();
          const style = getComputedStyle(segment);
          return {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            background: style.backgroundColor,
          };
        })
        .sort((first, second) => first.top - second.top || first.left - second.left);
      const noTextSegmentVerticalOverlap = segmentRects.every((segment, index) => {
        const nextSegment = segmentRects[index + 1];
        if (!nextSegment || nextSegment.top === segment.top) {
          return true;
        }

        return nextSegment.top >= segment.bottom - 1;
      });
      const wrappedLine = lineRects[1];
      const wrappedSelectionCoversLine = Boolean(
        wrappedLine && segmentRects.some(
          (segment) =>
            segment.top <= wrappedLine.top + 1 &&
            segment.bottom >= wrappedLine.top + wrappedLine.height - 1,
        ),
      );
      return {
        logicalLineCount: lines.length,
        segmentCount: segmentRects.length,
        wrappedLineIsTallerThanSingleRow: lineRects[1]?.height > (lineRects[0]?.height ?? 0) * 1.5,
        noTextSegmentVerticalOverlap,
        wrappedSelectionCoversLine,
        selectionColors: [...new Set(segmentRects.map((segment) => segment.background))],
        lineMetricsAfterSelection: lineRects,
      };
    });
    expect(
      JSON.stringify(wrappedSelectionSurfaceState.lineMetricsAfterSelection) ===
        JSON.stringify(wrappedLineMetricsBeforeSelection),
      "Wrapped text selection highlights should not change editor line positions or heights.",
    );
    expect(wrappedSelectionSurfaceState.wrappedLineIsTallerThanSingleRow, "Smoke document should contain a wrapped logical line.");
    expect(wrappedSelectionSurfaceState.segmentCount >= 1, "Wrapped text should retain a visible CodeMirror selection.");
    expect(wrappedSelectionSurfaceState.wrappedSelectionCoversLine, "Selection should cover the full height of a wrapped logical line.");
    expect(wrappedSelectionSurfaceState.noTextSegmentVerticalOverlap, "Wrapped text selection segments should not overlap each other.");
    expect(
      wrappedSelectionSurfaceState.selectionColors.every((color) => color === "rgb(182, 215, 255)"),
      "Wrapped selection rows should keep the standard blue selection color.",
    );
  });

  await withPage(browser, "/", async (page) => {
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await startLiveSession(page);
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
    await page.locator(".selection-comment-button").waitFor({ state: "visible" });
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
    expect(selectionAfterToolbarFormat.editorFocused, "Toolbar formatting should return focus to the Editor.");

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
      `Comment anchors should survive formatting that shifts their stored offsets. ` +
        `Actual: ${JSON.stringify(commentAfterOffsetShift)}`,
    );
    expect(commentAfterOffsetShift.activeMarkCount === 1, "Comment anchors should keep active focus after text edits.");
    expect(
      commentAfterOffsetShift.cursorPosition.includes("characters"),
      `Formatting command selection should continue to update the cursor selection state. ` +
        `Actual: ${JSON.stringify(commentAfterOffsetShift.cursorPosition)}`,
    );

    await ensureSidePanelClosed(page);
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

    await ensureSidePanelClosed(page);
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
      document.dispatchEvent(new Event("selectionchange"));

      return {
        selectedText: selection?.toString() ?? "",
        sourceStart: targetSpan.getAttribute("data-source-start") ?? "",
        sourceEnd: targetSpan.getAttribute("data-source-end") ?? "",
      };
    });
    expect(previewSelectionState?.selectedText === "omega", "Preview smoke should select rendered preview text.");
    await page.waitForFunction(
      () =>
        (document.querySelector(".status-cursor-position")?.textContent ?? "").includes("(5 characters)") &&
        Boolean(document.querySelector(".selection-comment-button")),
    );
    await waitForRenderFrame(page);
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
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await startLiveSession(page);
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
      "Preview should allow selecting rendered text across Formatting boundaries.",
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

  await withPage(browser, "/", async (page) => {
    await page.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(page, { mode: "edit" });
    await focusMarkdownEditor(page);
    await page.keyboard.insertText("line 3 has -firs here\nline 6 has -firs here");
    for (let index = 0; index < 5; index += 1) await page.keyboard.press("ArrowLeft");
    for (let index = 0; index < 5; index += 1) await page.keyboard.press("Shift+ArrowLeft");
    await waitForSelectionLayer(page, { minSegments: 1 });

    expect(
      (await page.locator(".selection-comment-popover.ui-popover").count()) === 1,
      "Selection comments should use the shared lightweight popover surface.",
    );
    expect(
      (await page.getByRole("button", { name: "Add comment", exact: true }).count()) === 1,
      "A single selection action should be a direct button instead of a one-item menu.",
    );

    await page.locator(".selection-comment-button").click();
    await waitForRenderFrame(page);
    await page.locator(".right-comment-input").fill("Review the second occurrence");
    await page.locator(".right-comment-form .right-comment-submit").click();
    await waitForRenderFrame(page);

    const repeatedQuoteState = await page.evaluate(() => {
      const lines = Array.from(document.querySelectorAll(".cm-line"));
      return {
        firstLineMarks: lines[0]?.querySelectorAll(".cm-comment-mark").length ?? -1,
        secondLineMarks: lines[1]?.querySelectorAll(".cm-comment-mark").length ?? -1,
        markText: document.querySelector(".cm-comment-mark")?.textContent ?? "",
      };
    });
    expect(repeatedQuoteState.firstLineMarks === 0, "A repeated quote must not attach to its first occurrence.");
    expect(repeatedQuoteState.secondLineMarks === 1, "A repeated quote must stay on the selected occurrence.");
    expect(repeatedQuoteState.markText === "-firs", "The selected source range should remain exact after the composer takes focus.");
  });
}
