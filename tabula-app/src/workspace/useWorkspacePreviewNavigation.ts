import { useEffect, useMemo, useState, type RefObject } from "react";
import type { WorkspaceKnowledgeIndex } from "@tabula-md/tabula";
import type { MarkdownPreviewHandle } from "../preview/previewSyncTypes";
import type { MarkdownPreviewWorkspaceLink } from "../preview/markdownPreviewTypes";
import {
  decodeMarkdownPreviewFragment,
  resolveMarkdownPreviewWorkspaceLink,
} from "../preview/workspacePreviewLinks";
import { useEventCallback } from "../shared/useEventCallback";
import type { FileViewMode } from "./workspaceStorage";

type PendingPreviewNavigation = {
  documentId: string;
  fragment: string;
  sourceLineNumber?: number;
};

type WorkspacePreviewNavigationOptions = {
  activeFileId: string;
  activeViewMode: FileViewMode;
  knowledgeIndex?: WorkspaceKnowledgeIndex;
  previewBody: string;
  previewRef: RefObject<MarkdownPreviewHandle | null>;
  previewSurfaceRef: RefObject<HTMLElement | null>;
  onSelectFile: (fileId: string) => void;
  onSetViewMode: (viewMode: FileViewMode) => void;
};

export function useWorkspacePreviewNavigation({
  activeFileId,
  activeViewMode,
  knowledgeIndex,
  previewBody,
  previewRef,
  previewSurfaceRef,
  onSelectFile,
  onSetViewMode,
}: WorkspacePreviewNavigationOptions) {
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingPreviewNavigation | null>(null);

  const resolveWorkspaceLink = useMemo(
    () => (
      target: string,
      syntax?: "markdown" | "wikilink",
      context?: {
        relation?: "link" | "embed";
        sourceDocumentId?: string;
      },
    ) => resolveMarkdownPreviewWorkspaceLink(
      knowledgeIndex,
      context?.sourceDocumentId ?? activeFileId,
      target,
      syntax,
      context?.relation,
    ),
    [activeFileId, knowledgeIndex],
  );

  const resolveWorkspaceDocument = useMemo(
    () => (documentId: string) => {
      const document = knowledgeIndex?.documentsById.get(documentId);
      const analysis = knowledgeIndex?.analysesByDocumentId.get(documentId);
      return document && analysis
        ? { ...document, headings: analysis.headings }
        : undefined;
    },
    [knowledgeIndex],
  );

  const openPreviewWorkspaceLink = useEventCallback((
    link: Extract<MarkdownPreviewWorkspaceLink, { status: "resolved" }>,
  ) => {
    const decodedFragment = link.fragment
      ? decodeMarkdownPreviewFragment(link.fragment)
      : "";
    setPendingNavigation(
      decodedFragment
        ? {
            documentId: link.targetDocumentId,
            fragment: decodedFragment,
            sourceLineNumber: link.sourceLineNumber,
          }
        : null,
    );

    if (link.targetDocumentId === activeFileId) return;
    onSelectFile(link.targetDocumentId);
    onSetViewMode(activeViewMode === "split" ? "split" : "preview");
  });

  useEffect(() => {
    if (
      !pendingNavigation ||
      pendingNavigation.documentId !== activeFileId ||
      activeViewMode === "edit" ||
      activeViewMode === "visual"
    ) {
      return undefined;
    }

    let frameId = 0;
    let attempts = 0;
    const scrollToFragment = () => {
      const target = Array.from(
        previewSurfaceRef.current?.querySelectorAll<HTMLElement>("[id]") ?? [],
      ).find((element) =>
        element.id === pendingNavigation.fragment &&
        !element.closest(".preview-workspace-embed-body")
      );
      if (target) {
        target.scrollIntoView({ block: "start", behavior: "smooth" });
        setPendingNavigation(null);
        return;
      }
      attempts += 1;
      if (attempts === 1 && pendingNavigation.sourceLineNumber) {
        previewRef.current?.followEditorPosition({
          atDocumentEnd: false,
          lineNumber: pendingNavigation.sourceLineNumber,
          lineOffsetRatio: 0,
        });
      }
      if (attempts < 90) {
        frameId = window.requestAnimationFrame(scrollToFragment);
      } else {
        setPendingNavigation(null);
      }
    };
    frameId = window.requestAnimationFrame(scrollToFragment);
    return () => window.cancelAnimationFrame(frameId);
  }, [
    activeFileId,
    activeViewMode,
    pendingNavigation,
    previewBody,
    previewRef,
    previewSurfaceRef,
  ]);

  return {
    openPreviewWorkspaceLink,
    resolveWorkspaceDocument,
    resolveWorkspaceLink,
  };
}
