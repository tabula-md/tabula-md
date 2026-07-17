import { useEffect, useRef, useState } from "react";
import {
  createOptimisticPreviewBlockIndex,
  createOptimisticPreviewBlockIndexFromPatches,
  createPreviewBlockIndex,
  type TextChange,
  type PreviewBlockIndex,
} from "@tabula-md/tabula";
import { reusePreviewBlockIndex, type PreviewBlockCache } from "./previewBlockIndexCache";
import type {
  PreviewBlockIndexWorkerRequest,
  PreviewBlockIndexWorkerResponse,
} from "./previewBlockIndexWorker";

export type PreviewBlockIndexSource = "none" | "pending" | "optimistic" | "worker" | "fallback";

export type PreviewBlockIndexWorkerState = {
  blockIndex: PreviewBlockIndex | null;
  elapsedMs: number | null;
  pending: boolean;
  source: PreviewBlockIndexSource;
};

type TimeoutHandle = ReturnType<typeof setTimeout>;

type PendingWorkerRequest = PreviewBlockIndexWorkerRequest;

type PreviewBlockIndexWorkerOptions = {
  textChange?: TextChange | null;
};

const createInitialState = (): PreviewBlockIndexWorkerState => ({
  blockIndex: null,
  elapsedMs: null,
  pending: false,
  source: "none",
});

export const usePreviewBlockIndexWorker = (
  markdown: string,
  enabled: boolean,
  options: PreviewBlockIndexWorkerOptions = {},
): PreviewBlockIndexWorkerState => {
  const blockCacheRef = useRef<PreviewBlockCache>(new Map());
  const fallbackTimerRef = useRef<TimeoutHandle | null>(null);
  const blockIndexMarkdownRef = useRef("");
  const blockIndexStateRef = useRef<PreviewBlockIndex | null>(null);
  const inFlightWorkerRequestIdRef = useRef<number | null>(null);
  const pendingWorkerRequestRef = useRef<PendingWorkerRequest | null>(null);
  const requestIdRef = useRef(0);
  const workerRef = useRef<Worker | null>(null);
  const [state, setState] = useState<PreviewBlockIndexWorkerState>(() => createInitialState());

  useEffect(() => () => {
    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    workerRef.current?.terminate();
    workerRef.current = null;
    inFlightWorkerRequestIdRef.current = null;
    pendingWorkerRequestRef.current = null;
  }, []);

  useEffect(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    if (!enabled || markdown.trim().length === 0) {
      pendingWorkerRequestRef.current = null;
      blockCacheRef.current.clear();
      blockIndexMarkdownRef.current = "";
      blockIndexStateRef.current = null;
      setState(createInitialState());
      return undefined;
    }

    const previousBlockIndex = blockIndexStateRef.current;
    const previousMarkdown = blockIndexMarkdownRef.current;
    const optimisticTextChange = options.textChange;
    const optimisticBlockIndex =
      previousBlockIndex && previousMarkdown
        ? optimisticTextChange?.patches.length
          ? createOptimisticPreviewBlockIndexFromPatches(
              previousBlockIndex,
              previousMarkdown,
              markdown,
              optimisticTextChange.patches,
            ) ?? createOptimisticPreviewBlockIndex(previousBlockIndex, previousMarkdown, markdown)
          : createOptimisticPreviewBlockIndex(previousBlockIndex, previousMarkdown, markdown)
        : null;
    if (optimisticBlockIndex) {
      const cachedOptimisticBlockIndex = reusePreviewBlockIndex(optimisticBlockIndex, blockCacheRef.current);
      blockIndexMarkdownRef.current = markdown;
      blockIndexStateRef.current = cachedOptimisticBlockIndex;
      setState({
        blockIndex: cachedOptimisticBlockIndex,
        elapsedMs: null,
        pending: true,
        source: "optimistic",
      });
    } else {
      setState((currentState) => ({
        ...currentState,
        elapsedMs: null,
        pending: true,
        source: currentState.blockIndex ? currentState.source : "pending",
      }));
    }

    const commitBlockIndex = (
      blockIndex: PreviewBlockIndex,
      source: Exclude<PreviewBlockIndexSource, "none" | "pending">,
      elapsedMs: number,
    ) => {
      if (requestIdRef.current !== requestId) {
        return;
      }

      const cachedBlockIndex = reusePreviewBlockIndex(blockIndex, blockCacheRef.current);
      blockIndexMarkdownRef.current = markdown;
      blockIndexStateRef.current = cachedBlockIndex;
      setState({
        blockIndex: cachedBlockIndex,
        elapsedMs,
        pending: false,
        source,
      });
    };

    const runFallback = () => {
      if (fallbackTimerRef.current !== null) {
        return;
      }

      fallbackTimerRef.current = setTimeout(() => {
        fallbackTimerRef.current = null;
        if (requestIdRef.current !== requestId) {
          return;
        }

        const startedAt = performance.now();
        const blockIndex = createPreviewBlockIndex(markdown);
        commitBlockIndex(blockIndex, "fallback", performance.now() - startedAt);
      }, 0);
    };

    if (typeof Worker === "undefined") {
      runFallback();
      return () => {
        if (fallbackTimerRef.current !== null) {
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
      };
    }

    try {
      if (!workerRef.current) {
        workerRef.current = new Worker(new URL("./previewBlockIndexWorker.ts", import.meta.url), {
          type: "module",
        });
      }

      const worker = workerRef.current;
      worker.onmessage = (event: MessageEvent<PreviewBlockIndexWorkerResponse>) => {
        if (event.data.id === inFlightWorkerRequestIdRef.current) {
          inFlightWorkerRequestIdRef.current = null;
        }
        if (event.data.id === requestIdRef.current) {
          commitBlockIndex(event.data.blockIndex, "worker", event.data.elapsedMs);
        }

        const pendingRequest = pendingWorkerRequestRef.current;
        if (pendingRequest && inFlightWorkerRequestIdRef.current === null) {
          pendingWorkerRequestRef.current = null;
          inFlightWorkerRequestIdRef.current = pendingRequest.id;
          worker.postMessage(pendingRequest);
        }
      };
      worker.onerror = () => {
        workerRef.current?.terminate();
        workerRef.current = null;
        inFlightWorkerRequestIdRef.current = null;
        pendingWorkerRequestRef.current = null;
        if (requestIdRef.current === requestId) {
          runFallback();
        }
      };
      const nextRequest = {
        id: requestId,
        markdown,
      } satisfies PendingWorkerRequest;
      if (inFlightWorkerRequestIdRef.current === null) {
        inFlightWorkerRequestIdRef.current = requestId;
        worker.postMessage(nextRequest);
      } else {
        pendingWorkerRequestRef.current = nextRequest;
      }
    } catch {
      workerRef.current?.terminate();
      workerRef.current = null;
      runFallback();
    }

    return () => {
      if (fallbackTimerRef.current !== null) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [enabled, markdown, options.textChange]);

  return state;
};
