import {
  buildLargeEditorMarkdown,
  buildOneMegabyteEditorMarkdown,
} from "../support/editor-fixtures.mjs";

export const id = "performance";
export const description = "Long-document split resize hot-path regression checks.";

const LARGE_SPLIT_LINE_COUNT = 3_000;
const MIN_SPLIT_FIXTURE_WORDS = 14_000;
const SPLIT_RESIZE_POINTER_MOVE_STEPS = 36;
const SPLIT_RESIZE_MAX_ELAPSED_MS = 2_500;
const SPLIT_RESIZE_MAX_FRAME_GAP_MS = 80;
const SPLIT_RESIZE_MAX_LONG_TASK_MS = 120;
const SPLIT_PREVIEW_LINE_ACTION_MAX = 200;
const SPLIT_PREVIEW_RENDERED_BLOCK_MAX = 220;
const SPLIT_CODEMIRROR_LINE_DOM_MAX = 250;
const LARGE_EDITOR_MIN_LINES = 5_000;
const LARGE_EDITOR_TYPING_MAX_MS = 5_000;
const LARGE_EDITOR_SEARCH_MAX_MS = 5_000;
const LARGE_EDITOR_PREVIEW_MAX_MS = 7_000;
const LARGE_EDITOR_SELECTION_MAX_MS = 5_000;
const ONE_MEGABYTE_PREVIEW_MAX_MS = 12_000;
const REMOTE_PRESENCE_MAX_MS = 10_000;
const LARGE_PASTE_WORDS = 14_758;
const LARGE_PASTE_MAX_ELAPSED_MS = 3_000;
const LARGE_PASTE_MAX_LONG_TASK_MS = 250;
const PLAIN_SPLIT_WORDS = 10_000;
const PLAIN_SPLIT_LINE_COUNT = 1_000;
const PLAIN_SPLIT_PREVIEW_NODE_MAX = 350;
const PLAIN_SPLIT_RENDERED_BLOCK_MAX = 20;
const PLAIN_SPLIT_TYPE_MAX_LONG_TASK_MS = 120;
const PLAIN_SPLIT_TYPE_MAX_FRAME_GAP_MS = 90;
const HTML_TABLE_DOC_CHAR_MIN = 150_000;
const HTML_TABLE_DOC_WORD_MIN = 14_000;
const HTML_TABLE_DOC_PREVIEW_NODE_MAX = 800;
const HTML_TABLE_DOC_RENDERED_BLOCK_MAX = 120;
const HTML_TABLE_DOC_INTERACTION_MAX_FRAME_GAP_MS = 120;
const HTML_TABLE_DOC_TYPE_MAX_LONG_TASK_MS = 120;
const HTML_TABLE_DOC_CLICK_MAX_LONG_TASK_MS = 80;
const HTML_TABLE_DOC_SCROLL_MAX_LONG_TASK_MS = 120;
const HTML_TABLE_DOC_RESIZE_MAX_ELAPSED_MS = 1_500;
const HTML_TABLE_DOC_RESIZE_MAX_LONG_TASK_MS = 100;
const SMALL_PREVIEW_UPDATE_MAX_MS = 600;
const KOREAN_SPLIT_LINE_COUNT = 2_200;
const KOREAN_SPLIT_CHAR_MIN = 120_000;
const KOREAN_SPLIT_PREVIEW_NODE_MAX = 700;
const KOREAN_SPLIT_RENDERED_BLOCK_MAX = 120;
const KOREAN_SPLIT_TYPE_MAX_LONG_TASK_MS = 120;
const KOREAN_SPLIT_TYPE_MAX_FRAME_GAP_MS = 120;
const ONE_MEGABYTE_SPLIT_PREVIEW_NODE_MAX = 900;
const ONE_MEGABYTE_SPLIT_RENDERED_BLOCK_MAX = 120;
const ONE_MEGABYTE_SPLIT_INITIAL_MAX_MS = 2_500;
const ONE_MEGABYTE_SPLIT_TYPE_MAX_LONG_TASK_MS = 160;
const ONE_MEGABYTE_SPLIT_TYPE_MAX_FRAME_GAP_MS = 140;
const HOT_PATH_COMMIT_GUARD_MS = 90;
const PROJECT_STORAGE_KEY = "tabula.project.v5";

const reportPerformanceMetric = (name, metrics) => {
  console.log(`[performance] ${name}: ${JSON.stringify(metrics)}`);
};

const buildLongMarkdown = () => {
  const normalLine =
    "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu";
  const koreanLine = "한글과 English가 섞인 긴 Markdown 문장입니다. 커서, 선택, 스크롤 기준을 함께 확인합니다.";
  return Array.from({ length: LARGE_SPLIT_LINE_COUNT }, (_, index) => {
    const lineNumber = index + 1;
    if (lineNumber % 101 === 0) {
      return [
        "```ts",
        `const performanceProbe${lineNumber} = "large split fenced code";`,
        "console.log(performanceProbe);",
        "```",
      ].join("\n");
    }
    if (lineNumber % 43 === 0) {
      return [
        "| Area | Expected |",
        "| --- | --- |",
        `| Split ${lineNumber} | ${normalLine} |`,
      ].join("\n");
    }
    if (lineNumber % 29 === 0) {
      return `Line ${lineNumber} ${koreanLine}`;
    }
    if (lineNumber % 17 === 0) {
      return `## Performance Section ${lineNumber}\n\nParagraph ${lineNumber} ${normalLine}.`;
    }
    if (lineNumber % 11 === 0) {
      return `- [ ] Task ${lineNumber} with markdown **bold** and [link](https://example.com)`;
    }
    if (lineNumber % 7 === 0) {
      return `> Quote ${lineNumber} ${normalLine}.`;
    }
    return `Line ${lineNumber} ${normalLine}.`;
  }).join("\n");
};

const buildGlobalSyntaxFallbackMarkdown = () =>
  [
    "# Global Markdown Context",
    "",
    "This document should prefer correctness over virtual preview.",
    "",
    "[Reference link][tabula]",
    "",
    "[tabula]: https://tabula.md",
    "",
    "Term",
    ": Definition that depends on whole-document parsing.",
    "",
    "<Frame>",
    "  <img src=\"https://tabula.md/favicon.svg\" alt=\"Tabula\" />",
    "</Frame>",
  ].join("\n");

