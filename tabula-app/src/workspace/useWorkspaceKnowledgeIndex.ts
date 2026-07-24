import {
  useEffect,
  useRef,
  useState,
} from "react";
import type {
  WorkspaceKnowledgeIndex,
  WorkspaceSourceDocument,
} from "@tabula-md/tabula";

export const useWorkspaceKnowledgeIndex = (
  documents: readonly WorkspaceSourceDocument[],
) => {
  const indexRef = useRef<WorkspaceKnowledgeIndex | undefined>(undefined);
  const [index, setIndex] = useState<WorkspaceKnowledgeIndex>();

  useEffect(() => {
    let cancelled = false;
    void import("./workspaceKnowledgeRuntime")
      .then(({ reconcileWorkspaceKnowledgeIndex }) => {
        if (cancelled) return;
        const next = reconcileWorkspaceKnowledgeIndex(
          indexRef.current,
          documents,
        );
        indexRef.current = next;
        setIndex(next);
      })
      .catch(() => {
        if (cancelled) return;
        indexRef.current = undefined;
        setIndex(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [documents]);

  return index;
};
