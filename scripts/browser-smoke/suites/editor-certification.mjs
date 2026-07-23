import { buildEditorCertificationMarkdown } from "../support/editor-fixtures.mjs";

export const id = "editor-certification";
export const requiresRoomService = true;
export const description = "Editor foundation certification for Markdown text, selection, layout, undo, narrow viewports, and remote cursor invariants.";

const getEditorLines = async (page) =>
  page.$$eval(".cm-content .cm-line", (lines) =>
    lines.map((line) => {
      const clone = line.cloneNode(true);
      clone.querySelectorAll(".cm-ySelectionCaret").forEach((cursor) => cursor.remove());
      return clone.textContent ?? "";
    }),
  );

const getEditorText = async (page) => (await getEditorLines(page)).join("\n");

const importMarkdownFixture = async (page, markdown, name = "editor-certification.md") => {
  await page.locator('input[aria-label="Open Markdown file"]').setInputFiles({
    name,
    mimeType: "text/markdown",
    buffer: Buffer.from(markdown),
  });
};

const waitForEditorText = async (page, text, timeout = 8_000) => {
  await page.waitForFunction(
    ({ text }) =>
      Array.from(document.querySelectorAll(".cm-content .cm-line")).some((line) =>
        line.textContent?.includes(text),
      ),
    { text },
    { timeout },
  );
};

const clickEditorLineOffset = async (page, lineText, offset) => {
  const point = await page.evaluate(
    ({ lineText, offset }) => {
      const lines = Array.from(document.querySelectorAll(".cm-content .cm-line"));
      const line = lines.find((candidate) => candidate.textContent === lineText);
      if (!line) {
        return null;
      }

      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      let remainingOffset = offset;
      let node = walker.nextNode();
      while (node) {
        const text = node.textContent ?? "";
        if (remainingOffset <= text.length) {
          const range = document.createRange();
          const start = Math.max(0, Math.min(remainingOffset, text.length - 1));
          range.setStart(node, start);
          range.setEnd(node, Math.min(start + 1, text.length));
          const rect = range.getBoundingClientRect();
          return {
            x: rect.left + Math.max(1, rect.width / 2),
            y: rect.top + Math.max(1, rect.height / 2),
          };
        }
        remainingOffset -= text.length;
        node = walker.nextNode();
      }

      const rect = line.getBoundingClientRect();
      return {
        x: rect.left + 4,
        y: rect.top + rect.height / 2,
      };
    },
    { lineText, offset },
  );

  if (!point) {
    throw new Error(`Could not find editor line for click: ${lineText}`);
  }

  await page.mouse.click(point.x, point.y);
};

const readLineNumberLayout = (page) =>
  page.evaluate(() => {
    const scroller = document.querySelector(".cm-scroller");
    const gutters = document.querySelector(".cm-gutters");
    const activeLine = document.querySelector(".cm-activeLine");
    const activeGutter = document.querySelector(".cm-activeLineGutter");

    if (scroller instanceof HTMLElement) {
      scroller.scrollLeft = 180;
    }

    const gutterStyle = gutters instanceof HTMLElement ? getComputedStyle(gutters) : null;
    const activeLineStyle = activeLine instanceof HTMLElement ? getComputedStyle(activeLine) : null;
    const activeGutterStyle = activeGutter instanceof HTMLElement ? getComputedStyle(activeGutter) : null;
    return {
      scrollLeft: scroller instanceof HTMLElement ? scroller.scrollLeft : 0,
      gutterBackground: gutterStyle?.backgroundColor ?? "",
      gutterZIndex: gutterStyle?.zIndex ?? "",
      activeLineBackground: activeLineStyle?.backgroundColor ?? "",
      activeGutterBackground: activeGutterStyle?.backgroundColor ?? "",
    };
  });

const selectAllEditorText = async (page, waitForSelectionLayer) => {
  await page.locator(".cm-content").focus();
  const before = await page.evaluate(() =>
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
  const after = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".cm-line")).map((line) => {
      const rect = line.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        height: Math.round(rect.height),
      };
    }),
  );

  return { before, after };
};

