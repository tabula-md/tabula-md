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
import { randomId, type FileComment, type MarkdownFile } from "../workspaceStorage";

type UsePublishControllerOptions = {
  activeFile?: MarkdownFile;
  activeFileId: string;
  commentsByFileId: Record<string, FileComment[]>;
  files: MarkdownFile[];
  ownerName: string;
  showToast: (message: string, tone?: "error" | "neutral") => void;
};

const getCommentsForPublishedFiles = (
  commentsByFileId: Record<string, FileComment[]>,
  publishFiles: MarkdownFile[],
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

export function usePublishController({
  activeFile,
  activeFileId,
  commentsByFileId,
  files,
  ownerName,
  showToast,
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
  const publishServiceConfigured = Boolean(getConfiguredPublishServiceUrl());
  const canManagePublishedPage = Boolean(
    publishedSnapshot && (!publishServiceConfigured || publishedSnapshot.ownerToken),
  );
  const publishPreviewFiles = useMemo(
    () => (publishScope === "file" && activeFile ? [activeFile] : files),
    [activeFile, files, publishScope],
  );
  const publishBlockerMessage = getEmptyPublishFilesMessage(publishPreviewFiles, publishScope);

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

    const publishServiceUrl = getConfiguredPublishServiceUrl();
    const isUpdatingPublishedPage = Boolean(
      publishedSnapshot && (publishServiceUrl ? publishedSnapshot.ownerToken : true),
    );
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
      const snapshot = publishServiceUrl
        ? isUpdatingPublishedPage && publishedSnapshot?.ownerToken
          ? await republishServerPublishedSnapshot({
              serviceUrl: publishServiceUrl,
              origin: window.location.origin,
              scope: publishScope,
              ownerName,
              snapshot: publishedSnapshot,
              files: publishFiles,
              activeFileId: publishActiveFileId,
              commentsByFileId: publishCommentsByFileId,
            })
          : await createServerPublishedSnapshot({
              serviceUrl: publishServiceUrl,
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
      showToast(isUpdatingPublishedPage ? "Published page updated." : "Page published.");
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

    const publishServiceUrl = getConfiguredPublishServiceUrl();
    if (publishServiceUrl && !publishedSnapshot.ownerToken) {
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
      if (publishServiceUrl) {
        await unpublishServerPublishedSnapshot({
          serviceUrl: publishServiceUrl,
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

  return {
    publishedSnapshot,
    publishedScope,
    publishedFileTitle,
    publishScope,
    setPublishScope,
    publishing,
    unpublishing,
    canManagePublishedPage,
    publishBlockerMessage,
    publishProjectSnapshot,
    unpublishProjectSnapshot,
    copyPublishedUrl,
  };
}
