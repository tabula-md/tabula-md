import {
  useEffect,
  useRef,
  useState,
} from "react";
import type { WorkspaceSourceDocument } from "@tabula-md/tabula";
import type { WorkspaceKnowledgeState } from "./workspaceKnowledgeWorkerClient";

const KNOWLEDGE_SYNC_DEBOUNCE_MS = 80;
const INITIAL_KNOWLEDGE_STATE: WorkspaceKnowledgeState = {
  elapsedMs: null,
  pending: true,
  revision: 0,
  source: "none",
};

export const useWorkspaceKnowledgeIndex = (
  documents: readonly WorkspaceSourceDocument[],
) => {
  const [snapshot, setSnapshot] = useState(INITIAL_KNOWLEDGE_STATE);
  const hasRequestedIndexRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    let timeout: number | undefined;

    void import("./workspaceKnowledgeWorkerClient")
      .then(({ workspaceKnowledgeWorkerClient }) => {
        if (cancelled) return;
        const updateSnapshot = () => {
          if (!cancelled) setSnapshot(workspaceKnowledgeWorkerClient.getSnapshot());
        };
        unsubscribe = workspaceKnowledgeWorkerClient.subscribe(updateSnapshot);
        const currentSnapshot = workspaceKnowledgeWorkerClient.getSnapshot();
        if (currentSnapshot.index) setSnapshot(currentSnapshot);

        const debounceMs = hasRequestedIndexRef.current
          ? KNOWLEDGE_SYNC_DEBOUNCE_MS
          : 0;
        hasRequestedIndexRef.current = true;
        timeout = window.setTimeout(
          () => workspaceKnowledgeWorkerClient.sync(documents),
          debounceMs,
        );
      })
      .catch(() => {
        if (!cancelled) {
          setSnapshot({
            elapsedMs: null,
            pending: false,
            revision: 0,
            source: "fallback",
          });
        }
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [documents]);

  return snapshot;
};