const assertCoreEditorInvariants = async ({
  expect,
  page,
  markdown,
  waitForRenderFrame,
  waitForSelectionLayer,
}) => {
  await waitForEditorText(page, "Editor Certification");
  await waitForEditorText(page, "한글 IME 기준 문장");
  await waitForEditorText(page, "unwrapped-segment-48");
  await waitForRenderFrame(page);

  const renderedText = await getEditorText(page);
  expect(renderedText.includes("한글 IME 기준 문장입니다."), "Certification fixture should preserve Korean text.");
  expect(renderedText.includes("| Search | finds text |"), "Certification fixture should preserve GFM table text.");
  expect(renderedText.includes("[Tabula](https://tabula.md)"), "Certification fixture should preserve link source.");
  expect(renderedText.includes("unwrapped-segment-48"), "Certification fixture should preserve long line source.");

  await page.locator(".cm-content").focus();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.insertText("\n인증 입력");
  await waitForRenderFrame(page);
  expect((await getEditorText(page)).endsWith("인증 입력"), "Typing Korean text should update the editor source.");
  await page.keyboard.press("ControlOrMeta+Z");
  await waitForRenderFrame(page);
  expect(!(await getEditorText(page)).endsWith("인증 입력"), "Undo should remove one typed Korean edit.");
  await page.keyboard.press("ControlOrMeta+Shift+Z");
  await waitForRenderFrame(page);
  expect((await getEditorText(page)).endsWith("인증 입력"), "Redo should restore one typed Korean edit.");

  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(markdown);
  await waitForRenderFrame(page);

  const selectionMetrics = await selectAllEditorText(page, waitForSelectionLayer);
  expect(
    JSON.stringify(selectionMetrics.before) === JSON.stringify(selectionMetrics.after),
    "Selection layer should not move or resize editor text lines.",
  );
  const selectionState = await page.evaluate(() => {
    const activeLine = document.querySelector(".cm-activeLine");
    const activeGutter = document.querySelector(".cm-activeLineGutter");
    return {
      segmentCount: document.querySelectorAll(".cm-selectionLayer .cm-selectionBackground").length,
      activeLineBackground: activeLine instanceof HTMLElement ? getComputedStyle(activeLine).backgroundColor : "",
      activeGutterBackground: activeGutter instanceof HTMLElement ? getComputedStyle(activeGutter).backgroundColor : "",
    };
  });
  expect(selectionState.segmentCount >= 1, "CodeMirror should render its native selection layer for a multi-line fixture.");
  expect(
    selectionState.activeLineBackground === "rgba(0, 0, 0, 0)" &&
      selectionState.activeGutterBackground === "rgba(0, 0, 0, 0)",
    "Active line styling should not obscure selected text.",
  );

  await page.keyboard.press("Escape");
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(markdown);
  await page.getByRole("button", { name: "Editor controls", exact: true }).click();
  await page.getByRole("button", { name: "Line Wrapping" }).click();
  await waitForRenderFrame(page);
  const unwrappedLayout = await readLineNumberLayout(page);
  expect(unwrappedLayout.scrollLeft > 0, "Wrapping-off fixture should be horizontally scrollable.");
  expect(
    unwrappedLayout.gutterBackground !== "" && unwrappedLayout.gutterBackground !== "rgba(0, 0, 0, 0)",
    "Line number gutters should stay opaque when wrapping is disabled.",
  );
  expect(Number(unwrappedLayout.gutterZIndex) >= 1, "Line number gutters should stay above scrolled text.");
  expect(
    unwrappedLayout.activeLineBackground === "rgba(0, 0, 0, 0)",
    "The editor active line should stay quiet while focus remains on document controls.",
  );
  expect(
    unwrappedLayout.activeGutterBackground === "rgba(0, 0, 0, 0)",
    "Active-line styling should not duplicate across the line-number gutter.",
  );
  await page.locator(".cm-content").focus();
  await waitForRenderFrame(page);
  const focusedUnwrappedLayout = await readLineNumberLayout(page);
  expect(
    focusedUnwrappedLayout.activeLineBackground !== "" &&
      focusedUnwrappedLayout.activeLineBackground !== "rgba(0, 0, 0, 0)",
    "Focused active-line styling should remain visible in the document content.",
  );
  expect(
    focusedUnwrappedLayout.activeGutterBackground === "rgba(0, 0, 0, 0)",
    "Focused active-line styling should remain confined to document content.",
  );
  await page.getByRole("button", { name: "Editor controls", exact: true }).click();
  await page.getByRole("button", { name: "Line Wrapping" }).click();
  await waitForRenderFrame(page);
};

