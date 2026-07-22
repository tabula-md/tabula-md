import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  createActiveDocumentEditorRuntime,
  createActiveDocumentPreviewBodyRuntime,
  createActiveDocumentPreviewMetadataRuntime,
  createActiveDocumentPreviewRuntime,
  getApproximateTokenCount,
  getMarkdownWordCount,
  isLargeMarkdownDocument,
  shouldUseImmediateMarkdownPreview,
  type ActiveDocumentPreviewBodyRuntime,
  type ActiveDocumentPreviewMetadataRuntime,
  type ActiveDocumentPreviewRuntime,
  type TextChange,
} from "@tabula-md/tabula";
import {
  derivePatchedPreviewBodyTextChange,
  derivePreviewBodyTextChange,
  type PreviewBodyTextChangeSnapshot,
} from "../preview/previewBodyTextChange";
import {
  getPreviewBodyDerivationDelayMs,
  getPreviewMetadataDerivationDelayMs,
  getWordCountDerivationDelayMs,
  LARGE_DOCUMENT_METADATA_IDLE_TIMEOUT_MS,
  shouldDeriveImmediatePreviewState,
  shouldDerivePreviewBodyImmediately,
  shouldPatchPreviewBodyImmediately,
} from "../preview/previewDerivationPolicy";
import type { WorkspaceFile } from "../workspace/workspaceStorage";

export type ActiveDocumentPreviewTextSnapshot = {
  fileId: string;
  hasFile: boolean;
  text: string;
};

export const createActiveDocumentPreviewTextSnapshot = (
  activeFile: Pick<WorkspaceFile, "id"> | undefined,
  text: string,
): ActiveDocumentPreviewTextSnapshot => ({
  fileId: activeFile?.id ?? "",
  hasFile: Boolean(activeFile),
  text,
});

const EMPTY_PREVIEW_TEXT_SNAPSHOT: ActiveDocumentPreviewTextSnapshot = {
  fileId: "",
  hasFile: false,
  text: "",
};

export const createPreviewStateFromSnapshot = (
  snapshot: ActiveDocumentPreviewTextSnapshot,
): ActiveDocumentPreviewRuntime =>
  createActiveDocumentPreviewRuntime(
    snapshot.hasFile ? { text: snapshot.text } : undefined,
    { text: snapshot.text },
  );

export const createPreviewBodyStateFromSnapshot = (
  snapshot: ActiveDocumentPreviewTextSnapshot,
): ActiveDocumentPreviewBodyRuntime =>
  createActiveDocumentPreviewBodyRuntime(
    snapshot.hasFile ? { text: snapshot.text } : undefined,
    { text: snapshot.text },
  );

const createPreviewMetadataStateFromSnapshot = (
  snapshot: ActiveDocumentPreviewTextSnapshot,
): ActiveDocumentPreviewMetadataRuntime =>
  createActiveDocumentPreviewMetadataRuntime(
    snapshot.hasFile ? { text: snapshot.text } : undefined,
    { text: snapshot.text },
  );

const getPreviewBodyState = ({
  previewBodyStartOffset,
  renderedPreview,
}: ActiveDocumentPreviewBodyRuntime): ActiveDocumentPreviewBodyRuntime => ({
  previewBodyStartOffset,
  renderedPreview,
});

const getPreviewMetadataState = ({
  outlineHeadings,
  parsedMarkdown,
}: ActiveDocumentPreviewMetadataRuntime): ActiveDocumentPreviewMetadataRuntime => ({
  outlineHeadings,
  parsedMarkdown,
});

interface DeferredPreviewBodyState {
  previewSnapshot: ActiveDocumentPreviewTextSnapshot;
  previewBodyState: ActiveDocumentPreviewBodyRuntime;
}

type DeferredPreviewMetadataState = {
  previewSnapshot: ActiveDocumentPreviewTextSnapshot;
  previewMetadataState: ActiveDocumentPreviewMetadataRuntime;
};

type DeferredDocumentMetricsState = {
  approximateTokenCount: number;
  previewSnapshot: ActiveDocumentPreviewTextSnapshot;
  wordCount: number;
};

