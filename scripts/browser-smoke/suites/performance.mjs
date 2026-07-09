import {
  buildLargeEditorMarkdown,
  buildOneMegabyteEditorMarkdown,
} from "../support/editor-fixtures.mjs";

export const id = "performance";
export const description = "Long-document split resize hot-path regression checks.";

const LONG_MARKDOWN_SECTION_COUNT = 58;
const MIN_FIXTURE_WORDS = 3_500;
const MAX_FIXTURE_WORDS = 4_000;
const SPLIT_RESIZE_POINTER_MOVE_STEPS = 36;
const SPLIT_RESIZE_MAX_ELAPSED_MS = 6_000;
const SPLIT_RESIZE_MAX_FRAME_GAP_MS = 750;
const SPLIT_RESIZE_MAX_LONG_TASK_MS = 1_500;
const LARGE_EDITOR_MIN_LINES = 5_000;
const LARGE_EDITOR_TYPING_MAX_MS = 5_000;
const LARGE_EDITOR_SEARCH_MAX_MS = 5_000;
const LARGE_EDITOR_PREVIEW_MAX_MS = 7_000;
const LARGE_EDITOR_SELECTION_MAX_MS = 5_000;
const ONE_MEGABYTE_PREVIEW_MAX_MS = 12_000;
const REMOTE_PRESENCE_MAX_MS = 10_000;

const buildLongMarkdown = () => {
  const paragraph =
    "Tabula keeps Markdown readable for people and agents while preserving local-first editing, comments, bookmarks, preview context, and reliable handoff paths.";

  return Array.from({ length: LONG_MARKDOWN_SECTION_COUNT }, (_, index) =>
    [
      `## Performance Section ${index + 1}`,
      "",
      `${paragraph} ${paragraph}`,
      "",
      `- Decision ${index + 1}: keep resize interaction independent from document persistence.`,
      `- Constraint ${index + 1}: avoid rerendering the preview while the divider is moving.`,
    ].join("\n"),
  ).join("\n\n");
};

const installSplitResizeProbe = () => {
  const PROJECT_STORAGE_KEY = "tabula.project.v5";
  window.__tabulaSplitResizeProbe?.restore?.();
  window.__tabulaReadSplitRects = () => {
    const handle = document.querySelector(".split-resize-handle");
    const workspace = document.querySelector(".workspace.split");
    const editor = document.querySelector(".workspace.split .editor-surface");
    const preview = document.querySelector(".workspace.split .preview-surface");
    const handleRect = handle?.getBoundingClientRect();
    const workspaceRect = workspace?.getBoundingClientRect();
    const editorRect = editor?.getBoundingClientRect();
    const previewRect = preview?.getBoundingClientRect();

    return {
      handle: handleRect
        ? {
            x: handleRect.x,
            y: handleRect.y,
            width: handleRect.width,
            height: handleRect.height,
          }
        : null,
      workspace: workspaceRect
        ? {
            x: workspaceRect.x,
            y: workspaceRect.y,
            width: workspaceRect.width,
            height: workspaceRect.height,
          }
        : null,
      editorWidth: editorRect?.width ?? 0,
      previewWidth: previewRect?.width ?? 0,
      valueNow: handle?.getAttribute("aria-valuenow") ?? "",
    };
  };

  const metrics = {
    projectWrites: 0,
    previewLineQueries: 0,
    previewLineMeasurements: 0,
    longTasks: [],
    frames: [],
    startedAt: 0,
    endedAt: 0,
  };
  const originalSetItem = Storage.prototype.setItem;
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  const originalQuerySelectorAll = Element.prototype.querySelectorAll;

  Storage.prototype.setItem = function setItem(key, value) {
    if (key === PROJECT_STORAGE_KEY) {
      metrics.projectWrites += 1;
    }

    return originalSetItem.call(this, key, value);
  };

  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this instanceof HTMLElement && this.matches("[data-preview-line-start]")) {
      metrics.previewLineMeasurements += 1;
    }

    return originalGetBoundingClientRect.call(this);
  };

  Element.prototype.querySelectorAll = function querySelectorAll(selectors) {
    if (selectors === "[data-preview-line-start]") {
      metrics.previewLineQueries += 1;
    }

    return originalQuerySelectorAll.call(this, selectors);
  };

  let frameRequest = null;
  let lastFrameTime = 0;
  let running = false;
  const tick = (time) => {
    if (!running) {
      return;
    }

    if (lastFrameTime > 0) {
      metrics.frames.push(time - lastFrameTime);
    }
    lastFrameTime = time;
    frameRequest = window.requestAnimationFrame(tick);
  };

  const observer =
    typeof PerformanceObserver !== "undefined" &&
    PerformanceObserver.supportedEntryTypes?.includes("longtask")
      ? new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => metrics.longTasks.push(entry.duration));
        })
      : null;
  observer?.observe({ entryTypes: ["longtask"] });

  window.__tabulaSplitResizeProbe = {
    start() {
      metrics.projectWrites = 0;
      metrics.previewLineQueries = 0;
      metrics.previewLineMeasurements = 0;
      metrics.longTasks = [];
      metrics.frames = [];
      metrics.startedAt = performance.now();
      metrics.endedAt = 0;
      lastFrameTime = 0;
      running = true;
      frameRequest = window.requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      metrics.endedAt = performance.now();
      if (frameRequest !== null) {
        window.cancelAnimationFrame(frameRequest);
        frameRequest = null;
      }
      return { ...metrics };
    },
    read() {
      return { ...metrics };
    },
    restore() {
      running = false;
      if (frameRequest !== null) {
        window.cancelAnimationFrame(frameRequest);
        frameRequest = null;
      }
      observer?.disconnect();
      Storage.prototype.setItem = originalSetItem;
      Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
      Element.prototype.querySelectorAll = originalQuerySelectorAll;
      delete window.__tabulaReadSplitRects;
    },
  };
};

