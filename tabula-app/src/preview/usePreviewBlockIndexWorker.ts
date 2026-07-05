import { useEffect, useRef, useState } from "react";
import { createPreviewBlockIndex, type PreviewBlockIndex } from "@tabula-md/tabula";
import { reusePreviewBlockIndex, type PreviewBlockCache } from "./previewBlockIndexCache";
import type {
  PreviewBlockIndexWorkerRequest,
  PreviewBlockIndexWorkerResponse,
} from "./previewBlockIndexWorker";

export type PreviewBlockIndexSource = "none" | "pending" | "worker" | "fallback";

export type PreviewBlockIndexWorkerState = {
  blockIndex: PreviewBlockIndex | null;
  elapsedMs: number | null;
  pending: boolean;
  source: PreviewBlockIndexSource;
};

type TimeoutHandle = ReturnType<typeof setTimeout>;

const createInitialState = (): PreviewBlockIndexWorkerState => ({
  blockIndex: null,
  elapsedMs: null,
  pending: false,
  source: "none",
});

export const usePreviewBlockIndexWorker = (
  markdown: string,
  enabled: boolean,
): PreviewBlockIndexWorkerState => {
  const blockCacheRef = useRef<PreviewBlockCache>(new Map());
  const fallbackTimerRef = useRef<TimeoutHandle | null>(null);
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
  }, []);

  useEffect(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    if (!enabled || markdown.trim().length === 0) {
      blockCacheRef.current.clear();
      setState(createInitialState());
      return undefined;
    }

    setState((currentState) => ({
      ...currentState,
      elapsedMs: null,
      pending: true,
      source: currentState.blockIndex ? currentState.source : "pending",
    }));

    const commitBlockIndex = (
      blockIndex: PreviewBlockIndex,
      source: Exclude<PreviewBlockIndexSource, "none" | "pending">,
      elapsedMs: number,
    ) => {
      if (requestIdRef.current !== requestId) {
        return;
      }

      const cachedBlockIndex = reusePreviewBlockIndex(blockIndex, blockCacheRef.current);
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
        if (event.data.id !== requestIdRef.current) {
          return;
        }
        commitBlockIndex(event.data.blockIndex, "worker", event.data.elapsedMs);
      };
      worker.onerror = () => {
        workerRef.current?.terminate();
        workerRef.current = null;
        if (requestIdRef.current === requestId) {
          runFallback();
        }
      };
      worker.postMessage({
        id: requestId,
        markdown,
      } satisfies PreviewBlockIndexWorkerRequest);
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
  }, [enabled, markdown]);

  return state;
};
