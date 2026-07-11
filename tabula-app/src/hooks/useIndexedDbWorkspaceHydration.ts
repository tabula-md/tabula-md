import { useEffect, useRef, useState } from "react";
import { readIndexedDbWorkspace } from "../workspaceIndexedDb";
import type { FileComment, WorkspaceFile, WorkspaceState } from "../workspaceStorage";
import { useEventCallback } from "./useEventCallback";

type WorkspaceHydrationStatus = "idle" | "pending" | "applied" | "skipped";

type UseIndexedDbWorkspaceHydrationOptions = {
  enabled: boolean;
  initialWorkspace: WorkspaceState;
  onError?: (error: unknown) => void;
  workspace: WorkspaceState;
  readWorkspace?: () => Promise<WorkspaceState | null>;
  replaceWorkspace: (
    workspace: Pick<WorkspaceState, "files" | "folders" | "openFileIds" | "activeFileId">,
  ) => void;
  replaceCommentsByFileId: (commentsByFileId: Record<string, FileComment[]>) => void;
};

type ShouldApplyIndexedDbWorkspaceHydrationInput = {
  enabled: boolean;
  currentWorkspace: WorkspaceState;
  initialWorkspace: WorkspaceState;
  indexedDbWorkspace: WorkspaceState | null;
};

const stableFiles = (files: WorkspaceFile[]) => files.map((file) => ({ ...file }));

export const getWorkspaceHydrationSignature = (workspace: WorkspaceState) =>
  JSON.stringify({
    activeFileId: workspace.activeFileId,
    commentsByFileId: workspace.commentsByFileId,
    files: stableFiles(workspace.files),
    folders: workspace.folders,
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
  onError,
  workspace,
  readWorkspace = readIndexedDbWorkspace,
  replaceWorkspace,
  replaceCommentsByFileId,
}: UseIndexedDbWorkspaceHydrationOptions) => {
  const [status, setStatus] = useState<WorkspaceHydrationStatus>(enabled ? "pending" : "idle");
  const workspaceRef = useRef(workspace);
  const onErrorEvent = useEventCallback((error: unknown) => onError?.(error));
  const replaceCommentsEvent = useEventCallback(replaceCommentsByFileId);
  const replaceWorkspaceEvent = useEventCallback(replaceWorkspace);

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

        replaceCommentsEvent(indexedDbWorkspace.commentsByFileId);
        replaceWorkspaceEvent({
          files: indexedDbWorkspace.files,
          folders: indexedDbWorkspace.folders,
          openFileIds: indexedDbWorkspace.openFileIds,
          activeFileId: indexedDbWorkspace.activeFileId,
        });
        setStatus("applied");
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          onErrorEvent(error);
          setStatus("skipped");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, initialWorkspace, onErrorEvent, readWorkspace, replaceCommentsEvent, replaceWorkspaceEvent]);

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
