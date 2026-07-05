import { createPreviewBlockIndex, type PreviewBlockIndex } from "@tabula-md/tabula";

export type PreviewBlockIndexWorkerRequest = {
  id: number;
  markdown: string;
};

export type PreviewBlockIndexWorkerResponse = {
  id: number;
  blockIndex: PreviewBlockIndex;
  elapsedMs: number;
};

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<PreviewBlockIndexWorkerRequest>) => void) | null;
  postMessage(message: PreviewBlockIndexWorkerResponse): void;
};

workerScope.onmessage = (event) => {
  const startedAt = performance.now();
  const blockIndex = createPreviewBlockIndex(event.data.markdown);
  workerScope.postMessage({
    id: event.data.id,
    blockIndex,
    elapsedMs: performance.now() - startedAt,
  });
};