const assertSearchReplaceInvariants = async ({ expect, page, markdown, waitForRenderFrame }) => {
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(markdown);
  await waitForRenderFrame(page);

  await page.keyboard.press("ControlOrMeta+F");
  await page.getByRole("button", { name: "Toggle replace" }).click();
  await page.getByRole("searchbox", { name: "Search" }).fill("https://tabula.md/favicon.svg");
  await page.getByLabel("Replace with").fill("https://example.com/favicon.svg");
  await page.getByRole("button", { name: "Replace match" }).click();
  await waitForRenderFrame(page);
  expect(
    (await getEditorText(page)).includes("![alt text](https://example.com/favicon.svg)"),
    "Replace current should update the active match through the editor transaction path.",
  );
  await page.locator(".cm-content").focus();
  await page.keyboard.press("ControlOrMeta+Z");
  await waitForRenderFrame(page);
  const replaceUndoText = await getEditorText(page);
  const replaceUndoActiveElement = await page.evaluate(() => ({
    tag: document.activeElement?.tagName ?? "",
    ariaLabel: document.activeElement?.getAttribute("aria-label") ?? "",
  }));
  expect(
    replaceUndoText.includes("![alt text](https://tabula.md/favicon.svg)"),
    `Replace current should be undoable as one editor transaction. ` +
      `active=${JSON.stringify(replaceUndoActiveElement)} ` +
      `hasReplacement=${replaceUndoText.includes("https://example.com/favicon.svg")} ` +
      `length=${replaceUndoText.length}`,
  );

  await page.getByRole("searchbox", { name: "Search" }).fill("Markdown");
  await page.getByLabel("Replace with").fill("MD");
  await page.getByRole("button", { name: "Replace all" }).click();
  await waitForRenderFrame(page);
  const replacedText = await getEditorText(page);
  expect(replacedText.includes("MD"), "Replace all should update matching text.");
  expect(!replacedText.includes("Markdown"), "Replace all should remove the searched term from the fixture.");
  await page.locator(".cm-content").focus();
  await page.keyboard.press("ControlOrMeta+Z");
  await waitForRenderFrame(page);
  expect(
    (await getEditorText(page)).includes("Markdown"),
    "Replace all should be undoable as one editor transaction.",
  );

  await page.getByRole("button", { name: "Close search" }).click();
};

const assertTaskAndLinkInvariants = async ({ expect, page, waitForRenderFrame }) => {
  const interactionFixture = "- [ ] task item\n[Tabula](https://tabula.md)";
  await page.locator(".cm-content").focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(interactionFixture);
  await waitForRenderFrame(page);

  await page.getByRole("button", { name: "Split", exact: true }).click();
  await waitForRenderFrame(page);
  await page.locator(".preview-task-checkbox").first().dispatchEvent("click");
  await waitForRenderFrame(page);
  expect(
    (await getEditorText(page)).includes("- [x] task item"),
    "Clicking a preview checklist marker should toggle the task source.",
  );
  await clickEditorLineOffset(page, "- [x] task item", 3);
  await page.keyboard.press("ControlOrMeta+Z");
  await waitForRenderFrame(page);
  expect(
    (await getEditorText(page)).includes("- [ ] task item"),
    "Preview task toggles should be undoable as one editor transaction.",
  );

  await clickEditorLineOffset(page, "[Tabula](https://tabula.md)", 2);
  await waitForRenderFrame(page);
  expect(
    (await page.getByLabel("Link URL").count()) === 0 &&
      (await page.getByRole("button", { name: "Open", exact: true }).count()) === 0,
    "Placing the cursor inside a Markdown link should not open a link action popover.",
  );
  expect(
    (await getEditorText(page)).includes("[Tabula](https://tabula.md)"),
    "Inspecting a Markdown link should not mutate its source.",
  );
};

