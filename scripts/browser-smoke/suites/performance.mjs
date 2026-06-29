export const id = "performance";
export const description = "Long-document split resize hot-path regression checks.";

const LONG_MARKDOWN_SECTION_COUNT = 58;
const MIN_FIXTURE_WORDS = 3_500;
const MAX_FIXTURE_WORDS = 4_000;
const SPLIT_RESIZE_POINTER_MOVE_STEPS = 36;
const SPLIT_RESIZE_MAX_ELAPSED_MS = 6_000;
const SPLIT_RESIZE_MAX_FRAME_GAP_MS = 750;
const SPLIT_RESIZE_MAX_LONG_TASK_MS = 1_500;

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

export async function run(ctx) {
  const {
    browser,
    expect,
    focusMarkdownEditor,
    waitForEditorReady,
    waitForRenderFrame,
    waitForSavedLocally,
    withPage,
  } = ctx;
  const longMarkdown = buildLongMarkdown();
  const wordCount = longMarkdown.trim().split(/\s+/).length;

  expect(
    wordCount >= MIN_FIXTURE_WORDS && wordCount <= MAX_FIXTURE_WORDS,
    `Split resize performance fixture should contain 3,500-4,000 words. Actual: ${wordCount}.`,
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
        finalMetrics.projectWrites >= 1 && finalMetrics.projectWrites <= 2,
        "Split resize should persist only the final committed ratio.",
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
}
