import { useEffect, useRef, useState } from "react";
import {
  getConfiguredJsonShareServiceUrl,
  getJsonShareImportRoute,
  readJsonShareSnapshot,
  type JsonShareRoute,
  createWorkspaceFromJsonShareSnapshot,
  hasMeaningfulWorkspaceContent,
} from "../share";
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
  | { status: "error"; route?: JsonShareRoute; errorMessage: string };

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
    showToast("Snapshot loaded.");
  });

  useEffect(() => {
    const openJsonShareRoute = () => {
      const importRoute = getJsonShareImportRoute(window.location);
      if (!importRoute) {
        return;
      }

      if (handledJsonShareRouteRef.current === importRoute.routeKey) {
        return;
      }
      handledJsonShareRouteRef.current = importRoute.routeKey;

      if (importRoute.status === "invalid") {
        setJsonShareImport({
          status: "error",
          errorMessage: importRoute.errorMessage,
        });
        return;
      }

      const { route } = importRoute;
      setJsonShareImport({ status: "loading", route });

      const serviceUrl = getConfiguredJsonShareServiceUrl();
      if (!serviceUrl) {
        setJsonShareImport({
          status: "error",
          route,
          errorMessage: "Snapshot links are not configured for this build.",
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