export async function run(ctx) {
  const {
    baseUrl,
    browser,
    expect,
    focusMarkdownEditor,
    waitForEditorReady,
    waitForRenderFrame,
    waitForSelectionLayer,
    waitForShareDialogState,
    withPage,
  } = ctx;
  const markdown = buildEditorCertificationMarkdown();

  await withPage(browser, "/", async (page) => {
    await importMarkdownFixture(page, markdown);
    await waitForEditorReady(page, { mode: "edit" });
    await assertCoreEditorInvariants({
      expect,
      page,
      markdown,
      waitForRenderFrame,
      waitForSelectionLayer,
    });
    await assertSearchReplaceInvariants({
      expect,
      page,
      markdown,
      waitForRenderFrame,
    });
    await assertTaskAndLinkInvariants({
      expect,
      page,
      waitForRenderFrame,
    });
  });

  await withPage(
    browser,
    "/",
    async (page) => {
      await importMarkdownFixture(page, markdown, "editor-certification-narrow.md");
      await waitForEditorReady(page, { mode: "edit" });
      await focusMarkdownEditor(page);
      await waitForEditorText(page, "한글 IME 기준 문장");
      const narrowState = await page.evaluate(() => {
        const shell = document.querySelector(".file-shell");
        const editor = document.querySelector(".cm-editor");
        const content = document.querySelector(".cm-content");
        const toolbar = document.querySelector(".document-toolbar-row");
        const editorRect = editor instanceof HTMLElement ? editor.getBoundingClientRect() : null;
        const contentRect = content instanceof HTMLElement ? content.getBoundingClientRect() : null;
        const toolbarRect = toolbar instanceof HTMLElement ? toolbar.getBoundingClientRect() : null;
        return {
          shellHasFile: shell instanceof HTMLElement && !shell.classList.contains("empty"),
          editorWidth: editorRect?.width ?? 0,
          contentWidth: contentRect?.width ?? 0,
          toolbarBottom: toolbarRect?.bottom ?? 0,
          contentTop: contentRect?.top ?? 0,
        };
      });
      expect(narrowState.shellHasFile, "Narrow editor should still render an active file shell.");
      expect(narrowState.editorWidth > 260, "Narrow editor should keep a usable editing width.");
      expect(narrowState.contentWidth > 180, "Narrow editor content should stay readable.");
      expect(
        narrowState.contentTop >= narrowState.toolbarBottom - 1,
        "Narrow editor content should not overlap the toolbar.",
      );
    },
    { viewport: { width: 390, height: 820 } },
  );

  const firstContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  try {
    await firstPage.goto(baseUrl);
    await firstPage.waitForSelector(".tabbar");
    await firstPage.getByRole("button", { name: "New document", exact: true }).click();
    await waitForEditorReady(firstPage, { mode: "edit" });
    const targetFileName = await firstPage.locator(".tab-item.active").getAttribute("data-file-name");
    expect(Boolean(targetFileName), "The remote cursor target document should be available.");
    await firstPage.locator(".share-trigger").click();
    await waitForShareDialogState(firstPage, { panel: "Share link" });
    await firstPage.getByRole("button", { name: "Start session" }).click();
    await waitForShareDialogState(firstPage, { text: "Share link" });
    const shareUrl = firstPage.url();
    await firstPage.keyboard.press("Escape");

    const roomUrl = new URL(shareUrl);
    await secondPage.goto(`${baseUrl}${roomUrl.pathname}${roomUrl.hash}`);
    await secondPage.waitForSelector(".tab-item.active[data-room-id]:not([data-room-id=''])");
    const targetTab = secondPage.locator(`.tab-item[data-file-name="${targetFileName}"] .tab-select-button`);
    if ((await targetTab.count()) === 1) {
      await targetTab.click();
    } else {
      await secondPage.getByRole("button", { name: "Toggle side panel" }).click();
      await secondPage.getByRole("button", { name: "Files", exact: true }).click();
      await secondPage.getByRole("button", { name: `Open ${targetFileName}` }).click();
    }
    await secondPage.waitForFunction(
      ({ fileName }) =>
        document.querySelector(".tab-item.active")?.getAttribute("data-file-name") === fileName,
      { fileName: targetFileName },
    );
    await waitForEditorReady(secondPage, { mode: "edit" });
    await firstPage.waitForFunction(() => document.querySelectorAll(".sharing-presence .avatar:not(.self)").length >= 1);
    await focusMarkdownEditor(secondPage);
    await secondPage.keyboard.press("ControlOrMeta+A");
    await secondPage.keyboard.insertText("Remote cursor baseline");
    await waitForEditorText(firstPage, "Remote cursor baseline", 12_000);
    await secondPage.keyboard.press("ControlOrMeta+End");
    await secondPage.keyboard.insertText("\nremote cursor certification");
    await waitForEditorText(secondPage, "remote cursor certification", 4_000);
    await waitForEditorText(firstPage, "remote cursor certification", 12_000);
    await firstPage.waitForSelector(".cm-ySelectionCaret", { state: "attached", timeout: 8_000 });
    await firstPage.waitForSelector(".cm-ySelectionInfo", { state: "attached", timeout: 8_000 });

    const remoteCursorLayout = await firstPage.evaluate(() => {
      const cursor = document.querySelector(".cm-ySelectionCaret");
      const label = document.querySelector(".cm-ySelectionInfo");
      const cursorStyle = cursor instanceof HTMLElement ? getComputedStyle(cursor) : null;
      const labelStyle = label instanceof HTMLElement ? getComputedStyle(label) : null;
      const cursorRect = cursor instanceof HTMLElement ? cursor.getBoundingClientRect() : null;
      const lines = Array.from(document.querySelectorAll(".cm-content .cm-line")).map((line) => {
        const clone = line.cloneNode(true);
        clone.querySelectorAll(".cm-ySelectionCaret").forEach((remoteCursor) => remoteCursor.remove());
        return clone.textContent ?? "";
      });
      return {
        cursorWidth: cursorRect?.width ?? -1,
        cursorDisplay: cursorStyle?.display ?? "",
        cursorMarginLeft: cursorStyle?.marginLeft ?? "",
        cursorMarginRight: cursorStyle?.marginRight ?? "",
        labelPosition: labelStyle?.position ?? "",
        labelZIndex: labelStyle?.zIndex ?? "",
        remoteLineCount: document.querySelectorAll(".cm-yLineSelection").length,
        text: lines.join("\n"),
      };
    });
    expect(
      remoteCursorLayout.cursorWidth <= 2 &&
        remoteCursorLayout.cursorMarginLeft === "-1px" &&
        remoteCursorLayout.cursorMarginRight === "-1px",
      "Remote cursor marker should not consume text width.",
    );
    expect(remoteCursorLayout.cursorDisplay === "inline", "Remote cursor marker should stay inline.");
    expect(remoteCursorLayout.labelPosition === "absolute", "Remote cursor label should not affect line layout.");
    expect(Number(remoteCursorLayout.labelZIndex) >= 1, "Remote cursor label should render above editor text.");
    expect(remoteCursorLayout.remoteLineCount === 0, "Remote cursor should not add a line-level presence rail.");
    expect(
      remoteCursorLayout.text.includes("remote cursor certification"),
      "Remote cursor certification should preserve byte-level text after removing cursor widgets.",
    );
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
}
