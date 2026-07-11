import {
  buildAsyncPreviewMediaMarkdown,
  buildHtmxSplitPreviewSyncMarkdown,
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
const HTML_TABLE_DOC_INTERACTION_MAX_FRAME_GAP_MS = 130;
const HTML_TABLE_DOC_TYPE_MAX_LONG_TASK_MS = 120;
const HTML_TABLE_DOC_CLICK_MAX_LONG_TASK_MS = 80;
const HTML_TABLE_DOC_SCROLL_MAX_LONG_TASK_MS = 120;
const HTML_TABLE_DOC_RESIZE_MAX_ELAPSED_MS = 1_800;
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
const WORKSPACE_LOCAL_STORAGE_PREFIX = "tabula.project";
const SPLIT_SYNC_UNRELATED_LINE_JUMP_MAX = 160;
const SPLIT_SYNC_IDLE_SCROLL_DRIFT_MAX = 120;
const SPLIT_SYNC_EDITOR_SCROLL_DELTA_MAX = 1;
const SPLIT_SYNC_PREVIEW_INPUT_UPDATE_MAX_MS = 500;
const ASYNC_PREVIEW_MEDIA_MIN_LINES = 900;

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
    if (key.startsWith(WORKSPACE_LOCAL_STORAGE_PREFIX)) {
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
    if (key.startsWith(WORKSPACE_LOCAL_STORAGE_PREFIX)) {
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

const readVisibleVirtualPreviewContract = () => {
  const surface = document.querySelector(".workspace.split .preview-surface");
  const surfaceRect = surface?.getBoundingClientRect();
  const cmScroller = document.querySelector(".workspace.split .cm-scroller");
  const blocks = Array.from(document.querySelectorAll(".workspace.split [data-preview-virtual-block]")).map((block) => {
    const rect = block.getBoundingClientRect();
    const sourceBlock = block.querySelector("[data-preview-line-start]");
    const startLine = Number(
      sourceBlock?.getAttribute("data-preview-line-start") ??
        block.getAttribute("data-preview-block-start-line") ??
        0,
    );
    const endLine = Number(
      sourceBlock?.getAttribute("data-preview-line-end") ??
        block.getAttribute("data-preview-block-end-line") ??
        0,
    );
    return {
      bottom: rect.bottom,
      endLine,
      height: rect.height,
      startLine,
      text: block.textContent?.replace(/\s+/g, " ").trim() ?? "",
      top: rect.top,
    };
  });
  const visibleBlocks =
    surfaceRect === undefined
      ? []
      : blocks.filter(
          (block) =>
            block.height > 1 &&
            block.text.length > 0 &&
            block.bottom > surfaceRect.top + 8 &&
            block.top < surfaceRect.bottom - 8,
        );

  return {
    cmScrollerScrollHeight: cmScroller?.scrollHeight ?? 0,
    cmScrollerScrollTop: cmScroller?.scrollTop ?? 0,
    firstRenderedBottom: Math.round(blocks[0]?.bottom ?? 0),
    clientHeight: surface?.clientHeight ?? 0,
    firstVisibleLine: visibleBlocks[0]?.startLine ?? 0,
    lastVisibleLine: visibleBlocks.at(-1)?.endLine ?? 0,
    firstRenderedLine: blocks[0]?.startLine ?? 0,
    firstRenderedText: blocks[0]?.text.slice(0, 80) ?? "",
    firstRenderedTop: Math.round(blocks[0]?.top ?? 0),
    lastRenderedBottom: Math.round(blocks.at(-1)?.bottom ?? 0),
    lastRenderedLine: blocks.at(-1)?.endLine ?? 0,
    lastRenderedText: blocks.at(-1)?.text.slice(0, 80) ?? "",
    lastRenderedTop: Math.round(blocks.at(-1)?.top ?? 0),
    renderedBlockCount: blocks.length,
    scrollHeight: surface?.scrollHeight ?? 0,
    scrollTop: surface?.scrollTop ?? 0,
    surfaceBottom: Math.round(surfaceRect?.bottom ?? 0),
    surfaceTop: Math.round(surfaceRect?.top ?? 0),
    visibleBlockCount: visibleBlocks.length,
    visibleText: visibleBlocks.map((block) => block.text).join(" ").slice(0, 240),
  };
};

const installVisibleVirtualPreviewSampler = () => {
  window.__tabulaVisibleVirtualPreviewSampler = (() => {
    let frameRequest = null;
    let running = false;
    const samples = [];

    const readSample = () => {
      const surface = document.querySelector(".workspace.split .preview-surface");
      const surfaceRect = surface?.getBoundingClientRect();
      const visibleBlocks =
        surfaceRect === undefined
          ? []
          : Array.from(document.querySelectorAll(".workspace.split [data-preview-virtual-block]")).filter((block) => {
              const rect = block.getBoundingClientRect();
              const text = block.textContent?.trim() ?? "";
              return (
                rect.height > 1 &&
                text.length > 0 &&
                rect.bottom > surfaceRect.top + 8 &&
                rect.top < surfaceRect.bottom - 8
              );
            });
      const firstVisibleBlock = visibleBlocks[0];
      const firstSourceBlock = firstVisibleBlock?.querySelector("[data-preview-line-start]");

      return {
        firstVisiblePreviewLine: Number(
          firstSourceBlock?.getAttribute("data-preview-line-start") ??
            firstVisibleBlock?.getAttribute("data-preview-block-start-line") ??
            0,
        ),
        previewScrollTop: Math.round(surface?.scrollTop ?? 0),
        visibleBlockCount: visibleBlocks.length,
      };
    };

    const sample = () => {
      samples.push(readSample());
      if (running) {
        frameRequest = window.requestAnimationFrame(sample);
      }
    };

    return {
      start() {
        samples.length = 0;
        running = true;
        frameRequest = window.requestAnimationFrame(sample);
      },
      stop() {
        running = false;
        if (frameRequest !== null) {
          window.cancelAnimationFrame(frameRequest);
          frameRequest = null;
        }

        let maxPreviewJump = 0;
        let maxLineJump = 0;
        let backwardLineSamples = 0;
        let forwardLineSamples = 0;
        for (let index = 1; index < samples.length; index += 1) {
          const lineDelta = samples[index].firstVisiblePreviewLine - samples[index - 1].firstVisiblePreviewLine;
          maxPreviewJump = Math.max(
            maxPreviewJump,
            Math.abs(samples[index].previewScrollTop - samples[index - 1].previewScrollTop),
          );
          maxLineJump = Math.max(maxLineJump, Math.abs(lineDelta));
          if (samples[index].firstVisiblePreviewLine > 0 && samples[index - 1].firstVisiblePreviewLine > 0) {
            if (lineDelta < -5) {
              backwardLineSamples += 1;
            } else if (lineDelta > 5) {
              forwardLineSamples += 1;
            }
          }
        }

        return {
          backwardLineSamples,
          blankSamples: samples.filter((sample) => sample.visibleBlockCount === 0).length,
          forwardLineSamples,
          maxLineJump,
          maxPreviewJump,
          sampleCount: samples.length,
        };
      },
    };
  })();
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

const installSplitPreviewSyncProbe = () => {
  window.__tabulaSplitPreviewSyncProbe = (() => {
    const getEditorView = () => {
      const content = document.querySelector(".workspace.split .cm-content") ?? document.querySelector(".cm-content");
      return (
        content?.cmView?.view ??
        content?.cmTile?.view ??
        content?.parentElement?.cmView?.view ??
        content?.parentElement?.cmTile?.view ??
        document.querySelector(".workspace.split .cm-editor")?.cmView?.view ??
        document.querySelector(".cm-editor")?.cmView?.view ??
        null
      );
    };

    const getSourceRange = (element) => {
      const startLine = Number(
        element.querySelector("[data-preview-line-start]")?.getAttribute("data-preview-line-start") ??
          element.getAttribute("data-preview-line-start") ??
          element.getAttribute("data-preview-block-start-line") ??
          0,
      );
      const endLine = Number(
        element.querySelector("[data-preview-line-end]")?.getAttribute("data-preview-line-end") ??
          element.getAttribute("data-preview-line-end") ??
          element.getAttribute("data-preview-block-end-line") ??
          startLine,
      );
      return { endLine, startLine };
    };

    const read = () => {
      const view = getEditorView();
      const editorScroller = document.querySelector(".workspace.split .cm-scroller");
      const previewSurface = document.querySelector(".workspace.split .preview-surface");
      const surfaceRect = previewSurface?.getBoundingClientRect();
      const visiblePreviewBlocks =
        surfaceRect === undefined
          ? []
          : Array.from(document.querySelectorAll(".workspace.split [data-preview-virtual-block]")).filter((block) => {
              const rect = block.getBoundingClientRect();
              const text = block.textContent?.trim() ?? "";
              return (
                rect.height > 1 &&
                text.length > 0 &&
                rect.bottom > surfaceRect.top + 8 &&
                rect.top < surfaceRect.bottom - 8
              );
            });
      const firstRange = visiblePreviewBlocks[0] ? getSourceRange(visiblePreviewBlocks[0]) : null;
      const lastRange = visiblePreviewBlocks.at(-1) ? getSourceRange(visiblePreviewBlocks.at(-1)) : null;
      const head = view?.state?.selection?.main?.head ?? 0;
      const selectedLine =
        typeof view?.state?.doc?.lineAt === "function" ? view.state.doc.lineAt(head).number : null;
      return {
        editorClientHeight: editorScroller?.clientHeight ?? 0,
        editorScrollHeight: editorScroller?.scrollHeight ?? 0,
        editorScrollTop: editorScroller?.scrollTop ?? 0,
        firstVisiblePreviewLine: firstRange?.startLine ?? 0,
        lastVisiblePreviewLine: lastRange?.endLine ?? 0,
        previewClientHeight: previewSurface?.clientHeight ?? 0,
        previewScrollHeight: previewSurface?.scrollHeight ?? 0,
        previewScrollTop: previewSurface?.scrollTop ?? 0,
        selectedLine,
        visiblePreviewBlockCount: visiblePreviewBlocks.length,
        visiblePreviewText: visiblePreviewBlocks
          .map((block) => block.textContent?.replace(/\s+/g, " ").trim() ?? "")
          .join(" ")
          .slice(0, 240),
      };
    };

    const scrollEditorToLine = (lineNumber, topOffset = 96) => {
      const view = getEditorView();
      if (!view) {
        throw new Error("CodeMirror view was not found.");
      }
      const line = view.state.doc.line(Math.max(1, Math.min(lineNumber, view.state.doc.lines)));
      const block = typeof view.lineBlockAt === "function" ? view.lineBlockAt(line.from) : null;
      if (block && typeof block.top === "number") {
        view.scrollDOM.scrollTop = Math.max(0, block.top - topOffset);
      } else {
        view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
      }
      view.scrollDOM.dispatchEvent(new Event("scroll", { bubbles: true }));
      return read();
    };

    const scrollEditorToBottom = () => {
      const editorScroller = document.querySelector(".workspace.split .cm-scroller");
      if (!editorScroller) {
        throw new Error("CodeMirror scroller was not found.");
      }
      editorScroller.scrollTop = Math.max(0, editorScroller.scrollHeight - editorScroller.clientHeight);
      editorScroller.dispatchEvent(new Event("scroll", { bubbles: true }));
      return read();
    };

    const setCursor = (lineNumber, column = 0) => {
      const view = getEditorView();
      if (!view) {
        throw new Error("CodeMirror view was not found.");
      }
      const line = view.state.doc.line(Math.max(1, Math.min(lineNumber, view.state.doc.lines)));
      const position = Math.max(line.from, Math.min(line.to, line.from + column));
      view.dispatch({ selection: { anchor: position }, scrollIntoView: false });
      view.focus();
      return read();
    };

    const getLineText = (lineNumber) => {
      const view = getEditorView();
      if (!view) {
        throw new Error("CodeMirror view was not found.");
      }
      return view.state.doc.line(Math.max(1, Math.min(lineNumber, view.state.doc.lines))).text;
    };

    return {
      getLineText,
      read,
      scrollEditorToBottom,
      scrollEditorToLine,
      setCursor,
    };
  })();
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
  const htmxSplitPreviewSyncMarkdown = buildHtmxSplitPreviewSyncMarkdown();
  const asyncPreviewMediaMarkdown = buildAsyncPreviewMediaMarkdown();
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
  const htmxSplitPreviewSyncLines = htmxSplitPreviewSyncMarkdown.split("\n");
  const asyncPreviewMediaLines = asyncPreviewMediaMarkdown.split("\n");
  const asyncPreviewMediaLine = asyncPreviewMediaLines.findIndex((line) =>
    line.includes("![Delayed media anchor]"),
  ) + 1;
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
    htmxSplitPreviewSyncLines.length >= 3_200 &&
      htmxSplitPreviewSyncLines[3_177] === "" &&
      htmxSplitPreviewSyncLines[3_207] === "" &&
      htmxSplitPreviewSyncLines[3_214]?.includes("data-sidebar-group"),
    "htmx split preview sync fixture should preserve the reported bottom-line shape around lines 3178, 3208, and 3215.",
  );
  expect(
    koreanSplitByteLength >= KOREAN_SPLIT_CHAR_MIN && koreanSplitLineCount >= KOREAN_SPLIT_LINE_COUNT,
    `Korean split fixture should contain enough multilingual text. Actual: ${koreanSplitByteLength} bytes, ${koreanSplitLineCount} lines.`,
  );
  expect(
    asyncPreviewMediaLines.length >= ASYNC_PREVIEW_MEDIA_MIN_LINES && asyncPreviewMediaLine > 0,
    `Async preview media fixture should be virtualized and contain delayed media. Actual: ${asyncPreviewMediaLines.length} lines, media line ${asyncPreviewMediaLine}.`,
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
    htmxSplitPreviewSyncLineCount: htmxSplitPreviewSyncLines.length,
    asyncPreviewMediaLineCount: asyncPreviewMediaLines.length,
    asyncPreviewMediaLine,
    koreanSplitByteLength,
    koreanSplitLineCount,
    globalSyntaxFallbackLineCount,
  });

  await withPage(
    browser,
    "/",
    async (page) => {
      await page.getByTitle("New document").click();
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
        typeMetrics.maxFrameGap <= HTML_TABLE_DOC_INTERACTION_MAX_FRAME_GAP_MS,
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
              await page.evaluate(() => new Promise((resolve) => window.requestAnimationFrame(resolve)));
            }
          },
          700,
        );
        expect(
          scrollMetrics.maxLongTask < HTML_TABLE_DOC_SCROLL_MAX_LONG_TASK_MS,
          `${name} in HTML/table docs should not create a large long task. Max long task: ${scrollMetrics.maxLongTask}ms.`,
        );
        expect(
          scrollMetrics.maxFrameGap <= HTML_TABLE_DOC_INTERACTION_MAX_FRAME_GAP_MS,
          `${name} in HTML/table docs should keep frames responsive. Max frame gap: ${scrollMetrics.maxFrameGap}ms.`,
        );
      }
      await page.evaluate(() => window.__tabulaLargePasteProbe.restore());

      await waitForRenderFrame(page);
      await page.waitForTimeout(100);
      await waitForRenderFrame(page);
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
      await page.route("**/tabula-delayed-media.svg**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 650));
        await route.fulfill({
          status: 200,
          contentType: "image/svg+xml",
          body: [
            '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="980" viewBox="0 0 1200 980">',
            '<rect width="1200" height="980" rx="36" fill="#f3f5f7"/>',
            '<rect x="80" y="80" width="1040" height="820" rx="24" fill="#dce6ee"/>',
            '<text x="120" y="180" font-family="Arial, sans-serif" font-size="64" fill="#24313a">Delayed media height</text>',
            '<text x="120" y="280" font-family="Arial, sans-serif" font-size="40" fill="#52616b">This image intentionally loads after preview alignment.</text>',
            "</svg>",
          ].join(""),
        });
      });
      await importMarkdownFixture(page, asyncPreviewMediaMarkdown, "async-preview-media.md");
      await waitForEditorReady(page, { mode: "edit" });
      await waitForSavedLocally(page);
      await page.getByRole("button", { name: "Split", exact: true }).click();
      await waitForEditorReady(page, { mode: "split" });
      await page.waitForSelector(".workspace.split [data-preview-virtual-block]", { timeout: 8_000 });
      await waitForRenderFrame(page);
      await page.evaluate(installSplitPreviewSyncProbe);
      await page.evaluate(
        ({ mediaLine }) => window.__tabulaSplitPreviewSyncProbe.scrollEditorToLine(Math.max(1, mediaLine - 4), 96),
        { mediaLine: asyncPreviewMediaLine },
      );
      await waitForRenderFrame(page);
      await page.waitForTimeout(120);
      await waitForRenderFrame(page);
      const beforeDelayedMediaLoad = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      await page.waitForFunction(
        () => {
          const image = document.querySelector(".workspace.split .preview-image[src*='tabula-delayed-media.svg']");
          return image instanceof HTMLImageElement && image.complete && image.naturalHeight > 0;
        },
        null,
        { timeout: 5_000 },
      );
      await waitForRenderFrame(page);
      await page.waitForTimeout(350);
      await waitForRenderFrame(page);
      const afterDelayedMediaLoad = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      await page.waitForTimeout(900);
      await waitForRenderFrame(page);
      const idleDelayedMediaLoad = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      reportPerformanceMetric("async-preview-media-height-change", {
        afterDelayedMediaLoad,
        beforeDelayedMediaLoad,
        idleDelayedMediaLoad,
      });
      expect(
        Math.abs(afterDelayedMediaLoad.editorScrollTop - beforeDelayedMediaLoad.editorScrollTop) <=
          SPLIT_SYNC_EDITOR_SCROLL_DELTA_MAX,
        `Delayed media height changes should not move the editor. Before: ${JSON.stringify(
          beforeDelayedMediaLoad,
        )}; after: ${JSON.stringify(afterDelayedMediaLoad)}.`,
      );
      expect(
        afterDelayedMediaLoad.visiblePreviewBlockCount > 0 &&
          Math.abs(afterDelayedMediaLoad.firstVisiblePreviewLine - beforeDelayedMediaLoad.firstVisiblePreviewLine) <=
            SPLIT_SYNC_UNRELATED_LINE_JUMP_MAX &&
          Math.abs(idleDelayedMediaLoad.previewScrollTop - afterDelayedMediaLoad.previewScrollTop) <=
            SPLIT_SYNC_IDLE_SCROLL_DRIFT_MAX,
        `Delayed media height changes should preserve preview context without a late jump. Before: ${JSON.stringify(
          beforeDelayedMediaLoad,
        )}; after: ${JSON.stringify(afterDelayedMediaLoad)}; idle: ${JSON.stringify(idleDelayedMediaLoad)}.`,
      );
    },
    { viewport: { width: 1600, height: 900 } },
  );

  await withPage(
    browser,
    "/",
    async (page) => {
      await importMarkdownFixture(page, htmlTableDocsMarkdown, "html-table-docs-visible-preview.md");
      await waitForEditorReady(page, { mode: "edit" });
      await waitForSavedLocally(page);
      await page.getByRole("button", { name: "Split", exact: true }).click();
      await waitForEditorReady(page, { mode: "split" });
      await page.waitForSelector(".workspace.split [data-preview-virtual-block]", { timeout: 8_000 });
      await waitForRenderFrame(page);

      const editorBox = await page.locator(".workspace.split .cm-scroller").boundingBox();
      await page.mouse.move(editorBox.x + editorBox.width * 0.5, editorBox.y + editorBox.height * 0.5);
      await page.evaluate(installVisibleVirtualPreviewSampler);
      await page.evaluate(() => window.__tabulaVisibleVirtualPreviewSampler.start());
      for (let index = 0; index < 8; index += 1) {
        await page.mouse.wheel(0, 650);
      }
      await waitForRenderFrame(page);
      await page.waitForTimeout(250);
      await waitForRenderFrame(page);
      const duringScrollPreviewContract = await page.evaluate(() => window.__tabulaVisibleVirtualPreviewSampler.stop());
      reportPerformanceMetric("html-table-docs-during-scroll-preview", duringScrollPreviewContract);
      expect(
        duringScrollPreviewContract.blankSamples === 0,
        `HTML/table docs preview should not render blank frames while the split editor is scrolling. ${JSON.stringify(
          duringScrollPreviewContract,
        )}`,
      );
      const earlyScrollPreviewContract = await page.evaluate(readVisibleVirtualPreviewContract);
      reportPerformanceMetric("html-table-docs-early-scroll-preview", earlyScrollPreviewContract);
      expect(
        earlyScrollPreviewContract.visibleBlockCount > 0,
        `HTML/table docs preview should keep visible rendered content after a short editor scroll. ${JSON.stringify(
          earlyScrollPreviewContract,
        )}`,
      );

      await page.evaluate(() => {
        const scroller = document.querySelector(".workspace.split .cm-scroller");
        if (scroller) {
          scroller.scrollTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
          scroller.dispatchEvent(new Event("scroll", { bubbles: true }));
        }
      });
      await waitForRenderFrame(page);
      await page.waitForTimeout(250);
      await waitForRenderFrame(page);
      const bottomPreviewContract = await page.evaluate(readVisibleVirtualPreviewContract);
      reportPerformanceMetric("html-table-docs-bottom-preview", bottomPreviewContract);
      expect(
        bottomPreviewContract.visibleBlockCount > 0,
        `HTML/table docs preview should keep visible rendered content when the split editor is scrolled near the end. ${JSON.stringify(
          bottomPreviewContract,
        )}`,
      );
    },
    { viewport: { width: 1600, height: 900 } },
  );

  await withPage(
    browser,
    "/",
    async (page) => {
      await importMarkdownFixture(page, htmxSplitPreviewSyncMarkdown, "htmx-split-preview-sync.md");
      await waitForEditorReady(page, { mode: "edit" });
      await waitForSavedLocally(page);
      await page.getByRole("button", { name: "Split", exact: true }).click();
      await waitForEditorReady(page, { mode: "split" });
      await page.waitForSelector(".workspace.split [data-preview-virtual-block]", { timeout: 8_000 });
      await waitForRenderFrame(page);
      await page.evaluate(installSplitPreviewSyncProbe);

      const lineShape = await page.evaluate(() => ({
        line102: window.__tabulaSplitPreviewSyncProbe.getLineText(102),
        line3178: window.__tabulaSplitPreviewSyncProbe.getLineText(3178),
        line3208: window.__tabulaSplitPreviewSyncProbe.getLineText(3208),
        line3215: window.__tabulaSplitPreviewSyncProbe.getLineText(3215),
      }));
      expect(
        lineShape.line102 === "" &&
          lineShape.line3178 === "" &&
          lineShape.line3208 === "" &&
          lineShape.line3215.includes("data-sidebar-group"),
        `htmx split sync smoke should use the reported fixture shape. ${JSON.stringify(lineShape)}`,
      );

      const editorBox = await page.locator(".workspace.split .cm-scroller").boundingBox();
      await page.mouse.move(editorBox.x + editorBox.width * 0.5, editorBox.y + editorBox.height * 0.5);
      await page.evaluate(installVisibleVirtualPreviewSampler);
      await page.evaluate(() => window.__tabulaVisibleVirtualPreviewSampler.start());
      for (let index = 0; index < 12; index += 1) {
        await page.mouse.wheel(0, 520);
        await page.waitForTimeout(80);
      }
      await waitForRenderFrame(page);
      const htmxScrollDownSamples = await page.evaluate(() => window.__tabulaVisibleVirtualPreviewSampler.stop());
      reportPerformanceMetric("htmx-split-sync-editor-scroll-down", htmxScrollDownSamples);
      expect(
        htmxScrollDownSamples.blankSamples === 0,
        `htmx split preview should not blank during continuous editor scroll. ${JSON.stringify(
          htmxScrollDownSamples,
        )}`,
      );
      expect(
        htmxScrollDownSamples.backwardLineSamples <= 2,
        `htmx split preview should move monotonically with downward editor scroll. ${JSON.stringify(
          htmxScrollDownSamples,
        )}`,
      );
      const afterScrollDown = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      await page.waitForTimeout(1_200);
      await waitForRenderFrame(page);
      const afterScrollDownIdle = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      reportPerformanceMetric("htmx-split-sync-scroll-down-idle", {
        after: afterScrollDown,
        idle: afterScrollDownIdle,
      });
      expect(
        Math.abs(afterScrollDownIdle.previewScrollTop - afterScrollDown.previewScrollTop) <=
          SPLIT_SYNC_IDLE_SCROLL_DRIFT_MAX,
        `htmx split preview should not jump after editor scrolling becomes idle. Before: ${JSON.stringify(
          afterScrollDown,
        )}; after idle: ${JSON.stringify(afterScrollDownIdle)}.`,
      );

      await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.scrollEditorToBottom());
      await waitForRenderFrame(page);
      await page.waitForTimeout(150);
      await waitForRenderFrame(page);
      const bottomState = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      expect(
        bottomState.visiblePreviewBlockCount > 0,
        `htmx split preview should render final blocks at document bottom. ${JSON.stringify(bottomState)}`,
      );
      await page.mouse.move(editorBox.x + editorBox.width * 0.5, editorBox.y + editorBox.height * 0.5);
      for (let index = 0; index < 5; index += 1) {
        await page.mouse.wheel(0, -620);
      }
      await waitForRenderFrame(page);
      await page.waitForTimeout(180);
      await waitForRenderFrame(page);
      const afterBottomScrollUp = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      reportPerformanceMetric("htmx-split-sync-bottom-scroll-up", {
        afterBottomScrollUp,
        bottomState,
      });
      expect(
        afterBottomScrollUp.editorScrollTop < bottomState.editorScrollTop - 100 &&
          afterBottomScrollUp.firstVisiblePreviewLine < bottomState.firstVisiblePreviewLine &&
          afterBottomScrollUp.visiblePreviewBlockCount > 0,
        `htmx split preview should follow upward editor scroll from document bottom. Bottom: ${JSON.stringify(
          bottomState,
        )}; after up: ${JSON.stringify(afterBottomScrollUp)}.`,
      );

      const previewBox = await page.locator(".workspace.split .preview-surface").boundingBox();
      const beforePreviewManualScroll = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      await page.mouse.move(previewBox.x + previewBox.width * 0.5, previewBox.y + previewBox.height * 0.5);
      for (let index = 0; index < 4; index += 1) {
        await page.mouse.wheel(0, -520);
      }
      await waitForRenderFrame(page);
      await page.waitForTimeout(180);
      await waitForRenderFrame(page);
      const afterPreviewManualScroll = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      reportPerformanceMetric("htmx-split-sync-preview-manual-scroll", {
        afterPreviewManualScroll,
        beforePreviewManualScroll,
      });
      expect(
        Math.abs(afterPreviewManualScroll.editorScrollTop - beforePreviewManualScroll.editorScrollTop) <=
          SPLIT_SYNC_EDITOR_SCROLL_DELTA_MAX,
        `Preview manual scroll must not move the editor. Before: ${JSON.stringify(
          beforePreviewManualScroll,
        )}; after: ${JSON.stringify(afterPreviewManualScroll)}.`,
      );

      await page.mouse.move(editorBox.x + editorBox.width * 0.5, editorBox.y + editorBox.height * 0.5);
      await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.scrollEditorToLine(100, 96));
      await waitForRenderFrame(page);
      await page.waitForTimeout(150);
      await waitForRenderFrame(page);
      const beforeLine102Typing = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.setCursor(102, 0));
      const line102PreviewUpdateElapsed = await measureElapsed(async () => {
        await page.keyboard.insertText("sync102");
        await waitForEditorDocumentText(page, "sync102", 2_000);
        await page.waitForFunction(
          () => document.querySelector(".workspace.split .preview-surface")?.textContent?.includes("sync102"),
          null,
          { timeout: 2_000 },
        );
      });
      await waitForRenderFrame(page);
      await page.waitForTimeout(250);
      await waitForRenderFrame(page);
      const afterLine102Typing = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      await page.waitForTimeout(1_000);
      await waitForRenderFrame(page);
      const idleLine102Typing = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      reportPerformanceMetric("htmx-split-sync-line-102-typing", {
        afterLine102Typing,
        beforeLine102Typing,
        idleLine102Typing,
        previewUpdateElapsedMs: Math.round(line102PreviewUpdateElapsed),
      });
      expect(
        line102PreviewUpdateElapsed <= SPLIT_SYNC_PREVIEW_INPUT_UPDATE_MAX_MS,
        `Typing on line 102 should appear in preview quickly. Elapsed: ${Math.round(line102PreviewUpdateElapsed)}ms.`,
      );
      expect(
        Math.abs(afterLine102Typing.editorScrollTop - beforeLine102Typing.editorScrollTop) <=
          SPLIT_SYNC_EDITOR_SCROLL_DELTA_MAX,
        `Typing on line 102 should not move the editor. Before: ${JSON.stringify(
          beforeLine102Typing,
        )}; after: ${JSON.stringify(afterLine102Typing)}.`,
      );
      expect(
        Math.abs(afterLine102Typing.firstVisiblePreviewLine - beforeLine102Typing.firstVisiblePreviewLine) <=
          SPLIT_SYNC_UNRELATED_LINE_JUMP_MAX &&
          Math.abs(idleLine102Typing.previewScrollTop - afterLine102Typing.previewScrollTop) <=
            SPLIT_SYNC_IDLE_SCROLL_DRIFT_MAX,
        `Typing on line 102 should not send preview to an unrelated section or jump later. Before: ${JSON.stringify(
          beforeLine102Typing,
        )}; after: ${JSON.stringify(afterLine102Typing)}; idle: ${JSON.stringify(idleLine102Typing)}.`,
      );

      await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.scrollEditorToLine(3176, 96));
      await waitForRenderFrame(page);
      await page.waitForTimeout(150);
      await waitForRenderFrame(page);
      const beforeLine3178Typing = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.setCursor(3178, 0));
      await page.keyboard.insertText("sync3178");
      await page.keyboard.insertText("x");
      await waitForEditorDocumentText(page, "sync3178x", 2_000);
      await waitForRenderFrame(page);
      await page.waitForTimeout(250);
      await waitForRenderFrame(page);
      const afterLine3178Typing = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      await page.waitForTimeout(1_000);
      await waitForRenderFrame(page);
      const idleLine3178Typing = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      reportPerformanceMetric("htmx-split-sync-line-3178-typing", {
        afterLine3178Typing,
        beforeLine3178Typing,
        idleLine3178Typing,
      });
      expect(
        Math.abs(afterLine3178Typing.editorScrollTop - beforeLine3178Typing.editorScrollTop) <=
          SPLIT_SYNC_EDITOR_SCROLL_DELTA_MAX,
        `Typing on line 3178 should not move the editor. Before: ${JSON.stringify(
          beforeLine3178Typing,
        )}; after: ${JSON.stringify(afterLine3178Typing)}.`,
      );
      expect(
        Math.abs(afterLine3178Typing.firstVisiblePreviewLine - beforeLine3178Typing.firstVisiblePreviewLine) <=
          SPLIT_SYNC_UNRELATED_LINE_JUMP_MAX &&
          Math.abs(idleLine3178Typing.previewScrollTop - afterLine3178Typing.previewScrollTop) <=
            SPLIT_SYNC_IDLE_SCROLL_DRIFT_MAX,
        `Typing on line 3178 should not send preview to an unrelated section or jump later. Before: ${JSON.stringify(
          beforeLine3178Typing,
        )}; after: ${JSON.stringify(afterLine3178Typing)}; idle: ${JSON.stringify(idleLine3178Typing)}.`,
      );

      await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.scrollEditorToLine(3197, 96));
      await waitForRenderFrame(page);
      await page.waitForTimeout(150);
      await waitForRenderFrame(page);
      const beforeCursorMove = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.setCursor(3199, 0));
      await waitForRenderFrame(page);
      const afterLine3199Cursor = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.setCursor(3208, 0));
      await waitForRenderFrame(page);
      const afterLine3208Cursor = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      await page.keyboard.insertText("dd");
      await page.keyboard.insertText("d");
      await waitForEditorDocumentText(page, "ddd", 2_000);
      await waitForRenderFrame(page);
      await page.waitForTimeout(250);
      await waitForRenderFrame(page);
      const afterLine3208Typing = await page.evaluate(() => window.__tabulaSplitPreviewSyncProbe.read());
      reportPerformanceMetric("htmx-split-sync-line-3208-cursor-typing", {
        afterLine3199Cursor,
        afterLine3208Cursor,
        afterLine3208Typing,
        beforeCursorMove,
      });
      expect(
        Math.abs(afterLine3208Cursor.previewScrollTop - beforeCursorMove.previewScrollTop) <=
          SPLIT_SYNC_IDLE_SCROLL_DRIFT_MAX,
        `Moving the cursor from line 3199 to line 3208 should not scroll preview. Before: ${JSON.stringify(
          beforeCursorMove,
        )}; after cursor: ${JSON.stringify(afterLine3208Cursor)}.`,
      );
      expect(
        Math.abs(afterLine3208Typing.editorScrollTop - afterLine3208Cursor.editorScrollTop) <=
          SPLIT_SYNC_EDITOR_SCROLL_DELTA_MAX &&
          Math.abs(afterLine3208Typing.firstVisiblePreviewLine - afterLine3208Cursor.firstVisiblePreviewLine) <=
            SPLIT_SYNC_UNRELATED_LINE_JUMP_MAX,
        `Typing on line 3208 should not move the editor or jump preview to an unrelated section. Before typing: ${JSON.stringify(
          afterLine3208Cursor,
        )}; after typing: ${JSON.stringify(afterLine3208Typing)}.`,
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
      await page.getByTitle("New document").click();
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
      await page.evaluate(installLargePasteProbe);
      await page.evaluate(() => window.__tabulaLargePasteProbe.start());

      const typingElapsed = await measureElapsed(async () => {
        await focusMarkdownEditor(page);
        await page.keyboard.press("ControlOrMeta+End");
        await page.keyboard.insertText("\nlatency-probe");
        await waitForEditorText(page, "latency-probe", LARGE_EDITOR_TYPING_MAX_MS);
      });
      const typingMetrics = await page.evaluate(() => window.__tabulaLargePasteProbe.stop());
      reportPerformanceMetric("large-editor-typing", {
        elapsedMs: Math.round(typingElapsed),
        projectWrites: typingMetrics.projectWrites,
      });
      expect(
        typingElapsed < LARGE_EDITOR_TYPING_MAX_MS,
        `Typing in a 5,000-line Markdown file should stay within budget. Elapsed: ${Math.round(typingElapsed)}ms.`,
      );
      expect(
        typingMetrics.projectWrites === 0,
        `Typing in a 5,000-line Markdown file should not synchronously persist workspace state before the debounce window. Writes: ${typingMetrics.projectWrites}.`,
      );
      await page.evaluate(() => window.__tabulaLargePasteProbe.restore());

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
    await firstPage.waitForSelector(".tab-item.active[data-room-id]:not([data-room-id=''])");
    const shareUrl = await firstPage.locator(".share-link-display").getAttribute("title");
    await firstPage.getByRole("button", { name: "Close share dialog" }).click();

    const roomUrl = new URL(shareUrl);
    await secondPage.goto(`${baseUrl}${roomUrl.pathname}${roomUrl.hash}`);
    await secondPage.waitForSelector(".tab-item.active[data-room-id]:not([data-room-id=''])");
    if ((await secondPage.locator('.tab-item[data-file-name="large-presence-performance.md"]').count()) === 0) {
      await secondPage.getByRole("button", { name: "Open Project Context" }).click();
      await secondPage.getByRole("button", { name: "Files", exact: true }).click();
      await secondPage.getByRole("button", { name: "Open large-presence-performance.md" }).click();
    }
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
