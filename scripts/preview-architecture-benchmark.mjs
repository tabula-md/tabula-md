import { fileURLToPath, pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import {
  createPreviewBlockIndex,
  getPreviewWindow,
  hasGlobalMarkdownSyntax,
} from "../packages/tabula/dist/previewBlockModel.js";

const previewModelUrl = pathToFileURL(fileURLToPath(new URL("../packages/tabula/dist/previewBlockModel.js", import.meta.url))).href;
const workerUrl = new URL("./preview-index-worker.mjs", import.meta.url);
const viewportHeight = 820;
const overscan = 900;
const markdown = buildArchitectureBenchmarkMarkdown();

const mainThreadIndex = measure(() => {
  const blockIndex = createPreviewBlockIndex(markdown);
  const previewWindow = getPreviewWindow(blockIndex, 0, viewportHeight, overscan);
  return {
    blockCount: blockIndex.blocks.length,
    hasGlobalSyntax: hasGlobalMarkdownSyntax(markdown),
    lineCount: blockIndex.lineCount,
    totalEstimatedHeight: blockIndex.totalEstimatedHeight,
    visibleBlockCount: previewWindow.blocks.length,
  };
});
const workerIndex = await measureWorkerIndexing();
const patchPressure = measureVirtualPatchPressure(markdown);

const result = {
  fixture: {
    bytes: Buffer.byteLength(markdown, "utf8"),
    lineCount: mainThreadIndex.value.lineCount,
    previewBlockCount: mainThreadIndex.value.blockCount,
  },
  rendererPatchEvaluation: {
    ...patchPressure,
    decision:
      patchPressure.maxVisibleBlockCount < mainThreadIndex.value.blockCount * 0.08
        ? "defer-dom-patch-renderer"
        : "prototype-dom-patch-renderer",
    reason:
      "The current virtual preview path already limits render work to a small keyed block window. A DOM patch renderer should only be revisited if browser performance smoke exceeds launch budgets while preserving comments, bookmarks, task toggles, selection, and safe Markdown rendering.",
  },
  workerIndexingEvaluation: {
    mainThreadMs: round(mainThreadIndex.elapsedMs),
    workerComputeMs: round(workerIndex.workerElapsedMs),
    workerRoundTripMs: round(workerIndex.roundTripMs),
    decision:
      mainThreadIndex.elapsedMs > 80 && workerIndex.roundTripMs < mainThreadIndex.elapsedMs * 1.2
        ? "prototype-worker-indexing"
        : "defer-worker-indexing",
    reason:
      "Move preview indexing to a worker only when measured main-thread indexing is a meaningful long task and worker roundtrip overhead stays below the recovered input-latency budget.",
  },
};

console.log(JSON.stringify(result, null, 2));

function measure(callback) {
  const startedAt = performance.now();
  const value = callback();
  return {
    elapsedMs: performance.now() - startedAt,
    value,
  };
}

function measureVirtualPatchPressure(input) {
  const blockIndex = createPreviewBlockIndex(input);
  const sampleCount = 120;
  let previousIds = new Set();
  let maxChangedBlockCount = 0;
  let maxVisibleBlockCount = 0;
  let totalChangedBlockCount = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const scrollTop = (blockIndex.totalEstimatedHeight * index) / Math.max(1, sampleCount - 1);
    const previewWindow = getPreviewWindow(blockIndex, scrollTop, viewportHeight, overscan);
    const nextIds = new Set(previewWindow.blocks.map((block) => block.id));
    let changedBlockCount = 0;

    for (const id of nextIds) {
      if (!previousIds.has(id)) {
        changedBlockCount += 1;
      }
    }
    for (const id of previousIds) {
      if (!nextIds.has(id)) {
        changedBlockCount += 1;
      }
    }

    maxChangedBlockCount = Math.max(maxChangedBlockCount, changedBlockCount);
    maxVisibleBlockCount = Math.max(maxVisibleBlockCount, nextIds.size);
    totalChangedBlockCount += changedBlockCount;
    previousIds = nextIds;
  }

  return {
    averageChangedBlockCount: round(totalChangedBlockCount / sampleCount),
    fullBlockCount: blockIndex.blocks.length,
    maxChangedBlockCount,
    maxVisibleBlockCount,
    sampledScrollWindows: sampleCount,
  };
}

async function measureWorkerIndexing() {
  const startedAt = performance.now();
  const message = await new Promise((resolve, reject) => {
    const worker = new Worker(workerUrl, {
      workerData: {
        markdown,
        overscan,
        previewModelUrl,
        viewportHeight,
      },
    });
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Preview index worker exited with code ${code}.`));
      }
    });
  });

  return {
    roundTripMs: performance.now() - startedAt,
    workerElapsedMs: message.elapsedMs,
  };
}

function buildArchitectureBenchmarkMarkdown() {
  const sections = [];
  for (let index = 0; index < 8_000; index += 1) {
    if (index % 120 === 0) {
      sections.push(`## Architecture Section ${index}`);
      continue;
    }
    if (index % 97 === 0) {
      sections.push(["```ts", `const marker${index} = "preview architecture";`, "```"].join("\n"));
      continue;
    }
    if (index % 53 === 0) {
      sections.push("| Column | Value |\n| --- | --- |\n| Preview | Virtual window |");
      continue;
    }
    if (index % 17 === 0) {
      sections.push(`- nested list item ${index}\n  - child item ${index}`);
      continue;
    }
    sections.push(
      `Paragraph ${index}: Tabula.md keeps Markdown source editable while preview, comments, bookmarks, and collaboration remain available for people and agents.`,
    );
  }

  return sections.join("\n\n");
}

function round(value) {
  return Math.round(value * 10) / 10;
}
