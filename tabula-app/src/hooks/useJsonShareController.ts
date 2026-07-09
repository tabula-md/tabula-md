import { useEffect, useMemo, useState } from "react";
import {
  createJsonShareLink,
  formatJsonShareUrlPreview,
  getConfiguredJsonShareServiceUrl,
} from "../share";
import type { WorkspaceShareCopy } from "../workspaceLocale";
import type { FileComment, WorkspaceFile } from "../workspaceStorage";
import { clientErrorReporter } from "../observability/clientErrorReporting";

type UseJsonShareControllerOptions = {
  activeFile?: WorkspaceFile;
  activeText?: string;
  commentsByFileId: Record<string, FileComment[]>;
  copy: WorkspaceShareCopy;
  files: WorkspaceFile[];
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  onBeforeWorkspaceBoundary?: () => void;
  showToast: (message: string, tone?: "error" | "neutral") => void;
};

export type JsonShareController = {
  canExport: boolean;
  copyLink: () => Promise<void>;
  disabledReason: string;
  exportLink: (fileIds?: readonly string[]) => Promise<boolean>;
  exporting: boolean;
  url?: string;
  urlPreview: string;
};

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
  fileIds,
  files,
  getActiveFileSnapshot,
  onBeforeWorkspaceBoundary,
}: {
  activeFile?: WorkspaceFile;
  activeText?: string;
  fileIds?: readonly string[];
  files: WorkspaceFile[];
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  onBeforeWorkspaceBoundary?: () => void;
}) => {
  onBeforeWorkspaceBoundary?.();
  const activeSnapshot = getActiveFileSnapshot?.();
  const selectedIds = fileIds ? new Set(fileIds) : null;
  const filesById = new Map(files.map((file) => [file.id, file]));

  if (activeSnapshot) {
    filesById.set(activeSnapshot.id, activeSnapshot);
  } else if (activeFile && activeText !== undefined) {
    filesById.set(activeFile.id, { ...activeFile, text: activeText });
  }

  return files
    .map((file) => filesById.get(file.id) ?? file)
    .filter((file) => !selectedIds || selectedIds.has(file.id));
};

export function useJsonShareController({
  activeFile,
  activeText,
  commentsByFileId,
  copy,
  files,
  getActiveFileSnapshot,
  onBeforeWorkspaceBoundary,
  showToast,
}: UseJsonShareControllerOptions): JsonShareController {
  const [jsonShareUrl, setJsonShareUrl] = useState<string | undefined>(undefined);
  const [exporting, setExporting] = useState(false);
  const serviceUrl = getConfiguredJsonShareServiceUrl();

  useEffect(() => {
    setJsonShareUrl(undefined);
  }, [activeFile?.id]);

  const disabledReason = useMemo(() => {
    if (files.length === 0) {
      return copy.shareable.noFileReason;
    }
    return "";
  }, [copy, files.length]);

  const exportLink = async (fileIds?: readonly string[]) => {
    if (exporting || disabledReason) {
      if (disabledReason) {
        showToast(disabledReason, "error");
      }
      return false;
    }
    const selectedFiles = getJsonShareExportWorkspaceFiles({
      activeFile,
      activeText,
      fileIds,
      files,
      getActiveFileSnapshot,
      onBeforeWorkspaceBoundary,
    });
    if (selectedFiles.length === 0) {
      showToast(copy.shareable.noFileReason, "error");
      return false;
    }
    if (!serviceUrl) {
      showToast("Export link isn’t available right now.", "error");
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
      const { url } = await createJsonShareLink({
        serviceUrl,
        origin: window.location.origin,
        files: selectedFiles,
        activeFileId: snapshotActiveFileId,
        commentsByFileId: selectedCommentsByFileId,
      });
      setJsonShareUrl(url);
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
    if (!jsonShareUrl) {
      return;
    }
    await navigator.clipboard.writeText(jsonShareUrl);
    showToast("Export link copied.");
  };

  return {
    canExport: !disabledReason && !exporting,
    copyLink,
    disabledReason,
    exportLink,
    exporting,
    ...(jsonShareUrl ? { url: jsonShareUrl } : {}),
    urlPreview: jsonShareUrl ? formatJsonShareUrlPreview(jsonShareUrl) : "",
  };
}

const getJsonShareExportErrorMessage = (error: unknown) => {
  if (
    error instanceof TypeError ||
    (error instanceof Error && /failed to fetch|network/i.test(error.message))
  ) {
    return "Export link isn’t available right now.";
  }

  return error instanceof Error
    ? error.message
    : "Couldn’t create export link.";
};
