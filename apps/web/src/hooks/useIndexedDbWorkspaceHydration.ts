import { useEffect, useRef, useState } from "react";
import { readIndexedDbWorkspace } from "../workspaceIndexedDb";
import type { FileComment, MarkdownFile, WorkspaceState } from "../workspaceStorage";

type WorkspaceHydrationStatus = "idle" | "pending" | "applied" | "skipped";

type UseIndexedDbWorkspaceHydrationOptions = {
  enabled: boolean;
  initialWorkspace: WorkspaceState;
  workspace: WorkspaceState;
  readWorkspace?: () => Promise<WorkspaceState | null>;
  replaceWorkspace: (workspace: Pick<WorkspaceState, "files" | "openFileIds" | "activeFileId">) => void;
  replaceCommentsByFileId: (commentsByFileId: Record<string, FileComment[]>) => void;
};

type ShouldApplyIndexedDbWorkspaceHydrationInput = {
  enabled: boolean;
  currentWorkspace: WorkspaceState;
  initialWorkspace: WorkspaceState;
  indexedDbWorkspace: WorkspaceState | null;
};

const stableFiles = (files: MarkdownFile[]) => files.map((file) => ({ ...file }));

export const getWorkspaceHydrationSignature = (workspace: WorkspaceState) =>
  JSON.stringify({
    activeFileId: workspace.activeFileId,
    commentsByFileId: workspace.commentsByFileId,
    files: stableFiles(workspace.files),
    openFileIds: workspace.openFileIds,
  });

export const shouldApplyIndexedDbWorkspaceHydration = ({
  enabled,
  currentWorkspace,
  initialWorkspace,
  indexedDbWorkspace,
}: ShouldApplyIndexedDbWorkspaceHydrationInput) => {
  if (!enabled || !indexedDbWorkspace) {
    return false;
  }

  const initialSignature = getWorkspaceHydrationSignature(initialWorkspace);
  return (
    getWorkspaceHydrationSignature(currentWorkspace) === initialSignature &&
    getWorkspaceHydrationSignature(indexedDbWorkspace) !== initialSignature
  );
};

export const shouldDeferIndexedDbWorkspacePersistence = ({
  enabled,
  currentWorkspace,
  initialWorkspace,
  status,
}: {
  enabled: boolean;
  currentWorkspace: WorkspaceState;
  initialWorkspace: WorkspaceState;
  status: WorkspaceHydrationStatus;
}) =>
  enabled &&
  status === "pending" &&
  getWorkspaceHydrationSignature(currentWorkspace) === getWorkspaceHydrationSignature(initialWorkspace);

export const useIndexedDbWorkspaceHydration = ({
  enabled,
  initialWorkspace,
  workspace,
  readWorkspace = readIndexedDbWorkspace,
  replaceWorkspace,
  replaceCommentsByFileId,
}: UseIndexedDbWorkspaceHydrationOptions) => {
  const [status, setStatus] = useState<WorkspaceHydrationStatus>(enabled ? "pending" : "idle");
  const workspaceRef = useRef(workspace);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    setStatus("pending");

    readWorkspace()
      .then((indexedDbWorkspace) => {
        if (cancelled) {
          return;
        }

        const shouldApply = shouldApplyIndexedDbWorkspaceHydration({
          enabled,
          currentWorkspace: workspaceRef.current,
          initialWorkspace,
          indexedDbWorkspace,
        });

        if (!shouldApply || !indexedDbWorkspace) {
          setStatus("skipped");
          return;
        }

        replaceCommentsByFileId(indexedDbWorkspace.commentsByFileId);
        replaceWorkspace({
          files: indexedDbWorkspace.files,
          openFileIds: indexedDbWorkspace.openFileIds,
          activeFileId: indexedDbWorkspace.activeFileId,
        });
        setStatus("applied");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("skipped");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, initialWorkspace, readWorkspace, replaceCommentsByFileId, replaceWorkspace]);

  return {
    deferPersistence: shouldDeferIndexedDbWorkspacePersistence({
      enabled,
      currentWorkspace: workspace,
      initialWorkspace,
      status,
    }),
    pending: status === "pending",
    status,
  };
};
