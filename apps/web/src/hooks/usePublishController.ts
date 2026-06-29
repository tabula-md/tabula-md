import { useEffect, useMemo, useState } from "react";
import {
  createPublishedSnapshot,
  createServerPublishedSnapshot,
  deletePublishedSnapshot,
  getConfiguredPublishServiceUrl,
  getEmptyPublishFiles,
  getEmptyPublishFilesMessage,
  readLatestPublishedSnapshot,
  republishServerPublishedSnapshot,
  savePublishedSnapshot,
  unpublishServerPublishedSnapshot,
  type PublishedSnapshot,
  type PublishScope,
} from "../publish";
import { buildPublishViewModel, type PublishViewModel } from "../publishViewModel";
import { randomId, type FileComment, type WorkspaceFile } from "../workspaceStorage";

type UsePublishControllerOptions = {
  activeFile?: WorkspaceFile;
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
  files: WorkspaceFile[];
  ownerName: string;
  showToast: (message: string, tone?: "error" | "neutral") => void;
  tabulaPlusEnabled: boolean;
};

type PublishLifecyclePolicy =
  | {
      canManagePublishedPage: boolean;
      isUpdatingPublishedPage: boolean;
      mode: "local";
      serviceUrl: null;
    }
  | {
      canManagePublishedPage: boolean;
      isUpdatingPublishedPage: boolean;
      mode: "server";
      serviceUrl: string;
    };

const getCommentsForPublishedFiles = (
  commentsByFileId: Record<string, FileComment[]>,
  publishFiles: WorkspaceFile[],
) => {
  const publishFileIds = new Set(publishFiles.map((file) => file.id));
  return Object.fromEntries(
    Object.entries(commentsByFileId).filter(
      ([fileId, comments]) => publishFileIds.has(fileId) && comments.length > 0,
    ),
  );
};

const getPublishedSnapshotScope = (snapshot: PublishedSnapshot | null | undefined): PublishScope | undefined => {
  if (!snapshot) {
    return undefined;
  }

  return snapshot.scope ?? (snapshot.fileCount > 1 ? "project" : "file");
};

export const getPublishLifecyclePolicy = (
  serviceUrl: string | null,
  publishedSnapshot: PublishedSnapshot | null,
): PublishLifecyclePolicy => {
  if (!serviceUrl) {
    return {
      canManagePublishedPage: Boolean(publishedSnapshot),
      isUpdatingPublishedPage: Boolean(publishedSnapshot),
      mode: "local",
      serviceUrl: null,
    };
  }

  return {
    canManagePublishedPage: Boolean(publishedSnapshot?.ownerToken),
    isUpdatingPublishedPage: Boolean(publishedSnapshot?.ownerToken),
    mode: "server",
    serviceUrl,
  };
};

export type PublishController = {
  changeScope: (nextScope: PublishScope) => void;
  copyPageUrl: () => void;
  pageUrl?: string;
  publish: () => Promise<void>;
  resetScopeToPublished: () => void;
  unpublish: () => Promise<void>;
  versionKey: string;
  view: PublishViewModel;
};