const buildHtmlTableDocsMarkdown = () => {
  const lines = [
    "# Documentation",
    "",
    '<hr data-sidebar-group="Get Started" />',
    "",
    "## Installation",
    "",
    "htmx is a single JavaScript file with no dependencies. No build step is required to use it.",
    "",
    "```html",
    '<script src="https://cdn.jsdelivr.net/npm/htmx.org/dist/htmx.min.js" crossorigin="anonymous"></script>',
    "```",
    "",
    "| Attribute | Type | Description |",
    "| --- | --- | --- |",
    ...Array.from(
      { length: 33 },
      (_, index) =>
        `| hx-docs-${index + 1} | string | Long table row ${index + 1} should stay a virtual preview block rather than forcing a full document render. |`,
    ),
  ];

  const paragraph =
    "Agents and people can read this Markdown file, scan examples, edit prose, compare instructions, and keep writing without waiting for preview rendering or collaboration bookkeeping.";
  let section = 0;
  while (Buffer.byteLength(lines.join("\n"), "utf8") < HTML_TABLE_DOC_CHAR_MIN + 2_000) {
    section += 1;
    lines.push(
      "",
      `## API Section ${section}`,
      "",
      `${paragraph} ${paragraph}`,
      "",
      section % 8 === 0
        ? [
            "<Frame>",
            `  <img src="https://example.com/diagram-${section}.png" alt="diagram ${section}" />`,
            "</Frame>",
          ].join("\n")
        : `- [ ] Review endpoint ${section} before launch`,
      "",
      "```html",
      `<button hx-post="/clicked-${section}" hx-target="#result-${section}">Save ${section}</button>`,
      "```",
    );
  }

  return lines.join("\n");
};

const buildLargePasteMarkdown = () =>
  Array.from({ length: LARGE_PASTE_WORDS }, (_, index) => `paste-latency-${index + 1}`).join(" ");

const buildPlainSplitMarkdown = () =>
  Array.from({ length: PLAIN_SPLIT_LINE_COUNT }, (_, lineIndex) =>
    Array.from({ length: PLAIN_SPLIT_WORDS / PLAIN_SPLIT_LINE_COUNT }, (_, wordIndex) => {
      const index = lineIndex * (PLAIN_SPLIT_WORDS / PLAIN_SPLIT_LINE_COUNT) + wordIndex + 1;
      return `plain-${index}`;
    }).join(" "),
  ).join("\n");

const buildSingleLinePlainSplitMarkdown = () =>
  Array.from({ length: PLAIN_SPLIT_WORDS }, (_, index) => `plain-${index + 1}`).join(" ");

const buildKoreanSplitMarkdown = () => {
  const koreanSentence =
    "탭룰라는 긴 한글 문서에서도 커서 이동, 줄 선택, 미리보기 스크롤, 협업 상태가 편집 입력을 막지 않아야 합니다.";
  const mixedSentence =
    "Markdown source, preview, comments, bookmarks, and collaboration metadata must stay outside the typing hot path.";
  return Array.from({ length: KOREAN_SPLIT_LINE_COUNT }, (_, index) => {
    const lineNumber = index + 1;
    if (lineNumber % 37 === 0) {
      return [
        `## 한글 성능 섹션 ${lineNumber}`,
        "",
        `${koreanSentence} ${mixedSentence}`,
      ].join("\n");
    }
    if (lineNumber % 19 === 0) {
      return [
        "| 항목 | 설명 |",
        "| --- | --- |",
        `| ${lineNumber} | ${koreanSentence} |`,
      ].join("\n");
    }
    if (lineNumber % 13 === 0) {
      return `- [ ] ${lineNumber}번째 확인 항목: ${koreanSentence}`;
    }
    if (lineNumber % 11 === 0) {
      return `> ${lineNumber}번째 인용문입니다. ${koreanSentence}`;
    }
    return `${lineNumber}. ${koreanSentence} ${mixedSentence}`;
  }).join("\n");
};

