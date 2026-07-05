import { parentPort, workerData } from "node:worker_threads";

const {
  createPreviewBlockIndex,
  getPreviewWindow,
  hasGlobalMarkdownSyntax,
} = await import(workerData.previewModelUrl);

const startedAt = performance.now();
const blockIndex = createPreviewBlockIndex(workerData.markdown);
const previewWindow = getPreviewWindow(blockIndex, 0, workerData.viewportHeight, workerData.overscan);
const hasGlobalSyntax = hasGlobalMarkdownSyntax(workerData.markdown);
const endedAt = performance.now();

parentPort?.postMessage({
  blockCount: blockIndex.blocks.length,
  elapsedMs: endedAt - startedAt,
  hasGlobalSyntax,
  lineCount: blockIndex.lineCount,
  visibleBlockCount: previewWindow.blocks.length,
});
