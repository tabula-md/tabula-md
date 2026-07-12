import { useEffect, useRef, useState } from "react";
import type { ConnectionStatus } from "../collaboration";
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
import { writeIndexedDbWorkspace } from "../workspaceIndexedDb";
import { clientErrorReporter } from "../observability/clientErrorReporting";
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
  getWorkspaceSnapshot?: () => WorkspaceState;
  onBeforeWorkspaceBoundary?: () => void;
  replaceCommentsByFileId: (commentsByFileId: Record<string, FileComment[]>) => void;
  replaceWorkspace: (workspace: Pick<WorkspaceState, "files" | "folders" | "openFileIds" | "activeFileId">) => WorkspaceFile | undefined;
  resetCollaborationState: (nextStatus: ConnectionStatus) => void;
  showToast: (
    message: string,
    tone?: "neutral" | "error",
    action?: { actionLabel?: string; onAction?: () => void },
  ) => void;
  workspaceSource: InitialWorkspaceSnapshot["source"];
};

export function useJsonShareImportController({
  clearFileHistory,
  closeFloatingChrome,
  commentsByFileId,
  files,
  getWorkspaceSnapshot,
  onBeforeWorkspaceBoundary,
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
  const closeFloatingChromeEvent = useEventCallback(closeFloatingChrome);

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
    const previousWorkspace = getWorkspaceSnapshot?.();
    jsonShareImportCleanupRef.current = null;
    handledJsonShareRouteRef.current = null;
    onBeforeWorkspaceBoundary?.();
    const nextActiveFile = replaceWorkspace(workspace);
    replaceCommentsByFileId(workspace.commentsByFileId);
    void writeIndexedDbWorkspace(workspace).catch((error: unknown) => {
      clientErrorReporter.report({
        feature: "workspace",
        operation: "persist-export-import",
        error,
      });
      showToast("The copy opened, but it couldn’t be saved in this browser.", "error");
    });
    clearFileHistory();
    resetCollaborationState("idle");
    closeFloatingChrome();
    syncUrlForFile(nextActiveFile, "replace");
    setJsonShareImport(null);
    showToast("Export copy opened.", "neutral", previousWorkspace ? {
      actionLabel: "Undo",
      onAction: () => {
        onBeforeWorkspaceBoundary?.();
        const restoredActiveFile = replaceWorkspace(previousWorkspace);
        replaceCommentsByFileId(previousWorkspace.commentsByFileId);
        void writeIndexedDbWorkspace(previousWorkspace).catch((error: unknown) => {
          clientErrorReporter.report({
            feature: "workspace",
            operation: "persist-export-import-undo",
            error,
          });
          showToast("The previous workspace was restored but couldn’t be saved.", "error");
        });
        clearFileHistory();
        resetCollaborationState("idle");
        closeFloatingChrome();
        syncUrlForFile(restoredActiveFile, "replace");
        showToast("Previous workspace restored.");
      },
    } : undefined);
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
      closeFloatingChromeEvent();

      if (importRoute.status === "invalid") {
        clientErrorReporter.report({
          feature: "json-share",
          operation: "import-route",
          error: new Error(importRoute.errorMessage),
        });
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
        clientErrorReporter.report({
          feature: "json-share",
          operation: "import-config",
          error: new Error("This export link cannot be opened here."),
        });
        setJsonShareImport({
          status: "error",
          route,
          errorMessage: "This export link cannot be opened here.",
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
            clientErrorReporter.report({
              feature: "json-share",
              operation: "import-read",
              error: new Error("This export link was not found or has expired."),
            });
            setJsonShareImport({
              status: "error",
              route,
              errorMessage: "This export link was not found or has expired.",
            });
            return;
          }

          const nextWorkspace = createWorkspaceFromJsonShareSnapshot(snapshot);
          onBeforeWorkspaceBoundary?.();
          const currentWorkspaceContent = getWorkspaceSnapshot?.() ?? workspaceContentRef.current;
          const shouldConfirmImport =
            workspaceSource !== "starter" || hasMeaningfulWorkspaceContent(currentWorkspaceContent);
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
          clientErrorReporter.report({
            feature: "json-share",
            operation: "import-read",
            error,
          });
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
  }, [closeFloatingChromeEvent, replaceWorkspaceWithJsonShare, workspaceSource]);

  return {
    closeJsonShareImport,
    jsonShareImport,
    replaceWorkspaceWithJsonShare,
  };
}