const installLargePasteProbe = () => {
  window.__tabulaLargePasteProbe?.restore?.();
  const originalSetItem = Storage.prototype.setItem;
  const metrics = {
    frames: [],
    longTasks: [],
    projectWrites: 0,
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

  Storage.prototype.setItem = function setItem(key, value) {
    if (key === PROJECT_STORAGE_KEY) {
      metrics.projectWrites += 1;
    }

    return originalSetItem.call(this, key, value);
  };

  window.__tabulaLargePasteProbe = {
    start() {
      metrics.frames = [];
      metrics.longTasks = [];
      metrics.projectWrites = 0;
      lastFrameTime = 0;
      running = true;
      frameRequest = window.requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      if (frameRequest !== null) {
        window.cancelAnimationFrame(frameRequest);
        frameRequest = null;
      }
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
      delete window.__tabulaLargePasteProbe;
    },
  };
};

const installSplitResizeProbe = () => {
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

const waitForEditorDocumentText = async (page, text, timeout = 8_000) => {
  await page.waitForFunction(
    ({ text }) => {
      const content = document.querySelector(".cm-content");
      const view =
        content?.cmView?.view ??
        content?.cmTile?.view ??
        content?.parentElement?.cmView?.view ??
        content?.parentElement?.cmTile?.view ??
        document.querySelector(".cm-editor")?.cmView?.view;
      return typeof view?.state?.doc?.toString === "function"
        ? view.state.doc.toString().includes(text)
        : Array.from(document.querySelectorAll(".cm-content .cm-line")).some((line) =>
            line.textContent?.includes(text),
          );
    },
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
  const largePasteMarkdown = buildLargePasteMarkdown();
  const htmlTableDocsMarkdown = buildHtmlTableDocsMarkdown();
  const koreanSplitMarkdown = buildKoreanSplitMarkdown();
  const globalSyntaxFallbackMarkdown = [
    buildGlobalSyntaxFallbackMarkdown(),
    "",
    ...Array.from({ length: LARGE_SPLIT_LINE_COUNT }, (_, index) => `Fallback context line ${index + 1}`),
  ].join("\n");
  const wordCount = longMarkdown.trim().split(/\s+/).length;
  const splitLineCount = longMarkdown.split("\n").length;
  const largeEditorLineCount = largeEditorMarkdown.split("\n").length;
  const oneMegabyteByteLength = Buffer.byteLength(oneMegabyteMarkdown, "utf8");
  const htmlTableDocsByteLength = Buffer.byteLength(htmlTableDocsMarkdown, "utf8");
  const htmlTableDocsWordCount = htmlTableDocsMarkdown.trim().split(/\s+/).length;
  const htmlTableDocsLineCount = htmlTableDocsMarkdown.split("\n").length;
  const koreanSplitByteLength = Buffer.byteLength(koreanSplitMarkdown, "utf8");
  const koreanSplitLineCount = koreanSplitMarkdown.split("\n").length;
  const globalSyntaxFallbackLineCount = globalSyntaxFallbackMarkdown.split("\n").length;

  expect(
    wordCount >= MIN_SPLIT_FIXTURE_WORDS && splitLineCount >= LARGE_SPLIT_LINE_COUNT,
    `Split performance fixture should contain at least ${MIN_SPLIT_FIXTURE_WORDS.toLocaleString()} words and ${LARGE_SPLIT_LINE_COUNT.toLocaleString()} lines. Actual: ${wordCount} words, ${splitLineCount} lines.`,
  );
  expect(
    largeEditorLineCount >= LARGE_EDITOR_MIN_LINES,
    `Large editor fixture should contain at least 5,000 lines. Actual: ${largeEditorLineCount}.`,
  );
  expect(
    oneMegabyteByteLength >= 1_000_000,
    `One-megabyte editor fixture should be at least 1MB. Actual: ${oneMegabyteByteLength}.`,
  );
  expect(
    htmlTableDocsByteLength >= HTML_TABLE_DOC_CHAR_MIN && htmlTableDocsWordCount >= HTML_TABLE_DOC_WORD_MIN,
    `HTML/table docs fixture should match the reported performance shape. Actual: ${htmlTableDocsByteLength} bytes, ${htmlTableDocsWordCount} words.`,
  );
  expect(
    koreanSplitByteLength >= KOREAN_SPLIT_CHAR_MIN && koreanSplitLineCount >= KOREAN_SPLIT_LINE_COUNT,
    `Korean split fixture should contain enough multilingual text. Actual: ${koreanSplitByteLength} bytes, ${koreanSplitLineCount} lines.`,
  );
  expect(
    globalSyntaxFallbackLineCount >= LARGE_SPLIT_LINE_COUNT,
    `Global-syntax fallback fixture should contain at least ${LARGE_SPLIT_LINE_COUNT.toLocaleString()} lines. Actual: ${globalSyntaxFallbackLineCount}.`,
  );
  reportPerformanceMetric("fixture-size", {
    splitLineCount,
    splitWordCount: wordCount,
    largeEditorLineCount,
    oneMegabyteByteLength,
    htmlTableDocsByteLength,
    htmlTableDocsWordCount,
    htmlTableDocsLineCount,
    koreanSplitByteLength,
    koreanSplitLineCount,
    globalSyntaxFallbackLineCount,
  });

  await withPage(
    browser,
    "/",
    async (page) => {
      await page.getByTitle("New tab").click();
      await waitForEditorReady(page, { mode: "edit" });
      await page.getByRole("button", { name: "Split", exact: true }).click();
      await waitForEditorReady(page, { mode: "split" });
      await focusMarkdownEditor(page);

      const previewElapsed = await measureElapsed(async () => {
        await page.keyboard.insertText("instant-preview-probe");
        await page.waitForFunction(
          () => document.querySelector(".preview-surface")?.textContent?.includes("instant-preview-probe"),
          {},
          { timeout: SMALL_PREVIEW_UPDATE_MAX_MS },
        );
      });
      reportPerformanceMetric("small-immediate-preview", { elapsedMs: Math.round(previewElapsed) });
      expect(
        previewElapsed < SMALL_PREVIEW_UPDATE_MAX_MS,
        `Small plain Markdown should update split preview without noticeable debounce. Elapsed: ${Math.round(previewElapsed)}ms.`,
      );
    },
    { viewport: { width: 1440, height: 900 } },
  );

  for (const [fixtureName, plainMarkdown] of [
    ["plain-split-10k-words.md", buildPlainSplitMarkdown()],
    ["plain-split-single-line-10k-words.md", buildSingleLinePlainSplitMarkdown()],
  ]) {
    await withPage(
      browser,
      "/",
      async (page) => {
        await page.locator('input[aria-label="Import file"]').setInputFiles({
          name: fixtureName,
          mimeType: "text/markdown",
          buffer: Buffer.from(plainMarkdown),
        });
        await waitForEditorReady(page, { mode: "edit" });
        await waitForSavedLocally(page);
        await page.getByRole("button", { name: "Split", exact: true }).click();
        await waitForEditorReady(page, { mode: "split" });
        await page.waitForSelector(".workspace.split [data-preview-virtual-block]", { timeout: 8_000 });
        await waitForRenderFrame(page);

        const beforeTypeDom = await page.evaluate(() => ({
          cmScrollerClientHeight: document.querySelector(".workspace.split .cm-scroller")?.clientHeight ?? 0,
          cmScrollerScrollHeight: document.querySelector(".workspace.split .cm-scroller")?.scrollHeight ?? 0,
          previewIndexSource: document
            .querySelector(".workspace.split .preview-document.virtualized")
            ?.getAttribute("data-preview-index-source"),
          previewVirtualized: Boolean(document.querySelector(".workspace.split .preview-document.virtualized")),
          previewNodeCount: document.querySelectorAll(".workspace.split .preview-surface *").length,
          renderedBlockCount: document.querySelectorAll(".workspace.split [data-preview-virtual-block]").length,
          cmLineCount: document.querySelectorAll(".workspace.split .cm-line").length,
          lineWrappingSuspended: Boolean(document.querySelector(".workspace.split .editor-surface.line-wrapping-suspended")),
        }));
        reportPerformanceMetric(`plain-split-dom-${fixtureName}`, beforeTypeDom);
        expect(beforeTypeDom.previewVirtualized, `${fixtureName} should use virtual preview in split mode.`);
        expect(
          beforeTypeDom.previewIndexSource === "worker",
          `${fixtureName} should build the virtual preview index in a worker. Source: ${beforeTypeDom.previewIndexSource}.`,
        );
        expect(
          beforeTypeDom.previewNodeCount < PLAIN_SPLIT_PREVIEW_NODE_MAX,
          `${fixtureName} should not render the whole plain preview DOM. Nodes: ${beforeTypeDom.previewNodeCount}.`,
        );
        expect(
          beforeTypeDom.renderedBlockCount < PLAIN_SPLIT_RENDERED_BLOCK_MAX,
          `${fixtureName} should render only a small virtual preview window. Blocks: ${beforeTypeDom.renderedBlockCount}.`,
        );
        if (fixtureName.includes("single-line")) {
          expect(
            beforeTypeDom.lineWrappingSuspended,
            `${fixtureName} should suspend soft wrapping to avoid long-line layout work.`,
          );
          expect(
            beforeTypeDom.cmScrollerScrollHeight < beforeTypeDom.cmScrollerClientHeight * 2,
            `${fixtureName} should not create thousands of wrapped visual rows. Scroll height: ${beforeTypeDom.cmScrollerScrollHeight}, client height: ${beforeTypeDom.cmScrollerClientHeight}.`,
          );
        }

        await page.evaluate(installLargePasteProbe);
        await focusMarkdownEditor(page);
        await page.evaluate(() => window.__tabulaLargePasteProbe.start());
        await page.keyboard.insertText("x");
        await page.waitForTimeout(500);
        const metrics = await page.evaluate(() => window.__tabulaLargePasteProbe.stop());
        await page.evaluate(() => window.__tabulaLargePasteProbe.restore());
        const maxLongTask = Math.max(0, ...metrics.longTasks);
        const maxFrameGap = Math.max(0, ...metrics.frames);
        reportPerformanceMetric(`plain-split-type-${fixtureName}`, {
          maxFrameGap: Math.round(maxFrameGap),
          maxLongTask: Math.round(maxLongTask),
        });
        expect(
          maxLongTask < PLAIN_SPLIT_TYPE_MAX_LONG_TASK_MS,
          `${fixtureName} typing should not create a large long task. Max long task: ${Math.round(maxLongTask)}ms.`,
        );
        expect(
          maxFrameGap < PLAIN_SPLIT_TYPE_MAX_FRAME_GAP_MS,
          `${fixtureName} typing should keep frames responsive. Max frame gap: ${Math.round(maxFrameGap)}ms.`,
        );
      },
      { viewport: { width: 1600, height: 900 } },
    );
  }

  await withPage(
    browser,
    "/",
    async (page) => {
      await importMarkdownFixture(page, htmlTableDocsMarkdown, "html-table-docs-performance.md");
      await waitForEditorReady(page, { mode: "edit" });
      await waitForSavedLocally(page);
      await page.getByRole("button", { name: "Split", exact: true }).click();
      await waitForEditorReady(page, { mode: "split" });
      await page.waitForSelector(".workspace.split [data-preview-virtual-block]", { timeout: 8_000 });
      await waitForRenderFrame(page);

      const domContract = await page.evaluate(() => {
        const editorSurface = document.querySelector(".workspace.split .editor-surface");
        const cmScroller = document.querySelector(".workspace.split .cm-scroller");
        return {
          cmLineCount: document.querySelectorAll(".workspace.split .cm-line").length,
          cmScrollerClientHeight: cmScroller?.clientHeight ?? 0,
          cmScrollerScrollHeight: cmScroller?.scrollHeight ?? 0,
          editorSurfaceClientHeight: editorSurface?.clientHeight ?? 0,
          previewIndexSource: document
            .querySelector(".workspace.split .preview-document.virtualized")
            ?.getAttribute("data-preview-index-source"),
          previewNodeCount: document.querySelectorAll(".workspace.split .preview-surface *").length,
          previewRenderedBlockCount: document.querySelectorAll(".workspace.split [data-preview-virtual-block]").length,
          previewVirtualized: Boolean(document.querySelector(".workspace.split .preview-document.virtualized")),
        };
      });
      reportPerformanceMetric("html-table-docs-dom", domContract);
      expect(domContract.previewVirtualized, "HTML/table docs should use virtual preview in split mode.");
      expect(
        domContract.previewIndexSource === "worker",
        `HTML/table docs should build the virtual preview index in a worker. Source: ${domContract.previewIndexSource}.`,
      );
      expect(
        domContract.cmScrollerClientHeight > 0 &&
          domContract.cmScrollerClientHeight <= domContract.editorSurfaceClientHeight,
        `HTML/table docs should keep CodeMirror scroller viewport-bounded. Scroller height: ${domContract.cmScrollerClientHeight}, editor height: ${domContract.editorSurfaceClientHeight}.`,
      );
      expect(
        domContract.cmScrollerScrollHeight > domContract.cmScrollerClientHeight * 4,
        "HTML/table docs should keep CodeMirror as the editor scroll owner.",
      );
      expect(
        domContract.cmLineCount < SPLIT_CODEMIRROR_LINE_DOM_MAX,
        `HTML/table docs should keep editor DOM virtualized. .cm-line count: ${domContract.cmLineCount}.`,
      );
      expect(
        domContract.previewNodeCount < HTML_TABLE_DOC_PREVIEW_NODE_MAX,
        `HTML/table docs should not render a full preview DOM. Nodes: ${domContract.previewNodeCount}.`,
      );
      expect(
        domContract.previewRenderedBlockCount < HTML_TABLE_DOC_RENDERED_BLOCK_MAX,
        `HTML/table docs should render only a visible virtual preview window. Blocks: ${domContract.previewRenderedBlockCount}.`,
      );

      await page.evaluate(installLargePasteProbe);
      const measureInteraction = async (name, action, waitMs = 500) => {
        await page.evaluate(() => window.__tabulaLargePasteProbe.start());
        const elapsedMs = await measureElapsed(action);
        await page.waitForTimeout(waitMs);
        const metrics = await page.evaluate(() => window.__tabulaLargePasteProbe.stop());
        const result = {
          elapsedMs: Math.round(elapsedMs),
          maxFrameGap: Math.round(Math.max(0, ...metrics.frames)),
          maxLongTask: Math.round(Math.max(0, ...metrics.longTasks)),
        };
        reportPerformanceMetric(`html-table-docs-${name}`, result);
        return result;
      };

      const typeMetrics = await measureInteraction(
        "type",
        async () => {
          await focusMarkdownEditor(page);
          await page.keyboard.insertText("x");
        },
        700,
      );
      expect(
        typeMetrics.maxLongTask < HTML_TABLE_DOC_TYPE_MAX_LONG_TASK_MS,
        `Typing in HTML/table docs should not create a large long task. Max long task: ${typeMetrics.maxLongTask}ms.`,
      );
      expect(
        typeMetrics.maxFrameGap < HTML_TABLE_DOC_INTERACTION_MAX_FRAME_GAP_MS,
        `Typing in HTML/table docs should keep frames responsive. Max frame gap: ${typeMetrics.maxFrameGap}ms.`,
      );

      const clickMetrics = await measureInteraction(
        "line-click",
        async () => {
          await page.evaluate(() => {
            const scroller = document.querySelector(".workspace.split .cm-scroller");
            if (scroller) {
              scroller.scrollTop = scroller.scrollHeight * 0.52;
              scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
            }
          });
          await waitForRenderFrame(page);
          const editorBox = await page.locator(".workspace.split .cm-scroller").boundingBox();
          await page.mouse.click(editorBox.x + editorBox.width * 0.52, editorBox.y + editorBox.height * 0.5);
        },
        700,
      );
      expect(
        clickMetrics.maxLongTask < HTML_TABLE_DOC_CLICK_MAX_LONG_TASK_MS,
        `Clicking a line in HTML/table docs should not scan the full text. Max long task: ${clickMetrics.maxLongTask}ms.`,
      );

      for (const [name, selector] of [
        ["editor-scroll", ".workspace.split .cm-scroller"],
        ["preview-scroll", ".workspace.split .preview-surface"],
      ]) {
        const scrollMetrics = await measureInteraction(
          name,
          async () => {
            const box = await page.locator(selector).boundingBox();
            await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
            for (let index = 0; index < 8; index += 1) {
              await page.mouse.wheel(0, 650);
            }
          },
          700,
        );
        expect(
          scrollMetrics.maxLongTask < HTML_TABLE_DOC_SCROLL_MAX_LONG_TASK_MS,
          `${name} in HTML/table docs should not create a large long task. Max long task: ${scrollMetrics.maxLongTask}ms.`,
        );
        expect(
          scrollMetrics.maxFrameGap < HTML_TABLE_DOC_INTERACTION_MAX_FRAME_GAP_MS,
          `${name} in HTML/table docs should keep frames responsive. Max frame gap: ${scrollMetrics.maxFrameGap}ms.`,
        );
      }
      await page.evaluate(() => window.__tabulaLargePasteProbe.restore());

      await page.evaluate(installSplitResizeProbe);
      const initial = await page.evaluate(() => window.__tabulaReadSplitRects());
      const startX = initial.handle.x + initial.handle.width / 2;
      const startY = initial.handle.y + initial.handle.height / 2;
      const endX = Math.min(startX + 220, initial.workspace.x + initial.workspace.width - 120);
      await page.mouse.move(startX, startY);
      await page.evaluate(() => window.__tabulaSplitResizeProbe.start());
      await page.mouse.down();
      await page.mouse.move(endX, startY, { steps: SPLIT_RESIZE_POINTER_MOVE_STEPS });
      await page.mouse.up();
      await waitForRenderFrame(page);
      const resizeMetrics = await page.evaluate(() => window.__tabulaSplitResizeProbe.stop());
      await page.evaluate(() => window.__tabulaSplitResizeProbe.restore());
      const resizeElapsedMs = Math.max(0, resizeMetrics.endedAt - resizeMetrics.startedAt);
      const resizeMaxLongTask = Math.max(0, ...resizeMetrics.longTasks);
      reportPerformanceMetric("html-table-docs-resize", {
        elapsedMs: Math.round(resizeElapsedMs),
        maxLongTask: Math.round(resizeMaxLongTask),
        previewLineQueries: resizeMetrics.previewLineQueries,
        previewLineMeasurements: resizeMetrics.previewLineMeasurements,
      });
      expect(
        resizeElapsedMs < HTML_TABLE_DOC_RESIZE_MAX_ELAPSED_MS,
        `HTML/table docs divider drag should stay responsive. Elapsed: ${Math.round(resizeElapsedMs)}ms.`,
      );
      expect(
        resizeMaxLongTask < HTML_TABLE_DOC_RESIZE_MAX_LONG_TASK_MS,
        `HTML/table docs divider drag should not create a large long task. Max long task: ${Math.round(resizeMaxLongTask)}ms.`,
      );
      expect(
        resizeMetrics.previewLineQueries <= 5 && resizeMetrics.previewLineMeasurements < 500,
        `HTML/table docs divider drag should not repeatedly measure full preview lines. Queries: ${resizeMetrics.previewLineQueries}, measurements: ${resizeMetrics.previewLineMeasurements}.`,
      );
    },
    { viewport: { width: 1600, height: 900 } },
  );

  await withPage(
    browser,
    "/",
    async (page) => {
      await importMarkdownFixture(page, koreanSplitMarkdown, "korean-split-performance.md");
      await waitForEditorReady(page, { mode: "edit" });
      await waitForSavedLocally(page);
      await page.getByRole("button", { name: "Split", exact: true }).click();
      await waitForEditorReady(page, { mode: "split" });
      await page.waitForSelector(".workspace.split [data-preview-virtual-block]", { timeout: 8_000 });
      await waitForSavedLocally(page);
      await waitForRenderFrame(page);

      const domContract = await page.evaluate(() => {
        const editorSurface = document.querySelector(".workspace.split .editor-surface");
        const cmScroller = document.querySelector(".workspace.split .cm-scroller");
        return {
          cmLineCount: document.querySelectorAll(".workspace.split .cm-line").length,
          cmScrollerClientHeight: cmScroller?.clientHeight ?? 0,
          cmScrollerScrollHeight: cmScroller?.scrollHeight ?? 0,
          editorSurfaceClientHeight: editorSurface?.clientHeight ?? 0,
          previewIndexSource: document
            .querySelector(".workspace.split .preview-document.virtualized")
            ?.getAttribute("data-preview-index-source"),
          previewNodeCount: document.querySelectorAll(".workspace.split .preview-surface *").length,
          previewRenderedBlockCount: document.querySelectorAll(".workspace.split [data-preview-virtual-block]").length,
          previewVirtualized: Boolean(document.querySelector(".workspace.split .preview-document.virtualized")),
        };
      });
      reportPerformanceMetric("korean-split-dom", domContract);
      expect(domContract.previewVirtualized, "Korean split fixture should use virtual preview.");
      expect(
        domContract.previewIndexSource === "worker",
        `Korean split fixture should build the virtual preview index in a worker. Source: ${domContract.previewIndexSource}.`,
      );
      expect(
        domContract.cmScrollerClientHeight > 0 &&
          domContract.cmScrollerClientHeight <= domContract.editorSurfaceClientHeight,
        `Korean split fixture should keep CodeMirror scroller viewport-bounded. Scroller height: ${domContract.cmScrollerClientHeight}, editor height: ${domContract.editorSurfaceClientHeight}.`,
      );
      expect(
        domContract.cmLineCount < SPLIT_CODEMIRROR_LINE_DOM_MAX,
        `Korean split fixture should keep editor DOM virtualized. .cm-line count: ${domContract.cmLineCount}.`,
      );
      expect(
        domContract.previewNodeCount < KOREAN_SPLIT_PREVIEW_NODE_MAX,
        `Korean split fixture should not render a full preview DOM. Nodes: ${domContract.previewNodeCount}.`,
      );
      expect(
        domContract.previewRenderedBlockCount < KOREAN_SPLIT_RENDERED_BLOCK_MAX,
        `Korean split fixture should render only a visible virtual preview window. Blocks: ${domContract.previewRenderedBlockCount}.`,
      );

      await page.evaluate(installLargePasteProbe);
      await focusMarkdownEditor(page);
      await page.keyboard.press("ControlOrMeta+End");
      await page.evaluate(() => window.__tabulaLargePasteProbe.start());
      const typingElapsed = await measureElapsed(async () => {
        await page.keyboard.insertText("\n한글-hot-path");
        await waitForEditorDocumentText(page, "한글-hot-path", 2_000);
      });
      await page.waitForTimeout(HOT_PATH_COMMIT_GUARD_MS);
      const typingMetrics = await page.evaluate(() => window.__tabulaLargePasteProbe.stop());
      await page.evaluate(() => window.__tabulaLargePasteProbe.restore());
      const maxLongTask = Math.max(0, ...typingMetrics.longTasks);
      const maxFrameGap = Math.max(0, ...typingMetrics.frames);
      reportPerformanceMetric("korean-split-type", {
        elapsedMs: Math.round(typingElapsed),
        maxFrameGap: Math.round(maxFrameGap),
        maxLongTask: Math.round(maxLongTask),
        projectWrites: typingMetrics.projectWrites,
      });
      expect(
        maxLongTask < KOREAN_SPLIT_TYPE_MAX_LONG_TASK_MS,
        `Typing in Korean split fixture should not create a large long task. Max long task: ${Math.round(maxLongTask)}ms.`,
      );
      expect(
        maxFrameGap < KOREAN_SPLIT_TYPE_MAX_FRAME_GAP_MS,
        `Typing in Korean split fixture should keep frames responsive. Max frame gap: ${Math.round(maxFrameGap)}ms.`,
      );
      expect(
        typingMetrics.projectWrites === 0,
        `Typing should not synchronously persist workspace state before the debounce window. Writes: ${typingMetrics.projectWrites}.`,
      );
    },
    { viewport: { width: 1600, height: 900 } },
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
      await page.waitForSelector(".workspace.split [data-preview-virtual-block]", { timeout: 8_000 });
      await waitForSavedLocally(page);
      await page.waitForTimeout(300);
      await waitForRenderFrame(page);
      const splitDomContract = await page.evaluate(() => {
        const editorSurface = document.querySelector(".workspace.split .editor-surface");
        const cmScroller = document.querySelector(".workspace.split .cm-scroller");
        return {
          cmLineCount: document.querySelectorAll(".workspace.split .cm-line").length,
          cmScrollerClientHeight: cmScroller?.clientHeight ?? 0,
          cmScrollerScrollHeight: cmScroller?.scrollHeight ?? 0,
          editorSurfaceClientHeight: editorSurface?.clientHeight ?? 0,
          previewIndexSource: document
            .querySelector(".workspace.split .preview-document.virtualized")
            ?.getAttribute("data-preview-index-source"),
          previewLineActionCount: document.querySelectorAll(".workspace.split .preview-line-action").length,
          previewRenderedBlockCount: document.querySelectorAll(".workspace.split [data-preview-virtual-block]").length,
        };
      });
      reportPerformanceMetric("split-dom-contract", splitDomContract);
      expect(
        splitDomContract.previewIndexSource === "worker",
        `Large split preview should build the virtual preview index in a worker. Source: ${splitDomContract.previewIndexSource}.`,
      );
      expect(
        splitDomContract.cmScrollerClientHeight > 0 &&
          splitDomContract.cmScrollerClientHeight <= splitDomContract.editorSurfaceClientHeight,
        `CodeMirror scroller should be viewport-bounded in split view. Scroller height: ${splitDomContract.cmScrollerClientHeight}, editor surface height: ${splitDomContract.editorSurfaceClientHeight}.`,
      );
      expect(
        splitDomContract.cmScrollerScrollHeight > splitDomContract.cmScrollerClientHeight * 4,
        `CodeMirror scroller should own document scrolling. Scroller scrollHeight: ${splitDomContract.cmScrollerScrollHeight}, clientHeight: ${splitDomContract.cmScrollerClientHeight}.`,
      );
      expect(
        splitDomContract.cmLineCount < SPLIT_CODEMIRROR_LINE_DOM_MAX,
        `CodeMirror should keep editor DOM virtualized for a 3,000-line split document. .cm-line count: ${splitDomContract.cmLineCount}.`,
      );
      expect(
        splitDomContract.previewLineActionCount < SPLIT_PREVIEW_LINE_ACTION_MAX,
        `Large split preview should not render line actions for every line. Count: ${splitDomContract.previewLineActionCount}.`,
      );
      expect(
        splitDomContract.previewRenderedBlockCount < SPLIT_PREVIEW_RENDERED_BLOCK_MAX,
        `Large split preview should render only the visible virtual window. Blocks: ${splitDomContract.previewRenderedBlockCount}.`,
      );
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
        finalMetrics.previewLineQueries <= 5,
        `Split resize should only remeasure the visible preview window after pointerup. Queries: ${finalMetrics.previewLineQueries}.`,
      );
      expect(
        finalMetrics.previewLineMeasurements < 500,
        `Split resize should not measure every source line after pointerup. Measurements: ${finalMetrics.previewLineMeasurements}.`,
      );

      const elapsedMs = Math.max(0, finalMetrics.endedAt - finalMetrics.startedAt);
      const maxFrameGap = Math.max(0, ...finalMetrics.frames);
      const maxLongTask = Math.max(0, ...finalMetrics.longTasks);
      reportPerformanceMetric("split-resize", {
        elapsedMs: Math.round(elapsedMs),
        frameCount: finalMetrics.frames.length,
        maxFrameGap: Math.round(maxFrameGap),
        maxLongTask: Math.round(maxLongTask),
        previewLineQueries: finalMetrics.previewLineQueries,
        previewLineMeasurements: finalMetrics.previewLineMeasurements,
        projectWrites: finalMetrics.projectWrites,
      });
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
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });
      await page.getByTitle("New tab").click();
      await waitForEditorReady(page, { mode: "edit" });
      await focusMarkdownEditor(page);
      await page.evaluate(installLargePasteProbe);
      await page.evaluate(async (value) => navigator.clipboard.writeText(value), largePasteMarkdown);

      const pasteElapsed = await measureElapsed(async () => {
        await page.evaluate(() => window.__tabulaLargePasteProbe.start());
        await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+V`);
        await page.waitForFunction(
          ({ wordCount }) => document.querySelector(".file-status-bar")?.textContent?.includes(`${wordCount} words`),
          { wordCount: LARGE_PASTE_WORDS },
          { timeout: LARGE_PASTE_MAX_ELAPSED_MS },
        );
      });

      await page.waitForTimeout(500);
      const metrics = await page.evaluate(() => window.__tabulaLargePasteProbe.stop());
      const editModeDom = await page.evaluate(() => ({
        hasPreviewSurface: Boolean(document.querySelector(".preview-surface")),
        status: document.querySelector(".file-status-bar")?.textContent ?? "",
      }));
      await page.evaluate(() => window.__tabulaLargePasteProbe.restore());

      const maxLongTask = Math.max(0, ...metrics.longTasks);
      reportPerformanceMetric("large-paste-edit-mode", {
        elapsedMs: Math.round(pasteElapsed),
        maxLongTask: Math.round(maxLongTask),
        frameCount: metrics.frames.length,
      });
      expect(
        pasteElapsed < LARGE_PASTE_MAX_ELAPSED_MS,
        `Pasting ${LARGE_PASTE_WORDS.toLocaleString()} words should update editor status within budget. Elapsed: ${Math.round(pasteElapsed)}ms.`,
      );
      expect(
        maxLongTask < LARGE_PASTE_MAX_LONG_TASK_MS,
        `Large paste in edit mode should not render hidden preview work. Max long task: ${Math.round(maxLongTask)}ms.`,
      );
      expect(
        !editModeDom.hasPreviewSurface,
        "Edit mode should not mount the preview surface after a large paste.",
      );
    },
    { viewport: { width: 1440, height: 900 } },
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
      reportPerformanceMetric("large-editor-typing", { elapsedMs: Math.round(typingElapsed) });
      expect(
        typingElapsed < LARGE_EDITOR_TYPING_MAX_MS,
        `Typing in a 5,000-line Markdown file should stay within budget. Elapsed: ${Math.round(typingElapsed)}ms.`,
      );

      const searchElapsed = await measureElapsed(async () => {
        await page.getByRole("button", { name: "Search", exact: true }).click();
        await page.getByRole("searchbox", { name: "Search" }).fill("Task 500");
        await page.waitForSelector(".cm-search-match.active", { timeout: LARGE_EDITOR_SEARCH_MAX_MS });
      });
      reportPerformanceMetric("large-editor-search", { elapsedMs: Math.round(searchElapsed) });
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
      reportPerformanceMetric("large-editor-selection", { elapsedMs: Math.round(selectionElapsed) });
      expect(
        selectionElapsed < LARGE_EDITOR_SELECTION_MAX_MS,
        `Selection layer should render within budget for a 5,000-line file. Elapsed: ${Math.round(selectionElapsed)}ms.`,
      );

      const previewElapsed = await measureElapsed(async () => {
        await page.getByRole("button", { name: "Preview", exact: true }).click();
        await waitForEditorReady(page, { mode: "preview" });
      });
      reportPerformanceMetric("large-editor-preview-toggle", { elapsedMs: Math.round(previewElapsed) });
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
      reportPerformanceMetric("one-megabyte-preview-toggle", { elapsedMs: Math.round(previewElapsed) });
      expect(
        previewElapsed < ONE_MEGABYTE_PREVIEW_MAX_MS,
        `Preview toggle should stay within budget for a 1MB Markdown file. Elapsed: ${Math.round(previewElapsed)}ms.`,
      );
    },
    { viewport: { width: 1440, height: 900 } },
  );

  await withPage(
    browser,
    "/",
    async (page) => {
      await importMarkdownFixture(page, oneMegabyteMarkdown, "one-megabyte-split-performance.md");
      await waitForEditorReady(page, { mode: "edit" });
      await waitForSavedLocally(page);

      const splitVisibleElapsed = await measureElapsed(async () => {
        await page.getByRole("button", { name: "Split", exact: true }).click();
        await waitForEditorReady(page, { mode: "split" });
        await page.waitForFunction(
          () => document.querySelectorAll(".workspace.split [data-preview-virtual-block]").length > 0,
          {},
          { timeout: ONE_MEGABYTE_SPLIT_INITIAL_MAX_MS },
        );
      });
      await waitForSavedLocally(page);
      await page.waitForTimeout(150);
      const domContract = await page.evaluate(() => {
        const editorSurface = document.querySelector(".workspace.split .editor-surface");
        const cmScroller = document.querySelector(".workspace.split .cm-scroller");
        return {
          cmLineCount: document.querySelectorAll(".workspace.split .cm-line").length,
          cmScrollerClientHeight: cmScroller?.clientHeight ?? 0,
          cmScrollerScrollHeight: cmScroller?.scrollHeight ?? 0,
          editorSurfaceClientHeight: editorSurface?.clientHeight ?? 0,
          previewIndexSource: document
            .querySelector(".workspace.split .preview-document.virtualized")
            ?.getAttribute("data-preview-index-source"),
          previewNodeCount: document.querySelectorAll(".workspace.split .preview-surface *").length,
          previewRenderedBlockCount: document.querySelectorAll(".workspace.split [data-preview-virtual-block]").length,
          previewVirtualized: Boolean(document.querySelector(".workspace.split .preview-document.virtualized")),
        };
      });
      reportPerformanceMetric("one-megabyte-split-dom", {
        elapsedMs: Math.round(splitVisibleElapsed),
        ...domContract,
      });
      expect(
        splitVisibleElapsed < ONE_MEGABYTE_SPLIT_INITIAL_MAX_MS,
        `1MB split preview should show the first virtual window within budget. Elapsed: ${Math.round(splitVisibleElapsed)}ms.`,
      );
      expect(domContract.previewVirtualized, "1MB split fixture should use virtual preview.");
      expect(
        domContract.previewIndexSource === "worker",
        `1MB split fixture should build the virtual preview index in a worker. Source: ${domContract.previewIndexSource}.`,
      );
      expect(
        domContract.cmLineCount < SPLIT_CODEMIRROR_LINE_DOM_MAX,
        `1MB split fixture should keep editor DOM virtualized. .cm-line count: ${domContract.cmLineCount}.`,
      );
      expect(
        domContract.previewNodeCount < ONE_MEGABYTE_SPLIT_PREVIEW_NODE_MAX,
        `1MB split fixture should not render a full preview DOM. Nodes: ${domContract.previewNodeCount}.`,
      );
      expect(
        domContract.previewRenderedBlockCount < ONE_MEGABYTE_SPLIT_RENDERED_BLOCK_MAX,
        `1MB split fixture should render only a visible virtual preview window. Blocks: ${domContract.previewRenderedBlockCount}.`,
      );

      await page.evaluate(installLargePasteProbe);
      await focusMarkdownEditor(page);
      await page.keyboard.press("ControlOrMeta+End");
      await page.evaluate(() => window.__tabulaLargePasteProbe.start());
      const typingElapsed = await measureElapsed(async () => {
        await page.keyboard.insertText("\none-megabyte-hot-path");
        await waitForEditorDocumentText(page, "one-megabyte-hot-path", 2_000);
      });
      await page.waitForTimeout(HOT_PATH_COMMIT_GUARD_MS);
      const typingMetrics = await page.evaluate(() => window.__tabulaLargePasteProbe.stop());
      await page.evaluate(() => window.__tabulaLargePasteProbe.restore());
      const maxLongTask = Math.max(0, ...typingMetrics.longTasks);
      const maxFrameGap = Math.max(0, ...typingMetrics.frames);
      reportPerformanceMetric("one-megabyte-split-type", {
        elapsedMs: Math.round(typingElapsed),
        maxFrameGap: Math.round(maxFrameGap),
        maxLongTask: Math.round(maxLongTask),
        projectWrites: typingMetrics.projectWrites,
      });
      expect(
        maxLongTask < ONE_MEGABYTE_SPLIT_TYPE_MAX_LONG_TASK_MS,
        `Typing in a 1MB split document should not create a large long task. Max long task: ${Math.round(maxLongTask)}ms.`,
      );
      expect(
        maxFrameGap < ONE_MEGABYTE_SPLIT_TYPE_MAX_FRAME_GAP_MS,
        `Typing in a 1MB split document should keep frames responsive. Max frame gap: ${Math.round(maxFrameGap)}ms.`,
      );
      expect(
        typingMetrics.projectWrites === 0,
        `1MB typing should not synchronously persist workspace state before the debounce window. Writes: ${typingMetrics.projectWrites}.`,
      );
    },
    { viewport: { width: 1600, height: 900 } },
  );

  await withPage(
    browser,
    "/",
    async (page) => {
      await importMarkdownFixture(page, globalSyntaxFallbackMarkdown, "global-syntax-virtual.md");
      await waitForEditorReady(page, { mode: "edit" });
      await waitForSavedLocally(page);

      const previewElapsed = await measureElapsed(async () => {
        await page.getByRole("button", { name: "Preview", exact: true }).click();
        await waitForEditorReady(page, { mode: "preview" });
        await page.waitForFunction(
          () =>
            !document.querySelector(".preview-placeholder") &&
            document.querySelector(".preview-document")?.textContent?.includes("Reference link"),
          {},
          { timeout: LARGE_EDITOR_PREVIEW_MAX_MS },
        );
      });
      const virtualState = await page.evaluate(() => ({
        isVirtualized: Boolean(document.querySelector(".preview-document.virtualized")),
        virtualBlockCount: document.querySelectorAll("[data-preview-virtual-block]").length,
        anchors: Array.from(document.querySelectorAll(".preview-document a")).map((link) => ({
          href: link.getAttribute("href"),
          text: link.textContent,
        })),
        textSample: document.querySelector(".preview-document")?.textContent?.slice(0, 240) ?? "",
        hasReferenceLink: Array.from(document.querySelectorAll(".preview-document a")).some((link) =>
          link.getAttribute("href")?.includes("tabula.md"),
        ),
      }));
      reportPerformanceMetric("global-syntax-virtual-preview", {
        elapsedMs: Math.round(previewElapsed),
        ...virtualState,
      });
      expect(
        virtualState.isVirtualized && virtualState.virtualBlockCount > 0,
        "Large Markdown with whole-document syntax should still prefer virtual preview for interaction responsiveness.",
      );
      expect(
        virtualState.hasReferenceLink,
        "Virtual preview should preserve reference-style links by injecting global definitions into visible blocks.",
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
    await Promise.all([
      firstPage.waitForFunction(
        () => document.querySelectorAll(".sharing-presence .avatar:not(.self)").length >= 1,
        {},
        { timeout: REMOTE_PRESENCE_MAX_MS },
      ),
      secondPage.waitForFunction(
        () => document.querySelectorAll(".sharing-presence .avatar:not(.self)").length >= 1,
        {},
        { timeout: REMOTE_PRESENCE_MAX_MS },
      ),
    ]);

    const presenceElapsed = await measureElapsed(async () => {
      await focusMarkdownEditor(firstPage);
      await firstPage.keyboard.press("ControlOrMeta+End");
      await focusMarkdownEditor(secondPage);
      await secondPage.keyboard.press("ControlOrMeta+End");
      await secondPage.keyboard.insertText("\nremote-presence-performance");
      await focusMarkdownEditor(firstPage);
      await firstPage.keyboard.press("ControlOrMeta+End");
      await waitForEditorDocumentText(firstPage, "remote-presence-performance", REMOTE_PRESENCE_MAX_MS);
    });
    reportPerformanceMetric("large-collaboration-presence", { elapsedMs: Math.round(presenceElapsed) });
    expect(
      presenceElapsed < REMOTE_PRESENCE_MAX_MS,
      `Remote presence and text sync should attach within budget for a large file. Elapsed: ${Math.round(presenceElapsed)}ms.`,
    );
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()]);
  }
}
