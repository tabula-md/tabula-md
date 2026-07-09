import { useCallback, type RefObject } from "react";
import type { DocumentWorkbenchProps } from "../components/DocumentWorkbench";
import type { MarkdownEditorHandle } from "../markdownEditorTypes";
import type { MarkdownFormatCommand } from "@tabula-md/tabula";
import type { CenterPopover, TopPopover } from "../uiTypes";
import type {
  FileComment,
  FileViewMode,
  ReadingWidth,
} from "../workspaceStorage";

type ValueUpdater<T> = T | ((currentValue: T) => T);

type SetUiValue<T> = (nextValue: ValueUpdater<T>) => void;

type DocumentWorkbenchRuntimeHandlers = Pick<
  DocumentWorkbenchProps,
  | "onCloseSearch"
  | "onFormat"
  | "onOpenComments"
  | "onSetReadingWidth"
  | "onSetViewMode"
  | "onToggleLineNumbers"
  | "onToggleLineWrapping"
  | "onToggleSearch"
  | "onToggleSyncScrolling"
  | "onToggleViewOptions"
>;

type UseDocumentWorkbenchRuntimeArgs = {
  activeLineNumbers: boolean;
  activeLineWrapping: boolean;
  activeOpenComments: FileComment[];
  activeSyncScrolling: boolean;
  activeViewMode: FileViewMode;
  editorRef: RefObject<MarkdownEditorHandle | null>;
  focusedCommentId: string | null;
  onOpenCommentsPanel: (commentId?: string) => void;
  onSetActiveFileLineNumbers: (isEnabled: boolean) => void;
  onSetActiveFileLineWrapping: (isEnabled: boolean) => void;
  onSetActiveFileReadingWidth: (readingWidth: ReadingWidth) => void;
  onSetActiveFileViewMode: (viewMode: FileViewMode) => void;
  onSetSyncScrolling: (isEnabled: boolean) => void;
  setCenterPopover: SetUiValue<CenterPopover>;
  setSearchOpen: SetUiValue<boolean>;
  setTopPopover: SetUiValue<TopPopover>;
};

export function useDocumentWorkbenchRuntime({
  activeLineNumbers,
  activeLineWrapping,
  activeOpenComments,
  activeSyncScrolling,
  activeViewMode,
  editorRef,
  focusedCommentId,
  onOpenCommentsPanel,
  onSetActiveFileLineNumbers,
  onSetActiveFileLineWrapping,
  onSetActiveFileReadingWidth,
  onSetActiveFileViewMode,
  onSetSyncScrolling,
  setCenterPopover,
  setSearchOpen,
  setTopPopover,
}: UseDocumentWorkbenchRuntimeArgs): DocumentWorkbenchRuntimeHandlers {
  const closeCenterPopover = useCallback(() => {
    setCenterPopover(null);
  }, [setCenterPopover]);

  const closeFloatingDocumentChrome = useCallback(() => {
    setTopPopover(null);
    setCenterPopover(null);
  }, [setCenterPopover, setTopPopover]);

  const onCloseSearch = useCallback(() => {
    setSearchOpen(false);
  }, [setSearchOpen]);

  const onFormat = useCallback(
    (command: MarkdownFormatCommand) => {
      if (activeViewMode === "preview") {
        return;
      }

      closeFloatingDocumentChrome();
      editorRef.current?.format(command);
    },
    [activeViewMode, closeFloatingDocumentChrome, editorRef],
  );

  const onOpenComments = useCallback(() => {
    onOpenCommentsPanel(focusedCommentId ?? activeOpenComments[0]?.id);
  }, [activeOpenComments, focusedCommentId, onOpenCommentsPanel]);

  const onSetReadingWidth = useCallback(
    (nextReadingWidth: ReadingWidth) => {
      onSetActiveFileReadingWidth(nextReadingWidth);
      closeCenterPopover();
    },
    [closeCenterPopover, onSetActiveFileReadingWidth],
  );

  const onSetViewMode = useCallback(
    (nextViewMode: FileViewMode) => {
      onSetActiveFileViewMode(nextViewMode);
      closeCenterPopover();
    },
    [closeCenterPopover, onSetActiveFileViewMode],
  );

  const onToggleLineNumbers = useCallback(() => {
    onSetActiveFileLineNumbers(!activeLineNumbers);
    closeCenterPopover();
  }, [activeLineNumbers, closeCenterPopover, onSetActiveFileLineNumbers]);

  const onToggleLineWrapping = useCallback(() => {
    onSetActiveFileLineWrapping(!activeLineWrapping);
    closeCenterPopover();
  }, [activeLineWrapping, closeCenterPopover, onSetActiveFileLineWrapping]);

  const onToggleSyncScrolling = useCallback(() => {
    onSetSyncScrolling(!activeSyncScrolling);
    closeCenterPopover();
  }, [activeSyncScrolling, closeCenterPopover, onSetSyncScrolling]);

  const onToggleSearch = useCallback(() => {
    setSearchOpen((current) => !current);
    closeFloatingDocumentChrome();
  }, [closeFloatingDocumentChrome, setSearchOpen]);

  const onToggleViewOptions = useCallback(() => {
    setCenterPopover((current) => (current === "view" ? null : "view"));
    setTopPopover(null);
  }, [setCenterPopover, setTopPopover]);

  return {
    onCloseSearch,
    onFormat,
    onOpenComments,
    onSetReadingWidth,
    onSetViewMode,
    onToggleLineNumbers,
    onToggleLineWrapping,
    onToggleSearch,
    onToggleSyncScrolling,
    onToggleViewOptions,
  };
}