export const useActiveDocumentRuntime = (
  activeFile?: WorkspaceFile,
  options: { text?: string; textChange?: TextChange | null } = {},
) => {
  const activeFileId = activeFile?.id ?? "";
  const hasActiveFile = Boolean(activeFile);
  const activeText = options.text ?? activeFile?.text ?? "";
  const activeViewMode = activeFile?.viewMode ?? "edit";
  const activePreviewSnapshot = createActiveDocumentPreviewTextSnapshot(activeFile, activeText);
  const previousPreviewBodyTextSnapshotRef = useRef<PreviewBodyTextChangeSnapshot | null>(null);
  const largeDocumentMode = isLargeMarkdownDocument(activeText);
  const immediatePreviewEligible = shouldUseImmediateMarkdownPreview(activeText);
  const [deferredPreviewBodyState, setDeferredPreviewBodyState] = useState<DeferredPreviewBodyState>(() => ({
    previewSnapshot: activePreviewSnapshot,
    previewBodyState: createPreviewBodyStateFromSnapshot(activePreviewSnapshot),
  }));
  const [deferredPreviewMetadataState, setDeferredPreviewMetadataState] = useState<DeferredPreviewMetadataState>(() => ({
    previewSnapshot: activePreviewSnapshot,
    previewMetadataState: createPreviewMetadataStateFromSnapshot(activePreviewSnapshot),
  }));
  const [deferredDocumentMetricsState, setDeferredDocumentMetricsState] = useState<DeferredDocumentMetricsState>(() => ({
    approximateTokenCount: getApproximateTokenCount(activeText),
    previewSnapshot: activePreviewSnapshot,
    wordCount: getMarkdownWordCount(activeText),
  }));
  const shouldRenderPreviewImmediately = shouldDeriveImmediatePreviewState({
    hasActiveFile,
    largeDocumentMode,
    markdownPreviewEligible: immediatePreviewEligible,
    textLength: activeText.length,
    viewMode: activeViewMode,
  });
  const immediatePreviewState = useMemo(
    () => (shouldRenderPreviewImmediately ? createPreviewStateFromSnapshot(activePreviewSnapshot) : null),
    [activeFileId, activeText, shouldRenderPreviewImmediately],
  );
  const hasPendingTextChange = Boolean(options.textChange?.patches.length);
  const canPatchPreviewBodyImmediately = shouldPatchPreviewBodyImmediately({
    hasActiveFile,
    largeDocumentMode,
    textLength: activeText.length,
    viewMode: activeViewMode,
  });
  const patchedPreviewBodyTextChange = useMemo(
    () => canPatchPreviewBodyImmediately
      ? derivePatchedPreviewBodyTextChange({
          currentFileId: activeFileId,
          currentText: activeText,
          previousSnapshot: previousPreviewBodyTextSnapshotRef.current,
          textChange: options.textChange,
        })
      : null,
    [activeFileId, activeText, canPatchPreviewBodyImmediately, options.textChange],
  );
  const shouldRenderPreviewBodyImmediately = shouldDerivePreviewBodyImmediately({
    hasActiveFile,
    viewMode: activeViewMode,
  });
  const shouldRenderFullPreviewBodyImmediately =
    shouldRenderPreviewBodyImmediately &&
    !(largeDocumentMode && hasPendingTextChange);
  const immediatePreviewBodyState = useMemo(
    () => patchedPreviewBodyTextChange
      ? {
          previewBodyStartOffset: patchedPreviewBodyTextChange.previewBodyStartOffset,
          renderedPreview: {
            body: patchedPreviewBodyTextChange.previewBody,
            sourceLineOffset: patchedPreviewBodyTextChange.previewSourceLineOffset,
          },
        }
      : shouldRenderFullPreviewBodyImmediately
        ? createPreviewBodyStateFromSnapshot(activePreviewSnapshot)
        : null,
    [activePreviewSnapshot, patchedPreviewBodyTextChange, shouldRenderFullPreviewBodyImmediately],
  );
  const previewBodyState =
    immediatePreviewState ??
    immediatePreviewBodyState ??
    (deferredPreviewBodyState.previewSnapshot.fileId === activeFileId
      ? deferredPreviewBodyState.previewBodyState
      : createPreviewBodyStateFromSnapshot(EMPTY_PREVIEW_TEXT_SNAPSHOT));
  const previewMetadataState =
    immediatePreviewState ??
    (deferredPreviewMetadataState.previewSnapshot.fileId === activeFileId
      ? deferredPreviewMetadataState.previewMetadataState
      : createPreviewMetadataStateFromSnapshot(EMPTY_PREVIEW_TEXT_SNAPSHOT));
  const previewState = useMemo<ActiveDocumentPreviewRuntime>(
    () => ({
      ...getPreviewMetadataState(previewMetadataState),
      ...getPreviewBodyState(previewBodyState),
    }),
    [previewBodyState, previewMetadataState],
  );
  const currentPreviewBodyTextSnapshot = useMemo<PreviewBodyTextChangeSnapshot>(() => ({
    fileId: activeFileId,
    previewBody: previewBodyState.renderedPreview.body,
    previewBodyStartOffset: previewBodyState.previewBodyStartOffset,
    previewSourceLineOffset: previewBodyState.renderedPreview.sourceLineOffset,
    text: activeText,
  }), [activeFileId, activeText, previewBodyState]);
  const previewBodyTextChange = useMemo(
    () => patchedPreviewBodyTextChange?.textChange ??
      (shouldRenderFullPreviewBodyImmediately
        ? derivePreviewBodyTextChange({
            currentSnapshot: currentPreviewBodyTextSnapshot,
            previousSnapshot: previousPreviewBodyTextSnapshotRef.current,
            textChange: options.textChange,
          })
        : null),
    [
      currentPreviewBodyTextSnapshot,
      options.textChange,
      patchedPreviewBodyTextChange,
      shouldRenderFullPreviewBodyImmediately,
    ],
  );
  const hasCurrentDocumentMetrics =
    deferredDocumentMetricsState.previewSnapshot.fileId === activeFileId;
  const approximateTokenCount = hasCurrentDocumentMetrics
    ? deferredDocumentMetricsState.approximateTokenCount
    : 0;
  const wordCount = hasCurrentDocumentMetrics
    ? deferredDocumentMetricsState.wordCount
    : 0;

  useEffect(() => {
    previousPreviewBodyTextSnapshotRef.current = currentPreviewBodyTextSnapshot;
  }, [currentPreviewBodyTextSnapshot]);

  useEffect(() => {
    if (!hasActiveFile) {
      setDeferredPreviewBodyState({
        previewSnapshot: EMPTY_PREVIEW_TEXT_SNAPSHOT,
        previewBodyState: createPreviewBodyStateFromSnapshot(EMPTY_PREVIEW_TEXT_SNAPSHOT),
      });
      return;
    }

    if (immediatePreviewState || immediatePreviewBodyState) {
      return;
    }

    const delayMs = getPreviewBodyDerivationDelayMs({
      largeDocumentMode,
      textLength: activeText.length,
      viewMode: activeViewMode,
    });
    const timer = window.setTimeout(() => {
      const previewSnapshot = createActiveDocumentPreviewTextSnapshot({ id: activeFileId }, activeText);
      setDeferredPreviewBodyState({
        previewSnapshot,
        previewBodyState: createPreviewBodyStateFromSnapshot(previewSnapshot),
      });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [activeFileId, activeText, activeViewMode, hasActiveFile, immediatePreviewBodyState, immediatePreviewState, largeDocumentMode]);

  useEffect(() => {
    if (!hasActiveFile) {
      setDeferredPreviewMetadataState({
        previewSnapshot: EMPTY_PREVIEW_TEXT_SNAPSHOT,
        previewMetadataState: createPreviewMetadataStateFromSnapshot(EMPTY_PREVIEW_TEXT_SNAPSHOT),
      });
      return;
    }

    const delayMs = getPreviewMetadataDerivationDelayMs({
      largeDocumentMode,
      textLength: activeText.length,
      viewMode: activeViewMode,
    });
    let cancelled = false;
    let idleHandle: number | null = null;
    const deriveMetadataState = () => {
      if (cancelled) {
        return;
      }
      const previewSnapshot = createActiveDocumentPreviewTextSnapshot({ id: activeFileId }, activeText);
      const previewMetadataState = createPreviewMetadataStateFromSnapshot(previewSnapshot);
      startTransition(() => {
        if (cancelled) {
          return;
        }
        setDeferredPreviewMetadataState({
          previewSnapshot,
          previewMetadataState,
        });
      });
    };
    const timer = window.setTimeout(() => {
      if (largeDocumentMode && "requestIdleCallback" in window) {
        idleHandle = window.requestIdleCallback(deriveMetadataState, {
          timeout: LARGE_DOCUMENT_METADATA_IDLE_TIMEOUT_MS,
        });
        return;
      }

      deriveMetadataState();
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (idleHandle !== null) {
        window.cancelIdleCallback(idleHandle);
      }
    };
  }, [activeFileId, activeText, activeViewMode, hasActiveFile, largeDocumentMode]);

  useEffect(() => {
    if (!hasActiveFile) {
      setDeferredDocumentMetricsState({
        approximateTokenCount: 0,
        previewSnapshot: EMPTY_PREVIEW_TEXT_SNAPSHOT,
        wordCount: 0,
      });
      return;
    }

    const delayMs = getWordCountDerivationDelayMs({
      largeDocumentMode,
      textLength: activeText.length,
      viewMode: activeViewMode,
    });
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const previewSnapshot = createActiveDocumentPreviewTextSnapshot({ id: activeFileId }, activeText);
      const approximateTokenCount = getApproximateTokenCount(activeText);
      const wordCount = getMarkdownWordCount(activeText);
      startTransition(() => {
        if (cancelled) {
          return;
        }
        setDeferredDocumentMetricsState({
          approximateTokenCount,
          previewSnapshot,
          wordCount,
        });
      });
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeFileId, activeText, activeViewMode, hasActiveFile, largeDocumentMode]);

  const editorState = useMemo(
    () => createActiveDocumentEditorRuntime(activeFile, {
      approximateTokenCount,
      text: activeText,
      wordCount,
    }),
    [
      activeFile?.bookmarks,
      activeFile?.lineNumbers,
      activeFile?.lineWrapping,
      activeFile?.readingWidth,
      activeFile?.splitRatio,
      activeText,
      activeFile?.title,
      activeFile?.viewMode,
      approximateTokenCount,
      wordCount,
    ],
  );

  return useMemo(
    () => ({
      ...editorState,
      ...previewState,
      previewBodyTextChange,
    }),
    [editorState, previewBodyTextChange, previewState],
  );
};
