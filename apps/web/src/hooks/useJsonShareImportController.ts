import { useEffect, useRef, useState } from "react";
import {
  getConfiguredJsonShareServiceUrl,
  getJsonShareRoute,
  readJsonShareSnapshot,
  type JsonShareRoute,
} from "../jsonShare";
import { createWorkspaceFromJsonShareSnapshot, hasMeaningfulWorkspaceContent } from "../jsonShareImport";
import {
  syncUrlForFile,
  type FileComment,
  type InitialWorkspaceSnapshot,
  type WorkspaceFile,
  type WorkspaceState,
} from "../workspaceStorage";
import { useEventCallback } from "./useEventCallback";

export type PendingJsonShareImport =
  | { status: "loading"; route: JsonShareRoute }
  | { status: "ready"; route: JsonShareRoute; workspace: WorkspaceState }
  | { status: "error"; route: JsonShareRoute; errorMessage: string };

type UseJsonShareImportControllerArgs = {
  clearFileHistory: () => void;
  closeFloatingChrome: () => void;
  commentsByFileId: Record<string, FileComment[]>;
  files: WorkspaceFile[];
  replaceCommentsByFileId: (commentsByFileId: Record<string, FileComment[]>) => void;
  replaceWorkspace: (workspace: Pick<WorkspaceState, "files" | "openFileIds" | "activeFileId">) => WorkspaceFile | undefined;
  resetCollaborationState: (nextStatus: WorkspaceFile["connectionStatus"]) => void;
  showToast: (message: string, tone?: "neutral" | "error") => void;
  workspaceSource: InitialWorkspaceSnapshot["source"];
};

export function useJsonShareImportController({
  clearFileHistory,
  closeFloatingChrome,
  commentsByFileId,
  files,
  replaceCommentsByFileId,
  replaceWorkspace,
  resetCollaborationState,
  showToast,
  workspaceSource,
}: UseJsonShareImportControllerArgs) {
  const [jsonShareImport, setJsonShareImport] = useState<PendingJsonShareImport | null>(null);
  const handledJsonShareRouteRef = useRef<string | null>(null);
  const jsonShareImportCleanupRef = useRef<(() => void) | null>(null);
  const workspaceContentRef = useRef({ files, commentsByFileId });

  useEffect(() => {
    workspaceContentRef.current = { files, commentsByFileId };
  }, [commentsByFileId, files]);

  const closeJsonShareImport = useEventCallback(() => {
    jsonShareImportCleanupRef.current?.();
    jsonShareImportCleanupRef.current = null;
    handledJsonShareRouteRef.current = null;
    setJsonShareImport(null);
    syncUrlForFile(undefined, "replace");
  });

  const replaceWorkspaceWithJsonShare = useEventCallback((workspace: WorkspaceState) => {
    jsonShareImportCleanupRef.current = null;
    handledJsonShareRouteRef.current = null;
    const nextActiveFile = replaceWorkspace(workspace);
    replaceCommentsByFileId(workspace.commentsByFileId);
    clearFileHistory();
    resetCollaborationState(nextActiveFile?.roomId ? "connecting" : "idle");
    closeFloatingChrome();
    syncUrlForFile(nextActiveFile, "replace");
    setJsonShareImport(null);
    showToast("Shared copy loaded.");
  });

  useEffect(() => {
    const openJsonShareRoute = () => {
      const route = getJsonShareRoute(window.location);
      if (!route) {
        return;
      }

      const routeKey = `${route.snapshotId}:${route.key}`;
      if (handledJsonShareRouteRef.current === routeKey) {
        return;
      }
      handledJsonShareRouteRef.current = routeKey;
      setJsonShareImport({ status: "loading", route });

      const serviceUrl = getConfiguredJsonShareServiceUrl();
      if (!serviceUrl) {
        setJsonShareImport({
          status: "error",
          route,
          errorMessage: "Shared links are not configured for this build.",
        });
        return;
      }

      let cancelled = false;
      void readJsonShareSnapshot({
        serviceUrl,
        origin: window.location.origin,
        route,
      })
        .then((snapshot) => {
          if (cancelled) {
            return;
          }
          if (!snapshot) {
            setJsonShareImport({
              status: "error",
              route,
              errorMessage: "This shared link was not found.",
            });
            return;
          }

          const nextWorkspace = createWorkspaceFromJsonShareSnapshot(snapshot);
          const shouldConfirmImport =
            workspaceSource !== "starter" || hasMeaningfulWorkspaceContent(workspaceContentRef.current);
          if (shouldConfirmImport) {
            setJsonShareImport({ status: "ready", route, workspace: nextWorkspace });
            return;
          }
          replaceWorkspaceWithJsonShare(nextWorkspace);
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return;
          }
          setJsonShareImport({
            status: "error",
            route,
            errorMessage: error instanceof Error ? error.message : "This shared link could not be loaded.",
          });
        });

      return () => {
        cancelled = true;
      };
    };

    jsonShareImportCleanupRef.current = openJsonShareRoute() ?? null;
    const handleHashChange = () => {
      jsonShareImportCleanupRef.current?.();
      jsonShareImportCleanupRef.current = openJsonShareRoute() ?? null;
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => {
      jsonShareImportCleanupRef.current?.();
      jsonShareImportCleanupRef.current = null;
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [replaceWorkspaceWithJsonShare, workspaceSource]);

  return {
    closeJsonShareImport,
    jsonShareImport,
    replaceWorkspaceWithJsonShare,
  };
}
