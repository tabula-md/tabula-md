import { useEffect, useMemo, useState } from "react";
import {
  createJsonShareLink,
  formatJsonShareUrlPreview,
  getConfiguredJsonShareServiceUrl,
} from "../share";
import { tabulaServiceConfig } from "../serviceConfig";
import type { WorkspaceShareCopy } from "../workspaceLocale";
import type { FileComment, WorkspaceFile } from "../workspaceStorage";
import { clientErrorReporter } from "../observability/clientErrorReporting";

type UseJsonShareControllerOptions = {
  activeFile?: WorkspaceFile;
  activeText?: string;
  commentsByFileId: Record<string, FileComment[]>;
  copy: WorkspaceShareCopy;
  getActiveFileSnapshot?: () => WorkspaceFile | undefined;
  onBeforeWorkspaceBoundary?: () => void;
  showToast: (message: string, tone?: "error" | "neutral") => void;
};

export type JsonShareController = {
  canExport: boolean;
  copyLink: () => Promise<void>;
  disabledReason: string;
  exportLink: () => Promise<void>;
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

export function useJsonShareController({
  activeFile,
  activeText,
  commentsByFileId,
  copy,
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
    if (!activeFile) {
      return copy.shareable.noFileReason;
    }
    if ((activeText ?? activeFile.text).trim().length === 0) {
      return copy.shareable.emptyFileReason(activeFile.title.replace(/\.(?:md|markdown)$/i, ""));
    }
    if (!serviceUrl) {
      return tabulaServiceConfig.copy.jsonShareUnconfiguredMessage;
    }
    return "";
  }, [activeFile, activeText, copy, serviceUrl]);

  const exportLink = async () => {
    if (exporting || disabledReason || !serviceUrl) {
      if (disabledReason) {
        showToast(disabledReason, "error");
      }
      return;
    }
    const fileSnapshot = getJsonShareExportFileSnapshot({
      activeFile,
      getActiveFileSnapshot,
      onBeforeWorkspaceBoundary,
    });
    if (!fileSnapshot) {
      return;
    }

    setExporting(true);
    try {
      const activeFileComments = commentsByFileId[fileSnapshot.id] ?? [];
      const { url } = await createJsonShareLink({
        serviceUrl,
        origin: window.location.origin,
        files: [fileSnapshot],
        activeFileId: fileSnapshot.id,
        commentsByFileId: activeFileComments.length > 0 ? { [fileSnapshot.id]: activeFileComments } : {},
      });
      setJsonShareUrl(url);
      showToast("Snapshot link created.");
    } catch (error) {
      clientErrorReporter.report({
        feature: "json-share",
        operation: "export",
        error,
      });
      showToast(error instanceof Error ? error.message : "Share link failed.", "error");
    } finally {
      setExporting(false);
    }
  };

  const copyLink = async () => {
    if (!jsonShareUrl) {
      return;
    }
    await navigator.clipboard.writeText(jsonShareUrl);
    showToast("Snapshot link copied.");
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
