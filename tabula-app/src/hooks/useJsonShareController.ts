import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  createJsonShareLink,
  formatJsonShareUrlPreview,
  getConfiguredJsonShareServiceUrl,
} from "../share";
import type { WorkspaceShareCopy } from "../workspaceLocale";
import {
  WORKSPACE_ROOT_FOLDER_ID,
  type FileComment,
  type WorkspaceFile,
  type WorkspaceFolder,
} from "../workspaceStorage";
import { clientErrorReporter } from "../observability/clientErrorReporting";

type UseJsonShareControllerOptions = {
  activeFile?: WorkspaceFile;
  activeText?: string;
  commentsByFileId: Record<string, FileComment[]>;
  copy: WorkspaceShareCopy;
  files: WorkspaceFile[];
  folders: WorkspaceFolder[];
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  onBeforeWorkspaceBoundary?: () => void;
  showToast: (message: string, tone?: "error" | "neutral") => void;
};

export type JsonShareController = {
  canExport: boolean;
  copyLink: () => Promise<void>;
  disabledReason: string;
  documentCount: number;
  expiresAt?: string;
  exportLink: () => Promise<boolean>;
  exporting: boolean;
  reset: () => void;
  url?: string;
  urlPreview: string;
};

const EXPORT_LINK_UNAVAILABLE_MESSAGE = "Export link isn’t available right now.";

export const getJsonShareExportFileSnapshot = ({
  activeFile,
  getActiveFileSnapshot,
  onBeforeWorkspaceBoundary,
}: {
  activeFile?: WorkspaceFile;
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  onBeforeWorkspaceBoundary?: () => void;
}) => {
  onBeforeWorkspaceBoundary?.();
  return getActiveFileSnapshot?.() ?? activeFile;
};

export const getJsonShareExportWorkspaceFiles = ({
  activeFile,
  activeText,
  files,
  getActiveFileSnapshot,
  onBeforeWorkspaceBoundary,
}: {
  activeFile?: WorkspaceFile;
  activeText?: string;
  files: WorkspaceFile[];
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  onBeforeWorkspaceBoundary?: () => void;
}) => {
  onBeforeWorkspaceBoundary?.();
  const activeSnapshot = getActiveFileSnapshot?.();
  const filesById = new Map(files.map((file) => [file.id, file]));

  if (activeSnapshot) {
    filesById.set(activeSnapshot.id, activeSnapshot);
  } else if (activeFile && activeText !== undefined) {
    filesById.set(activeFile.id, { ...activeFile, text: activeText });
  }

  return files.map((file) => filesById.get(file.id) ?? file);
};

export function useJsonShareController({
  activeFile,
  activeText,
  commentsByFileId,
  copy,
  files,
  folders,
  getActiveFileSnapshot,
  onBeforeWorkspaceBoundary,
  showToast,
}: UseJsonShareControllerOptions): JsonShareController {
  const [jsonShareResult, setJsonShareResult] = useState<{
    url: string;
    expiresAt?: string;
    documentCount: number;
  }>();
  const [exporting, setExporting] = useState(false);
  const serviceUrl = getConfiguredJsonShareServiceUrl();

  const reset = useCallback(() => setJsonShareResult(undefined), []);

  useLayoutEffect(() => {
    reset();
  }, [activeFile?.id, activeText, commentsByFileId, files, folders, reset]);

  const disabledReason = useMemo(() => {
    if (files.length === 0) {
      return copy.shareable.noFileReason;
    }
    return "";
  }, [copy, files.length]);

  const exportLink = async () => {
    if (exporting || disabledReason) {
      if (disabledReason) {
        showToast(disabledReason, "error");
      }
      return false;
    }
    const selectedFiles = getJsonShareExportWorkspaceFiles({
      activeFile,
      activeText,
      files,
      getActiveFileSnapshot,
      onBeforeWorkspaceBoundary,
    });
    if (selectedFiles.length === 0) {
      showToast(copy.shareable.noFileReason, "error");
      return false;
    }
    if (!serviceUrl) {
      showToast(EXPORT_LINK_UNAVAILABLE_MESSAGE, "error");
      return false;
    }

    setExporting(true);
    try {
      const selectedFileIds = new Set(selectedFiles.map((file) => file.id));
      const selectedCommentsByFileId = Object.fromEntries(
        selectedFiles
          .map((file) => [file.id, commentsByFileId[file.id] ?? []] as const)
          .filter(([, comments]) => comments.length > 0),
      );
      const snapshotActiveFileId =
        (activeFile && selectedFileIds.has(activeFile.id) ? activeFile.id : undefined) ??
        selectedFiles[0]!.id;
      const { url, expiresAt } = await createJsonShareLink({
        serviceUrl,
        origin: window.location.origin,
        files: selectedFiles,
        folders,
        rootFolderId: WORKSPACE_ROOT_FOLDER_ID,
        activeFileId: snapshotActiveFileId,
        commentsByFileId: selectedCommentsByFileId,
      });
      setJsonShareResult({ url, expiresAt, documentCount: selectedFiles.length });
      showToast("Export link created.");
      return true;
    } catch (error) {
      clientErrorReporter.report({
        feature: "json-share",
        operation: "export",
        error,
      });
      showToast(getJsonShareExportErrorMessage(error), "error");
      return false;
    } finally {
      setExporting(false);
    }
  };

  const copyLink = async () => {
    if (!jsonShareResult?.url) {
      return;
    }
    await navigator.clipboard.writeText(jsonShareResult.url);
    showToast("Export link copied.");
  };

  return {
    canExport: !disabledReason && !exporting,
    copyLink,
    disabledReason,
    documentCount: jsonShareResult?.documentCount ?? files.length,
    expiresAt: jsonShareResult?.expiresAt,
    exportLink,
    exporting,
    reset,
    ...(jsonShareResult ? { url: jsonShareResult.url } : {}),
    urlPreview: jsonShareResult ? formatJsonShareUrlPreview(jsonShareResult.url) : "",
  };
}

const getJsonShareExportErrorMessage = (error: unknown) => {
  if (
    error instanceof TypeError ||
    (error instanceof Error && /failed to fetch|network/i.test(error.message))
  ) {
    return EXPORT_LINK_UNAVAILABLE_MESSAGE;
  }

  return "Couldn’t export to link.";
};