const importMarkdownFixture = async (page, markdown, name) => {
  await page.locator('input[aria-label="Import file"]').setInputFiles({
    name,
    mimeType: "text/markdown",
    buffer: Buffer.from(markdown),
  });
};

const measureElapsed = async (action) => {
  const startedAt = performance.now();
  await action();
  return performance.now() - startedAt;
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

export async function run(ctx) {
  const {
    browser,
    baseUrl,
    expect,
    focusMarkdownEditor,
    waitForEditorReady,
    waitForRenderFrame,
    waitForSavedLocally,
    waitForSelectionLayer,
    withPage,
  } = ctx;
  const longMarkdown = buildLongMarkdown();
  const largeEditorMarkdown = buildLargeEditorMarkdown({ sections: 500, paragraphRepeats: 1 });
  const oneMegabyteMarkdown = buildOneMegabyteEditorMarkdown();
  const wordCount = longMarkdown.trim().split(/\s+/).length;
  const largeEditorLineCount = largeEditorMarkdown.split("\n").length;
  const oneMegabyteByteLength = Buffer.byteLength(oneMegabyteMarkdown, "utf8");

  expect(
    wordCount >= MIN_FIXTURE_WORDS && wordCount <= MAX_FIXTURE_WORDS,
    `Split resize performance fixture should contain 3,500-4,000 words. Actual: ${wordCount}.`,
  );
  expect(
    largeEditorLineCount >= LARGE_EDITOR_MIN_LINES,
    `Large editor fixture should contain at least 5,000 lines. Actual: ${largeEditorLineCount}.`,
  );
  expect(
    oneMegabyteByteLength >= 1_000_000,
    `One-megabyte editor fixture should be at least 1MB. Actual: ${oneMegabyteByteLength}.`,
  );

  await withPage(
    browser,
    "/",
    async (page) => {
      await page.locator('input[aria-label="Import file"]').setInputFiles({
        name: "split-performance.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(longMarkdown),
      });
      await waitForEditorReady(page, { mode: "edit" });
      await waitForSavedLocally(page);
      await page.getByRole("button", { name: "Split", exact: true }).click();
      await waitForEditorReady(page, { mode: "split" });
      await page.waitForSelector(".workspace.split .preview-line-action-icon", { timeout: 8_000 });
      await waitForSavedLocally(page);
      await page.waitForTimeout(300);
      await waitForRenderFrame(page);
      await page.evaluate(installSplitResizeProbe);

      const initial = await page.evaluate(() => window.__tabulaReadSplitRects());
      expect(initial.handle && initial.workspace, "Split resize performance smoke should find the handle and workspace.");
      expect(initial.editorWidth > 300 && initial.previewWidth > 300, "Split panes should start wide enough to resize.");

      const startX = initial.handle.x + initial.handle.width / 2;
      const startY = initial.handle.y + initial.handle.height / 2;
      const endX = Math.min(startX + 220, initial.workspace.x + initial.workspace.width - 120);

      await page.mouse.move(startX, startY);
      await page.evaluate(() => window.__tabulaSplitResizeProbe.start());
      await page.mouse.down();
      await page.mouse.move(endX, startY, { steps: SPLIT_RESIZE_POINTER_MOVE_STEPS });
      await waitForRenderFrame(page);

      const duringDrag = await page.evaluate(() => ({
        metrics: window.__tabulaSplitResizeProbe.read(),
        rects: window.__tabulaReadSplitRects(),
      }));

      expect(
        duringDrag.rects.editorWidth > initial.editorWidth + 80 &&
          duringDrag.rects.previewWidth < initial.previewWidth - 80,
        "Split panes should resize during pointer movement before commit.",
      );
      expect(
        duringDrag.metrics.projectWrites === 0,
        "Split drag should not persist workspace state until pointerup.",
      );
      expect(
        duringDrag.metrics.previewLineMeasurements <= 2,
        "Split drag should not repeatedly measure preview line gutters while the divider is moving.",
      );
      expect(
        duringDrag.metrics.previewLineQueries <= 1,
        "Split drag should not repeatedly query preview source line blocks while the divider is moving.",
      );

      await page.mouse.up();
      await waitForRenderFrame(page);
      const finalMetrics = await page.evaluate(() => window.__tabulaSplitResizeProbe.stop());
      const finalRects = await page.evaluate(() => window.__tabulaReadSplitRects());
      await page.evaluate(() => window.__tabulaSplitResizeProbe.restore());

      expect(
        finalRects.editorWidth > initial.editorWidth + 80 &&
          finalRects.previewWidth < initial.previewWidth - 80,
        "Split panes should keep the resized ratio after pointerup commit.",
      );
      expect(Number(finalRects.valueNow) > 50, "Split resize aria value should reflect the committed editor width.");
      expect(
        finalMetrics.projectWrites <= 2,
        `Split resize should not repeatedly persist during the resize smoke. Writes: ${finalMetrics.projectWrites}.`,
      );
      expect(
        finalMetrics.previewLineQueries <= duringDrag.metrics.previewLineQueries + 1,
        "Split resize should run at most one preview line query after pointerup.",
      );

      const elapsedMs = Math.max(0, finalMetrics.endedAt - finalMetrics.startedAt);
      const maxFrameGap = Math.max(0, ...finalMetrics.frames);
      const maxLongTask = Math.max(0, ...finalMetrics.longTasks);
      expect(
        finalMetrics.frames.length > 0,
        "Split resize should keep animation frames observable while dragging.",
      );
      expect(
        elapsedMs < SPLIT_RESIZE_MAX_ELAPSED_MS,
        `Split resize should complete within the smoke latency budget. Elapsed: ${Math.round(elapsedMs)}ms.`,
      );
      expect(
        maxFrameGap < SPLIT_RESIZE_MAX_FRAME_GAP_MS,
        `Split resize should not freeze the UI thread while dragging. Max frame gap: ${Math.round(maxFrameGap)}ms.`,
      );
      expect(
        maxLongTask < SPLIT_RESIZE_MAX_LONG_TASK_MS,
        `Split resize should not create a catastrophic long task for a long Markdown file. Max long task: ${Math.round(maxLongTask)}ms.`,
      );

      await focusMarkdownEditor(page);
    },
    { viewport: { width: 1600, height: 900 } },
  );

  await withPage(
    browser,
    "/",
    async (page) => {
      await importMarkdownFixture(page, largeEditorMarkdown, "large-editor-performance.md");
      await waitForEditorReady(page, { mode: "edit" });
      await waitForSavedLocally(page);

      const typingElapsed = await measureElapsed(async () => {
        await focusMarkdownEditor(page);
        await page.keyboard.press("ControlOrMeta+End");
        await page.keyboard.insertText("\nlatency-probe");
        await waitForEditorText(page, "latency-probe", LARGE_EDITOR_TYPING_MAX_MS);
      });
      expect(
        typingElapsed < LARGE_EDITOR_TYPING_MAX_MS,
        `Typing in a 5,000-line Markdown file should stay within budget. Elapsed: ${Math.round(typingElapsed)}ms.`,
      );

      const searchElapsed = await measureElapsed(async () => {
        await page.getByRole("button", { name: "Search", exact: true }).click();
        await page.getByRole("searchbox", { name: "Search" }).fill("Task 500");
        await page.waitForSelector(".cm-search-match.active", { timeout: LARGE_EDITOR_SEARCH_MAX_MS });
      });
      expect(
        searchElapsed < LARGE_EDITOR_SEARCH_MAX_MS,
        `Search in a 5,000-line Markdown file should stay within budget. Elapsed: ${Math.round(searchElapsed)}ms.`,
      );
      await page.getByRole("button", { name: "Close search" }).click();

      const selectionElapsed = await measureElapsed(async () => {
        await focusMarkdownEditor(page);
        await page.keyboard.press("ControlOrMeta+A");
        await waitForSelectionLayer(page, { minSegments: 20 });
      });
      expect(
        selectionElapsed < LARGE_EDITOR_SELECTION_MAX_MS,
        `Selection layer should render within budget for a 5,000-line file. Elapsed: ${Math.round(selectionElapsed)}ms.`,
      );

      const previewElapsed = await measureElapsed(async () => {
        await page.getByRole("button", { name: "Preview", exact: true }).click();
        await waitForEditorReady(page, { mode: "preview" });
      });
      expect(
        previewElapsed < LARGE_EDITOR_PREVIEW_MAX_MS,
        `Preview toggle should stay within budget for a 5,000-line file. Elapsed: ${Math.round(previewElapsed)}ms.`,
      );
    },
    { viewport: { width: 1440, height: 900 } },
  );

  await withPage(
    browser,
    "/",
    async (page) => {
      await importMarkdownFixture(page, oneMegabyteMarkdown, "one-megabyte-performance.md");
      await waitForEditorReady(page, { mode: "edit" });
      await waitForSavedLocally(page);

      const previewElapsed = await measureElapsed(async () => {
        await page.getByRole("button", { name: "Preview", exact: true }).click();
        await waitForEditorReady(page, { mode: "preview" });
      });
      expect(
        previewElapsed < ONE_MEGABYTE_PREVIEW_MAX_MS,
        `Preview toggle should stay within budget for a 1MB Markdown file. Elapsed: ${Math.round(previewElapsed)}ms.`,
      );
    },
    { viewport: { width: 1440, height: 900 } },
  );

  const firstContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const firstPage = await firstContext.newPage();
  const secondPage = await secondContext.newPage();

  try {
    await firstPage.goto(baseUrl);
    await firstPage.waitForSelector(".tabbar");
    await importMarkdownFixture(firstPage, largeEditorMarkdown, "large-presence-performance.md");
    await waitForEditorReady(firstPage, { mode: "edit" });
    await firstPage.locator(".share-trigger").click();
    await firstPage.getByRole("button", { name: "Start session" }).click();
    await firstPage.waitForSelector(".tab-item.live.active");
    const shareUrl = await firstPage.locator(".share-link-display").getAttribute("title");
    await firstPage.getByRole("button", { name: "Close share dialog" }).click();

    const roomUrl = new URL(shareUrl);
    await secondPage.goto(`${baseUrl}${roomUrl.pathname}${roomUrl.hash}`);
    await secondPage.waitForSelector(".tab-item.live.active");
    await waitForEditorReady(secondPage, { mode: "edit" });

    const presenceElapsed = await measureElapsed(async () => {
      await focusMarkdownEditor(secondPage);
      await secondPage.keyboard.press("ControlOrMeta+End");
      await secondPage.keyboard.insertText("\nremote-presence-performance");
      await firstPage.waitForSelector(".cm-remote-cursor", { state: "attached", timeout: REMOTE_PRESENCE_MAX_MS });
      await waitForEditorText(firstPage, "remote-presence-performance", REMOTE_PRESENCE_MAX_MS);
    });
    expect(
      presenceElapsed < REMOTE_PRESENCE_MAX_MS,
      `Remote presence decoration should attach within budget for a large file. Elapsed: ${Math.round(presenceElapsed)}ms.`,
    );
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
}