export function usePublishController({
  activeFile,
  activeFileId,
  commentsByFileId,
  files,
  ownerName,
  showToast,
  tabulaPlusEnabled,
}: UsePublishControllerOptions) {
  const [publishedSnapshot, setPublishedSnapshot] = useState<PublishedSnapshot | null>(() =>
    readLatestPublishedSnapshot(),
  );
  const [publishScope, setPublishScope] = useState<PublishScope>("file");
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);

  useEffect(() => {
    const currentPublishedScope = getPublishedSnapshotScope(publishedSnapshot);
    if (currentPublishedScope) {
      setPublishScope(currentPublishedScope);
    }
  }, [publishedSnapshot?.id, publishedSnapshot?.scope, publishedSnapshot?.fileCount]);

  const publishedScope = getPublishedSnapshotScope(publishedSnapshot);
  const publishedFileTitle =
    publishedSnapshot?.files.find((file) => file.id === publishedSnapshot.activeFileId)?.title ??
    publishedSnapshot?.files[0]?.title;
  const publishPolicy = getPublishLifecyclePolicy(getConfiguredPublishServiceUrl(), publishedSnapshot);
  const publishPreviewFiles = useMemo(
    () => (publishScope === "file" && activeFile ? [activeFile] : files),
    [activeFile, files, publishScope],
  );
  const publishBlockerMessage = getEmptyPublishFilesMessage(publishPreviewFiles, publishScope);
  const activeFileTitle = activeFile?.title ?? "No file open";
  const activeFileDisplayTitle = activeFileTitle.replace(/\.(?:md|markdown)$/i, "");
  const publishViewModel = useMemo(
    () =>
      buildPublishViewModel({
        activeFileDisplayTitle,
        activeFileTitle,
        tabulaPlusEnabled,
        publishScope,
        publishFileCount: files.length,
        publishedScope,
        publishedFileTitle,
        publishedFileCount: publishedSnapshot?.fileCount,
        publishedAt: publishedSnapshot?.updatedAt ?? publishedSnapshot?.createdAt,
        publishPageUrl: publishedSnapshot?.urls.page,
        publishBlockerMessage,
        canRepublishSnapshot: publishPolicy.canManagePublishedPage,
        publishing,
        unpublishing,
      }),
    [
      activeFileDisplayTitle,
      activeFileTitle,
      files.length,
      publishBlockerMessage,
      publishedFileTitle,
      publishedScope,
      publishedSnapshot?.createdAt,
      publishedSnapshot?.fileCount,
      publishedSnapshot?.updatedAt,
      publishedSnapshot?.urls.page,
      publishPolicy.canManagePublishedPage,
      publishScope,
      publishing,
      tabulaPlusEnabled,
      unpublishing,
    ],
  );
  const publishedVersionKey = [
    publishedSnapshot?.id ?? "",
    publishedSnapshot?.scope ?? "",
    publishedSnapshot?.updatedAt ?? "",
    publishedSnapshot?.createdAt ?? "",
  ].join(":");

  const getPublishActiveFileId = (publishFiles = publishPreviewFiles) => {
    const requestedActiveFileId = activeFile?.id ?? activeFileId;
    return publishFiles.some((file) => file.id === requestedActiveFileId)
      ? requestedActiveFileId
      : (publishFiles[0]?.id ?? requestedActiveFileId);
  };

  const publishProjectSnapshot = async () => {
    if (publishing) {
      return;
    }

    const publishFiles = publishPreviewFiles;
    const emptyPublishFiles = getEmptyPublishFiles(publishFiles);
    if (emptyPublishFiles.length > 0) {
      showToast(getEmptyPublishFilesMessage(publishFiles, publishScope), "error");
      return;
    }

    const publishActiveFileId = getPublishActiveFileId(publishFiles);
    const publishCommentsByFileId = getCommentsForPublishedFiles(commentsByFileId, publishFiles);
    setPublishing(true);
    try {
      const snapshot = publishPolicy.mode === "server"
        ? publishPolicy.isUpdatingPublishedPage && publishedSnapshot?.ownerToken
          ? await republishServerPublishedSnapshot({
              serviceUrl: publishPolicy.serviceUrl,
              origin: window.location.origin,
              scope: publishScope,
              ownerName,
              snapshot: publishedSnapshot,
              files: publishFiles,
              activeFileId: publishActiveFileId,
              commentsByFileId: publishCommentsByFileId,
            })
          : await createServerPublishedSnapshot({
              serviceUrl: publishPolicy.serviceUrl,
              origin: window.location.origin,
              scope: publishScope,
              ownerName,
              files: publishFiles,
              activeFileId: publishActiveFileId,
              commentsByFileId: publishCommentsByFileId,
            })
        : {
            ...createPublishedSnapshot({
              id: publishedSnapshot?.id ?? randomId(),
              origin: window.location.origin,
              scope: publishScope,
              ownerName,
              files: publishFiles,
              activeFileId: publishActiveFileId,
              commentsByFileId: publishCommentsByFileId,
            }),
            ...(publishedSnapshot ? { createdAt: publishedSnapshot.createdAt, updatedAt: new Date().toISOString() } : {}),
          };
      savePublishedSnapshot(snapshot);
      setPublishedSnapshot(snapshot);
      showToast(publishPolicy.isUpdatingPublishedPage ? "Published page updated." : "Page published.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Publish failed.");
    } finally {
      setPublishing(false);
    }
  };

  const unpublishProjectSnapshot = async () => {
    if (unpublishing || !publishedSnapshot) {
      return;
    }

    if (publishPolicy.mode === "server" && !publishedSnapshot.ownerToken) {
      return;
    }

    const confirmed = window.confirm(
      "Unpublish this page?\n\nThis removes the public page and included AI-readable outputs. The local project stays unchanged.",
    );
    if (!confirmed) {
      return;
    }

    setUnpublishing(true);
    try {
      if (publishPolicy.mode === "server") {
        await unpublishServerPublishedSnapshot({
          serviceUrl: publishPolicy.serviceUrl,
          snapshot: publishedSnapshot,
        });
      }
      deletePublishedSnapshot(publishedSnapshot.id);
      setPublishedSnapshot(null);
      showToast("Page unpublished.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Publish failed.");
    } finally {
      setUnpublishing(false);
    }
  };

  const copyPublishedUrl = async (url: string, label: string) => {
    await navigator.clipboard.writeText(url);
    showToast(`${label} copied.`);
  };

  const copyPublishedPageUrl = async () => {
    if (!publishedSnapshot) {
      return;
    }

    await copyPublishedUrl(publishedSnapshot.urls.page, "Published page link");
  };

  const resetScopeToPublished = () => {
    if (publishedScope) {
      setPublishScope(publishedScope);
    }
  };

  return {
    changeScope: setPublishScope,
    copyPageUrl: copyPublishedPageUrl,
    pageUrl: publishedSnapshot?.urls.page,
    publish: publishProjectSnapshot,
    resetScopeToPublished,
    unpublish: unpublishProjectSnapshot,
    versionKey: publishedVersionKey,
    view: publishViewModel,
  };
}
