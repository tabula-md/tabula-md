import { useEffect, useMemo, useState } from "react";
import {
  createJsonShareLink,
  formatJsonShareUrlPreview,
  getConfiguredJsonShareServiceUrl,
} from "../jsonShare";
import type { FileComment, MarkdownFile } from "../workspaceStorage";

type UseJsonShareControllerOptions = {
  activeFile?: MarkdownFile;
  commentsByFileId: Record<string, FileComment[]>;
  ownerName: string;
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

export function useJsonShareController({
  activeFile,
  commentsByFileId,
  ownerName,
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
      return "Open a file before exporting a link.";
    }
    if (activeFile.text.trim().length === 0) {
      return `Add content to ${activeFile.title.replace(/\.(?:md|markdown)$/i, "")} before exporting a link.`;
    }
    if (!serviceUrl) {
      return "Read-only links are not configured.";
    }
    return "";
  }, [activeFile, serviceUrl]);

  const exportLink = async () => {
    if (exporting || disabledReason || !activeFile || !serviceUrl) {
      if (disabledReason) {
        showToast(disabledReason, "error");
      }
      return;
    }

    setExporting(true);
    try {
      const activeFileComments = commentsByFileId[activeFile.id] ?? [];
      const { url } = await createJsonShareLink({
        serviceUrl,
        origin: window.location.origin,
        ownerName,
        files: [activeFile],
        activeFileId: activeFile.id,
        commentsByFileId: activeFileComments.length > 0 ? { [activeFile.id]: activeFileComments } : {},
      });
      setJsonShareUrl(url);
      showToast("Read-only link created.");
    } catch (error) {
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
    showToast("Read-only link copied.");
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
